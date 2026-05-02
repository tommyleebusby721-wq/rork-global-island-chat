import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export const BUCKET = 'chat-media';
export const MAX_PHOTOS_PER_USER = 5;
export const MAX_VOICE_PER_USER = 10;

function guessExt(uri: string, fallback: string): string {
  const m = uri.match(/\.([a-zA-Z0-9]{2,5})(?:\?|$)/);
  return (m ? m[1] : fallback).toLowerCase();
}

async function uriToBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  return await res.blob();
}

async function readAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return decodeBase64(base64);
}

const SIGNED_URL_TTL_SECONDS = 60 * 60;
const SIGNED_URL_REFRESH_BEFORE_MS = 5 * 60 * 1000;

interface SignedEntry {
  url: string;
  expiresAt: number;
  inflight?: Promise<string>;
}

const signedUrlCache = new Map<string, SignedEntry>();

function isStoragePath(value: string): boolean {
  if (!value) return false;
  if (value.startsWith('http://') || value.startsWith('https://')) return false;
  if (value.startsWith('file://') || value.startsWith('blob:') || value.startsWith('data:')) return false;
  return value.includes('/');
}

async function createSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'Failed to sign media URL');
  }
  return data.signedUrl;
}

export async function getSignedMediaUrl(pathOrUrl: string): Promise<string> {
  if (!isStoragePath(pathOrUrl)) return pathOrUrl;
  const now = Date.now();
  const cached = signedUrlCache.get(pathOrUrl);
  if (cached && cached.expiresAt - now > SIGNED_URL_REFRESH_BEFORE_MS) {
    return cached.url;
  }
  if (cached?.inflight) return cached.inflight;
  const inflight = createSignedUrl(pathOrUrl)
    .then((url) => {
      signedUrlCache.set(pathOrUrl, {
        url,
        expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
      });
      return url;
    })
    .catch((e) => {
      signedUrlCache.delete(pathOrUrl);
      throw e;
    });
  signedUrlCache.set(pathOrUrl, {
    url: cached?.url ?? '',
    expiresAt: cached?.expiresAt ?? 0,
    inflight,
  });
  return inflight;
}

export function invalidateSignedMediaUrl(pathOrUrl: string): void {
  signedUrlCache.delete(pathOrUrl);
}

async function listUserFiles(userId: string, prefix: 'photos' | 'voice'): Promise<{ name: string; created_at?: string }[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list(`${userId}/${prefix}`, {
    limit: 100,
    sortBy: { column: 'created_at', order: 'asc' },
  });
  if (error) {
    console.log('[media] list error', error.message);
    return [];
  }
  return (data ?? []).filter(f => f.name && !f.name.startsWith('.'));
}

async function enforceQuota(userId: string, prefix: 'photos' | 'voice', max: number): Promise<void> {
  const files = await listUserFiles(userId, prefix);
  if (files.length < max) return;
  const toDelete = files.slice(0, files.length - max + 1).map(f => `${userId}/${prefix}/${f.name}`);
  if (toDelete.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(toDelete);
  if (error) console.log('[media] remove error', error.message);
  else console.log('[media] rotated', toDelete.length, 'old files for', userId, prefix);
}

export async function uploadImageForUser(userId: string, localUri: string): Promise<string> {
  console.log('[media] compressing image', localUri);
  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1024 } }],
    { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG },
  );
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const path = `${userId}/photos/${fileName}`;

  let body: Blob | ArrayBuffer;
  if (Platform.OS === 'web') {
    body = await uriToBlob(manipulated.uri);
    console.log('[media] uploading image (web)', path, 'size', (body as Blob).size);
  } else {
    body = await readAsArrayBuffer(manipulated.uri);
    console.log('[media] uploading image (native)', path, 'bytes', (body as ArrayBuffer).byteLength);
  }

  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(error.message);

  void enforceQuota(userId, 'photos', MAX_PHOTOS_PER_USER).catch(() => {});
  return path;
}

export async function uploadVoiceForUser(userId: string, localUri: string): Promise<string> {
  const rawExt = Platform.OS === 'web' ? guessExt(localUri, 'webm') : 'm4a';
  const ext = rawExt === 'x-m4a' ? 'm4a' : rawExt;
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${userId}/voice/${fileName}`;

  const contentType =
    ext === 'm4a' || ext === 'mp4' || ext === 'aac'
      ? 'audio/mp4'
      : ext === 'webm'
      ? 'audio/webm'
      : ext === 'wav'
      ? 'audio/wav'
      : 'audio/mp4';

  let body: Blob | ArrayBuffer;
  if (Platform.OS === 'web') {
    body = await uriToBlob(localUri);
    console.log('[media] uploading voice (web)', path, 'size', (body as Blob).size, contentType);
  } else {
    body = await readAsArrayBuffer(localUri);
    console.log('[media] uploading voice (native)', path, 'bytes', (body as ArrayBuffer).byteLength, contentType);
  }

  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  void enforceQuota(userId, 'voice', MAX_VOICE_PER_USER).catch(() => {});
  return path;
}
