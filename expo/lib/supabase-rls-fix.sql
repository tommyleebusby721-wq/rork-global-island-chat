-- =====================================================
-- FIX: "new row violates row-level security policy for table profiles"
-- Run this in Supabase Dashboard → SQL Editor → New Query → RUN
-- =====================================================

-- Make sure RLS is on (it already is, but safe to re-run)
alter table public.profiles      enable row level security;
alter table public.messages      enable row level security;
alter table public.blocks        enable row level security;
alter table public.room_seen     enable row level security;
alter table public.notifications enable row level security;
alter table public.islands       enable row level security;

-- ---------- PROFILES ----------
drop policy if exists "profiles readable" on public.profiles;
drop policy if exists "profiles insert"   on public.profiles;
drop policy if exists "profiles update"   on public.profiles;
drop policy if exists "profiles delete"   on public.profiles;

create policy "profiles readable"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "profiles insert"
  on public.profiles for insert
  to anon, authenticated
  with check (true);

create policy "profiles update"
  on public.profiles for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "profiles delete"
  on public.profiles for delete
  to anon, authenticated
  using (true);

-- ---------- ISLANDS (read-only for clients) ----------
drop policy if exists "islands readable" on public.islands;
create policy "islands readable"
  on public.islands for select
  to anon, authenticated
  using (true);

-- ---------- MESSAGES ----------
drop policy if exists "messages readable" on public.messages;
drop policy if exists "messages insert"   on public.messages;
drop policy if exists "messages update"   on public.messages;
drop policy if exists "messages delete"   on public.messages;

create policy "messages readable"
  on public.messages for select
  to anon, authenticated
  using (expires_at > now());

create policy "messages insert"
  on public.messages for insert
  to anon, authenticated
  with check (true);

create policy "messages update"
  on public.messages for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "messages delete"
  on public.messages for delete
  to anon, authenticated
  using (true);

-- ---------- BLOCKS ----------
drop policy if exists "blocks readable" on public.blocks;
drop policy if exists "blocks write"    on public.blocks;
create policy "blocks all"
  on public.blocks for all
  to anon, authenticated
  using (true) with check (true);

-- ---------- ROOM SEEN ----------
drop policy if exists "room_seen rw" on public.room_seen;
create policy "room_seen all"
  on public.room_seen for all
  to anon, authenticated
  using (true) with check (true);

-- ---------- NOTIFICATIONS ----------
drop policy if exists "notifications rw" on public.notifications;
create policy "notifications all"
  on public.notifications for all
  to anon, authenticated
  using (true) with check (true);

-- =====================================================
-- Make sure the anon + authenticated roles actually have table privileges
-- (RLS only restricts; it doesn't grant. If GRANTs are missing, inserts fail too.)
-- =====================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.profiles,
  public.messages,
  public.blocks,
  public.room_seen,
  public.notifications
to anon, authenticated;

grant select on public.islands to anon, authenticated;
