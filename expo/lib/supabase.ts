import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const FALLBACK_SUPABASE_URL = 'https://rxehhabhkqwhpuqwlbao.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable_KSUnJqGbw6O31SRy50cFLA_YUfc4Rmo';

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL as string) || FALLBACK_SUPABASE_URL;
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string) || FALLBACK_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

console.log('[supabase] init', { url: supabaseUrl });

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
