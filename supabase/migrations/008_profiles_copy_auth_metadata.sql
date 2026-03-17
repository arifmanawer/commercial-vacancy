-- =============================================================================
-- auth: copy signup metadata into public.profiles on user creation
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
--
-- Why:
-- - New signups often have no session until email confirmation.
-- - RLS prevents the client from updating public.profiles without a session.
-- - We already send username/first/last/address/description in auth signUp options.data.
--   This migration copies those values into public.profiles at creation time.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    email,
    username,
    first_name,
    last_name,
    address,
    description,
    profile_picture_url
  )
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data->>'username', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'last_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'address', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'description', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'profile_picture_url', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

