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
};

