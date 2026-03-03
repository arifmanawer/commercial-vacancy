-- =============================================================================
-- saved_listings: user saved/favorite listings + RLS
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================================

-- Table may already exist (created in Dashboard). Keep this idempotent.
create table if not exists public.saved_listings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Prevent duplicates: one save per user per listing
create unique index if not exists saved_listings_user_property_key
  on public.saved_listings (user_id, property_id);

-- Enable RLS
alter table public.saved_listings enable row level security;

-- Policies (drop/recreate for repeatable runs)
drop policy if exists "Users can view own saved listings" on public.saved_listings;
drop policy if exists "Users can save listings" on public.saved_listings;
drop policy if exists "Users can delete own saved listings" on public.saved_listings;

create policy "Users can view own saved listings"
  on public.saved_listings for select
  using (auth.uid() = user_id);

create policy "Users can save listings"
  on public.saved_listings for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own saved listings"
  on public.saved_listings for delete
  using (auth.uid() = user_id);

