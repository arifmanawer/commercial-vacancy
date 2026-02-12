import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

function logApiRequest(method: string, path: string, userId?: string, success?: boolean, error?: string) {
  const msg = userId
    ? `[API] ${method} ${path} user_id=${userId} ${success ? 'OK' : `FAIL: ${error}`}`
    : `[API] ${method} ${path} ${success === false ? `FAIL: ${error}` : ''}`;
  console.log(msg, { timestamp: new Date().toISOString() });
}

/**
 * GET /api/users
 * Fetches user from Supabase by user_id (no JWT validation).
 * Pass user_id in X-User-Id header or ?user_id= query param.
 * Supabase stores and owns all user data - we simply look it up.
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.headers['x-user-id'] as string) || (req.query.user_id as string);

    if (!userId) {
      logApiRequest('GET', '/api/users', undefined, false, 'Missing user_id');
      res.status(400).json({ error: 'Missing user_id (X-User-Id header or user_id query param)' });
      return;
    }

    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (error) {
      logApiRequest('GET', '/api/users', userId, false, error.message);
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (!user) {
      logApiRequest('GET', '/api/users', userId, false, 'User not found');
      res.status(404).json({ error: 'User not found' });
      return;
    }

    logApiRequest('GET', '/api/users', userId, true);
    res.json({
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        user_metadata: user.user_metadata,
      },
    });
  })
);

export default router;
