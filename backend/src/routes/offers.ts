import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../types';
import { requireStripe } from '../lib/stripe';
import { computeOfferAmounts } from '../lib/offerPricing';

const router = Router();

type OfferStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'cancelled'
  | 'countered';

type BookingStatus =
  | 'pending_payment'
  | 'reserved'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'refund_pending'
  | 'refund_completed'
  | 'payment_failed';

interface OfferRow {
  id: string;
  conversation_id: string;
  listing_id: string;
  landlord_id: string;
  renter_id: string;
  parent_offer_id: string | null;
  created_by: string;
  rate_type: string;
  rate_amount: number;
  currency: string;
  start_date: string;
  duration: number;
  subtotal_amount: number;
  platform_fee_amount: number;
  total_amount: number;
  status: OfferStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ListingRow {
  id: string;
  user_id: string;
  rate_type: string | null;
  rate_amount: number | null;
  min_duration: number | null;
  max_duration: number | null;
  currency: string | null;
}

interface ConversationRow {
  id: string;
  context_type: string;
  context_listing_id: string | null;
}

interface ConversationParticipantRow {
  conversation_id: string;
  user_id: string;
}

interface BookingRow {
  id: string;
  offer_id: string;
  listing_id: string;
  landlord_id: string;
  renter_id: string;
  start_datetime: string;
  end_datetime: string;
  status: BookingStatus;
  payment_intent_id: string | null;
  currency: string;
  total_amount: number;
  platform_fee_amount: number;
  landlord_amount: number;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  refund_amount: number | null;
  created_at: string;
  updated_at: string;
}

const OFFER_SELECT =
  'id, conversation_id, listing_id, landlord_id, renter_id, parent_offer_id, created_by, rate_type, rate_amount, currency, start_date, duration, subtotal_amount, platform_fee_amount, total_amount, status, notes, created_at, updated_at';

function logOffersApi(
  method: string,
  path: string,
  userId?: string,
  success?: boolean,
  error?: string
) {
  const msg = userId
    ? `[API] ${method} ${path} user_id=${userId} ${success ? 'OK' : `FAIL: ${error}`}`
    : `[API] ${method} ${path} ${success === false ? `FAIL: ${error}` : ''}`;
  console.log(msg, { timestamp: new Date().toISOString() });
}

function getUserId(req: Request): string | null {
  const headerId = req.headers['x-user-id'];
  const queryId = req.query.user_id;
  const id = (headerId as string) || (queryId as string) || '';
  return id || null;
}

async function loadListing(listingId: string): Promise<{ listing: ListingRow | null; error: string | null }> {
  const { data: listing, error: listingError } = await supabaseAdmin
    .from('listings')
    .select('id, user_id, rate_type, rate_amount, min_duration, max_duration, currency')
    .eq('id', listingId)
    .maybeSingle();

  if (listingError) {
    return { listing: null, error: listingError.message };
  }
  return { listing: listing as ListingRow | null, error: null };
}

function validateDurationAgainstListing(
  listing: ListingRow,
  duration: number
): { ok: true } | { ok: false; message: string } {
  if (
    listing.min_duration != null &&
    listing.max_duration != null &&
    listing.min_duration > listing.max_duration
  ) {
    return { ok: false, message: 'Listing has invalid duration configuration' };
  }
  if (listing.min_duration != null && duration < listing.min_duration) {
    return { ok: false, message: `Duration must be at least ${listing.min_duration}` };
  }
  if (listing.max_duration != null && duration > listing.max_duration) {
    return { ok: false, message: `Duration must be at most ${listing.max_duration}` };
  }
  return { ok: true };
}

async function assertListingConversation(
  conversationId: string,
  listingId: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const { data: conv, error } = await supabaseAdmin
    .from('conversations')
    .select('id, context_type, context_listing_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, message: 'Failed to load conversation' };
  }
  if (!conv) {
    return { ok: false, status: 404, message: 'Conversation not found' };
  }
  const c = conv as ConversationRow;
  if (c.context_type !== 'listing' || c.context_listing_id !== listingId) {
    return {
      ok: false,
      status: 400,
      message: 'Conversation must be a listing thread for this listing',
    };
  }
  return { ok: true };
}

async function conversationHasPendingOffer(conversationId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('offers')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('status', 'pending')
    .maybeSingle();
  return !!data;
}

async function loadParticipants(conversationId: string): Promise<Set<string>> {
  const { data: participants } = await supabaseAdmin
    .from('conversation_participants')
    .select('conversation_id, user_id')
    .eq('conversation_id', conversationId);
  return new Set((participants ?? []).map((p) => p.user_id));
}

/**
 * POST /api/offers
 *
 * Landlord or renter creates a new offer. At most one pending offer per conversation.
 */
router.post<
  {},
  ApiResponse<OfferRow> | ApiResponse,
  {
    conversationId: string;
    listingId: string;
    renterId?: string;
    startDate: string;
    duration: number;
    platformFeePercent?: number;
    rateAmount?: number;
    rateType?: string;
    notes?: string;
  }
>(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);

    if (!userId) {
      logOffersApi('POST', '/api/offers', undefined, false, 'Missing user_id');
      res.status(400).json({
        success: false,
        error: 'Missing user_id (X-User-Id header or user_id query param)',
      });
      return;
    }

    const {
      conversationId,
      listingId,
      renterId: renterIdBody,
      startDate,
      duration,
      platformFeePercent,
      rateAmount: rateAmountOverride,
      rateType: rateTypeOverride,
      notes,
    } = req.body;

    if (!conversationId || !listingId || !startDate || !duration) {
      res.status(400).json({
        success: false,
        error: 'conversationId, listingId, startDate, and duration are required',
      });
      return;
    }

    if (duration <= 0) {
      res.status(400).json({
        success: false,
        error: 'duration must be greater than zero',
      });
      return;
    }

    const convCheck = await assertListingConversation(conversationId, listingId);
    if (!convCheck.ok) {
      res.status(convCheck.status).json({ success: false, error: convCheck.message });
      return;
    }

    const { listing, error: listingErr } = await loadListing(listingId);
    if (listingErr) {
      logOffersApi('POST', '/api/offers', userId, false, listingErr);
      res.status(500).json({ success: false, error: 'Failed to load listing' });
      return;
    }
    if (!listing) {
      res.status(404).json({ success: false, error: 'Listing not found' });
      return;
    }

    const durCheck = validateDurationAgainstListing(listing, duration);
    if (!durCheck.ok) {
      res.status(400).json({ success: false, error: durCheck.message });
      return;
    }

    const participantIds = await loadParticipants(conversationId);
    if (!participantIds.has(userId)) {
      res.status(403).json({ success: false, error: 'You are not a participant in this conversation' });
      return;
    }

    const hasPending = await conversationHasPendingOffer(conversationId);
    if (hasPending) {
      res.status(409).json({
        success: false,
        error: 'This conversation already has a pending offer. Counter, reject, withdraw, or wait.',
      });
      return;
    }

    const isLandlord = listing.user_id === userId;
    let landlordId: string;
    let renterId: string;

    if (isLandlord) {
      const renterIdResolved = renterIdBody?.trim();
      if (!renterIdResolved) {
        res.status(400).json({ success: false, error: 'renterId is required when creating an offer as the landlord' });
        return;
      }
      if (!participantIds.has(renterIdResolved) || renterIdResolved === userId) {
        res.status(403).json({
          success: false,
          error: 'The renter must be another participant in this conversation',
        });
        return;
      }
      landlordId = userId;
      renterId = renterIdResolved;
    } else {
      landlordId = listing.user_id;
      renterId = userId;
      if (!participantIds.has(landlordId)) {
        res.status(403).json({
          success: false,
          error: 'The listing owner must be a participant in this conversation',
        });
        return;
      }
    }

    let rateType = listing.rate_type;
    let rateAmount = listing.rate_amount;
    if (rateTypeOverride != null && String(rateTypeOverride).trim()) {
      rateType = String(rateTypeOverride).trim();
    }
    if (rateAmountOverride != null) {
      const n = Number(rateAmountOverride);
      if (!Number.isFinite(n) || n <= 0) {
        res.status(400).json({ success: false, error: 'rateAmount must be a positive number when provided' });
        return;
      }
      rateAmount = n;
    }

    if (!rateType || rateAmount == null) {
      res.status(400).json({
        success: false,
        error: 'Listing is missing pricing information; provide rateType and rateAmount if negotiating custom terms',
      });
      return;
    }

    let amounts: { subtotal: number; platformFee: number; total: number };
    try {
      amounts = computeOfferAmounts({
        rateAmount: Number(rateAmount),
        duration,
        platformFeePercent,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invalid pricing';
      res.status(400).json({ success: false, error: msg });
      return;
    }

    const notesTrimmed = typeof notes === 'string' ? notes.trim() || null : null;

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('offers')
      .insert({
        conversation_id: conversationId,
        listing_id: listingId,
        landlord_id: landlordId,
        renter_id: renterId,
        parent_offer_id: null,
        created_by: userId,
        rate_type: rateType,
        rate_amount: Number(rateAmount),
        currency: listing.currency || 'usd',
        start_date: new Date(startDate).toISOString(),
        duration,
        subtotal_amount: amounts.subtotal,
        platform_fee_amount: amounts.platformFee,
        total_amount: amounts.total,
        notes: notesTrimmed,
      } as Partial<OfferRow>)
      .select(OFFER_SELECT)
      .single();

    if (insertError || !inserted) {
      const code = insertError?.code === '23505' ? 409 : 500;
      logOffersApi('POST', '/api/offers', userId, false, insertError?.message);
      res.status(code).json({
        success: false,
        error:
          code === 409
            ? 'A pending offer already exists for this conversation'
            : 'Failed to create offer',
      });
      return;
    }

    logOffersApi('POST', '/api/offers', userId, true);
    res.status(201).json({ success: true, data: inserted as OfferRow });
  })
);

/**
 * GET /api/offers/conversation/:conversationId
 *
 * Full offer history for a conversation (newest first).
 */
router.get<
  { conversationId: string },
  ApiResponse<OfferRow[]> | ApiResponse
>(
  '/conversation/:conversationId',
  asyncHandler(async (req: Request<{ conversationId: string }>, res: Response) => {
    const userId = getUserId(req);
    const { conversationId } = req.params;

    if (!userId) {
      logOffersApi('GET', '/api/offers/conversation/:id', undefined, false, 'Missing user_id');
      res.status(400).json({
        success: false,
        error: 'Missing user_id (X-User-Id header or user_id query param)',
      });
      return;
    }

    const { data: participantRow, error: participantError } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (participantError) {
      logOffersApi('GET', '/api/offers/conversation/:id', userId, false, participantError.message);
      res.status(500).json({ success: false, error: 'Failed to validate access' });
      return;
    }

    if (!participantRow) {
      res.status(403).json({ success: false, error: 'You are not a participant in this conversation' });
      return;
    }

    const { data: rows, error } = await supabaseAdmin
      .from('offers')
      .select(OFFER_SELECT)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false });

    if (error) {
      logOffersApi('GET', '/api/offers/conversation/:id', userId, false, error.message);
      res.status(500).json({ success: false, error: 'Failed to load offers' });
      return;
    }

    logOffersApi('GET', '/api/offers/conversation/:id', userId, true);
    res.json({ success: true, data: (rows ?? []) as OfferRow[] });
  })
);

/**
 * POST /api/offers/:id/counter
 *
 * Recipient of the current pending offer proposes new terms (prior offer becomes countered).
 */
router.post<
  { id: string },
  ApiResponse<OfferRow> | ApiResponse,
  {
    startDate: string;
    duration: number;
    platformFeePercent?: number;
    rateAmount?: number;
    rateType?: string;
    notes?: string;
  }
>(
  '/:id/counter',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const userId = getUserId(req);
    const { id: parentId } = req.params;
    const { startDate, duration, platformFeePercent, rateAmount: rateAmountOverride, rateType: rateTypeOverride, notes } =
      req.body;

    if (!userId) {
      logOffersApi('POST', '/api/offers/:id/counter', undefined, false, 'Missing user_id');
      res.status(400).json({
        success: false,
        error: 'Missing user_id (X-User-Id header or user_id query param)',
      });
      return;
    }

    if (!startDate || !duration) {
      res.status(400).json({ success: false, error: 'startDate and duration are required' });
      return;
    }
    if (duration <= 0) {
      res.status(400).json({ success: false, error: 'duration must be greater than zero' });
      return;
    }

    const { data: parent, error: parentError } = await supabaseAdmin
      .from('offers')
      .select(OFFER_SELECT)
      .eq('id', parentId)
      .maybeSingle();

    if (parentError) {
      logOffersApi('POST', '/api/offers/:id/counter', userId, false, parentError.message);
      res.status(500).json({ success: false, error: 'Failed to load offer' });
      return;
    }
    if (!parent) {
      res.status(404).json({ success: false, error: 'Offer not found' });
      return;
    }

    const p = parent as OfferRow;
    if (p.status !== 'pending') {
      res.status(409).json({ success: false, error: 'Only a pending offer can be countered' });
      return;
    }
    if (p.created_by === userId) {
      res.status(403).json({ success: false, error: 'Only the recipient can counter an offer' });
      return;
    }
    if (userId !== p.landlord_id && userId !== p.renter_id) {
      res.status(403).json({ success: false, error: 'You are not a party to this offer' });
      return;
    }

    const { listing, error: listingErr } = await loadListing(p.listing_id);
    if (listingErr || !listing) {
      res.status(500).json({ success: false, error: 'Failed to load listing' });
      return;
    }

    const durCheck = validateDurationAgainstListing(listing, duration);
    if (!durCheck.ok) {
      res.status(400).json({ success: false, error: durCheck.message });
      return;
    }

    let rateType = p.rate_type;
    let rateAmount = p.rate_amount;
    if (rateTypeOverride != null && String(rateTypeOverride).trim()) {
      rateType = String(rateTypeOverride).trim();
    }
    if (rateAmountOverride != null) {
      const n = Number(rateAmountOverride);
      if (!Number.isFinite(n) || n <= 0) {
        res.status(400).json({ success: false, error: 'rateAmount must be a positive number when provided' });
        return;
      }
      rateAmount = n;
    }

    let amounts: { subtotal: number; platformFee: number; total: number };
    try {
      amounts = computeOfferAmounts({
        rateAmount: Number(rateAmount),
        duration,
        platformFeePercent,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invalid pricing';
      res.status(400).json({ success: false, error: msg });
      return;
    }

    const { data: updatedParent, error: markCounteredError } = await supabaseAdmin
      .from('offers')
      .update({ status: 'countered' } as Partial<OfferRow>)
      .eq('id', parentId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (markCounteredError) {
      logOffersApi('POST', '/api/offers/:id/counter', userId, false, markCounteredError.message);
      res.status(500).json({ success: false, error: 'Failed to update prior offer' });
      return;
    }
    if (!updatedParent) {
      res.status(409).json({ success: false, error: 'Offer is no longer pending' });
      return;
    }

    const notesTrimmed = typeof notes === 'string' ? notes.trim() || null : null;

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('offers')
      .insert({
        conversation_id: p.conversation_id,
        listing_id: p.listing_id,
        landlord_id: p.landlord_id,
        renter_id: p.renter_id,
        parent_offer_id: parentId,
        created_by: userId,
        rate_type: rateType,
        rate_amount: Number(rateAmount),
        currency: p.currency,
        start_date: new Date(startDate).toISOString(),
        duration,
        subtotal_amount: amounts.subtotal,
        platform_fee_amount: amounts.platformFee,
        total_amount: amounts.total,
        notes: notesTrimmed,
      } as Partial<OfferRow>)
      .select(OFFER_SELECT)
      .single();

    if (insertError || !inserted) {
      logOffersApi('POST', '/api/offers/:id/counter', userId, false, insertError?.message);
      await supabaseAdmin
        .from('offers')
        .update({ status: 'pending' } as Partial<OfferRow>)
        .eq('id', parentId)
        .eq('status', 'countered');
      res.status(500).json({ success: false, error: 'Failed to create counter offer' });
      return;
    }

    logOffersApi('POST', '/api/offers/:id/counter', userId, true);
    res.status(201).json({ success: true, data: inserted as OfferRow });
  })
);

/**
 * POST /api/offers/:id/reject
 *
 * Recipient declines a pending offer.
 */
router.post<{ id: string }, ApiResponse<OfferRow> | ApiResponse>(
  '/:id/reject',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId) {
      logOffersApi('POST', '/api/offers/:id/reject', undefined, false, 'Missing user_id');
      res.status(400).json({
        success: false,
        error: 'Missing user_id (X-User-Id header or user_id query param)',
      });
      return;
    }

    const { data: offer, error } = await supabaseAdmin
      .from('offers')
      .select(OFFER_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logOffersApi('POST', '/api/offers/:id/reject', userId, false, error.message);
      res.status(500).json({ success: false, error: 'Failed to load offer' });
      return;
    }
    if (!offer) {
      res.status(404).json({ success: false, error: 'Offer not found' });
      return;
    }

    const o = offer as OfferRow;
    if (o.status !== 'pending') {
      res.status(409).json({ success: false, error: 'Only a pending offer can be rejected' });
      return;
    }
    if (o.created_by === userId) {
      res.status(403).json({ success: false, error: 'Only the recipient can reject an offer' });
      return;
    }
    if (userId !== o.landlord_id && userId !== o.renter_id) {
      res.status(403).json({ success: false, error: 'You are not a party to this offer' });
      return;
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('offers')
      .update({ status: 'declined' } as Partial<OfferRow>)
      .eq('id', id)
      .eq('status', 'pending')
      .select(OFFER_SELECT)
      .maybeSingle();

    if (updErr) {
      logOffersApi('POST', '/api/offers/:id/reject', userId, false, updErr.message);
      res.status(500).json({ success: false, error: 'Failed to reject offer' });
      return;
    }
    if (!updated) {
      res.status(409).json({ success: false, error: 'Offer is no longer pending' });
      return;
    }

    logOffersApi('POST', '/api/offers/:id/reject', userId, true);
    res.json({ success: true, data: updated as OfferRow });
  })
);

/**
 * POST /api/offers/:id/withdraw
 *
 * Creator cancels their own pending offer.
 */
router.post<{ id: string }, ApiResponse<OfferRow> | ApiResponse>(
  '/:id/withdraw',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId) {
      logOffersApi('POST', '/api/offers/:id/withdraw', undefined, false, 'Missing user_id');
      res.status(400).json({
        success: false,
        error: 'Missing user_id (X-User-Id header or user_id query param)',
      });
      return;
    }

    const { data: offer, error } = await supabaseAdmin
      .from('offers')
      .select(OFFER_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logOffersApi('POST', '/api/offers/:id/withdraw', userId, false, error.message);
      res.status(500).json({ success: false, error: 'Failed to load offer' });
      return;
    }
    if (!offer) {
      res.status(404).json({ success: false, error: 'Offer not found' });
      return;
    }

    const o = offer as OfferRow;
    if (o.status !== 'pending') {
      res.status(409).json({ success: false, error: 'Only a pending offer can be withdrawn' });
      return;
    }
    if (o.created_by !== userId) {
      res.status(403).json({ success: false, error: 'Only the offer creator can withdraw it' });
      return;
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('offers')
      .update({ status: 'cancelled' } as Partial<OfferRow>)
      .eq('id', id)
      .eq('status', 'pending')
      .select(OFFER_SELECT)
      .maybeSingle();

    if (updErr) {
      logOffersApi('POST', '/api/offers/:id/withdraw', userId, false, updErr.message);
      res.status(500).json({ success: false, error: 'Failed to withdraw offer' });
      return;
    }
    if (!updated) {
      res.status(409).json({ success: false, error: 'Offer is no longer pending' });
      return;
    }

    logOffersApi('POST', '/api/offers/:id/withdraw', userId, true);
    res.json({ success: true, data: updated as OfferRow });
  })
);

/**
 * POST /api/offers/:id/accept
 *
 * Recipient accepts a pending offer, creating a booking and a Stripe PaymentIntent (manual capture).
 */
router.post<
  { id: string },
  ApiResponse<{ booking: BookingRow; clientSecret: string | null }> | ApiResponse
>(
  '/:id/accept',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId) {
      logOffersApi('POST', '/api/offers/:id/accept', undefined, false, 'Missing user_id');
      res.status(400).json({
        success: false,
        error: 'Missing user_id (X-User-Id header or user_id query param)',
      });
      return;
    }

    const {
      data: offer,
      error: offerError,
    } = await supabaseAdmin.from('offers').select(OFFER_SELECT).eq('id', id).maybeSingle();

    if (offerError) {
      logOffersApi('POST', '/api/offers/:id/accept', userId, false, offerError.message);
      res.status(500).json({ success: false, error: 'Failed to load offer' });
      return;
    }

    if (!offer) {
      res.status(404).json({ success: false, error: 'Offer not found' });
      return;
    }

    const o = offer as OfferRow;

    if (userId !== o.landlord_id && userId !== o.renter_id) {
      res.status(403).json({
        success: false,
        error: 'You are not a party to this offer',
      });
      return;
    }

    if (o.created_by === userId) {
      res.status(403).json({
        success: false,
        error: 'Only the recipient of an offer can accept it',
      });
      return;
    }

    if (o.status !== 'pending') {
      res.status(400).json({
        success: false,
        error: 'Only pending offers can be accepted',
      });
      return;
    }

    const { data: existingBookings, error: existingBookingsError } = await supabaseAdmin
      .from('bookings')
      .select('id, status')
      .eq('offer_id', o.id);

    if (existingBookingsError) {
      logOffersApi(
        'POST',
        '/api/offers/:id/accept',
        userId,
        false,
        existingBookingsError.message
      );
      res.status(500).json({ success: false, error: 'Failed to validate existing bookings' });
      return;
    }

    if (existingBookings && existingBookings.length > 0) {
      res.status(400).json({
        success: false,
        error: 'This offer already has an associated booking',
      });
      return;
    }

    const {
      data: landlordProfile,
      error: landlordProfileError,
    } = await supabaseAdmin
      .from('profiles')
      .select('id, email, stripe_account_id')
      .eq('id', o.landlord_id)
      .maybeSingle();

    if (landlordProfileError) {
      logOffersApi(
        'POST',
        '/api/offers/:id/accept',
        userId,
        false,
        landlordProfileError.message
      );
      res.status(500).json({ success: false, error: 'Failed to load landlord profile' });
      return;
    }

    if (!landlordProfile || !landlordProfile.stripe_account_id) {
      res.status(400).json({
        success: false,
        error:
          'Landlord has not completed Stripe Connect onboarding. They must connect payouts before offers can be accepted.',
      });
      return;
    }

    const start = new Date(o.start_date);
    if (Number.isNaN(start.getTime())) {
      res.status(500).json({ success: false, error: 'Offer has invalid start_date' });
      return;
    }

    const end = new Date(start.getTime());
    switch (o.rate_type) {
      case 'hourly':
        end.setHours(end.getHours() + o.duration);
        break;
      case 'weekly':
        end.setDate(end.getDate() + o.duration * 7);
        break;
      case 'monthly':
        end.setMonth(end.getMonth() + o.duration);
        break;
      case 'daily':
      default:
        end.setDate(end.getDate() + o.duration);
        break;
    }

    const landlordAmount = o.total_amount - o.platform_fee_amount;
    if (landlordAmount < 0) {
      res.status(500).json({
        success: false,
        error: 'Offer has invalid amounts (platform fee exceeds total)',
      });
      return;
    }

    const {
      data: booking,
      error: bookingError,
    } = await supabaseAdmin
      .from('bookings')
      .insert({
        offer_id: o.id,
        listing_id: o.listing_id,
        landlord_id: o.landlord_id,
        renter_id: o.renter_id,
        start_datetime: start.toISOString(),
        end_datetime: end.toISOString(),
        status: 'pending_payment',
        payment_intent_id: null,
        currency: o.currency,
        total_amount: o.total_amount,
        platform_fee_amount: o.platform_fee_amount,
        landlord_amount: landlordAmount,
      } as Partial<BookingRow>)
      .select(
        'id, offer_id, listing_id, landlord_id, renter_id, start_datetime, end_datetime, status, payment_intent_id, currency, total_amount, platform_fee_amount, landlord_amount, cancelled_at, cancellation_reason, refund_amount, created_at, updated_at'
      )
      .single();

    if (bookingError || !booking) {
      logOffersApi('POST', '/api/offers/:id/accept', userId, false, bookingError?.message);
      res.status(500).json({ success: false, error: 'Failed to create booking' });
      return;
    }

    try {
      const stripe = requireStripe();
      const paymentIntent = await stripe.paymentIntents.create({
        amount: o.total_amount,
        currency: o.currency,
        capture_method: 'manual',
        application_fee_amount: o.platform_fee_amount,
        transfer_data: {
          destination: landlordProfile.stripe_account_id as string,
        },
        metadata: {
          offer_id: o.id,
          booking_id: booking.id,
          listing_id: o.listing_id,
          landlord_id: o.landlord_id,
          renter_id: o.renter_id,
        },
      });

      const {
        data: updatedBooking,
        error: updateBookingError,
      } = await supabaseAdmin
        .from('bookings')
        .update({
          payment_intent_id: paymentIntent.id,
        } as Partial<BookingRow>)
        .eq('id', booking.id)
        .select(
          'id, offer_id, listing_id, landlord_id, renter_id, start_datetime, end_datetime, status, payment_intent_id, currency, total_amount, platform_fee_amount, landlord_amount, cancelled_at, cancellation_reason, refund_amount, created_at, updated_at'
        )
        .single();

      if (updateBookingError || !updatedBooking) {
        logOffersApi(
          'POST',
          '/api/offers/:id/accept',
          userId,
          false,
          updateBookingError?.message
        );
        res.status(500).json({
          success: false,
          error: 'Failed to link payment intent to booking',
        });
        return;
      }

      logOffersApi('POST', '/api/offers/:id/accept', userId, true);
      res.status(201).json({
        success: true,
        data: {
          booking: updatedBooking,
          clientSecret: paymentIntent.client_secret ?? null,
        },
      });
    } catch (err: unknown) {
      console.error('Stripe PaymentIntent create failed', err);
      const {
        error: markFailedError,
      } = await supabaseAdmin
        .from('bookings')
        .update({
          status: 'payment_failed',
        } as Partial<BookingRow>)
        .eq('id', booking.id);

      if (markFailedError) {
        logOffersApi(
          'POST',
          '/api/offers/:id/accept',
          userId,
          false,
          `Stripe error and failed to mark booking as payment_failed: ${markFailedError.message}`
        );
      } else {
        logOffersApi(
          'POST',
          '/api/offers/:id/accept',
          userId,
          false,
          'Stripe PaymentIntent creation failed'
        );
      }

      res.status(502).json({
        success: false,
        error:
          'Failed to initialize payment with Stripe. Please try again or contact support if the problem persists.',
      });
    }
  })
);

export default router;
