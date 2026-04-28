import { supabaseAdmin } from '../lib/supabaseAdmin';
import { resendSendEmail } from '../lib/email/resend';

type BookingRow = {
  id: string;
  listing_id: string;
  landlord_id: string;
  renter_id: string;
  start_datetime: string;
  end_datetime: string;
  currency: string;
  total_amount: number;
  reserved_email_sent_at: string | null;
};

type ListingRow = {
  id: string;
  title: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  property_type: string | null;
};

function formatMoneyFromCents(cents: number, currency: string) {
  const amount = cents / 100;
  const currencyUpper = (currency || 'usd').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyUpper,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currencyUpper}`;
  }
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatListingLocation(listing: ListingRow) {
  const parts = [listing.address, listing.city, listing.state, listing.zip_code]
    .map((p) => (p || '').trim())
    .filter((p) => p.length > 0);
  return parts.join(', ') || 'Location not provided';
}

async function getUserEmail(userId: string): Promise<string | null> {
  // Prefer profiles.email (already used throughout the app); fall back to auth user.
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    console.warn('Failed to load profiles.email', { userId, error: profileError.message });
  }

  const emailFromProfile = profile?.email?.trim?.() || null;
  if (emailFromProfile) return emailFromProfile;

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) {
    console.warn('Failed to load auth user email', { userId, error: error.message });
    return null;
  }

  return data.user?.email?.trim() || null;
}

async function markReservationEmailSentOnce(bookingId: string): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .update({ reserved_email_sent_at: nowIso } as any)
    .eq('id', bookingId)
    .is('reserved_email_sent_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    console.warn('Failed to set reserved_email_sent_at', { bookingId, error: error.message });
    // If we can’t guarantee idempotency, fail closed to avoid spam.
    return false;
  }

  return Boolean(data?.id);
}

function renderReservationEmailHtml(args: {
  recipientRole: 'renter' | 'landlord';
  booking: BookingRow;
  listing: ListingRow;
}) {
  const { recipientRole, booking, listing } = args;
  const location = formatListingLocation(listing);
  const start = formatDateTime(booking.start_datetime);
  const end = formatDateTime(booking.end_datetime);
  const total = formatMoneyFromCents(booking.total_amount, booking.currency);
  const heading =
    recipientRole === 'renter'
      ? 'Reservation confirmed'
      : 'Your listing was reserved';

  return `<!doctype html>
<html>
  <body style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <h1 style="font-size:20px;margin:0 0 12px 0;">${heading}</h1>
      <p style="margin:0 0 16px 0; color:#334155;">
        Listing: <strong>${escapeHtml(listing.title)}</strong><br/>
        Location: ${escapeHtml(location)}
      </p>
      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:16px 0;">
        <div style="margin:0 0 6px 0;"><strong>Start</strong>: ${escapeHtml(start)}</div>
        <div style="margin:0 0 6px 0;"><strong>End</strong>: ${escapeHtml(end)}</div>
        <div style="margin:0;"><strong>Total</strong>: ${escapeHtml(total)}</div>
      </div>
      <p style="margin:16px 0 0 0; color:#475569; font-size:14px;">
        Booking ID: <code>${escapeHtml(booking.id)}</code>
      </p>
    </div>
  </body>
</html>`;
}

function renderReservationEmailText(args: {
  recipientRole: 'renter' | 'landlord';
  booking: BookingRow;
  listing: ListingRow;
}) {
  const { recipientRole, booking, listing } = args;
  const location = formatListingLocation(listing);
  const start = formatDateTime(booking.start_datetime);
  const end = formatDateTime(booking.end_datetime);
  const total = formatMoneyFromCents(booking.total_amount, booking.currency);
  const heading =
    recipientRole === 'renter'
      ? 'Reservation confirmed'
      : 'Your listing was reserved';

  return [
    heading,
    '',
    `Listing: ${listing.title}`,
    `Location: ${location}`,
    '',
    `Start: ${start}`,
    `End: ${end}`,
    `Total: ${total}`,
    '',
    `Booking ID: ${booking.id}`,
  ].join('\n');
}

function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function sendReservationEmails(bookingId: string) {
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('bookings')
    .select(
      'id, listing_id, landlord_id, renter_id, start_datetime, end_datetime, currency, total_amount, reserved_email_sent_at'
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingError) {
    throw new Error(`Failed to load booking: ${bookingError.message}`);
  }
  if (!booking) {
    throw new Error('Booking not found');
  }

  if (booking.reserved_email_sent_at) {
    return { sent: false, reason: 'already_sent' as const };
  }

  // Acquire idempotency in DB first (fail closed on error).
  const acquired = await markReservationEmailSentOnce(booking.id);
  if (!acquired) {
    return { sent: false, reason: 'idempotency_not_acquired' as const };
  }

  const { data: listing, error: listingError } = await supabaseAdmin
    .from('listings')
    .select('id, title, address, city, state, zip_code, property_type')
    .eq('id', booking.listing_id)
    .maybeSingle();

  if (listingError) {
    throw new Error(`Failed to load listing: ${listingError.message}`);
  }
  if (!listing) {
    throw new Error('Listing not found for booking');
  }

  const [renterEmail, landlordEmail] = await Promise.all([
    getUserEmail(booking.renter_id),
    getUserEmail(booking.landlord_id),
  ]);

  if (!renterEmail || !landlordEmail) {
    // Don’t throw; email is a side effect. We’ve already locked idempotency, so log clearly.
    console.warn('Missing renter/landlord email for reservation', {
      bookingId: booking.id,
      renterEmail: Boolean(renterEmail),
      landlordEmail: Boolean(landlordEmail),
    });
    return { sent: false, reason: 'missing_recipient_email' as const };
  }

  const start = formatDateTime(booking.start_datetime);
  const subjectRenter = `Reservation confirmed: ${listing.title} (${start})`;
  const subjectLandlord = `Your listing was reserved: ${listing.title} (${start})`;

  const commonHeaders = {
    'X-Booking-Id': booking.id,
    'X-Listing-Id': listing.id,
  };

  await Promise.all([
    resendSendEmail({
      to: renterEmail,
      subject: subjectRenter,
      html: renderReservationEmailHtml({ recipientRole: 'renter', booking: booking as any, listing: listing as any }),
      text: renderReservationEmailText({ recipientRole: 'renter', booking: booking as any, listing: listing as any }),
      idempotencyKey: `booking_reserved_renter_${booking.id}`,
      headers: commonHeaders,
    }),
    resendSendEmail({
      to: landlordEmail,
      subject: subjectLandlord,
      html: renderReservationEmailHtml({ recipientRole: 'landlord', booking: booking as any, listing: listing as any }),
      text: renderReservationEmailText({ recipientRole: 'landlord', booking: booking as any, listing: listing as any }),
      idempotencyKey: `booking_reserved_landlord_${booking.id}`,
      headers: commonHeaders,
    }),
  ]);

  return { sent: true as const };
}

