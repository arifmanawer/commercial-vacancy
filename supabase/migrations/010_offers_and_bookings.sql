-- =============================================================================
-- offers & bookings: structured offers linked to conversations and listings
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'offer_status') then
    create type public.offer_status as enum ('pending', 'accepted', 'declined', 'expired', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'booking_status') then
    create type public.booking_status as enum (
      'pending_payment',
      'reserved',
      'active',
      'completed',
      'cancelled',
      'refund_pending',
      'refund_completed',
      'payment_failed'
    );
  end if;
end $$;

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  landlord_id uuid not null references auth.users(id) on delete cascade,
  renter_id uuid not null references auth.users(id) on delete cascade,
  rate_type text not null,
  rate_amount numeric not null,
  currency text not null default 'usd',
  start_date timestamptz not null,
  duration integer not null,
  subtotal_amount bigint not null,
  platform_fee_amount bigint not null,
  total_amount bigint not null,
  status public.offer_status not null default 'pending',
  agreement_pdf_url text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_offers_conversation_id
  on public.offers (conversation_id, created_at desc);

create index if not exists idx_offers_listing_id
  on public.offers (listing_id, created_at desc);

create index if not exists idx_offers_renter_id
  on public.offers (renter_id, created_at desc);

create index if not exists idx_offers_landlord_id
  on public.offers (landlord_id, created_at desc);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  landlord_id uuid not null references auth.users(id) on delete cascade,
  renter_id uuid not null references auth.users(id) on delete cascade,
  start_datetime timestamptz not null,
  end_datetime timestamptz not null,
  status public.booking_status not null default 'pending_payment',
  payment_intent_id text,
  currency text not null default 'usd',
  total_amount bigint not null,
  platform_fee_amount bigint not null,
  landlord_amount bigint not null,
  cancelled_at timestamptz,
  cancellation_reason text,
  refund_amount bigint,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_bookings_renter_id
  on public.bookings (renter_id, start_datetime);

create index if not exists idx_bookings_landlord_id
  on public.bookings (landlord_id, start_datetime);

create index if not exists idx_bookings_status_start_datetime
  on public.bookings (status, start_datetime);

alter table public.offers enable row level security;
alter table public.bookings enable row level security;

create policy "Participants can view offers"
  on public.offers
  for select
  using (
    auth.uid() = landlord_id
    or auth.uid() = renter_id
  );

create policy "Landlord can create offers"
  on public.offers
  for insert
  with check (auth.uid() = landlord_id);

create policy "Participants can update offers status"
  on public.offers
  for update
  using (auth.uid() = landlord_id or auth.uid() = renter_id)
  with check (auth.uid() = landlord_id or auth.uid() = renter_id);

create policy "Participants can view bookings"
  on public.bookings
  for select
  using (auth.uid() = landlord_id or auth.uid() = renter_id);

