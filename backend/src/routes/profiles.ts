import { Router, Request, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../types';

const router = Router();

interface ReviewRow {
  id: string;
  target_user_id: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_avatar: string | null;
  role_context: 'landlord' | 'contractor' | 'renter';
  rating: number;
  content: string;
  created_at: string;
}

function logProfileApi(method: string, path: string, userId?: string, success?: boolean, error?: string) {
  const msg = userId
    ? `[API] ${method} ${path} user_id=${userId} ${success ? 'OK' : `FAIL: ${error}`}`
    : `[API] ${method} ${path} ${success === false ? `FAIL: ${error}` : ''}`;
  console.log(msg, { timestamp: new Date().toISOString() });
}


/**
 * GET /api/profiles/me
 *
 * Returns the full profile for the current user, including common fields
 * shared across all roles.
 */
router.get<
  ParamsDictionary,
  ApiResponse<{
    id: string;
    email: string | null;
    is_landlord: boolean;
    is_contractor: boolean;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    address: string | null;
    description: string | null;
    profile_picture_url: string | null;
  }> | ApiResponse
>(
  '/me',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.headers['x-user-id'] as string) || (req.query.user_id as string);

    if (!userId) {
      logProfileApi('GET', '/api/profiles/me', undefined, false, 'Missing user_id');
      res.status(400).json({ success: false, error: 'Missing user_id (X-User-Id header or user_id query param)' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(
        'id, email, is_landlord, is_contractor, username, first_name, last_name, address, description, profile_picture_url'
      )
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      logProfileApi('GET', '/api/profiles/me', userId, false, error.message);
      res.status(500).json({ success: false, error: 'Failed to load profile' });
      return;
    }

    if (!data) {
      logProfileApi('GET', '/api/profiles/me', userId, false, 'Profile not found');
      res.status(404).json({ success: false, error: 'Profile not found' });
      return;
    }

    logProfileApi('GET', '/api/profiles/me', userId, true);
    res.json({ success: true, data: data as any });
  })
);

/**
 * PATCH /api/profiles/me
 *
 * Updates common profile fields for the current user.
 * All fields are optional; only provided fields are updated.
 */
router.patch<
  ParamsDictionary,
  ApiResponse<{
    id: string;
    email: string | null;
    is_landlord: boolean;
    is_contractor: boolean;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    address: string | null;
    description: string | null;
    profile_picture_url: string | null;
  }> | ApiResponse
>(
  '/me',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.headers['x-user-id'] as string) || (req.query.user_id as string);

    if (!userId) {
      logProfileApi('PATCH', '/api/profiles/me', undefined, false, 'Missing user_id');
      res.status(400).json({ success: false, error: 'Missing user_id (X-User-Id header or user_id query param)' });
      return;
    }

    const {
      username,
      first_name,
      last_name,
      address,
      description,
      profile_picture_url,
    } = req.body as {
      username?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      address?: string | null;
      description?: string | null;
      profile_picture_url?: string | null;
    };

    const updates: Record<string, string | null | undefined> = {};

    if (typeof username !== 'undefined') updates.username = username;
    if (typeof first_name !== 'undefined') updates.first_name = first_name;
    if (typeof last_name !== 'undefined') updates.last_name = last_name;
    if (typeof address !== 'undefined') updates.address = address;
    if (typeof description !== 'undefined') updates.description = description;
    if (typeof profile_picture_url !== 'undefined') updates.profile_picture_url = profile_picture_url;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, error: 'No fields to update' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select(
        'id, email, is_landlord, is_contractor, username, first_name, last_name, address, description, profile_picture_url'
      )
      .single();

    if (error || !data) {
      logProfileApi('PATCH', '/api/profiles/me', userId, false, error?.message || 'Unknown error');
      res.status(500).json({ success: false, error: 'Failed to update profile' });
      return;
    }

    logProfileApi('PATCH', '/api/profiles/me', userId, true);
    res.json({ success: true, data: data as any });
  })
);

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
  ParamsDictionary,
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
      .select('id, email, is_landlord, is_contractor')
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

/**
 * POST /api/profiles/upgrade-contractor
 *
 * Sets is_contractor=true on the user's profile.
 */
router.post<
  ParamsDictionary,
  ApiResponse<{ id: string; email: string | null; is_landlord: boolean; is_contractor: boolean }> | ApiResponse
>(
  '/upgrade-contractor',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.headers['x-user-id'] as string) || (req.query.user_id as string);

    if (!userId) {
      logProfileApi('POST', '/api/profiles/upgrade-contractor', undefined, false, 'Missing user_id');
      res.status(400).json({ success: false, error: 'Missing user_id (X-User-Id header or user_id query param)' });
      return;
    }

    const {
      data: { user },
      error: userErr,
    } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (userErr || !user) {
      logProfileApi('POST', '/api/profiles/upgrade-contractor', userId, false, userErr?.message || 'User not found');
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const email = user.email ?? null;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: userId,
          email: email ?? `user_${userId}@example.invalid`,
          is_contractor: true,
        },
        { onConflict: 'id' }
      )
      .select('id, email, is_landlord, is_contractor')
      .single();

    if (error || !data) {
      logProfileApi('POST', '/api/profiles/upgrade-contractor', userId, false, error?.message || 'Unknown error');
      res.status(500).json({ success: false, error: 'Failed to upgrade to contractor' });
      return;
    }

    logProfileApi('POST', '/api/profiles/upgrade-contractor', userId, true);
    res.json({ success: true, data });
  })
);

/**
 * PATCH /api/profiles/roles
 *
 * Update is_landlord and is_contractor from role checklist.
 */
router.patch<
  ParamsDictionary,
  ApiResponse<{ id: string; email: string | null; is_landlord: boolean; is_contractor: boolean }> | ApiResponse
>(
  '/roles',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.headers['x-user-id'] as string) || (req.query.user_id as string);
    const { is_landlord, is_contractor } = req.body as { is_landlord?: boolean; is_contractor?: boolean };

    if (!userId) {
      logProfileApi('PATCH', '/api/profiles/roles', undefined, false, 'Missing user_id');
      res.status(400).json({ success: false, error: 'Missing user_id (X-User-Id header or user_id query param)' });
      return;
    }

    const {
      data: { user },
      error: userErr,
    } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (userErr || !user) {
      logProfileApi('PATCH', '/api/profiles/roles', userId, false, userErr?.message || 'User not found');
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const updates: { is_landlord?: boolean; is_contractor?: boolean } = {};
    if (typeof is_landlord === 'boolean') updates.is_landlord = is_landlord;
    if (typeof is_contractor === 'boolean') updates.is_contractor = is_contractor;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, error: 'Provide is_landlord and/or is_contractor in body' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('id, email, is_landlord, is_contractor')
      .single();

    if (error || !data) {
      logProfileApi('PATCH', '/api/profiles/roles', userId, false, error?.message || 'Unknown error');
      res.status(500).json({ success: false, error: 'Failed to update roles' });
      return;
    }

    logProfileApi('PATCH', '/api/profiles/roles', userId, true);
    res.json({ success: true, data });
  })
);

/**
 * GET /api/profiles/:targetUserId/reviews
 *
 * Returns all reviews written for the given user, ordered newest first.
 * Uses supabaseAdmin to bypass RLS — reviews are public data.
 */
router.get<
  { targetUserId: string },
  ApiResponse<ReviewRow[]> | ApiResponse
>(
  '/:targetUserId/reviews',
  asyncHandler(async (req: Request<{ targetUserId: string }>, res: Response) => {
    const { targetUserId } = req.params;

    if (!targetUserId) {
      res.status(400).json({ success: false, error: 'Missing targetUserId' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select('id, target_user_id, reviewer_id, reviewer_name, reviewer_avatar, role_context, rating, content, created_at')
      .eq('target_user_id', targetUserId)
      .order('created_at', { ascending: false });

    if (error) {
      logProfileApi('GET', `/api/profiles/${targetUserId}/reviews`, undefined, false, error.message);
      res.status(500).json({ success: false, error: 'Failed to load reviews' });
      return;
    }

    logProfileApi('GET', `/api/profiles/${targetUserId}/reviews`, undefined, true);
    res.json({ success: true, data: (data ?? []) as ReviewRow[] });
  })
);

/**
 * POST /api/profiles/:targetUserId/reviews
 *
 * Creates a new review for the given user.
 * Expects X-User-Id header for the reviewer's identity.
 * Validates: rating 1-5, non-empty content, cannot self-review, one per pair.
 */
router.post<
  { targetUserId: string },
  ApiResponse<ReviewRow> | ApiResponse
>(
  '/:targetUserId/reviews',
  asyncHandler(async (req: Request<{ targetUserId: string }>, res: Response) => {
    const { targetUserId } = req.params;
    const reviewerId = (req.headers['x-user-id'] as string) || (req.query.user_id as string);

    if (!reviewerId) {
      res.status(401).json({ success: false, error: 'Missing X-User-Id header' });
      return;
    }

    if (reviewerId === targetUserId) {
      res.status(400).json({ success: false, error: 'You cannot review your own profile' });
      return;
    }

    const { rating, role_context, content } = req.body as {
      rating?: number;
      role_context?: string;
      content?: string;
    };

    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
      return;
    }

    if (!role_context || !['landlord', 'contractor', 'renter'].includes(role_context)) {
      res.status(400).json({ success: false, error: 'Invalid role_context' });
      return;
    }

    if (!content || content.trim().length === 0) {
      res.status(400).json({ success: false, error: 'Review content cannot be empty' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('reviews')
      .insert({
        target_user_id: targetUserId,
        reviewer_id: reviewerId,
        role_context,
        rating,
        content: content.trim(),
      })
      .select('id, target_user_id, reviewer_id, reviewer_name, reviewer_avatar, role_context, rating, content, created_at')
      .single();

    if (error) {
      // Unique constraint violation → already reviewed
      if (error.code === '23505') {
        res.status(409).json({ success: false, error: 'You have already reviewed this user' });
        return;
      }
      logProfileApi('POST', `/api/profiles/${targetUserId}/reviews`, reviewerId, false, error.message);
      res.status(500).json({ success: false, error: 'Failed to submit review' });
      return;
    }

    logProfileApi('POST', `/api/profiles/${targetUserId}/reviews`, reviewerId, true);
    res.status(201).json({ success: true, data: data as ReviewRow });
  })
);

async function reviewerDisplayFromProfile(reviewerId: string): Promise<{
  reviewer_name: string;
  reviewer_avatar: string | null;
}> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('first_name, last_name, username, profile_picture_url')
    .eq('id', reviewerId)
    .maybeSingle();

  const fn = profile?.first_name ?? '';
  const ln = profile?.last_name ?? '';
  const combined = `${fn} ${ln}`.trim();
  const reviewer_name =
    combined ||
    profile?.username?.trim() ||
    'Verified User';

  return {
    reviewer_name,
    reviewer_avatar: profile?.profile_picture_url ?? null,
  };
}

/**
 * PATCH /api/profiles/:targetUserId/reviews
 *
 * Updates the signed-in user's existing review for this profile (one per reviewer/target pair).
 * Body: optional rating, role_context, content (all optional but at least one required).
 */
router.patch<
  { targetUserId: string },
  ApiResponse<ReviewRow> | ApiResponse
>(
  '/:targetUserId/reviews',
  asyncHandler(async (req: Request<{ targetUserId: string }>, res: Response) => {
    const { targetUserId } = req.params;
    const reviewerId = (req.headers['x-user-id'] as string) || (req.query.user_id as string);

    if (!reviewerId) {
      res.status(401).json({ success: false, error: 'Missing X-User-Id header' });
      return;
    }

    if (reviewerId === targetUserId) {
      res.status(400).json({ success: false, error: 'Invalid review target' });
      return;
    }

    const { rating, role_context, content } = req.body as {
      rating?: number;
      role_context?: string;
      content?: string;
    };

    if (
      rating === undefined &&
      role_context === undefined &&
      content === undefined
    ) {
      res.status(400).json({
        success: false,
        error: 'Provide at least one of: rating, role_context, content',
      });
      return;
    }

    const { data: existing, error: findErr } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .eq('target_user_id', targetUserId)
      .eq('reviewer_id', reviewerId)
      .maybeSingle();

    if (findErr) {
      logProfileApi(
        'PATCH',
        `/api/profiles/${targetUserId}/reviews`,
        reviewerId,
        false,
        findErr.message,
      );
      res.status(500).json({ success: false, error: 'Failed to load review' });
      return;
    }

    if (!existing) {
      res.status(404).json({ success: false, error: 'No review found to update' });
      return;
    }

    const updates: Partial<{
      rating: number;
      role_context: ReviewRow['role_context'];
      content: string;
      reviewer_name: string;
      reviewer_avatar: string | null;
    }> = {};

    if (rating !== undefined) {
      const r = Number(rating);
      if (!Number.isFinite(r) || r < 1 || r > 5) {
        res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
        return;
      }
      updates.rating = Math.round(r);
    }

    if (role_context !== undefined) {
      if (!['landlord', 'contractor', 'renter'].includes(role_context)) {
        res.status(400).json({ success: false, error: 'Invalid role_context' });
        return;
      }
      updates.role_context = role_context as ReviewRow['role_context'];
    }

    if (content !== undefined) {
      const trimmed = typeof content === 'string' ? content.trim() : '';
      if (!trimmed) {
        res.status(400).json({ success: false, error: 'Review content cannot be empty' });
        return;
      }
      updates.content = trimmed;
    }

    const display = await reviewerDisplayFromProfile(reviewerId);
    updates.reviewer_name = display.reviewer_name;
    updates.reviewer_avatar = display.reviewer_avatar;

    const { data, error } = await supabaseAdmin
      .from('reviews')
      .update(updates)
      .eq('id', existing.id)
      .select(
        'id, target_user_id, reviewer_id, reviewer_name, reviewer_avatar, role_context, rating, content, created_at',
      )
      .single();

    if (error || !data) {
      logProfileApi(
        'PATCH',
        `/api/profiles/${targetUserId}/reviews`,
        reviewerId,
        false,
        error?.message || 'Unknown error',
      );
      res.status(500).json({ success: false, error: 'Failed to update review' });
      return;
    }

    logProfileApi('PATCH', `/api/profiles/${targetUserId}/reviews`, reviewerId, true);
    res.json({ success: true, data: data as ReviewRow });
  })
);

/**
 * GET /api/profiles/public/:userId
 *
 * Returns a public user profile, bypassing RLS using the admin client.
 */
router.get<
  { userId: string },
  ApiResponse<{
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    profile_picture_url: string | null;
    description: string | null;
    created_at: string;
    is_landlord: boolean;
    is_contractor: boolean;
  }> | ApiResponse
>(
  '/public/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({ success: false, error: 'Missing userId parameter' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(
        'id, username, first_name, last_name, profile_picture_url, description, created_at, is_landlord, is_contractor'
      )
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      logProfileApi('GET', `/api/profiles/public/${userId}`, undefined, false, error.message);
      res.status(500).json({ success: false, error: 'Failed to load public profile' });
      return;
    }

    if (!data) {
      logProfileApi('GET', `/api/profiles/public/${userId}`, undefined, false, 'Profile not found');
      res.status(404).json({ success: false, error: 'Profile not found' });
      return;
    }

    logProfileApi('GET', `/api/profiles/public/${userId}`, undefined, true);
    res.json({ success: true, data: data as any });
  })
);

export default router;

