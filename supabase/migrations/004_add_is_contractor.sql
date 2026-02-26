-- =============================================================================
-- Add is_contractor to profiles (contractor role)
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- Required before deploying the role selection checklist feature.
-- =============================================================================

alter table public.profiles
  add column if not exists is_contractor boolean default false not null;
