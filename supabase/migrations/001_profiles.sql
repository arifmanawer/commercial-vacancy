-- =============================================================================
-- auth: profiles table, auto-insert trigger, RLS
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================================

-- 1. Create profiles table (one row per auth user)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Auto-insert profile when a new user signs up
-- Guarantees exactly one profile per user; Supabase Auth enforces unique email
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (
    new.id,
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Drop existing trigger if present (idempotent)
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- 4. RLS policies: users can only read/update their own profile
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- No insert policy: only the trigger inserts. No delete: users cannot delete profiles.
-- No public access: unauthenticated users get no rows.
