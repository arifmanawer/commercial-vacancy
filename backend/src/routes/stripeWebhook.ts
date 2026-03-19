import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { requireStripe } from '../lib/stripe';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { generateAndSendAgreementForBooking } from '../lib/agreementService';

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

interface BookingRow {
  id: string;
  offer_id: string;
  status: BookingStatus;
  payment_intent_id: string | null;
  refund_amount?: number | null;
}

interface OfferRow {
  id: string;
  status: OfferStatus;
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function logStripeWebhook(message: string, extra?: Record<string, unknown>) {
  console.log(`[Stripe Webhook] ${message}`, {
    timestamp: new Date().toISOString(),
    ...extra,
  });
}

async function markBookingReservedAndOfferAccepted(booking: BookingRow) {
  const { data: updatedBooking, error: bookingUpdateError } = await supabaseAdmin
    .from<BookingRow>('bookings')
    .update({ status: 'reserved' } as Partial<BookingRow>)
    .eq('id', booking.id)
    .select('id, offer_id, status, payment_intent_id')
    .maybeSingle();

  if (bookingUpdateError) {
    logStripeWebhook('Failed to update booking to reserved', {
      bookingId: booking.id,
      error: bookingUpdateError.message,
    });
    return;
  }

  if (!updatedBooking) {
    logStripeWebhook('Booking disappeared while updating to reserved', {
      bookingId: booking.id,
    });
    return;
  }

  const { error: offerUpdateError } = await supabaseAdmin
    .from<OfferRow>('offers')
    .update({ status: 'accepted' } as Partial<OfferRow>)
    .eq('id', updatedBooking.offer_id);

  if (offerUpdateError) {
    logStripeWebhook('Failed to update offer to accepted', {
      offerId: updatedBooking.offer_id,
      error: offerUpdateError.message,
    });
  }
}

async function markBookingPaymentFailed(booking: BookingRow) {
  const { error } = await supabaseAdmin
    .from<BookingRow>('bookings')
    .update({ status: 'payment_failed' } as Partial<BookingRow>)
    .eq('id', booking.id);

  if (error) {
    logStripeWebhook('Failed to update booking to payment_failed', {
      bookingId: booking.id,
      error: error.message,
    });
  }
}

async function markBookingRefundCompleted(
  paymentIntentId: string,
  refundAmountFromStripe?: number | null
) {
  const {
    data: booking,
    error: bookingError,
  } = await supabaseAdmin
    .from<BookingRow>('bookings')
    .select('id, offer_id, status, payment_intent_id, refund_amount')
    .eq('payment_intent_id', paymentIntentId)
    .maybeSingle();

  if (bookingError) {
    logStripeWebhook('Failed to load booking for refund event', {
      paymentIntentId,
      error: bookingError.message,
    });
    return;
  }

  if (!booking) {
    logStripeWebhook('No booking found for refund event', { paymentIntentId });
    return;
  }

  const effectiveRefundAmount =
    typeof refundAmountFromStripe === 'number' && refundAmountFromStripe >= 0
      ? refundAmountFromStripe
      : booking.refund_amount ?? null;

  const { error: updateError } = await supabaseAdmin
    .from<BookingRow>('bookings')
    .update({
      status: 'refund_completed' as BookingStatus,
      refund_amount: effectiveRefundAmount,
    } as Partial<BookingRow>)
    .eq('id', booking.id);

  if (updateError) {
    logStripeWebhook('Failed to update booking to refund_completed', {
      bookingId: booking.id,
      error: updateError.message,
    });
  }
}

export async function stripeWebhookHandler(req: Request, res: Response) {
  if (!webhookSecret) {
    logStripeWebhook('Missing STRIPE_WEBHOOK_SECRET in environment');
    res.status(500).send('Webhook not configured');
    return;
  }

  const sig = req.headers['stripe-signature'] as string | undefined;

  if (!sig) {
    logStripeWebhook('Missing Stripe-Signature header');
    res.status(400).send('Missing Stripe-Signature header');
    return;
  }

  const stripe = requireStripe();

  let event: Stripe.Event;

  try {
    const rawBody = req.body as Buffer;
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    logStripeWebhook('Failed to construct Stripe event', {
      error: err?.message ?? String(err),
    });
    res.status(400).send(`Webhook Error: ${err?.message ?? 'Invalid payload'}`);
    return;
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
      case 'payment_intent.amount_capturable_updated': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const paymentIntentId = paymentIntent.id;

        const {
          data: booking,
          error: bookingError,
        } = await supabaseAdmin
          .from<BookingRow>('bookings')
          .select('id, offer_id, status, payment_intent_id')
          .eq('payment_intent_id', paymentIntentId)
          .maybeSingle();

        if (bookingError) {
          logStripeWebhook('Failed to load booking for PaymentIntent', {
            paymentIntentId,
            error: bookingError.message,
          });
          break;
        }

        if (!booking) {
          logStripeWebhook('No booking found for PaymentIntent', { paymentIntentId });
          break;
        }

        if (booking.status === 'pending_payment') {
          await markBookingReservedAndOfferAccepted(booking);
          await generateAndSendAgreementForBooking(booking.id);
        } else {
          logStripeWebhook('Booking already processed, skipping reserved update', {
            bookingId: booking.id,
            status: booking.status,
          });
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const paymentIntentId = paymentIntent.id;

        const {
          data: booking,
          error: bookingError,
        } = await supabaseAdmin
          .from<BookingRow>('bookings')
          .select('id, offer_id, status, payment_intent_id')
          .eq('payment_intent_id', paymentIntentId)
          .maybeSingle();

        if (bookingError) {
          logStripeWebhook('Failed to load booking for failed PaymentIntent', {
            paymentIntentId,
            error: bookingError.message,
          });
          break;
        }

        if (!booking) {
          logStripeWebhook('No booking found for failed PaymentIntent', { paymentIntentId });
          break;
        }

        await markBookingPaymentFailed(booking);
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = (charge.payment_intent as string | null) ?? null;

        if (!paymentIntentId) {
          logStripeWebhook('Refund event charge.refunded missing payment_intent', {
            chargeId: charge.id,
          });
          break;
        }

        await markBookingRefundCompleted(paymentIntentId, charge.amount_refunded);
        break;
      }
      case 'refund.succeeded': {
        const refund = event.data.object as Stripe.Refund;
        const paymentIntentId = (refund.payment_intent as string | null) ?? null;

        if (!paymentIntentId) {
          logStripeWebhook('Refund event refund.succeeded missing payment_intent', {
            refundId: refund.id,
          });
          break;
        }

        await markBookingRefundCompleted(paymentIntentId, refund.amount ?? null);
        break;
      }
      default: {
        logStripeWebhook('Unhandled Stripe event type', { type: event.type });
      }
    }
  } catch (err: any) {
    logStripeWebhook('Unexpected error while handling Stripe event', {
      type: event.type,
      error: err?.message ?? String(err),
    });
    res.status(500).send('Webhook handler error');
    return;
  }

  res.json({ received: true });
}

