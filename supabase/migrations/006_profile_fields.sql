-- =============================================================================
-- Extend profiles with common user fields
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================================

alter table public.profiles
  add column if not exists username text unique,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists address text,
  add column if not exists description text,
  add column if not exists profile_picture_url text;

