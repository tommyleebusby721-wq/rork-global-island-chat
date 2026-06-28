-- =====================================================
-- ISLAND CHAT — Add 'video' message kind (COMPREHENSIVE)
-- Run this once in Supabase Dashboard → SQL Editor → New Query
-- =====================================================

-- 1. Allow kind = 'video' in messages table
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages
  add constraint messages_kind_check
  check (kind in ('text','image','voice','video'));

-- 2. Update storage bucket to accept video MIME types
--    (The bucket has a 2 MB file_size_limit — increase to 55 MB for videos)
update storage.buckets
  set file_size_limit = 55 * 1024 * 1024,
      allowed_mime_types = array[
        'image/jpeg','image/png','image/webp',
        'audio/mp4','audio/mpeg','audio/webm','audio/aac','audio/wav',
        'video/mp4','video/quicktime','video/webm','video/x-m4v'
      ]
  where id = 'chat-media';

-- 3. Update storage INSERT policy to allow the 'videos' folder
--    (previously only 'photos' and 'voice' were allowed)
drop policy if exists "chat-media insert own" on storage.objects;
create policy "chat-media insert own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-media'
    and auth.uid()::text = (storage.foldername(name))[1]
    and (storage.foldername(name))[2] in ('photos', 'voice', 'videos')
  );
