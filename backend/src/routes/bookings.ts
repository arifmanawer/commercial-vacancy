import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../types';
import { requireStripe } from '../lib/stripe';

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
  renter_id: string;
  status: BookingStatus;
  start_datetime: string;
  payment_intent_id: string | null;
  total_amount: number;
  refund_amount: number | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
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
      .from<BookingRow>('bookings')
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
        .from<BookingRow>('bookings')
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
        .from<BookingRow>('bookings')
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
      .from<BookingRow>('bookings')
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

