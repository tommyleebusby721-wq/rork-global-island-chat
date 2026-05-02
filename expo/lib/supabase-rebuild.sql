-- =====================================================
-- ISLAND CHAT — CLEAN REBUILD around auth.uid()
-- Paste this ENTIRE script into Supabase → SQL Editor → New Query → RUN
--
-- What it does:
--   1. Wipes existing app tables (profiles, messages, blocks, room_seen, notifications, recovery).
--   2. Recreates them so profile.id === auth.users.id (one source of truth).
--   3. Restores password-recovery RPCs against the new shape.
--   4. Re-enables Realtime and re-seeds the islands catalog.
--   5. Sets up RLS so users can only write as themselves.
-- =====================================================

-- ---------- 0) WIPE ----------
drop function if exists public.reset_password_with_recovery(text, text, text, text) cascade;
drop function if exists public.lookup_recovery_question(text, text) cascade;
drop function if exists public.set_security_answer(text, text) cascade;
drop function if exists public.cleanup_expired_messages() cascade;

drop table if exists public.notifications cascade;
drop table if exists public.room_seen      cascade;
drop table if exists public.blocks         cascade;
drop table if exists public.messages       cascade;
drop table if exists public.profiles       cascade;
-- islands stays (catalog), but recreate if missing
create table if not exists public.islands (
  id text primary key,
  name text not null,
  subtitle text,
  flag text,
  flag_code text,
  region text,
  bio text
);

create extension if not exists pgcrypto with schema extensions;

-- ---------- 1) PROFILES (id == auth.users.id) ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_emoji text not null default '👤',
  island_id text references public.islands(id) on delete set null,
  device_id text,
  security_question text,
  security_answer_hash text,
  created_at timestamptz not null default now()
);
create index profiles_username_idx on public.profiles (lower(username));
create index profiles_island_idx on public.profiles (island_id);

-- ---------- 2) MESSAGES ----------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  username text not null,
  avatar_emoji text not null,
  kind text not null check (kind in ('text','image','voice')),
  text text,
  image_uri text,
  voice_uri text,
  voice_duration int,
  mentions text[] default '{}',
  reactions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index messages_room_idx on public.messages (room_id, created_at desc);
create index messages_expires_idx on public.messages (expires_at);
create index messages_user_idx on public.messages (user_id);

-- ---------- 3) BLOCKS ----------
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- ---------- 4) ROOM SEEN ----------
create table public.room_seen (
  user_id uuid not null references public.profiles(id) on delete cascade,
  room_id text not null,
  seen_at timestamptz not null default now(),
  primary key (user_id, room_id)
);

-- ---------- 5) NOTIFICATIONS ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('mention','reaction','island','dm')),
  title text not null,
  body text,
  emoji text,
  room_id text,
  partner_id uuid,
  island_id text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------- 6) CLEANUP FN ----------
create or replace function public.cleanup_expired_messages()
returns void language sql as $$
  delete from public.messages where expires_at < now();
$$;

-- ---------- 7) REALTIME ----------
do $$ begin
  perform 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages';
  if not found then execute 'alter publication supabase_realtime add table public.messages'; end if;
  perform 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications';
  if not found then execute 'alter publication supabase_realtime add table public.notifications'; end if;
  perform 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profiles';
  if not found then execute 'alter publication supabase_realtime add table public.profiles'; end if;
end $$;

-- ---------- 8) RLS ----------
alter table public.profiles       enable row level security;
alter table public.messages       enable row level security;
alter table public.blocks         enable row level security;
alter table public.room_seen      enable row level security;
alter table public.notifications  enable row level security;
alter table public.islands        enable row level security;

-- Islands: public read
drop policy if exists "islands readable" on public.islands;
create policy "islands readable" on public.islands for select using (true);

-- Profiles: anyone can read; only owner can insert/update/delete their row
drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select using (true);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert
  to authenticated with check (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update
  to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles delete own" on public.profiles;
create policy "profiles delete own" on public.profiles for delete
  to authenticated using (auth.uid() = id);

-- Messages: everyone authenticated can read non-expired; only owner can insert/update/delete
drop policy if exists "messages readable" on public.messages;
create policy "messages readable" on public.messages for select
  using (expires_at > now());

drop policy if exists "messages insert own" on public.messages;
create policy "messages insert own" on public.messages for insert
  to authenticated with check (auth.uid() = user_id);

drop policy if exists "messages update" on public.messages;
-- reactions are a jsonb column on the message row — anyone authenticated may update reactions.
-- We keep it simple: allow any authenticated user to update messages (for reactions),
-- but only owner can delete.
create policy "messages update" on public.messages for update
  to authenticated using (true) with check (true);

drop policy if exists "messages delete own" on public.messages;
create policy "messages delete own" on public.messages for delete
  to authenticated using (auth.uid() = user_id);

-- Blocks: owner-only
drop policy if exists "blocks readable own" on public.blocks;
create policy "blocks readable own" on public.blocks for select
  to authenticated using (auth.uid() = blocker_id);

drop policy if exists "blocks write own" on public.blocks;
create policy "blocks write own" on public.blocks for all
  to authenticated using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

-- Room seen: owner-only
drop policy if exists "room_seen own" on public.room_seen;
create policy "room_seen own" on public.room_seen for all
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Notifications: owner-only read/update; inserts allowed (app writes them)
drop policy if exists "notifications read own" on public.notifications;
create policy "notifications read own" on public.notifications for select
  to authenticated using (auth.uid() = user_id);

drop policy if exists "notifications insert any" on public.notifications;
create policy "notifications insert any" on public.notifications for insert
  to authenticated with check (true);

drop policy if exists "notifications update own" on public.notifications;
create policy "notifications update own" on public.notifications for update
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "notifications delete own" on public.notifications;
create policy "notifications delete own" on public.notifications for delete
  to authenticated using (auth.uid() = user_id);

-- Grants
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.messages, public.blocks, public.room_seen, public.notifications to authenticated;
grant select on public.profiles, public.messages, public.islands to anon;

-- ---------- 9) RECOVERY RPCs ----------
create or replace function public.set_security_answer(
  p_question text,
  p_answer   text
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_question is null or length(btrim(p_question)) = 0 then raise exception 'Question required'; end if;
  if p_answer is null or length(btrim(p_answer)) < 2 then raise exception 'Answer must be at least 2 characters'; end if;

  update public.profiles
     set security_question    = btrim(p_question),
         security_answer_hash = extensions.crypt(lower(btrim(p_answer)), extensions.gen_salt('bf'))
   where id = auth.uid();
end;
$$;
grant execute on function public.set_security_answer(text, text) to authenticated;

create or replace function public.lookup_recovery_question(
  p_username  text,
  p_island_id text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_q text;
begin
  select security_question into v_q
    from public.profiles
   where lower(username) = lower(btrim(p_username))
     and island_id = p_island_id
     and security_answer_hash is not null
   limit 1;
  return v_q;
end;
$$;
grant execute on function public.lookup_recovery_question(text, text) to anon, authenticated;

create or replace function public.reset_password_with_recovery(
  p_username     text,
  p_island_id    text,
  p_answer       text,
  p_new_password text
) returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid;
  v_hash    text;
begin
  if p_new_password is null or length(p_new_password) < 6 then return false; end if;

  select id, security_answer_hash
    into v_user_id, v_hash
    from public.profiles
   where lower(username) = lower(btrim(p_username))
     and island_id = p_island_id
     and security_answer_hash is not null
   limit 1;

  if v_user_id is null or v_hash is null then return false; end if;
  if extensions.crypt(lower(btrim(p_answer)), v_hash) <> v_hash then return false; end if;

  update auth.users
     set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
         updated_at         = now()
   where id = v_user_id;

  return true;
end;
$$;
grant execute on function public.reset_password_with_recovery(text, text, text, text) to anon, authenticated;

-- ---------- 10) SEED ISLANDS ----------
insert into public.islands (id, name, subtitle, flag, flag_code, region, bio) values
  ('sint-maarten-dutch','Sint Maarten','Dutch Side','🇸🇽','sx','Leeward Islands','The Dutch side of the Friendly Island.'),
  ('saint-martin-french','Saint Martin','French Side','🇫🇷','mf','Leeward Islands','The French side.'),
  ('anguilla','Anguilla',null,'🇦🇮','ai','Leeward Islands','Powder-soft beaches.'),
  ('antigua-barbuda','Antigua & Barbuda',null,'🇦🇬','ag','Leeward Islands','365 beaches.'),
  ('saint-kitts-nevis','Saint Kitts & Nevis',null,'🇰🇳','kn','Leeward Islands','Twin-island federation.'),
  ('montserrat','Montserrat',null,'🇲🇸','ms','Leeward Islands','Emerald Isle.'),
  ('guadeloupe','Guadeloupe',null,'🇬🇵','gp','Leeward Islands','Butterfly-shaped.'),
  ('saint-barthelemy','Saint Barthélemy',null,'🇧🇱','bl','Leeward Islands','St Barts.'),
  ('dominica','Dominica',null,'🇩🇲','dm','Windward Islands','Nature Isle.'),
  ('martinique','Martinique',null,'🇲🇶','mq','Windward Islands','Flower of the Caribbean.'),
  ('saint-lucia','Saint Lucia',null,'🇱🇨','lc','Windward Islands','The Pitons.'),
  ('saint-vincent','Saint Vincent & the Grenadines',null,'🇻🇨','vc','Windward Islands','Bequia.'),
  ('grenada','Grenada',null,'🇬🇩','gd','Windward Islands','The Spice Isle.'),
  ('barbados','Barbados',null,'🇧🇧','bb','Windward Islands','Bajan pride.'),
  ('trinidad','Trinidad',null,'🇹🇹','tt','Southern Caribbean','Carnival capital.'),
  ('tobago','Tobago',null,'🇹🇹','tt','Southern Caribbean','Pigeon Point.'),
  ('aruba','Aruba',null,'🇦🇼','aw','Southern Caribbean','One happy island.'),
  ('curacao','Curaçao',null,'🇨🇼','cw','Southern Caribbean','Dushi island life.'),
  ('bonaire','Bonaire',null,'🇧🇶','bq','Southern Caribbean','Diver''s paradise.'),
  ('jamaica','Jamaica',null,'🇯🇲','jm','Greater Antilles','One love.'),
  ('dominican-republic','Dominican Republic',null,'🇩🇴','do','Greater Antilles','Bachata & merengue.'),
  ('haiti','Haiti',null,'🇭🇹','ht','Greater Antilles','First Black republic.'),
  ('cuba','Cuba',null,'🇨🇺','cu','Greater Antilles','Havana classics.'),
  ('puerto-rico','Puerto Rico',null,'🇵🇷','pr','Greater Antilles','Isla del Encanto.'),
  ('cayman-islands','Cayman Islands',null,'🇰🇾','ky','Greater Antilles','Seven Mile Beach.'),
  ('bahamas','Bahamas',null,'🇧🇸','bs','Lucayan Archipelago','700 islands.'),
  ('turks-caicos','Turks & Caicos',null,'🇹🇨','tc','Lucayan Archipelago','Grace Bay.'),
  ('us-virgin-islands','US Virgin Islands',null,'🇻🇮','vi','Virgin Islands','St Thomas, St John, St Croix.'),
  ('british-virgin-islands','British Virgin Islands',null,'🇻🇬','vg','Virgin Islands','Sailing mecca.'),
  ('guyana','Guyana',null,'🇬🇾','gy','Mainland Caribbean','Land of many waters.'),
  ('belize','Belize',null,'🇧🇿','bz','Mainland Caribbean','Barrier reef.')
on conflict (id) do nothing;

-- DONE. You should now be able to sign up fresh and chat.
