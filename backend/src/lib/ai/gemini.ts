import { config } from '../../config/env';

export class GeminiError extends Error {
  status: number;
  statusCode: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.statusCode = status;
  }
}

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args?: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

type GeminiContent = { role?: 'user' | 'model'; parts: GeminiPart[] };

type GeminiTool = {
  function_declarations: Array<{
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  }>;
};

type GenerateContentResponse = {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
  }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error?: any;
};

function abortAfter(ms: number): AbortSignal {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (t as any).unref?.();
  return controller.signal;
}

function requireGeminiConfig() {
  if (config.ai.provider !== 'gemini') {
    throw new GeminiError(`Unsupported AI provider: ${config.ai.provider}`, 500);
  }
  const { apiKey, baseUrl, model, fallbackModel, requestTimeoutMs } = config.ai.gemini;
  if (!apiKey) throw new GeminiError('Missing GEMINI_API_KEY (or GOOGLE_API_KEY) in server env', 500);
  return { apiKey, baseUrl, model, fallbackModel, requestTimeoutMs };
}

export type GeminiToolDeclaration = GeminiTool;
export type GeminiChatTurn = GeminiContent;

async function generateContentOnce(args: {
  apiKey: string;
  baseUrl: string;
  model: string;
  requestTimeoutMs: number;
  systemInstruction?: string;
  contents: GeminiChatTurn[];
  tools?: GeminiToolDeclaration[];
}) {
  const startedAt = Date.now();
  const res = await fetch(
    `${args.baseUrl}/v1beta/models/${encodeURIComponent(args.model)}:generateContent?key=${encodeURIComponent(
      args.apiKey
    )}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: args.systemInstruction ? { parts: [{ text: args.systemInstruction }] } : undefined,
        contents: args.contents,
        tools: args.tools,
        generationConfig: {
          maxOutputTokens: config.ai.gemini.maxOutputTokens,
        },
      }),
      signal: abortAfter(Number.isFinite(args.requestTimeoutMs) ? args.requestTimeoutMs : 15000),
    }
  );
  const json = (await res.json().catch(() => null)) as GenerateContentResponse | null;
  return { res, json, elapsedMs: Date.now() - startedAt };
}

export async function generateContent(args: {
  model?: string;
  systemInstruction?: string;
  contents: GeminiChatTurn[];
  tools?: GeminiToolDeclaration[];
}): Promise<{ text: string; functionCalls: Array<{ name: string; args: Record<string, unknown> }> }> {
  const { apiKey, baseUrl, model, fallbackModel, requestTimeoutMs } = requireGeminiConfig();
  const effectiveModel = args.model || model;

  let { res, json, elapsedMs } = await generateContentOnce({
    apiKey,
    baseUrl,
    model: effectiveModel,
    requestTimeoutMs,
    systemInstruction: args.systemInstruction,
    contents: args.contents,
    tools: args.tools,
  });

  const errorMessage = typeof json?.error?.message === 'string' ? json.error.message : '';
  const modelUnsupported =
    !res.ok &&
    (res.status === 400 || res.status === 404) &&
    (errorMessage.includes('is not found for API version') || errorMessage.includes('not supported for generateContent'));
  if (modelUnsupported && !args.model && fallbackModel && effectiveModel !== fallbackModel) {
    ({ res, json, elapsedMs } = await generateContentOnce({
      apiKey,
      baseUrl,
      model: fallbackModel,
      requestTimeoutMs,
      systemInstruction: args.systemInstruction,
      contents: args.contents,
      tools: args.tools,
    }));
  }
  if (!res.ok) {
    const msg = json?.error?.message || `Gemini request failed with status ${res.status}`;
    throw new GeminiError(msg, res.status);
  }

  const parts = json?.candidates?.[0]?.content?.parts || [];
  let text = '';
  const functionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

  for (const part of parts) {
    if ('text' in part && typeof part.text === 'string') {
      text += part.text;
    }
    if ('functionCall' in part && part.functionCall?.name) {
      functionCalls.push({
        name: part.functionCall.name,
        args: (part.functionCall.args || {}) as Record<string, unknown>,
      });
    }
  }

  return { text: text.trim(), functionCalls };
}

