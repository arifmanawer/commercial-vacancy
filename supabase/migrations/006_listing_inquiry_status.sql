-- =============================================================================
-- listing_inquiries: add status and landlord response fields
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================================

alter table public.listing_inquiries
  add column if not exists status text not null default 'pending' check (
    status in ('pending', 'accepted', 'declined', 'reschedule_proposed')
  ),
  add column if not exists landlord_message text,
  add column if not exists landlord_suggested_time text,
  add column if not exists resolved_at timestamp with time zone;

