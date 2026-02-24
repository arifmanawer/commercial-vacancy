-- =============================================================================
-- contractors: contractor profiles for landlord browse
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================================

-- 1. Contractor profiles table
create table if not exists public.contractors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null,
  profile_picture_url text,
  services text[] not null default '{}',          -- e.g. ['Painting', 'Cleaning']
  hourly_rate numeric(10, 2) not null,
  service_radius integer not null,                -- in miles
  rating numeric(3, 2) not null default 0,        -- e.g. 4.70
  total_jobs_completed integer not null default 0,
  is_verified boolean not null default false,
  availability_status text not null default 'available' check (
    availability_status in ('available', 'soon', 'busy')
  ),
  available_days text[] not null default '{}',    -- e.g. ['Mon', 'Wed', 'Fri']
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ensure one contractor profile per auth user
create unique index if not exists contractors_user_id_key
  on public.contractors (user_id);

