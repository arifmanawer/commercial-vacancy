-- =============================================================================
-- listing_inquiries: interest + tour requests on listings
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================================

create table if not exists public.listing_inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  renter_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('contact', 'tour')),
  message text,
  preferred_time text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.listing_inquiries enable row level security;

-- Renter can insert their own inquiries
create policy "Renter can create listing inquiries"
  on public.listing_inquiries for insert
  with check (auth.uid() = renter_id);

-- Renter can view their own inquiries
create policy "Renter can view own listing inquiries"
  on public.listing_inquiries for select
  using (auth.uid() = renter_id);

-- Landlord can view inquiries on their own listings
create policy "Landlord can view listing inquiries on own listings"
  on public.listing_inquiries for select
  using (
    exists (
      select 1
      from public.listings
      where public.listings.id = listing_inquiries.listing_id
        and public.listings.user_id = auth.uid()
    )
  );

-- Renter can update their own inquiries (e.g. cancel, edit message)
create policy "Renter can update own listing inquiries"
  on public.listing_inquiries for update
  using (auth.uid() = renter_id)
  with check (auth.uid() = renter_id);

-- Landlord can update inquiries on their own listings (e.g. accept/decline/reschedule)
create policy "Landlord can update listing inquiries on own listings"
  on public.listing_inquiries for update
  using (
    exists (
      select 1
      from public.listings
      where public.listings.id = listing_inquiries.listing_id
        and public.listings.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.listings
      where public.listings.id = listing_inquiries.listing_id
        and public.listings.user_id = auth.uid()
    )
  );

