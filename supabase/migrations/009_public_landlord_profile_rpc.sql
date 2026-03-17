-- =============================================================================
-- Public landlord info RPC for listing details
--
-- Why:
-- - public.profiles has RLS allowing only auth.uid() = id, so other users can't
--   read landlord profile rows directly.
-- - Listing details needs to show limited landlord info (name/email/avatar).
-- - This RPC is SECURITY DEFINER and returns only safe columns.
-- =============================================================================

create or replace function public.get_listing_landlord_public(listing_id uuid)
returns table (
  id uuid,
  email text,
  username text,
  first_name text,
  last_name text,
  profile_picture_url text
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.email,
    p.username,
    p.first_name,
    p.last_name,
    p.profile_picture_url
  from public.listings l
  join public.profiles p on p.id = l.user_id
  where l.id = listing_id
    and p.is_landlord = true
  limit 1;
$$;

revoke all on function public.get_listing_landlord_public(uuid) from public;
grant execute on function public.get_listing_landlord_public(uuid) to anon;
grant execute on function public.get_listing_landlord_public(uuid) to authenticated;

