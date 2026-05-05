import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import type { User } from '@supabase/supabase-js';

function readBearerToken(req: Request): string | null {
  const raw = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
  if (!raw) return null;
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m?.[1]?.trim() || null;
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = readBearerToken(req);
  if (!token) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  const user: User | null = data?.user ?? null;

  if (error || !user?.id) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  req.user = { id: user.id };
  next();
};

export const getAuthUserId = (req: Request) => req.user?.id;

