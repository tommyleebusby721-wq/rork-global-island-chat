-- =====================================================
-- ISLAND CHAT — App Store compliance migration
-- Run once in Supabase → SQL Editor
-- Adds:
--   • Account deletion RPC (Guideline 5.1.1 v)
--   • Reports table + RPC (Guideline 1.2)
--   • Terms acceptance tracking (Guideline 1.2)
-- =====================================================

-- ---------- Terms acceptance on profiles ----------
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;

-- ---------- REPORTS (user-generated content moderation) ----------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid,
  room_id text,
  kind text not null check (kind in ('message','user','dm','island')),
  reason text,
  snapshot_text text,
  status text not null default 'open' check (status in ('open','reviewed','actioned','dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists reports_reported_user_idx on public.reports (reported_user_id, created_at desc);
create index if not exists reports_status_idx on public.reports (status, created_at desc);

alter table public.reports enable row level security;

-- Reporter can insert, can read their own
drop policy if exists "reports insert own" on public.reports;
create policy "reports insert own"
  on public.reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

drop policy if exists "reports read own" on public.reports;
create policy "reports read own"
  on public.reports for select
  to authenticated
  using (auth.uid() = reporter_id);

-- ---------- RPC: submit report ----------
create or replace function public.submit_report(
  p_reported_user_id uuid,
  p_message_id uuid,
  p_room_id text,
  p_kind text,
  p_reason text,
  p_snapshot_text text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  reporter uuid := auth.uid();
begin
  if reporter is null then
    raise exception 'not authenticated';
  end if;
  insert into public.reports
    (reporter_id, reported_user_id, message_id, room_id, kind, reason, snapshot_text)
  values
    (reporter, p_reported_user_id, p_message_id, p_room_id, coalesce(p_kind,'message'), p_reason, p_snapshot_text)
  returning id into new_id;
  return new_id;
end;
$$;
grant execute on function public.submit_report(uuid, uuid, text, text, text, text) to authenticated;

-- ---------- RPC: accept terms ----------
create or replace function public.accept_terms(p_version text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.profiles
    set terms_accepted_at = now(),
        terms_version = p_version
    where id = auth.uid();
end;
$$;
grant execute on function public.accept_terms(text) to authenticated;

-- ---------- RPC: delete my account ----------
-- Removes user data (profile cascades messages, blocks, room_seen, notifications, reports)
-- and deletes the auth user entirely. Apple 5.1.1 (v).
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

  -- Remove any content the user posted (messages table cascades on profile delete,
  -- but we null out any dangling references just in case)
  delete from public.messages where user_id = uid;
  delete from public.blocks where blocker_id = uid or blocked_id = uid;
  delete from public.room_seen where user_id = uid;
  delete from public.notifications where user_id = uid;
  delete from public.reports where reporter_id = uid;
  delete from public.profiles where id = uid;

  -- Finally remove the auth user
  delete from auth.users where id = uid;
end;
$$;
grant execute on function public.delete_my_account() to authenticated;
