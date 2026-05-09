-- =====================================================
-- ISLAND CHAT — Add 'video' message kind
-- Run this once in Supabase Dashboard → SQL Editor → New Query
-- =====================================================

-- Allow kind = 'video'
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages
  add constraint messages_kind_check
  check (kind in ('text','image','voice','video'));

-- Note: video files reuse the existing `image_uri` column for the
-- storage path, and `voice_duration` for the video duration in seconds.
-- This avoids needing new columns or a backfill.
