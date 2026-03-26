import PDFDocument from 'pdfkit';
import { supabaseAdmin } from './supabaseAdmin';
import { sendTransactionalEmail } from './email';

type OfferStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';

interface OfferRow {
  id: string;
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
  agreement_pdf_url: string | null;
}

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
  start_datetime: string;
  end_datetime: string;
  status: BookingStatus;
  currency: string;
  total_amount: number;
  platform_fee_amount: number;
  landlord_amount: number;
}

interface ListingRow {
  id: string;
  title: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

const agreementsBucket = 'agreements';

function logAgreement(message: string, extra?: Record<string, unknown>) {
  console.log(`[Agreement] ${message}`, {
    timestamp: new Date().toISOString(),
    ...extra,
  });
}

async function loadBookingContext(bookingId: string): Promise<{
  booking: BookingRow;
  offer: OfferRow;
  listing: ListingRow | null;
  landlord: ProfileRow | null;
  renter: ProfileRow | null;
} | null> {
  const {
    data: booking,
    error: bookingError,
  } = await supabaseAdmin
    .from<BookingRow>('bookings')
    .select(
      'id, offer_id, listing_id, landlord_id, renter_id, start_datetime, end_datetime, status, currency, total_amount, platform_fee_amount, landlord_amount'
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingError) {
    logAgreement('Failed to load booking for agreement', {
      bookingId,
      error: bookingError.message,
    });
    return null;
  }

  if (!booking) {
    logAgreement('No booking found for agreement', { bookingId });
    return null;
  }

  const {
    data: offer,
    error: offerError,
  } = await supabaseAdmin
    .from<OfferRow>('offers')
    .select(
      'id, listing_id, landlord_id, renter_id, rate_type, rate_amount, currency, start_date, duration, subtotal_amount, platform_fee_amount, total_amount, status, agreement_pdf_url'
    )
    .eq('id', booking.offer_id)
    .maybeSingle();

  if (offerError) {
    logAgreement('Failed to load offer for agreement', {
      bookingId,
      offerId: booking.offer_id,
      error: offerError.message,
    });
    return null;
  }

  if (!offer) {
    logAgreement('No offer found for agreement', {
      bookingId,
      offerId: booking.offer_id,
    });
    return null;
  }

  const { data: listing, error: listingError } = await supabaseAdmin
    .from<ListingRow>('listings')
    .select('id, title, address, city, state, postal_code')
    .eq('id', booking.listing_id)
    .maybeSingle();

  if (listingError) {
    logAgreement('Failed to load listing for agreement', {
      bookingId,
      listingId: booking.listing_id,
      error: listingError.message,
    });
  }

  const { data: landlord, error: landlordError } = await supabaseAdmin
    .from<ProfileRow>('profiles')
    .select('id, full_name, email')
    .eq('id', booking.landlord_id)
    .maybeSingle();

  if (landlordError) {
    logAgreement('Failed to load landlord profile for agreement', {
      bookingId,
      landlordId: booking.landlord_id,
      error: landlordError.message,
    });
  }

  const { data: renter, error: renterError } = await supabaseAdmin
    .from<ProfileRow>('profiles')
    .select('id, full_name, email')
    .eq('id', booking.renter_id)
    .maybeSingle();

  if (renterError) {
    logAgreement('Failed to load renter profile for agreement', {
      bookingId,
      renterId: booking.renter_id,
      error: renterError.message,
    });
  }

  return {
    booking,
    offer,
    listing: listing ?? null,
    landlord: landlord ?? null,
    renter: renter ?? null,
  };
}

function formatCurrency(amountInMinor: number, currency: string): string {
  const major = amountInMinor / 100;
  const upper = (currency || 'usd').toUpperCase();
  return `${major.toFixed(2)} ${upper}`;
}

function buildAgreementPdfBuffer(context: {
  booking: BookingRow;
  offer: OfferRow;
  listing: ListingRow | null;
  landlord: ProfileRow | null;
  renter: ProfileRow | null;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => {
      chunks.push(chunk as Buffer);
    });

    doc.on('error', (err) => {
      reject(err);
    });

    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    const { booking, offer, listing, landlord, renter } = context;

    const landlordName = landlord?.full_name || landlord?.email || landlord?.id || 'Landlord';
    const renterName = renter?.full_name || renter?.email || renter?.id || 'Renter';
    const landlordEmail = landlord?.email ?? 'N/A';
    const renterEmail = renter?.email ?? 'N/A';

    const listingTitle = listing?.title || 'Listing';
    const listingAddress = [listing?.address, listing?.city, listing?.state, listing?.postal_code]
      .filter(Boolean)
      .join(', ');

    const startDate = new Date(booking.start_datetime);
    const endDate = new Date(booking.end_datetime);

    const total = formatCurrency(booking.total_amount, booking.currency);
    const platformFee = formatCurrency(booking.platform_fee_amount, booking.currency);
    const landlordAmount = formatCurrency(booking.landlord_amount, booking.currency);

    doc.fontSize(20).text('Rental Agreement', { align: 'center' });
    doc.moveDown();

    doc.fontSize(10).text(`Agreement ID: ${offer.id}`, { align: 'right' });
    doc.text(`Booking ID: ${booking.id}`, { align: 'right' });
    doc.moveDown();

    doc.fontSize(12).text('Parties', { underline: true });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .text(`Landlord: ${landlordName}`)
      .text(`Landlord email: ${landlordEmail}`)
      .moveDown(0.5)
      .text(`Renter: ${renterName}`)
      .text(`Renter email: ${renterEmail}`);

    doc.moveDown();
    doc.fontSize(12).text('Property', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Listing: ${listingTitle}`);
    if (listingAddress) {
      doc.text(`Address: ${listingAddress}`);
    }

    doc.moveDown();
    doc.fontSize(12).text('Term', { underline: true });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .text(`Start: ${startDate.toISOString()}`)
      .text(`End: ${endDate.toISOString()}`)
      .text(`Duration: ${offer.duration} ${offer.rate_type}(s)`);

    doc.moveDown();
    doc.fontSize(12).text('Financial Terms', { underline: true });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .text(`Rate: ${formatCurrency(Math.round(offer.rate_amount * 100), offer.currency)} per ${offer.rate_type}`)
      .text(`Subtotal: ${formatCurrency(offer.subtotal_amount, offer.currency)}`)
      .text(`Platform fee: ${platformFee}`)
      .text(`Total amount (paid by renter): ${total}`)
      .text(`Landlord payout (before any tax): ${landlordAmount}`);

    doc.moveDown();
    doc.fontSize(12).text('Agreement & Acceptance', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).text(
      'By clicking “Accept offer” (or similar) in the Commercial Vacancy platform and successfully completing payment, ' +
        'the Renter and Landlord enter into a binding rental agreement for the property identified above. In addition ' +
        'to the specific terms set out here (dates, price, and any applicable fees), both parties agree to the current ' +
        'Commercial Vacancy Terms of Service and any house rules or policies shown in the listing.'
    );
    doc.moveDown(0.5);
    doc.fontSize(10).text(
      'This agreement is formed electronically. The parties consent to use of electronic records and signatures, ' +
        'and acknowledge that their actions in the app (including accepting an offer and completing payment) ' +
        'constitute their intent to sign and be legally bound, to the fullest extent permitted by applicable law.'
    );

    doc.moveDown();
    doc.fontSize(12).text('Cancellations & Refunds', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).text(
      'Cancellations and refunds are governed by the refund policy communicated in the Commercial Vacancy app or in the listing. ' +
        'Refund eligibility and amounts may depend on when a cancellation is requested relative to the booking start date. ' +
        'Any refunds will be processed through the same payment method where possible and reflected in the booking record.'
    );

    doc.moveDown();
    doc.fontSize(12).text('Additional Terms', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).text(
      'Commercial Vacancy operates as an online marketplace and does not itself become a party to this rental agreement. ' +
        'Except as required by law, Commercial Vacancy is not responsible for the condition of the property, conduct of the parties, ' +
        'or compliance with local regulations. This agreement is intended to supplement (not limit) any non-waivable statutory rights ' +
        'that may apply to the Renter or Landlord in the relevant jurisdiction.'
    );

    doc.moveDown(2);
    doc.fontSize(10).text(`Generated at: ${new Date().toISOString()}`, {
      align: 'right',
    });

    doc.end();
  });
}

async function uploadAgreementPdf(offerId: string, bookingId: string, pdf: Buffer): Promise<string | null> {
  const filePath = `offer-${offerId}/booking-${bookingId}.pdf`;

  const { error } = await supabaseAdmin.storage
    .from(agreementsBucket)
    .upload(filePath, pdf, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) {
    logAgreement('Failed to upload agreement PDF', {
      offerId,
      bookingId,
      error: error.message,
    });
    return null;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    logAgreement('Missing SUPABASE_URL when building agreement URL', {
      filePath,
      bucket: agreementsBucket,
    });
    return filePath;
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${agreementsBucket}/${filePath}`;
  return publicUrl;
}

async function saveAgreementUrlOnOffer(offerId: string, url: string | null): Promise<void> {
  if (!url) {
    return;
  }

  const { error } = await supabaseAdmin
    .from<OfferRow>('offers')
    .update({ agreement_pdf_url: url } as Partial<OfferRow>)
    .eq('id', offerId);

  if (error) {
    logAgreement('Failed to save agreement URL on offer', {
      offerId,
      error: error.message,
    });
  }
}

async function sendAgreementEmails(context: {
  booking: BookingRow;
  offer: OfferRow;
  listing: ListingRow | null;
  landlord: ProfileRow | null;
  renter: ProfileRow | null;
  agreementUrl: string | null;
}): Promise<void> {
  const { booking, offer, listing, landlord, renter, agreementUrl } = context;

  const landlordEmail = landlord?.email || null;
  const renterEmail = renter?.email || null;

  const recipients = [landlordEmail, renterEmail].filter(
    (email): email is string => Boolean(email)
  );

  if (!recipients.length) {
    logAgreement('No email recipients for agreement; skipping email send', {
      bookingId: booking.id,
    });
    return;
  }

  const listingTitle = listing?.title || 'Listing';
  const startDate = new Date(booking.start_datetime);
  const endDate = new Date(booking.end_datetime);

  const total = formatCurrency(booking.total_amount, booking.currency);
  const landlordAmount = formatCurrency(booking.landlord_amount, booking.currency);

  const subject = `Booking confirmed – Agreement for ${listingTitle}`;

  const htmlParts: string[] = [];
  htmlParts.push(`<p>Your booking has been confirmed for <strong>${listingTitle}</strong>.</p>`);
  htmlParts.push(
    `<p><strong>Dates:</strong> ${startDate.toISOString()} – ${endDate.toISOString()}</p>`
  );
  htmlParts.push(`<p><strong>Total paid by renter:</strong> ${total}</p>`);
  htmlParts.push(`<p><strong>Landlord payout (before any tax):</strong> ${landlordAmount}</p>`);

  if (agreementUrl) {
    htmlParts.push(
      `<p>You can view or download the signed agreement here: <a href="${agreementUrl}">${agreementUrl}</a></p>`
    );
  } else {
    htmlParts.push(
      '<p>The agreement PDF is being generated. It will be available in your account shortly.</p>'
    );
  }

  htmlParts.push(
    '<p>If you have any questions about this booking, please reply to this email or contact support via the app.</p>'
  );

  await sendTransactionalEmail({
    to: recipients,
    subject,
    html: htmlParts.join(''),
  });
}

export async function generateAndSendAgreementForBooking(bookingId: string): Promise<void> {
  try {
    const context = await loadBookingContext(bookingId);
    if (!context) {
      return;
    }

    const pdf = await buildAgreementPdfBuffer(context);
    const agreementUrl = await uploadAgreementPdf(context.offer.id, context.booking.id, pdf);

    await saveAgreementUrlOnOffer(context.offer.id, agreementUrl);

    await sendAgreementEmails({
      ...context,
      agreementUrl,
    });

    logAgreement('Successfully generated agreement PDF and sent emails', {
      bookingId,
      offerId: context.offer.id,
      agreementUrl,
    });
  } catch (err: any) {
    logAgreement('Unexpected error while generating agreement PDF', {
      bookingId,
      error: err?.message ?? String(err),
    });
  }
}

