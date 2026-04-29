import dotenv from 'dotenv';
import path from 'path';

// Load backend-local .env first, then repo-root .env as fallback.
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL || '',
  ai: {
    provider: (process.env.AI_PROVIDER || 'gemini').toLowerCase(),
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
      baseUrl: (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(
        /\/+$/,
        ''
      ),
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
      fallbackModel: process.env.GEMINI_FALLBACK_MODEL || '',
      requestTimeoutMs: Number.parseInt(process.env.GEMINI_TIMEOUT_MS || '15000', 10),
      maxOutputTokens: Number.parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '300', 10),
    },
  },
  assistant: {
    rpmLimit: Number.parseInt(process.env.ASSISTANT_RPM_LIMIT || '15', 10),
    rpdLimit: Number.parseInt(process.env.ASSISTANT_RPD_LIMIT || '1000', 10),
    perUserRpmLimit: Number.parseInt(process.env.ASSISTANT_PER_USER_RPM_LIMIT || '10', 10),
    maxMessageChars: Number.parseInt(process.env.ASSISTANT_MAX_MESSAGE_CHARS || '2000', 10),
  },
};

