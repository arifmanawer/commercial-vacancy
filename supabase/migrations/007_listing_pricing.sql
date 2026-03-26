-- =============================================================================
-- listing_pricing: core pricing fields on listings
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================================

alter table public.listings
  add column if not exists rate_type text check (
    rate_type in ('hourly', 'daily', 'weekly', 'monthly')
  ),
  add column if not exists rate_amount numeric,
  add column if not exists min_duration integer,
  add column if not exists max_duration integer,
  add column if not exists currency text not null default 'usd',
  add column if not exists timezone text not null default 'UTC';

