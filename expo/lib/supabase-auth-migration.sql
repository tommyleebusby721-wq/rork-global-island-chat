-- =====================================================
-- AUTH MIGRATION: link profiles to auth.users via user_id
-- Run in Supabase Dashboard → SQL Editor → New Query → RUN
-- =====================================================

-- 1) Add user_id column linking to auth.users
alter table public.profiles
  add column if not exists user_id uuid unique references auth.users(id) on delete cascade;

create index if not exists profiles_user_id_idx on public.profiles (user_id);

-- 2) RLS policies — tighten inserts/updates to owner only, keep reads public
alter table public.profiles enable row level security;

-- Drop the exact policies that this migration creates
drop policy if exists "profiles readable" on public.profiles;

drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles insert anon" on public.profiles;

drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "profiles delete own" on public.profiles;

-- (Optional) also drop old policies if they existed under other names
drop policy if exists "profiles insert" on public.profiles;
drop policy if exists "profiles update" on public.profiles;
drop policy if exists "profiles delete" on public.profiles;

create policy "profiles readable"
on public.profiles for select
to anon, authenticated
using (true);

create policy "profiles insert own"
on public.profiles for insert
to authenticated
with check (auth.uid() = user_id);

create policy "profiles insert anon"
on public.profiles for insert
to anon
with check (true);

create policy "profiles update own"
on public.profiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "profiles delete own"
on public.profiles for delete
to authenticated
using (auth.uid() = user_id);

-- 3) Grants (RLS restricts but grants must exist)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to anon, authenticated;
