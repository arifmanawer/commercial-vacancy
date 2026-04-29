-- =============================================================================
-- bookings: prevent duplicate \"reserved\" emails (idempotency)
-- =============================================================================

alter table public.bookings
  add column if not exists reserved_email_sent_at timestamptz;

create index if not exists idx_bookings_reserved_email_sent_at
  on public.bookings (reserved_email_sent_at)
  where reserved_email_sent_at is not null;

