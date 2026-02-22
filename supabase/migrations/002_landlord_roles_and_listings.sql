-- =============================================================================
-- Multi-role: is_landlord, listings table, RLS for landlord-only creation
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================================

-- 1. Add is_landlord to profiles (all users start as renter)
alter table public.profiles
  add column if not exists is_landlord boolean default false not null;

-- 2. Create listings table (landlord-owned)
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Enable RLS on listings
alter table public.listings enable row level security;

-- 4. Listings policies

-- Anyone can read listings (browse)
create policy "Anyone can view listings"
  on public.listings for select
  using (true);

-- Only landlords can create listings (RLS enforces role at DB level)
create policy "Only landlords can create listings"
  on public.listings for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles
      where id = auth.uid()
      and is_landlord = true
    )
  );

-- Owners can update their own listings
create policy "Owners can update own listings"
  on public.listings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Owners can delete their own listings
create policy "Owners can delete own listings"
  on public.listings for delete
  using (auth.uid() = user_id);
