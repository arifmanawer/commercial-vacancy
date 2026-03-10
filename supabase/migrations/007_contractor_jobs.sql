-- =============================================================================
-- contractor_jobs: landlord -> contractor job requests
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================================

create table if not exists public.contractor_jobs (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references auth.users(id) on delete cascade,
  contractor_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  title text not null,
  description text,
  budget numeric(12, 2),
  preferred_date timestamptz,
  status text not null default 'requested' check (
    status in ('requested', 'accepted', 'declined', 'completed')
  ),
  landlord_note text,
  contractor_note text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.contractor_jobs enable row level security;

-- Landlord can create jobs they own
create policy "Landlord can create contractor jobs"
  on public.contractor_jobs for insert
  with check (auth.uid() = landlord_id);

-- Landlord can view jobs they created
create policy "Landlord can view own contractor jobs"
  on public.contractor_jobs for select
  using (auth.uid() = landlord_id);

-- Contractor can view jobs assigned to them
create policy "Contractor can view assigned contractor jobs"
  on public.contractor_jobs for select
  using (auth.uid() = contractor_id);

-- Landlord can update jobs they created (e.g. mark completed or adjust notes)
create policy "Landlord can update own contractor jobs"
  on public.contractor_jobs for update
  using (auth.uid() = landlord_id)
  with check (auth.uid() = landlord_id);

-- Contractor can update jobs assigned to them (e.g. accept/decline, add note)
create policy "Contractor can update assigned contractor jobs"
  on public.contractor_jobs for update
  using (auth.uid() = contractor_id)
  with check (auth.uid() = contractor_id);

