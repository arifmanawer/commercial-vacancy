-- =============================================================================
-- Public user profile info RPC
--
-- Why:
-- - public.profiles has RLS allowing only auth.uid() = id
-- - Public profile pages need to read name/description/roles of other users
-- - This RPC is SECURITY DEFINER and returns safe columns of any user.
-- =============================================================================

create or replace function public.get_user_public_profile(profile_id uuid)
returns table (
  id uuid,
  username text,
  first_name text,
  last_name text,
  profile_picture_url text,
  description text,
  created_at timestamp with time zone,
  is_landlord boolean,
  is_contractor boolean
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.first_name,
    p.last_name,
    p.profile_picture_url,
    p.description,
    p.created_at,
    p.is_landlord,
    p.is_contractor
  from public.profiles p
  where p.id = profile_id
  limit 1;
$$;

revoke all on function public.get_user_public_profile(uuid) from public;
grant execute on function public.get_user_public_profile(uuid) to anon;
grant execute on function public.get_user_public_profile(uuid) to authenticated;
