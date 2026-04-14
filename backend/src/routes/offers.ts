import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../types';
import { requireStripe } from '../lib/stripe';

const router = Router();

type OfferStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';

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
  rate_type: string;
  rate_amount: number;
  currency: string;
  start_date: string;
  duration: number;
  subtotal_amount: number;
  platform_fee_amount: number;
  total_amount: number;
  status: OfferStatus;
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

interface ProfileRow {
  id: string;
  email: string | null;
  stripe_account_id: string | null;
}

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

/**
 * POST /api/offers
 *
 * Landlord creates an offer in the context of a conversation + listing.
 */
router.post<
  {},
  ApiResponse<OfferRow> | ApiResponse,
  {
    conversationId: string;
    listingId: string;
    renterId: string;
    startDate: string;
    duration: number;
    platformFeePercent?: number;
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

    const { conversationId, listingId, renterId, startDate, duration, platformFeePercent } =
      req.body;

    if (!conversationId || !listingId || !renterId || !startDate || !duration) {
      res.status(400).json({
        success: false,
        error: 'conversationId, listingId, renterId, startDate, and duration are required',
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

    const {
      data: listing,
      error: listingError,
    } = await supabaseAdmin
      .from('listings')
      .select('id, user_id, rate_type, rate_amount, min_duration, max_duration, currency')
      .eq('id', listingId)
      .maybeSingle();

    if (listingError) {
      logOffersApi('POST', '/api/offers', userId, false, listingError.message);
      res.status(500).json({ success: false, error: 'Failed to load listing' });
      return;
    }

    if (!listing) {
      res.status(404).json({ success: false, error: 'Listing not found' });
      return;
    }

    if (listing.user_id !== userId) {
      res.status(403).json({ success: false, error: 'Only the listing owner can create offers' });
      return;
    }

    if (!listing.rate_type || !listing.rate_amount) {
      res.status(400).json({
        success: false,
        error: 'Listing is missing pricing information',
      });
      return;
    }

    if (
      listing.min_duration != null &&
      listing.max_duration != null &&
      listing.min_duration > listing.max_duration
    ) {
      res.status(500).json({
        success: false,
        error: 'Listing has invalid duration configuration',
      });
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

    const {
      data: participants,
      error: participantsError,
    } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .eq('conversation_id', conversationId);

    if (participantsError) {
      logOffersApi('POST', '/api/offers', userId, false, participantsError.message);
      res.status(500).json({ success: false, error: 'Failed to validate conversation' });
      return;
    }

    const participantIds = new Set((participants ?? []).map((p) => p.user_id));

    if (!participantIds.has(userId) || !participantIds.has(renterId)) {
      res.status(403).json({
        success: false,
        error: 'Both landlord and renter must be participants in the conversation',
      });
      return;
    }

    const rateAmount = listing.rate_amount;
    const currency = listing.currency || 'usd';
    const perUnit = Number(rateAmount);
    const subtotal = Math.round(perUnit * duration * 100);

    const platformPercent =
      typeof platformFeePercent === 'number' && platformFeePercent >= 0
        ? platformFeePercent
        : 10;
    const platformFee = Math.round((subtotal * platformPercent) / 100);
    const total = subtotal + platformFee;

    const {
      data: inserted,
      error: insertError,
    } = await supabaseAdmin
      .from('offers')
      .insert({
        conversation_id: conversationId,
        listing_id: listingId,
        landlord_id: userId,
        renter_id: renterId,
        rate_type: listing.rate_type,
        rate_amount: perUnit,
        currency,
        start_date: new Date(startDate).toISOString(),
        duration,
        subtotal_amount: subtotal,
        platform_fee_amount: platformFee,
        total_amount: total,
      } as Partial<OfferRow>)
      .select(
        'id, conversation_id, listing_id, landlord_id, renter_id, rate_type, rate_amount, currency, start_date, duration, subtotal_amount, platform_fee_amount, total_amount, status, created_at, updated_at'
      )
      .single();

    if (insertError || !inserted) {
      logOffersApi('POST', '/api/offers', userId, false, insertError?.message);
      res.status(500).json({ success: false, error: 'Failed to create offer' });
      return;
    }

    logOffersApi('POST', '/api/offers', userId, true);
    res.status(201).json({ success: true, data: inserted });
  })
);

/**
 * POST /api/offers/:id/accept
 *
 * Renter accepts an offer, creating a booking and a Stripe PaymentIntent (manual capture).
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
    } = await supabaseAdmin
      .from('offers')
      .select(
        'id, conversation_id, listing_id, landlord_id, renter_id, rate_type, rate_amount, currency, start_date, duration, subtotal_amount, platform_fee_amount, total_amount, status, created_at, updated_at'
      )
      .eq('id', id)
      .maybeSingle();

    if (offerError) {
      logOffersApi('POST', '/api/offers/:id/accept', userId, false, offerError.message);
      res.status(500).json({ success: false, error: 'Failed to load offer' });
      return;
    }

    if (!offer) {
      res.status(404).json({ success: false, error: 'Offer not found' });
      return;
    }

    if (offer.renter_id !== userId) {
      res.status(403).json({
        success: false,
        error: 'Only the renter for this offer can accept it',
      });
      return;
    }

    if (offer.status !== 'pending') {
      res.status(400).json({
        success: false,
        error: 'Only pending offers can be accepted',
      });
      return;
    }

    const { data: existingBookings, error: existingBookingsError } = await supabaseAdmin
      .from('bookings')
      .select('id, status')
      .eq('offer_id', offer.id);

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
      .eq('id', offer.landlord_id)
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

    const start = new Date(offer.start_date);
    if (Number.isNaN(start.getTime())) {
      res.status(500).json({ success: false, error: 'Offer has invalid start_date' });
      return;
    }

    const end = new Date(start.getTime());
    switch (offer.rate_type) {
      case 'hourly':
        end.setHours(end.getHours() + offer.duration);
        break;
      case 'weekly':
        end.setDate(end.getDate() + offer.duration * 7);
        break;
      case 'monthly':
        end.setMonth(end.getMonth() + offer.duration);
        break;
      case 'daily':
      default:
        end.setDate(end.getDate() + offer.duration);
        break;
    }

    const landlordAmount = offer.total_amount - offer.platform_fee_amount;
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
        offer_id: offer.id,
        listing_id: offer.listing_id,
        landlord_id: offer.landlord_id,
        renter_id: offer.renter_id,
        start_datetime: start.toISOString(),
        end_datetime: end.toISOString(),
        status: 'pending_payment',
        payment_intent_id: null,
        currency: offer.currency,
        total_amount: offer.total_amount,
        platform_fee_amount: offer.platform_fee_amount,
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
        amount: offer.total_amount,
        currency: offer.currency,
        capture_method: 'manual',
        application_fee_amount: offer.platform_fee_amount,
        transfer_data: {
          destination: landlordProfile.stripe_account_id as string,
        },
        metadata: {
          offer_id: offer.id,
          booking_id: booking.id,
          listing_id: offer.listing_id,
          landlord_id: offer.landlord_id,
          renter_id: offer.renter_id,
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
    } catch (err: any) {
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

