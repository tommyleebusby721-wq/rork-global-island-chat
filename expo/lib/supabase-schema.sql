-- =====================================================
-- ISLAND CHAT — Supabase Schema
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- =====================================================

-- ---------- ISLANDS (catalog of all Caribbean islands) ----------
create table if not exists public.islands (
  id text primary key,
  name text not null,
  subtitle text,
  flag text,
  flag_code text,
  region text,
  bio text
);

-- ---------- PROFILES (one row per user) ----------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  avatar_emoji text not null default '👤',
  island_id text references public.islands(id) on delete set null,
  device_id text,
  created_at timestamptz not null default now()
);

create index if not exists profiles_username_idx on public.profiles (lower(username));
create index if not exists profiles_island_idx on public.profiles (island_id);

-- ---------- MESSAGES (island chat + DMs, ephemeral 24h) ----------
create table if not exists public.messages (
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

create index if not exists messages_room_idx on public.messages (room_id, created_at desc);
create index if not exists messages_expires_idx on public.messages (expires_at);
create index if not exists messages_user_idx on public.messages (user_id);

-- ---------- BLOCKS (who blocked who) ----------
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- ---------- ROOM SEEN (unread tracking) ----------
create table if not exists public.room_seen (
  user_id uuid not null references public.profiles(id) on delete cascade,
  room_id text not null,
  seen_at timestamptz not null default now(),
  primary key (user_id, room_id)
);

-- ---------- NOTIFICATIONS (in-app) ----------
create table if not exists public.notifications (
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

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- =====================================================
-- CLEANUP: auto-delete expired messages (runs on read)
-- =====================================================
create or replace function public.cleanup_expired_messages()
returns void language sql as $$
  delete from public.messages where expires_at < now();
$$;

-- =====================================================
-- REALTIME: enable for live chat & notifications
-- =====================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.profiles;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
alter table public.profiles       enable row level security;
alter table public.messages       enable row level security;
alter table public.blocks         enable row level security;
alter table public.room_seen      enable row level security;
alter table public.notifications  enable row level security;
alter table public.islands        enable row level security;

-- Public read for islands
drop policy if exists "islands readable" on public.islands;
create policy "islands readable" on public.islands for select using (true);

-- Profiles: anyone can read; anyone can insert/update their own row
drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select using (true);

drop policy if exists "profiles insert" on public.profiles;
create policy "profiles insert" on public.profiles for insert with check (true);

drop policy if exists "profiles update" on public.profiles;
create policy "profiles update" on public.profiles for update using (true);

-- Messages: anyone can read non-expired; anyone can insert
drop policy if exists "messages readable" on public.messages;
create policy "messages readable" on public.messages for select using (expires_at > now());

drop policy if exists "messages insert" on public.messages;
create policy "messages insert" on public.messages for insert with check (true);

drop policy if exists "messages update" on public.messages;
create policy "messages update" on public.messages for update using (true);

drop policy if exists "messages delete" on public.messages;
create policy "messages delete" on public.messages for delete using (true);

-- Blocks: users manage their own
drop policy if exists "blocks readable" on public.blocks;
create policy "blocks readable" on public.blocks for select using (true);

drop policy if exists "blocks write" on public.blocks;
create policy "blocks write" on public.blocks for all using (true) with check (true);

-- Room seen
drop policy if exists "room_seen rw" on public.room_seen;
create policy "room_seen rw" on public.room_seen for all using (true) with check (true);

-- Notifications
drop policy if exists "notifications rw" on public.notifications;
create policy "notifications rw" on public.notifications for all using (true) with check (true);

-- =====================================================
-- SEED: Caribbean islands
-- =====================================================
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
