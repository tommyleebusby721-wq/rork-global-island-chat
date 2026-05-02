-- =====================================================
-- FIX: null value in column "id" of relation "profiles"
-- Run in Supabase Dashboard → SQL Editor → New Query → RUN
-- =====================================================

-- Make sure pgcrypto is available for gen_random_uuid()
create extension if not exists pgcrypto;

-- Restore default on profiles.id (in case it was dropped by a prior migration)
alter table public.profiles
  alter column id set default gen_random_uuid();
