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
  email: string | null;
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
 * Returns minimal public landlord info (email and role flags) for a given listing.
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
      .select('id, email, is_landlord, created_at, username, first_name, last_name, description, profile_picture_url')
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
      email: (profile as any).email ?? null,
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

export default router;

