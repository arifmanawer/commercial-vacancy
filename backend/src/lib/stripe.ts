import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

// Initialize lazily so the backend can boot even if Stripe is not configured yet.
export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    })
  : null;

export function requireStripe() {
  if (!stripe) {
    throw new Error(
      'Stripe is not configured: missing STRIPE_SECRET_KEY (required for Stripe payment/refund flows).'
    );
  }
  return stripe;
}

