import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../types';

const router = Router();

function logProfileApi(method: string, path: string, userId?: string, success?: boolean, error?: string) {
  const msg = userId
    ? `[API] ${method} ${path} user_id=${userId} ${success ? 'OK' : `FAIL: ${error}`}`
    : `[API] ${method} ${path} ${success === false ? `FAIL: ${error}` : ''}`;
  console.log(msg, { timestamp: new Date().toISOString() });
}

/**
 * POST /api/profiles/upgrade-landlord
 *
 * Ensures a public.profiles row exists for the user and sets is_landlord=true.
 * Uses service role (supabaseAdmin), so it works even if the profile row is missing.
 *
 * Auth model note:
 * - For MVP consistency with existing endpoints, this expects user_id via X-User-Id header
 *   (or ?user_id= query param). It does not validate a JWT.
 */
router.post<
  unknown,
  ApiResponse<{ id: string; email: string | null; is_landlord: boolean }> | ApiResponse
>(
  '/upgrade-landlord',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.headers['x-user-id'] as string) || (req.query.user_id as string);

    if (!userId) {
      logProfileApi('POST', '/api/profiles/upgrade-landlord', undefined, false, 'Missing user_id');
      res.status(400).json({ success: false, error: 'Missing user_id (X-User-Id header or user_id query param)' });
      return;
    }

    const {
      data: { user },
      error: userErr,
    } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (userErr || !user) {
      logProfileApi('POST', '/api/profiles/upgrade-landlord', userId, false, userErr?.message || 'User not found');
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const email = user.email ?? null;

    // Upsert profile row. This backfills users created before the trigger existed.
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: userId,
          email: email ?? `user_${userId}@example.invalid`,
          is_landlord: true,
        },
        { onConflict: 'id' }
      )
      .select('id, email, is_landlord')
      .single();

    if (error || !data) {
      logProfileApi('POST', '/api/profiles/upgrade-landlord', userId, false, error?.message || 'Unknown error');
      res.status(500).json({ success: false, error: 'Failed to upgrade to landlord' });
      return;
    }

    logProfileApi('POST', '/api/profiles/upgrade-landlord', userId, true);
    res.json({ success: true, data });
  })
);

export default router;

