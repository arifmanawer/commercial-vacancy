import { Router, Request, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../types';

const router = Router();

interface PublicListingSummary {
  id: string;
  title: string | null;
  city: string | null;
  state: string | null;
  property_type: string | null;
  status: string | null;
  created_at: string | null;
}

interface LandlordPublicProfileResponse {
  id: string;
  name: string;
  profile_picture_url: string | null;
  message_enabled: boolean;
  current_listings: PublicListingSummary[];
  reviews: {
    implemented: boolean;
    message: string;
    items: unknown[];
  };
}

function logProfileApi(method: string, path: string, userId?: string, success?: boolean, error?: string) {
  const msg = userId
    ? `[API] ${method} ${path} user_id=${userId} ${success ? 'OK' : `FAIL: ${error}`}`
    : `[API] ${method} ${path} ${success === false ? `FAIL: ${error}` : ''}`;
  console.log(msg, { timestamp: new Date().toISOString() });
}

/**
 * GET /api/profiles/public/:landlordId
 *
 * Public landlord profile for renters. Eligible if `is_landlord` is true or the
 * user owns at least one listing (covers hosts who list without the role flag).
 */
router.get<
  { landlordId: string },
  ApiResponse<LandlordPublicProfileResponse> | ApiResponse
>(
  '/public/:landlordId',
  asyncHandler(async (req: Request<{ landlordId: string }>, res: Response) => {
    const { landlordId } = req.params;

    if (!landlordId) {
      logProfileApi('GET', '/api/profiles/public/:landlordId', undefined, false, 'Missing landlordId');
      res.status(400).json({ success: false, error: 'Missing landlordId' });
      return;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, is_landlord, username, first_name, last_name, profile_picture_url')
      .eq('id', landlordId)
      .maybeSingle();

    if (profileError) {
      logProfileApi('GET', '/api/profiles/public/:landlordId', landlordId, false, profileError.message);
      res.status(500).json({ success: false, error: 'Failed to load landlord profile' });
      return;
    }

    if (!profile) {
      logProfileApi('GET', '/api/profiles/public/:landlordId', landlordId, false, 'Profile not found');
      res.status(404).json({ success: false, error: 'Landlord profile not found' });
      return;
    }

    const isLandlordRole = Boolean((profile as any).is_landlord);

    const { count: listingCount, error: countError } = await supabaseAdmin
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', landlordId);

    if (countError) {
      logProfileApi('GET', '/api/profiles/public/:landlordId', landlordId, false, countError.message);
      res.status(500).json({ success: false, error: 'Failed to verify landlord listings' });
      return;
    }

    const hasListings = (listingCount ?? 0) > 0;

    if (!isLandlordRole && !hasListings) {
      logProfileApi('GET', '/api/profiles/public/:landlordId', landlordId, false, 'Not a landlord or host');
      res.status(404).json({ success: false, error: 'Landlord profile not found' });
      return;
    }

    const { data: listings, error: listingsError } = await supabaseAdmin
      .from('listings')
      .select('id, title, city, state, property_type, status, created_at')
      .eq('user_id', landlordId)
      .eq('status', 'Available')
      .order('created_at', { ascending: false });

    if (listingsError) {
      logProfileApi('GET', '/api/profiles/public/:landlordId', landlordId, false, listingsError.message);
      res.status(500).json({ success: false, error: 'Failed to load landlord listings' });
      return;
    }

    const firstName = (profile as any).first_name?.trim?.() || '';
    const lastName = (profile as any).last_name?.trim?.() || '';
    const username = (profile as any).username?.trim?.() || '';
    const displayName =
      [firstName, lastName].filter(Boolean).join(' ').trim() ||
      username ||
      'Landlord';

    const currentListings: PublicListingSummary[] = ((listings ?? []) as any[]).map((listing) => ({
      id: listing.id ?? '',
      title: listing.title ?? null,
      city: listing.city ?? null,
      state: listing.state ?? null,
      property_type: listing.property_type ?? null,
      status: listing.status ?? null,
      created_at: listing.created_at ?? null,
    }));

    const payload: LandlordPublicProfileResponse = {
      id: (profile as any).id,
      name: displayName,
      profile_picture_url: (profile as any).profile_picture_url ?? null,
      message_enabled: true,
      current_listings: currentListings,
      reviews: {
        implemented: false,
        message: 'No reviews yet.',
        items: [],
      },
    };

    logProfileApi('GET', '/api/profiles/public/:landlordId', landlordId, true);
    res.json({ success: true, data: payload });
  })
);

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

