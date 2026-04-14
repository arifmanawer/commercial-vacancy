import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../types';

const router = Router();

interface ListingRow {
  id: string;
  user_id: string;
}

interface LandlordPublicInfo {
  id: string;
  is_landlord: boolean;
  created_at: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  description: string | null;
  profile_picture_url: string | null;
}

function logListingApi(
  method: string,
  path: string,
  listingId?: string,
  success?: boolean,
  error?: string
) {
  const msg = listingId
    ? `[API] ${method} ${path} listing_id=${listingId} ${success ? 'OK' : `FAIL: ${error}`}`
    : `[API] ${method} ${path} ${success === false ? `FAIL: ${error}` : ''}`;
  console.log(msg, { timestamp: new Date().toISOString() });
}

/**
 * GET /api/listings/:id/landlord
 *
 * Returns minimal public landlord info (no email) for a given listing.
 * Uses the Supabase service role and does not require authentication.
 */
router.get<
  { id: string },
  ApiResponse<LandlordPublicInfo> | ApiResponse
>(
  '/:id/landlord',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;

    if (!id) {
      logListingApi('GET', '/api/listings/:id/landlord', undefined, false, 'Missing id');
      res.status(400).json({ success: false, error: 'Missing listing id' });
      return;
    }

    // Look up the listing to find its owner (user_id)
    const {
      data: listing,
      error: listingError,
    } = await supabaseAdmin
      .from('listings')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (listingError) {
      logListingApi('GET', '/api/listings/:id/landlord', id, false, listingError.message);
      res.status(500).json({ success: false, error: 'Failed to load listing' });
      return;
    }

    if (!listing) {
      logListingApi('GET', '/api/listings/:id/landlord', id, false, 'Listing not found');
      res.status(404).json({ success: false, error: 'Listing not found' });
      return;
    }

    // Fetch landlord profile from public.profiles
    const {
      data: profile,
      error: profileError,
    } = await supabaseAdmin
      .from('profiles')
      .select('id, is_landlord, created_at, username, first_name, last_name, description, profile_picture_url')
      .eq('id', listing.user_id)
      .maybeSingle();

    if (profileError) {
      logListingApi('GET', '/api/listings/:id/landlord', id, false, profileError.message);
      res.status(500).json({ success: false, error: 'Failed to load landlord profile' });
      return;
    }

    if (!profile) {
      logListingApi('GET', '/api/listings/:id/landlord', id, false, 'Landlord profile not found');
      res.status(404).json({ success: false, error: 'Landlord profile not found' });
      return;
    }

    const payload: LandlordPublicInfo = {
      id: profile.id as string,
      is_landlord: (profile as any).is_landlord ?? false,
      created_at: (profile as any).created_at ?? null,
      username: (profile as any).username ?? null,
      first_name: (profile as any).first_name ?? null,
      last_name: (profile as any).last_name ?? null,
      description: (profile as any).description ?? null,
      profile_picture_url: (profile as any).profile_picture_url ?? null,
    };

    logListingApi('GET', '/api/listings/:id/landlord', id, true);
    res.json({ success: true, data: payload });
  })
);

interface PublicListingSummary {
  id: string;
  title: string | null;
  city: string | null;
  state: string | null;
  property_type: string | null;
  status: string | null;
  created_at: string | null;
}

/**
 * GET /api/listings?user_id=:userId
 *
 * Returns all Available listings owned by the given user.
 * Used by the public landlord profile page.
 */
router.get<
  Record<string, never>,
  ApiResponse<PublicListingSummary[]> | ApiResponse
>(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.user_id as string | undefined;

    if (!userId) {
      res.status(400).json({ success: false, error: 'user_id query param is required' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('listings')
      .select('id, title, city, state, property_type, status, created_at')
      .eq('user_id', userId)
      .eq('status', 'Available')
      .order('created_at', { ascending: false });

    if (error) {
      logListingApi('GET', '/api/listings', undefined, false, error.message);
      res.status(500).json({ success: false, error: 'Failed to load listings' });
      return;
    }

    const listings: PublicListingSummary[] = ((data ?? []) as any[]).map((l) => ({
      id: l.id,
      title: l.title ?? null,
      city: l.city ?? null,
      state: l.state ?? null,
      property_type: l.property_type ?? null,
      status: l.status ?? null,
      created_at: l.created_at ?? null,
    }));

    logListingApi('GET', '/api/listings', undefined, true);
    res.json({ success: true, data: listings });
  })
);

export default router;

