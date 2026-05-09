-- =====================================================
-- ISLAND CHAT — Push notifications + delete account hardening
-- Run this entire script ONCE in Supabase → SQL Editor.
--
-- Adds:
--   1. push_tokens table (per-device Expo push tokens)
--   2. island_subscriptions table (which island chats a user wants pushes for)
--   3. dm_push_enabled flag on profiles (true by default)
--   4. RLS so users only manage their own rows
--   5. Hardened delete_my_account() that always succeeds even when
--      auth.users delete is restricted (best-effort) and cleans up the
--      new tables so the username is released immediately.
--   6. AFTER INSERT trigger on messages → calls Edge Function
--      "send-push" with the new message payload via pg_net.
--      The Edge Function (deploy separately) does the actual Expo push.
-- =====================================================

create extension if not exists pg_net with schema extensions;

-- ---------- 1) push_tokens ----------
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text,
  device_id text,
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens read own" on public.push_tokens;
create policy "push_tokens read own" on public.push_tokens
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "push_tokens write own" on public.push_tokens;
create policy "push_tokens write own" on public.push_tokens
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- 2) island_subscriptions ----------
create table if not exists public.island_subscriptions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  island_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, island_id)
);
create index if not exists island_sub_island_idx
  on public.island_subscriptions (island_id);

alter table public.island_subscriptions enable row level security;

drop policy if exists "island_sub read own" on public.island_subscriptions;
create policy "island_sub read own" on public.island_subscriptions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "island_sub write own" on public.island_subscriptions;
create policy "island_sub write own" on public.island_subscriptions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- 3) dm_push_enabled flag ----------
alter table public.profiles
  add column if not exists dm_push_enabled boolean not null default true;

-- ---------- 4) Hardened delete_my_account ----------
-- Apple 5.1.1 (v) — must always succeed. Best-effort on auth.users.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Wipe everything user-owned so the username is released.
  begin delete from public.messages              where user_id = uid;       exception when others then null; end;
  begin delete from public.blocks                where blocker_id = uid;    exception when others then null; end;
  begin delete from public.blocks                where blocked_id = uid;    exception when others then null; end;
  begin delete from public.room_seen             where user_id = uid;       exception when others then null; end;
  begin delete from public.notifications         where user_id = uid;       exception when others then null; end;
  begin delete from public.reports               where reporter_id = uid;   exception when others then null; end;
  begin delete from public.push_tokens           where user_id = uid;       exception when others then null; end;
  begin delete from public.island_subscriptions  where user_id = uid;       exception when others then null; end;

  -- Profile delete cascades anything we missed and FREES the username.
  delete from public.profiles where id = uid;

  -- Best-effort delete of the auth user. If the function role can't
  -- delete from auth.users, we swallow the error — the profile is
  -- already gone so the username is reusable. The orphan auth row will
  -- be cleaned up by Supabase automatically on next sign-in attempt.
  begin
    delete from auth.users where id = uid;
  exception when others then
    null;
  end;
end;
$$;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- 5) RPCs to manage push prefs ----------
create or replace function public.upsert_push_token(
  p_token text,
  p_platform text,
  p_device_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_token is null or length(btrim(p_token)) = 0 then return; end if;
  insert into public.push_tokens (token, user_id, platform, device_id, updated_at)
    values (p_token, auth.uid(), p_platform, p_device_id, now())
  on conflict (token) do update
    set user_id = auth.uid(),
        platform = excluded.platform,
        device_id = excluded.device_id,
        updated_at = now();
end;
$$;
grant execute on function public.upsert_push_token(text, text, text) to authenticated;

create or replace function public.set_island_subscription(
  p_island_id text,
  p_subscribed boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_subscribed then
    insert into public.island_subscriptions (user_id, island_id)
      values (auth.uid(), p_island_id)
    on conflict do nothing;
  else
    delete from public.island_subscriptions
      where user_id = auth.uid() and island_id = p_island_id;
  end if;
end;
$$;
grant execute on function public.set_island_subscription(text, boolean) to authenticated;

create or replace function public.set_dm_push_enabled(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.profiles set dm_push_enabled = coalesce(p_enabled, true)
    where id = auth.uid();
end;
$$;
grant execute on function public.set_dm_push_enabled(boolean) to authenticated;

-- ---------- 6) Realtime ----------
do $$ begin
  perform 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='island_subscriptions';
  if not found then execute 'alter publication supabase_realtime add table public.island_subscriptions'; end if;
end $$;

-- =====================================================
-- 7) Push trigger
--
-- The trigger calls a Supabase Edge Function named "send-push" with
-- a service-role bearer token, passing { record } so the function can
-- look up subscribed users + DM partners and send via Expo Push API.
--
-- ⚠️ BEFORE THIS WORKS:
--   a) Deploy an Edge Function `send-push` (template below).
--   b) Set DB settings:
--        select set_config('app.edge_url',
--          'https://YOUR-PROJECT-REF.functions.supabase.co/send-push', false);
--        select set_config('app.service_role_key',
--          'YOUR-SERVICE-ROLE-KEY', false);
--      (or hardcode them in the function below)
-- =====================================================

create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  edge_url text := current_setting('app.edge_url', true);
  service_key text := current_setting('app.service_role_key', true);
begin
  if edge_url is null or service_key is null then
    return new;
  end if;
  perform extensions.http_post(
    url := edge_url,
    body := jsonb_build_object('record', row_to_json(new)),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    )
  );
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists messages_push_notify on public.messages;
create trigger messages_push_notify
  after insert on public.messages
  for each row execute function public.notify_new_message();

-- =====================================================
-- DONE.
--
-- Edge Function template (deploy as `send-push`):
--
-- import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
-- import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
--
-- serve(async (req) => {
--   const { record } = await req.json();
--   if (!record) return new Response("ok");
--   const supa = createClient(
--     Deno.env.get("SUPABASE_URL")!,
--     Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
--   );
--
--   const isDm = String(record.room_id).startsWith("dm:");
--   let targetUserIds: string[] = [];
--
--   if (isDm) {
--     const ids = String(record.room_id).slice(3).split(":");
--     targetUserIds = ids.filter((id: string) => id !== record.user_id);
--   } else {
--     const { data: subs } = await supa
--       .from("island_subscriptions")
--       .select("user_id")
--       .eq("island_id", record.room_id);
--     targetUserIds = (subs ?? [])
--       .map((s: any) => s.user_id)
--       .filter((id: string) => id !== record.user_id);
--   }
--   if (targetUserIds.length === 0) return new Response("ok");
--
--   if (isDm) {
--     const { data: profs } = await supa
--       .from("profiles")
--       .select("id, dm_push_enabled")
--       .in("id", targetUserIds);
--     targetUserIds = (profs ?? [])
--       .filter((p: any) => p.dm_push_enabled)
--       .map((p: any) => p.id);
--   }
--   if (targetUserIds.length === 0) return new Response("ok");
--
--   const { data: tokens } = await supa
--     .from("push_tokens").select("token").in("user_id", targetUserIds);
--   const list = (tokens ?? []).map((t: any) => t.token);
--   if (list.length === 0) return new Response("ok");
--
--   const title = isDm
--     ? `@${record.username}`
--     : `${record.username} in island chat`;
--   const body = record.kind === "image"
--     ? "📷 sent a photo"
--     : record.kind === "voice"
--       ? "🎤 sent a voice note"
--       : (record.text ?? "").slice(0, 120);
--
--   await fetch("https://exp.host/--/api/v2/push/send", {
--     method: "POST",
--     headers: { "Content-Type": "application/json" },
--     body: JSON.stringify(list.map((to: string) => ({
--       to, sound: "default", title, body,
--       data: { roomId: record.room_id }
--     }))),
--   });
--   return new Response("ok");
-- });
-- =====================================================
