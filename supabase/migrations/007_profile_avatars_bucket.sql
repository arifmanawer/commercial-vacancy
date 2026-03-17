-- =============================================================================
-- storage: profile_avatars bucket (public read)
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
--
-- Notes:
-- - The backend uses the service role key to upload, so upload is allowed.
-- - Making the bucket public allows getPublicUrl() to work without signed URLs.
-- =============================================================================

-- 1) Create the bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('profile_avatars', 'profile_avatars', true)
on conflict (id) do update set public = excluded.public;

-- 2) Public read access (only needed if your project enforces RLS on storage.objects)
-- Allow anyone to read objects in the profile_avatars bucket.
drop policy if exists "Public read profile avatars" on storage.objects;
create policy "Public read profile avatars"
on storage.objects for select
using (bucket_id = 'profile_avatars');

-- 3) Authenticated users can manage ONLY their own avatar objects
-- Enforces path format: avatars/<uid>/...
drop policy if exists "Users can upload own profile avatar" on storage.objects;
create policy "Users can upload own profile avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile_avatars'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "Users can update own profile avatar" on storage.objects;
create policy "Users can update own profile avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile_avatars'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'profile_avatars'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "Users can delete own profile avatar" on storage.objects;
create policy "Users can delete own profile avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile_avatars'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

