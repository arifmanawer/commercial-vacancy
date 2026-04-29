import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../types';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { generateContent } from '../lib/ai/gemini';
import { GeminiError } from '../lib/ai/gemini';
import {
  tool_checkAvailability,
  tool_getListing,
  tool_searchListings,
} from '../lib/assistant/tools';
import { createRateLimiter } from '../middleware/rateLimit';
import { config } from '../config/env';

const router = Router();

// Global request caps aligned with Gemini 2.5 Flash-Lite free tier.
const assistantGlobalMinuteRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: config.assistant.rpmLimit,
  key: () => 'assistant_global_minute',
});

const assistantGlobalDailyRateLimit = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  max: config.assistant.rpdLimit,
  key: () => 'assistant_global_day',
});

// Per-user/IP limiter to reduce abuse from a single actor.
const assistantPerUserRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: config.assistant.perUserRpmLimit,
  key: (req) => {
    const userId = (req.headers['x-user-id'] as string) || '';
    if (userId) return `user:${userId}`;
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    return `ip:${ip}`;
  },
});

function getUserId(req: Request): string | null {
  const headerId = req.headers['x-user-id'];
  const queryId = req.query.user_id;
  const id = (headerId as string) || (queryId as string) || '';
  return id || null;
}

type Persona = 'renter' | 'landlord' | 'contractor';

async function resolvePersona(userId: string): Promise<Persona> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('is_landlord, is_contractor')
    .eq('id', userId)
    .maybeSingle();

  const isLandlord = Boolean((data as any)?.is_landlord);
  const isContractor = Boolean((data as any)?.is_contractor);
  if (isContractor) return 'contractor';
  if (isLandlord) return 'landlord';
  return 'renter';
}

function toolDeclarations() {
  return [
    {
      function_declarations: [
        {
          name: 'searchListings',
          description:
            'Search available listings with optional filters (city/state/propertyType/rateType/price range). Returns listing cards.',
          parameters: {
            type: 'object',
            properties: {
              q: { type: 'string', description: 'Optional free-text query' },
              city: { type: 'string' },
              state: { type: 'string' },
              propertyType: { type: 'string' },
              rateType: { type: 'string', description: 'hourly|daily|weekly|monthly' },
              minRate: { type: 'number' },
              maxRate: { type: 'number' },
              limit: { type: 'number', description: '1-20' },
            },
          },
        },
        {
          name: 'getListing',
          description: 'Get one listing by id (allowlisted fields only).',
          parameters: {
            type: 'object',
            properties: {
              listingId: { type: 'string' },
            },
            required: ['listingId'],
          },
        },
        {
          name: 'checkAvailability',
          description:
            'Check whether a listing is available for a start/end time window based on existing bookings.',
          parameters: {
            type: 'object',
            properties: {
              listingId: { type: 'string' },
              start: { type: 'string', description: 'ISO datetime' },
              end: { type: 'string', description: 'ISO datetime' },
            },
            required: ['listingId', 'start', 'end'],
          },
        },
      ],
    },
  ];
}

async function runTool(name: string, args: Record<string, unknown>) {
  const start = Date.now();
  let result:
    | { ok: true; data: unknown }
    | { ok: false; error: string };
  switch (name) {
    case 'searchListings':
      result = await tool_searchListings(args);
      break;
    case 'getListing':
      result = await tool_getListing(args);
      break;
    case 'checkAvailability':
      result = await tool_checkAvailability(args);
      break;
    default:
      result = { ok: false as const, error: `Unknown tool: ${name}` };
  }

  const durationMs = Date.now() - start;
  console.log('[assistant_tool]', { name, ok: result.ok, durationMs });
  return result;
}

function systemInstruction(persona: Persona) {
  return [
    'You are Commercial Vacancy Assistant.',
    'You are a read-only assistant: do not claim you booked anything or changed data.',
    'When you need listings or availability, call the provided tools instead of guessing.',
    'Only use tool results provided; do not invent listing IDs or prices.',
    'If the user asks for private data you do not have, explain what you can do.',
    `The current user persona is: ${persona}. Tailor answers accordingly.`,
    'Keep answers concise and actionable. Prefer bullet points.',
  ].join('\n');
}

type ChatRequestBody = {
  message: string;
  contextType?: 'listing' | 'contractor' | 'general';
  listingId?: string;
  contractorId?: string;
};

type AssistantResponse = {
  reply: string;
  cards?: {
    listings?: any[];
  };
};

router.post<{}, ApiResponse<AssistantResponse> | ApiResponse, ChatRequestBody>(
  '/chat',
  assistantGlobalDailyRateLimit,
  assistantGlobalMinuteRateLimit,
  assistantPerUserRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const message = (req.body?.message || '').trim();

    if (!userId) {
      res.status(400).json({ success: false, error: 'Missing user_id (X-User-Id header)' });
      return;
    }
    if (!message) {
      res.status(400).json({ success: false, error: 'message is required' });
      return;
    }
    if (message.length > config.assistant.maxMessageChars) {
      res.status(400).json({
        success: false,
        error: `Message too long. Max ${config.assistant.maxMessageChars} characters.`,
      });
      return;
    }

    const persona = await resolvePersona(userId);

    // Minimal conversation state for a single request. Frontend can send prior turns later.
    const contents: any[] = [{ role: 'user', parts: [{ text: message }] }];

    const tools = toolDeclarations();
    const sys = systemInstruction(persona);

    // Single-call design (quota-friendly):
    // 1 Gemini call to decide tool calls + optional draft text.
    // Then we run tools and produce a deterministic reply template without making another Gemini call.
    let finalText = '';
    const cards: AssistantResponse['cards'] = {};

    let gen;
    try {
      gen = await generateContent({
        systemInstruction: sys,
        contents,
        tools,
      });
    } catch (err) {
      // Quota/rate-limit handling (e.g. free tier exhausted)
      const status =
        err instanceof GeminiError
          ? err.status
          : typeof (err as any)?.status === 'number'
            ? (err as any).status
            : typeof (err as any)?.statusCode === 'number'
              ? (err as any).statusCode
              : 500;

      if (status === 429 || status === 403) {
        res.status(429).json({
          success: false,
          error:
            'Gemini free tier rate limit/quota reached. Please wait a bit, or upgrade your quota/billing in Google AI Studio.',
        });
        return;
      }

      throw err;
    }

    const { text, functionCalls } = gen;
    if (text) finalText = text;

    // Run any tool calls and craft a deterministic reply from results.
    if (functionCalls.length) {
      const lines: string[] = [];

      for (const call of functionCalls) {
        const result = await runTool(call.name, call.args || {});

        if (!result.ok) {
          lines.push(`- ${call.name}: ${result.error}`);
          continue;
        }

        if (call.name === 'searchListings') {
          const listings = (result.data as any)?.listings;
          if (Array.isArray(listings)) {
            cards.listings = listings;
            lines.push(`- Found ${listings.length} available listing(s).`);
            lines.push(`- Open one to see details, or tell me your budget + dates to check availability.`);
          }
        } else if (call.name === 'getListing') {
          const listing = (result.data as any)?.listing;
          if (listing) {
            cards.listings = [listing];
            lines.push(`- Loaded the listing details. Ask about pricing, duration limits, or availability dates.`);
          }
        } else if (call.name === 'checkAvailability') {
          const available = Boolean((result.data as any)?.available);
          const conflicts = Array.isArray((result.data as any)?.conflicts)
            ? ((result.data as any).conflicts as any[])
            : [];
          if (available) {
            lines.push(`- This time window looks available based on current bookings.`);
          } else {
            lines.push(`- This time window conflicts with ${conflicts.length} existing booking(s). Try different dates.`);
          }
        }
      }

      finalText = lines.length ? lines.join('\n') : finalText;
    }

    res.json({
      success: true,
      data: {
        reply: finalText || 'How can I help?',
        cards,
      },
    });
  })
);

export default router;

