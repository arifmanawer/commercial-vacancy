import Stripe from 'npm:stripe@13.11.0';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

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
  status: BookingStatus;
  payment_intent_id: string | null;
  start_datetime: string;
}

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!stripeSecretKey) {
  throw new Error(
    'Missing STRIPE_SECRET_KEY in environment for capture_due_bookings function'
  );
}

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for capture_due_bookings function'
  );
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
});

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
  },
});

function logCapture(message: string, extra?: Record<string, unknown>) {
  console.log(`[capture_due_bookings] ${message}`, {
    timestamp: new Date().toISOString(),
    ...extra,
  });
}

async function findDueBookings(): Promise<BookingRow[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from<BookingRow>('bookings')
    .select('id, status, payment_intent_id, start_datetime')
    .eq('status', 'reserved' satisfies BookingStatus)
    .lte('start_datetime', now)
    .not('payment_intent_id', 'is', null);

  if (error) {
    logCapture('Failed to query due bookings', { error: error.message });
    throw error;
  }

  return data ?? [];
}

async function capturePaymentIntentForBooking(booking: BookingRow) {
  if (!booking.payment_intent_id) {
    logCapture('Booking has no payment_intent_id, skipping', { bookingId: booking.id });
    return;
  }

  try {
    await stripe.paymentIntents.capture(booking.payment_intent_id);

    const { error: updateError } = await supabaseAdmin
      .from<BookingRow>('bookings')
      .update({ status: 'active' as BookingStatus })
      .eq('id', booking.id);

    if (updateError) {
      logCapture('Failed to update booking to active after capture', {
        bookingId: booking.id,
        error: updateError.message,
      });
      return;
    }

    logCapture('Successfully captured PaymentIntent and activated booking', {
      bookingId: booking.id,
      paymentIntentId: booking.payment_intent_id,
    });
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String((err as any).message)
        : String(err);

    logCapture('Failed to capture PaymentIntent for booking', {
      bookingId: booking.id,
      paymentIntentId: booking.payment_intent_id,
      error: message,
    });

    const { error: markFailedError } = await supabaseAdmin
      .from<BookingRow>('bookings')
      .update({ status: 'payment_failed' as BookingStatus })
      .eq('id', booking.id);

    if (markFailedError) {
      logCapture('Failed to mark booking as payment_failed after capture error', {
        bookingId: booking.id,
        error: markFailedError.message,
      });
    }
  }
}

serve(async (req) => {
  const method = req.method.toUpperCase();

  if (method !== 'GET' && method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const bookings = await findDueBookings();

    if (!bookings.length) {
      logCapture('No due bookings found to capture');
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    logCapture('Processing due bookings for capture', {
      count: bookings.length,
    });

    for (const booking of bookings) {
      // Run sequentially to avoid accidentally hammering Stripe.
      // If volume grows large, this can be batched or parallelized with rate limiting.
      // deno-lint-ignore no-await-in-loop
      await capturePaymentIntentForBooking(booking);
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: bookings.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String((err as any).message)
        : String(err);

    logCapture('Unexpected error in capture_due_bookings function', {
      error: message,
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

