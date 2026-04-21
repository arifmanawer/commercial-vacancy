-- =============================================================================
-- Stripe Connect: store connected account id on landlord profile
-- Run in Supabase SQL Editor (Dashboard → SQL Editor) if not applied via CLI
-- =============================================================================

alter table public.profiles
  add column if not exists stripe_account_id text;

comment on column public.profiles.stripe_account_id is 'Stripe Connect Express account id (acct_...) for marketplace payouts';
