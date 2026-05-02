-- =====================================================
-- RECOVERY MIGRATION: forgot-password via security question + home island
-- Run in Supabase Dashboard → SQL Editor → New Query → RUN
-- =====================================================

-- pgcrypto gives us crypt() + gen_salt('bf') (bcrypt) for hashing answers
create extension if not exists pgcrypto with schema extensions;

-- 1) Columns on profiles
alter table public.profiles
  add column if not exists security_question text,
  add column if not exists security_answer_hash text;

-- 2) RPC: set (or update) your own recovery question + answer
-- Stores answer as bcrypt hash. Lowercased + trimmed before hashing.
create or replace function public.set_security_answer(
  p_question text,
  p_answer   text
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_question is null or length(btrim(p_question)) = 0 then
    raise exception 'Question required';
  end if;
  if p_answer is null or length(btrim(p_answer)) < 2 then
    raise exception 'Answer must be at least 2 characters';
  end if;

  update public.profiles
     set security_question    = btrim(p_question),
         security_answer_hash = extensions.crypt(lower(btrim(p_answer)), extensions.gen_salt('bf'))
   where user_id = auth.uid();
end;
$$;

grant execute on function public.set_security_answer(text, text) to authenticated;

-- 3) RPC: look up the security question for a given username + island
-- Returns null if the username/island don't match or recovery isn't set up.
create or replace function public.lookup_recovery_question(
  p_username  text,
  p_island_id text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q text;
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

-- 4) RPC: reset password given username + island + security answer
-- Returns true on success, false otherwise (never reveals which field failed).
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
  if p_new_password is null or length(p_new_password) < 6 then
    return false;
  end if;

  select user_id, security_answer_hash
    into v_user_id, v_hash
    from public.profiles
   where lower(username) = lower(btrim(p_username))
     and island_id = p_island_id
     and security_answer_hash is not null
     and user_id is not null
   limit 1;

  if v_user_id is null or v_hash is null then
    return false;
  end if;

  if extensions.crypt(lower(btrim(p_answer)), v_hash) <> v_hash then
    return false;
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
         updated_at         = now()
   where id = v_user_id;

  return true;
end;
$$;

grant execute on function public.reset_password_with_recovery(text, text, text, text) to anon, authenticated;

-- 5) (Optional) allow clients to see if a profile has recovery set without exposing the hash.
-- The existing "profiles readable" policy already exposes every column. If you want to hide
-- the hash from clients, switch to a view; otherwise we just never select it from the app.
