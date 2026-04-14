-- =============================================================================
-- Reviews table for public profile reviews
--
-- Design decisions:
--   - reviewer_name / reviewer_avatar are de-normalised at INSERT time via a
--     BEFORE INSERT trigger so that public SELECT queries never need to JOIN
--     across the RLS-protected profiles table.
--   - UNIQUE (reviewer_id, target_user_id) enforces one review per pair.
--   - RLS: anyone (incl. anon) can SELECT; only authenticated users can INSERT
--     their own rows, and they cannot review themselves.
-- =============================================================================

-- 1. Create the reviews table
create table if not exists public.reviews (
  id              uuid primary key default gen_random_uuid(),
  target_user_id  uuid not null references auth.users(id) on delete cascade,
  reviewer_id     uuid not null references auth.users(id) on delete cascade,
  reviewer_name   text not null default '',
  reviewer_avatar text,
  role_context    text not null check (role_context in ('landlord', 'contractor', 'renter')),
  rating          smallint not null check (rating >= 1 and rating <= 5),
  content         text not null check (char_length(content) > 0),
  created_at      timestamptz not null default timezone('utc'::text, now()),

  -- one review per reviewer per profile
  constraint reviews_unique_reviewer_target unique (reviewer_id, target_user_id),
  -- cannot self-review
  constraint reviews_no_self_review check (reviewer_id <> target_user_id)
);

create index if not exists idx_reviews_target_user_id
  on public.reviews (target_user_id, created_at desc);

-- 2. Trigger: populate reviewer_name / reviewer_avatar from profiles at insert time
create or replace function public.reviews_set_reviewer_display()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first_name text;
  v_last_name  text;
  v_username   text;
  v_avatar     text;
begin
  select first_name, last_name, username, profile_picture_url
    into v_first_name, v_last_name, v_username, v_avatar
    from public.profiles
   where id = new.reviewer_id;

  new.reviewer_name :=
    coalesce(
      nullif(trim(coalesce(v_first_name, '') || ' ' || coalesce(v_last_name, '')), ''),
      v_username,
      'Verified User'
    );
  new.reviewer_avatar := v_avatar;

  return new;
end;
$$;

drop trigger if exists reviews_before_insert on public.reviews;
create trigger reviews_before_insert
  before insert on public.reviews
  for each row execute function public.reviews_set_reviewer_display();

-- 3. Enable RLS
alter table public.reviews enable row level security;

-- 4. RLS policies

-- Anyone (including anonymous visitors) can read reviews
create policy "Public can read reviews"
  on public.reviews
  for select
  using (true);

-- Authenticated users can insert their own reviews (not for themselves)
create policy "Authenticated users can insert reviews"
  on public.reviews
  for insert
  with check (
    auth.role() = 'authenticated'
    and auth.uid() = reviewer_id
    and reviewer_id <> target_user_id
  );
