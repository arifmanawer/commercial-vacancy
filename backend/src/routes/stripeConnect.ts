import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../types';
import { requireStripe } from '../lib/stripe';

const router = Router();

type ConnectOnboardingResponse =
  | ApiResponse<{ onboarding_url: string; stripe_account_id: string }>
  | ApiResponse;

function logStripeConnect(
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

/**
 * POST /api/stripe/connect/onboarding
 *
 * Creates or reuses a Stripe Connect account for the landlord and returns an onboarding URL.
 * Auth model: expects X-User-Id header (or ?user_id= query param) just like other routes.
 */
router.post<{}, ConnectOnboardingResponse>(
  '/connect/onboarding',
  asyncHandler(async (req: Request, res: Response<ConnectOnboardingResponse>) => {
    const userId = (req.headers['x-user-id'] as string) || (req.query.user_id as string);

    if (!userId) {
      logStripeConnect('POST', '/api/stripe/connect/onboarding', undefined, false, 'Missing user_id');
      res
        .status(400)
        .json({ success: false, error: 'Missing user_id (X-User-Id header or user_id query param)' });
      return;
    }

    const refreshUrl = process.env.STRIPE_CONNECT_REFRESH_URL;
    const returnUrl = process.env.STRIPE_CONNECT_RETURN_URL;

    if (!refreshUrl || !returnUrl) {
      logStripeConnect(
        'POST',
        '/api/stripe/connect/onboarding',
        userId,
        false,
        'Missing STRIPE_CONNECT_REFRESH_URL or STRIPE_CONNECT_RETURN_URL'
      );
      res.status(500).json({
        success: false,
        error: 'Stripe Connect is not configured (missing refresh/return URLs)',
      });
      return;
    }

    const stripe = requireStripe();

    // Ensure profile exists and fetch any existing stripe_account_id
    const {
      data: profile,
      error: profileError,
    } = await supabaseAdmin
      .from('profiles')
      .select('id, email, first_name, last_name, stripe_account_id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      logStripeConnect(
        'POST',
        '/api/stripe/connect/onboarding',
        userId,
        false,
        profileError.message
      );
      res.status(500).json({ success: false, error: 'Failed to load profile for Stripe Connect' });
      return;
    }

    const email =
      (profile && (profile as any).email && String((profile as any).email)) ||
      `user_${userId}@example.invalid`;
    const firstName =
      (profile && (profile as any).first_name && String((profile as any).first_name)) || undefined;
    const lastName =
      (profile && (profile as any).last_name && String((profile as any).last_name)) || undefined;

    let accountId = profile && (profile as any).stripe_account_id;

    if (accountId) {
      // Reuse existing account, just create a new onboarding link
      try {
        const account = await stripe.accounts.retrieve(accountId);
        if (!account) {
          accountId = undefined;
        }
      } catch (err) {
        console.warn('Failed to retrieve existing Stripe account, creating new one', err);
        accountId = undefined;
      }
    }

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        business_profile: {
          product_description: 'Receives rental payouts for commercial vacancy platform',
        },
        metadata: {
          supabase_user_id: userId,
        },
      });

      accountId = account.id;

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ stripe_account_id: accountId })
        .eq('id', userId);

      if (updateError) {
        logStripeConnect(
          'POST',
          '/api/stripe/connect/onboarding',
          userId,
          false,
          updateError.message
        );
        res
          .status(500)
          .json({ success: false, error: 'Failed to save Stripe account to profile' });
        return;
      }
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId as string,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    logStripeConnect('POST', '/api/stripe/connect/onboarding', userId, true);
    res.json({
      success: true,
      data: {
        onboarding_url: accountLink.url,
        stripe_account_id: accountId as string,
      },
    });
  })
);

export default router;

