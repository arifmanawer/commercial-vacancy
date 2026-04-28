import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../types';
import { requireStripe } from '../lib/stripe';
import { config } from '../config/env';
import { sendReservationEmails } from '../services/reservationEmails';

const router = Router();

type BookingStatus =
  | 'pending_payment'
  | 'reserved'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'refund_pending'
  | 'refund_completed'
  | 'payment_failed';

interface BookingRow {
  id: string;
  offer_id: string;
  listing_id: string;
  landlord_id: string;
  renter_id: string;
  end_datetime: string;
  currency: string;
  platform_fee_amount: number;
  landlord_amount: number;
  status: BookingStatus;
  start_datetime: string;
  payment_intent_id: string | null;
  total_amount: number;
  refund_amount: number | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
}

interface ListingRow {
  id: string;
  user_id: string;
  rate_type: 'hourly' | 'daily' | 'weekly' | 'monthly' | null;
  rate_amount: number | null;
  min_duration: number | null;
  max_duration: number | null;
  currency: string | null;
}

interface OfferRow {
  id: string;
}

interface ProfileRow {
  id: string;
  stripe_account_id: string | null;
}

interface ConversationRow {
  id: string;
  context_type: 'listing' | 'contractor' | 'general';
  context_listing_id: string | null;
}

interface ConversationParticipantRow {
  conversation_id: string;
  user_id: string;
}

function logBookingsApi(
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

function computeDurationUnits(start: Date, end: Date, rateType: string): number | null {
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return null;

  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;

  switch (rateType) {
    case 'hourly':
      return Math.ceil((endMs - startMs) / hourMs);
    case 'daily':
      return Math.ceil((endMs - startMs) / dayMs);
    case 'weekly':
      return Math.ceil((endMs - startMs) / (7 * dayMs));
    case 'monthly': {
      const monthsBase =
        (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      const addMonths = (d: Date, months: number) => {
        const copy = new Date(d.getTime());
        copy.setMonth(copy.getMonth() + months);
        return copy;
      };
      let months = Math.max(0, monthsBase);
      if (addMonths(start, months).getTime() < endMs) months += 1;
      return Math.max(1, months);
    }
    default:
      return null;
  }
}

function calculateRefundPercentage(start: Date, now: Date): number {
  const msUntilStart = start.getTime() - now.getTime();

  if (Number.isNaN(start.getTime())) {
    return 0;
  }

  const oneDayMs = 24 * 60 * 60 * 1000;
  const sevenDaysMs = 7 * oneDayMs;

  if (msUntilStart > sevenDaysMs) {
    return 1;
  }

  if (msUntilStart > oneDayMs) {
    return 0.5;
  }

  if (msUntilStart > 0) {
    return 0;
  }

  return 0;
}

/**
 * POST /api/bookings/buy-now
 *
 * Renter purchases a listing instantly for desired start + duration.
 * Creates offer+booking, checks overlap, and returns Stripe Checkout URL.
 */
router.post<
  {},
  ApiResponse<{ booking: BookingRow; checkoutUrl: string }> | ApiResponse,
  {
    listingId: string;
    startDate: string;
    endDate: string;
    platformFeePercent?: number;
  }
>(
  '/buy-now',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      logBookingsApi('POST', '/api/bookings/buy-now', undefined, false, 'Missing user_id');
      res.status(400).json({
        success: false,
        error: 'Missing user_id (X-User-Id header or user_id query param)',
      });
      return;
    }

    const { listingId, startDate, endDate, platformFeePercent } = req.body;
    if (!listingId || !startDate || !endDate) {
      res.status(400).json({
        success: false,
        error: 'listingId, startDate, and endDate are required',
      });
      return;
    }

    const {
      data: listing,
      error: listingError,
    } = await supabaseAdmin
      .from('listings')
      .select('id, user_id, rate_type, rate_amount, min_duration, max_duration, currency')
      .eq('id', listingId)
      .maybeSingle();

    if (listingError) {
      logBookingsApi('POST', '/api/bookings/buy-now', userId, false, listingError.message);
      res.status(500).json({ success: false, error: 'Failed to load listing' });
      return;
    }
    if (!listing) {
      res.status(404).json({ success: false, error: 'Listing not found' });
      return;
    }
    if (!listing.rate_type || listing.rate_amount == null) {
      res.status(400).json({
        success: false,
        error: 'Listing is missing pricing information',
      });
      return;
    }
    if (listing.user_id === userId) {
      res.status(400).json({ success: false, error: 'Landlord cannot buy own listing' });
      return;
    }

    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) {
      res.status(400).json({ success: false, error: 'Invalid startDate' });
      return;
    }
    if (start.getTime() <= Date.now()) {
      res.status(400).json({ success: false, error: 'startDate must be in the future' });
      return;
    }

    const end = new Date(endDate);
    if (Number.isNaN(end.getTime())) {
      res.status(400).json({ success: false, error: 'Invalid endDate' });
      return;
    }
    if (end <= start) {
      res.status(400).json({ success: false, error: 'endDate must be after startDate' });
      return;
    }

    const duration = computeDurationUnits(start, end, listing.rate_type);
    if (!duration) {
      res.status(400).json({ success: false, error: 'Invalid booking window for rate type' });
      return;
    }
    if (listing.min_duration != null && duration < listing.min_duration) {
      res.status(400).json({
        success: false,
        error: `Duration must be at least ${listing.min_duration}`,
      });
      return;
    }
    if (listing.max_duration != null && duration > listing.max_duration) {
      res.status(400).json({
        success: false,
        error: `Duration must be at most ${listing.max_duration}`,
      });
      return;
    }

    const activeStatuses: BookingStatus[] = ['pending_payment', 'reserved', 'active'];
    const { data: existingBookings, error: existingError } = await supabaseAdmin
      .from('bookings')
      .select('id, start_datetime, end_datetime, status')
      .eq('listing_id', listing.id)
      .in('status', activeStatuses);

    if (existingError) {
      logBookingsApi('POST', '/api/bookings/buy-now', userId, false, existingError.message);
      res.status(500).json({ success: false, error: 'Failed to validate listing availability' });
      return;
    }

    const hasOverlap = (existingBookings ?? []).some((booking) => {
      const existingStart = new Date(booking.start_datetime);
      const existingEnd = new Date(booking.end_datetime);
      return start < existingEnd && end > existingStart;
    });

    if (hasOverlap) {
      res.status(409).json({
        success: false,
        error: 'Listing is not available for the selected time window',
      });
      return;
    }

    const {
      data: landlordProfile,
      error: landlordProfileError,
    } = await supabaseAdmin
      .from('profiles')
      .select('id, stripe_account_id')
      .eq('id', listing.user_id)
      .maybeSingle();

    if (landlordProfileError) {
      logBookingsApi(
        'POST',
        '/api/bookings/buy-now',
        userId,
        false,
        landlordProfileError.message
      );
      res.status(500).json({ success: false, error: 'Failed to load landlord profile' });
      return;
    }

    if (!landlordProfile?.stripe_account_id) {
      res.status(400).json({
        success: false,
        error: 'Landlord is not ready for Stripe payouts yet',
      });
      return;
    }

    const perUnit = Number(listing.rate_amount);
    const subtotal = Math.round(perUnit * duration * 100);
    const platformPercent =
      typeof platformFeePercent === 'number' && platformFeePercent >= 0
        ? platformFeePercent
        : 10;
    const platformFee = Math.round((subtotal * platformPercent) / 100);
    const total = subtotal + platformFee;
    const landlordAmount = total - platformFee;
    const currency = (listing.currency || 'usd').toLowerCase();

    let conversationId: string | null = null;
    const { data: existingConversations } = await supabaseAdmin
      .from('conversations')
      .select('id, context_type, context_listing_id')
      .eq('context_type', 'listing')
      .eq('context_listing_id', listing.id)
      .limit(20);

    if (existingConversations && existingConversations.length > 0) {
      const candidateIds = existingConversations.map((c) => c.id);
      const { data: participants } = await supabaseAdmin
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', candidateIds);
      const targetPair = [userId, listing.user_id].sort();

      for (const conv of existingConversations) {
        const ids = (participants ?? [])
          .filter((p) => p.conversation_id === conv.id)
          .map((p) => p.user_id)
          .sort();
        if (ids.length === 2 && ids[0] === targetPair[0] && ids[1] === targetPair[1]) {
          conversationId = conv.id;
          break;
        }
      }
    }

    if (!conversationId) {
      const { data: createdConversation, error: conversationError } = await supabaseAdmin
        .from('conversations')
        .insert({
          created_by: userId,
          context_type: 'listing',
          context_listing_id: listing.id,
          context_contractor_id: null,
        } as any)
        .select('id, context_type, context_listing_id')
        .single();

      if (conversationError || !createdConversation) {
        logBookingsApi(
          'POST',
          '/api/bookings/buy-now',
          userId,
          false,
          conversationError?.message
        );
        res.status(500).json({ success: false, error: 'Failed to create conversation' });
        return;
      }

      const { error: participantError } = await supabaseAdmin
        .from('conversation_participants')
        .insert([
          { conversation_id: createdConversation.id, user_id: userId },
          { conversation_id: createdConversation.id, user_id: listing.user_id },
        ] as any);

      if (participantError) {
        logBookingsApi(
          'POST',
          '/api/bookings/buy-now',
          userId,
          false,
          participantError.message
        );
        res.status(500).json({ success: false, error: 'Failed to initialize conversation' });
        return;
      }

      conversationId = createdConversation.id;
    }

    // This conversation can only have one pending offer (partial unique index).
    // If a previous buy-now attempt created a pending offer/booking but never made it to
    // `reserved`, we remove it so the renter can try again.
    //
    // We prefer deleting stale pending offers, but if for any reason a pending offer has an
    // already-reserved booking (shouldn't happen), we at least cancel it to clear the unique
    // constraint and keep the history.
    const { data: pendingOffers, error: pendingOffersError } = await supabaseAdmin
      .from('offers')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('status', 'pending');

    if (pendingOffersError) {
      logBookingsApi('POST', '/api/bookings/buy-now', userId, false, pendingOffersError.message);
      res.status(500).json({ success: false, error: 'Failed to validate prior offers' });
      return;
    }

    if (pendingOffers && pendingOffers.length > 0) {
      const pendingOfferIds = pendingOffers.map((o) => o.id);

      const { data: relatedBookings, error: relatedBookingsError } = await supabaseAdmin
        .from('bookings')
        .select('id, offer_id, status')
        .in('offer_id', pendingOfferIds);

      if (relatedBookingsError) {
        logBookingsApi('POST', '/api/bookings/buy-now', userId, false, relatedBookingsError.message);
        res.status(500).json({ success: false, error: 'Failed to validate prior bookings' });
        return;
      }

      const keepOfferIds = new Set(
        (relatedBookings ?? [])
          .filter((b) => b.status === 'reserved' || b.status === 'active' || b.status === 'completed')
          .map((b) => b.offer_id)
      );

      const deletableOfferIds = pendingOfferIds.filter((id) => !keepOfferIds.has(id));
      const nonDeletableOfferIds = pendingOfferIds.filter((id) => keepOfferIds.has(id));

      if (deletableOfferIds.length > 0) {
        const { error: deleteError } = await supabaseAdmin
          .from('offers')
          .delete()
          .in('id', deletableOfferIds);

        if (deleteError) {
          logBookingsApi('POST', '/api/bookings/buy-now', userId, false, deleteError.message);
          res.status(500).json({ success: false, error: 'Failed to delete prior pending offer' });
          return;
        }
      }

      if (nonDeletableOfferIds.length > 0) {
        const { error: cancelError } = await supabaseAdmin
          .from('offers')
          .update({ status: 'cancelled' } as any)
          .in('id', nonDeletableOfferIds)
          .eq('status', 'pending');

        if (cancelError) {
          logBookingsApi('POST', '/api/bookings/buy-now', userId, false, cancelError.message);
          res.status(500).json({ success: false, error: 'Failed to cancel prior pending offer' });
          return;
        }
      }
    }

    const { data: insertedOffer, error: offerError } = await supabaseAdmin
      .from('offers')
      .insert({
        conversation_id: conversationId,
        listing_id: listing.id,
        landlord_id: listing.user_id,
        renter_id: userId,
        created_by: userId,
        rate_type: listing.rate_type,
        rate_amount: perUnit,
        currency,
        start_date: start.toISOString(),
        duration,
        subtotal_amount: subtotal,
        platform_fee_amount: platformFee,
        total_amount: total,
      } as any)
      .select('id')
      .single();

    if (offerError || !insertedOffer) {
      logBookingsApi('POST', '/api/bookings/buy-now', userId, false, offerError?.message);
      res.status(500).json({ success: false, error: 'Failed to create purchase offer' });
      return;
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        offer_id: insertedOffer.id,
        listing_id: listing.id,
        landlord_id: listing.user_id,
        renter_id: userId,
        start_datetime: start.toISOString(),
        end_datetime: end.toISOString(),
        status: 'pending_payment',
        payment_intent_id: null,
        currency,
        total_amount: total,
        platform_fee_amount: platformFee,
        landlord_amount: landlordAmount,
      } as Partial<BookingRow>)
      .select(
        'id, offer_id, listing_id, landlord_id, renter_id, start_datetime, end_datetime, status, payment_intent_id, currency, total_amount, platform_fee_amount, landlord_amount, refund_amount, cancellation_reason, cancelled_at'
      )
      .single();

    if (bookingError || !booking) {
      logBookingsApi('POST', '/api/bookings/buy-now', userId, false, bookingError?.message);
      res.status(500).json({ success: false, error: 'Failed to create booking' });
      return;
    }

    try {
      const stripe = requireStripe();
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        // Include bookingId and session_id so the frontend can confirm status if the webhook is delayed.
        success_url: `${config.frontendUrl}/listings/${listing.id}?checkout=success&bookingId=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.frontendUrl}/listings/${listing.id}?checkout=cancelled`,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: total,
              product_data: {
                name: `Listing booking (${listing.rate_type})`,
                description: `Start: ${start.toISOString()} · End: ${end.toISOString()} · Duration: ${duration} ${listing.rate_type}`,
              },
            },
          },
        ],
        payment_intent_data: {
          application_fee_amount: platformFee,
          transfer_data: {
            destination: landlordProfile.stripe_account_id,
          },
          metadata: {
            booking_id: booking.id,
            offer_id: booking.offer_id,
            listing_id: booking.listing_id,
            renter_id: booking.renter_id,
            landlord_id: booking.landlord_id,
            flow: 'buy_now',
            start_datetime: start.toISOString(),
            end_datetime: end.toISOString(),
            duration_units: String(duration),
            rate_type: listing.rate_type,
          },
        },
        metadata: {
          booking_id: booking.id,
          start_datetime: start.toISOString(),
          end_datetime: end.toISOString(),
        },
      });

      // Stripe sometimes returns `payment_intent: null` in the create response for
      // connected-account scenarios. We still want to redirect the user.
      // The webhook will reconcile bookings using `payment_intent.metadata.booking_id`.
      let sessionToUse = session;
      if (!sessionToUse.url) {
        try {
          const retrieved = await stripe.checkout.sessions.retrieve(session.id);
          sessionToUse = retrieved;
        } catch (err: any) {
          console.warn('Failed to retrieve checkout session after create', {
            sessionId: session.id,
            error: err?.message ?? String(err),
          });
        }
      }

      if (!sessionToUse.url) {
        console.error('Stripe checkout session missing URL', {
          sessionId: session.id,
        });
        throw new Error('Stripe checkout session did not return a URL');
      }

      const paymentIntentId =
        sessionToUse.payment_intent && typeof sessionToUse.payment_intent === 'string'
          ? sessionToUse.payment_intent
          : sessionToUse.payment_intent && typeof sessionToUse.payment_intent === 'object'
            ? (sessionToUse.payment_intent as any).id
            : null;

      if (paymentIntentId) {
        const { error: bookingUpdateError } = await supabaseAdmin
          .from('bookings')
          .update({ payment_intent_id: paymentIntentId } as Partial<BookingRow>)
          .eq('id', booking.id);

        if (bookingUpdateError) {
          logBookingsApi(
            'POST',
            '/api/bookings/buy-now',
            userId,
            false,
            bookingUpdateError.message
          );
          res
            .status(500)
            .json({ success: false, error: 'Failed to link payment to booking' });
          return;
        }
      } else {
        console.warn('Stripe checkout session missing payment_intent at create time', {
          sessionId: session.id,
          bookingId: booking.id,
        });
      }

      logBookingsApi('POST', '/api/bookings/buy-now', userId, true);
      res.status(201).json({
        success: true,
        data: {
          booking: {
            ...booking,
            payment_intent_id: paymentIntentId,
          },
          checkoutUrl: sessionToUse.url,
        },
      });
    } catch (err: any) {
      await supabaseAdmin
        .from('bookings')
        .update({ status: 'payment_failed' } as Partial<BookingRow>)
        .eq('id', booking.id);

      logBookingsApi('POST', '/api/bookings/buy-now', userId, false, err?.message);
      res.status(502).json({
        success: false,
        error: 'Failed to initialize Stripe checkout',
      });
    }
  })
);

/**
 * POST /api/bookings/confirm-checkout
 *
 * Fallback for environments where Stripe webhooks are delayed/unavailable.
 * Given a Checkout Session id, verifies payment status with Stripe and, if paid,
 * marks the booking reserved + offer accepted.
 */
router.post<
  {},
  ApiResponse<{ bookingId: string; status: BookingStatus }> | ApiResponse,
  { sessionId: string; bookingId?: string }
>(
  '/confirm-checkout',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      logBookingsApi('POST', '/api/bookings/confirm-checkout', undefined, false, 'Missing user_id');
      res.status(400).json({
        success: false,
        error: 'Missing user_id (X-User-Id header or user_id query param)',
      });
      return;
    }

    const sessionId = req.body?.sessionId?.trim();
    const bookingIdHint = req.body?.bookingId?.trim() || null;
    if (!sessionId) {
      res.status(400).json({ success: false, error: 'sessionId is required' });
      return;
    }

    const stripe = requireStripe();
    let session: any;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent'],
      });
    } catch (err: any) {
      logBookingsApi('POST', '/api/bookings/confirm-checkout', userId, false, err?.message);
      res.status(502).json({ success: false, error: 'Failed to retrieve Stripe session' });
      return;
    }

    const paymentStatus = String(session?.payment_status || '').toLowerCase();
    const sessionStatus = String(session?.status || '').toLowerCase();
    const isPaid =
      paymentStatus === 'paid' ||
      sessionStatus === 'complete' ||
      sessionStatus === 'completed';

    if (!isPaid) {
      res.status(200).json({
        success: true,
        data: {
          bookingId: bookingIdHint || (session?.metadata?.booking_id as string) || 'unknown',
          status: 'pending_payment',
        },
      });
      return;
    }

    const paymentIntentId =
      session?.payment_intent && typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session?.payment_intent && typeof session.payment_intent === 'object'
          ? session.payment_intent.id
          : null;

    const bookingIdFromMetadata =
      (session?.metadata?.booking_id as string | undefined) ||
      (session?.metadata?.bookingId as string | undefined) ||
      (session?.payment_intent?.metadata?.booking_id as string | undefined) ||
      (session?.payment_intent?.metadata?.bookingId as string | undefined) ||
      null;

    const bookingId = bookingIdHint || bookingIdFromMetadata;
    if (!bookingId) {
      logBookingsApi('POST', '/api/bookings/confirm-checkout', userId, false, 'Missing bookingId');
      res.status(400).json({ success: false, error: 'Unable to resolve bookingId from session' });
      return;
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, offer_id, renter_id, landlord_id, status, payment_intent_id')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError) {
      logBookingsApi('POST', '/api/bookings/confirm-checkout', userId, false, bookingError.message);
      res.status(500).json({ success: false, error: 'Failed to load booking' });
      return;
    }
    if (!booking) {
      res.status(404).json({ success: false, error: 'Booking not found' });
      return;
    }
    if (booking.renter_id !== userId && booking.landlord_id !== userId) {
      res.status(403).json({ success: false, error: 'Not authorized to confirm this booking' });
      return;
    }

    if (booking.status !== 'pending_payment') {
      res.status(200).json({ success: true, data: { bookingId: booking.id, status: booking.status } });
      return;
    }

    if (paymentIntentId && !booking.payment_intent_id) {
      await supabaseAdmin
        .from('bookings')
        .update({ payment_intent_id: paymentIntentId } as Partial<BookingRow>)
        .eq('id', booking.id);
    }

    const { error: reserveError } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'reserved' } as Partial<BookingRow>)
      .eq('id', booking.id)
      .eq('status', 'pending_payment');

    if (reserveError) {
      logBookingsApi('POST', '/api/bookings/confirm-checkout', userId, false, reserveError.message);
      res.status(500).json({ success: false, error: 'Failed to mark booking reserved' });
      return;
    }

    await supabaseAdmin
      .from('offers')
      .update({ status: 'accepted' } as any)
      .eq('id', booking.offer_id);

    // Best-effort side effect: reservation emails. Idempotency is enforced in DB.
    sendReservationEmails(booking.id).catch((err: any) => {
      console.warn('Failed to send reservation emails after confirm-checkout', {
        bookingId: booking.id,
        error: err?.message ?? String(err),
      });
    });

    logBookingsApi('POST', '/api/bookings/confirm-checkout', userId, true);
    res.status(200).json({ success: true, data: { bookingId: booking.id, status: 'reserved' } });
  })
);

/**
 * GET /api/bookings/:id
 *
 * Fetch a booking by id for the renter or landlord.
 */
router.get<
  { id: string },
  ApiResponse<BookingRow> | ApiResponse
>(
  '/:id',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId) {
      logBookingsApi('GET', '/api/bookings/:id', undefined, false, 'Missing user_id');
      res.status(400).json({
        success: false,
        error: 'Missing user_id (X-User-Id header or user_id query param)',
      });
      return;
    }

    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select(
        'id, offer_id, listing_id, landlord_id, renter_id, start_datetime, end_datetime, status, payment_intent_id, currency, total_amount, platform_fee_amount, landlord_amount, refund_amount, cancellation_reason, cancelled_at'
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logBookingsApi('GET', '/api/bookings/:id', userId, false, error.message);
      res.status(500).json({ success: false, error: 'Failed to load booking' });
      return;
    }

    if (!booking) {
      res.status(404).json({ success: false, error: 'Booking not found' });
      return;
    }

    if (booking.renter_id !== userId && booking.landlord_id !== userId) {
      res.status(403).json({ success: false, error: 'Not authorized to view this booking' });
      return;
    }

    logBookingsApi('GET', '/api/bookings/:id', userId, true);
    res.status(200).json({ success: true, data: booking as BookingRow });
  })
);

/**
 * POST /api/bookings/:id/cancel
 *
 * Renter-initiated cancellation with refund logic based on time until start.
 */
router.post<
  { id: string },
  ApiResponse<BookingRow> | ApiResponse,
  {
    reason?: string;
  }
>(
  '/:id/cancel',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId) {
      logBookingsApi('POST', '/api/bookings/:id/cancel', undefined, false, 'Missing user_id');
      res.status(400).json({
        success: false,
        error: 'Missing user_id (X-User-Id header or user_id query param)',
      });
      return;
    }

    const {
      data: booking,
      error: bookingError,
    } = await supabaseAdmin
      .from('bookings')
      .select(
        'id, renter_id, status, start_datetime, payment_intent_id, total_amount, refund_amount, cancellation_reason, cancelled_at'
      )
      .eq('id', id)
      .maybeSingle();

    if (bookingError) {
      logBookingsApi(
        'POST',
        '/api/bookings/:id/cancel',
        userId,
        false,
        bookingError.message
      );
      res.status(500).json({ success: false, error: 'Failed to load booking' });
      return;
    }

    if (!booking) {
      res.status(404).json({ success: false, error: 'Booking not found' });
      return;
    }

    if (booking.renter_id !== userId) {
      res.status(403).json({
        success: false,
        error: 'Only the renter for this booking can cancel it',
      });
      return;
    }

    if (
      booking.status !== 'reserved' &&
      booking.status !== 'active' &&
      booking.status !== 'pending_payment'
    ) {
      res.status(400).json({
        success: false,
        error: 'Only reserved, active, or pending_payment bookings can be cancelled',
      });
      return;
    }

    const now = new Date();
    const start = new Date(booking.start_datetime);

    if (Number.isNaN(start.getTime())) {
      res.status(500).json({ success: false, error: 'Booking has invalid start_datetime' });
      return;
    }

    const reason = req.body?.reason?.trim() || null;

    // If there is no PaymentIntent yet, just cancel without Stripe interaction.
    if (!booking.payment_intent_id || booking.status === 'pending_payment') {
      const {
        data: updatedBooking,
        error: updateError,
      } = await supabaseAdmin
        .from('bookings')
        .update({
          status: 'cancelled' as BookingStatus,
          cancelled_at: now.toISOString(),
          cancellation_reason: reason,
          refund_amount: booking.refund_amount ?? 0,
        } as Partial<BookingRow>)
        .eq('id', booking.id)
        .select(
          'id, renter_id, status, start_datetime, payment_intent_id, total_amount, refund_amount, cancellation_reason, cancelled_at'
        )
        .maybeSingle();

      if (updateError || !updatedBooking) {
        logBookingsApi(
          'POST',
          '/api/bookings/:id/cancel',
          userId,
          false,
          updateError?.message
        );
        res.status(500).json({ success: false, error: 'Failed to cancel booking' });
        return;
      }

      logBookingsApi('POST', '/api/bookings/:id/cancel', userId, true);
      res.status(200).json({ success: true, data: updatedBooking });
      return;
    }

    const refundPercent = calculateRefundPercentage(start, now);
    const refundAmount = Math.round(booking.total_amount * refundPercent);

    if (refundAmount <= 0) {
      const {
        data: updatedBooking,
        error: updateError,
      } = await supabaseAdmin
        .from('bookings')
        .update({
          status: 'cancelled' as BookingStatus,
          cancelled_at: now.toISOString(),
          cancellation_reason: reason,
          refund_amount: booking.refund_amount ?? 0,
        } as Partial<BookingRow>)
        .eq('id', booking.id)
        .select(
          'id, renter_id, status, start_datetime, payment_intent_id, total_amount, refund_amount, cancellation_reason, cancelled_at'
        )
        .maybeSingle();

      if (updateError || !updatedBooking) {
        logBookingsApi(
          'POST',
          '/api/bookings/:id/cancel',
          userId,
          false,
          updateError?.message
        );
        res.status(500).json({ success: false, error: 'Failed to cancel booking' });
        return;
      }

      logBookingsApi('POST', '/api/bookings/:id/cancel', userId, true);
      res.status(200).json({ success: true, data: updatedBooking });
      return;
    }

    try {
      const stripe = requireStripe();
      await stripe.refunds.create({
        payment_intent: booking.payment_intent_id,
        amount: refundAmount,
      });
    } catch (err: any) {
      logBookingsApi('POST', '/api/bookings/:id/cancel', userId, false, err?.message);
      res.status(502).json({
        success: false,
        error:
          'Failed to initiate refund with Stripe. Please try again or contact support if the problem persists.',
      });
      return;
    }

    const {
      data: updatedBooking,
      error: updateError,
    } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'refund_pending' as BookingStatus,
        cancelled_at: now.toISOString(),
        cancellation_reason: reason,
        refund_amount: refundAmount,
      } as Partial<BookingRow>)
      .eq('id', booking.id)
      .select(
        'id, renter_id, status, start_datetime, payment_intent_id, total_amount, refund_amount, cancellation_reason, cancelled_at'
      )
      .maybeSingle();

    if (updateError || !updatedBooking) {
      logBookingsApi(
        'POST',
        '/api/bookings/:id/cancel',
        userId,
        false,
        updateError?.message
      );
      res.status(500).json({ success: false, error: 'Failed to update booking after refund' });
      return;
    }

    logBookingsApi('POST', '/api/bookings/:id/cancel', userId, true);
    res.status(200).json({ success: true, data: updatedBooking });
  })
);

export default router;

