import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { UserProfile } from '@/types';
import { supabase } from '@/lib/supabase';
import { TERMS_VERSION } from '@/constants/moderation';

const PROFILE_KEY = 'gic_profile_v4';
const DEVICE_KEY = 'gic_device_v4';
const LANG_KEY = 'gic_lang_v1';
const AUTO_TRANSLATE_KEY = 'gic_auto_translate_v1';
const ALLOW_DM_ALL_KEY = 'gic_allow_dm_all_v1';

export const SUPPORTED_LANGUAGES: { code: string; label: string; flag: string }[] = [
  { code: 'English', label: 'English', flag: '🇺🇸' },
  { code: 'Spanish', label: 'Español', flag: '🇪🇸' },
  { code: 'French', label: 'Français', flag: '🇫🇷' },
  { code: 'Haitian Creole', label: 'Kreyòl Ayisyen', flag: '🇭🇹' },
  { code: 'Dutch', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'Papiamento', label: 'Papiamentu', flag: '🇦🇼' },
  { code: 'Portuguese', label: 'Português', flag: '🇵🇹' },
];

export interface StoredUser {
  id: string;
  username: string;
  avatarEmoji: string;
  islandId?: string;
}

interface DbProfile {
  id: string;
  username: string;
  avatar_emoji: string;
  island_id: string | null;
  device_id: string | null;
  created_at: string;
  security_question?: string | null;
}

export const SECURITY_QUESTIONS: string[] = [
  'What was the name of your first pet?',
  'What city were you born in?',
  'What is your favorite food?',
  'What was your childhood nickname?',
  'What is your favorite song?',
  'What is your mother’s maiden name?',
];

function dbToStored(p: DbProfile): StoredUser {
  return {
    id: p.id,
    username: p.username,
    avatarEmoji: p.avatar_emoji,
    islandId: p.island_id ?? undefined,
  };
}

const EMAIL_DOMAIN = 'gmail.com';
function usernameToEmail(username: string): string {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${clean}.user@${EMAIL_DOMAIN}`;
}

export const [UserProvider, useUser] = createContextHook(() => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<StoredUser[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');
  const [blocked, setBlocked] = useState<string[]>([]);
  const [preferredLanguage, setPreferredLanguage] = useState<string>('English');
  const [autoTranslate, setAutoTranslate] = useState<boolean>(false);
  const [allowDmFromEveryone, setAllowDmFromEveryone] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshBlocks = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', userId);
      if (error) throw error;
      setBlocked((data ?? []).map(r => r.blocked_id as string));
    } catch (e) {
      console.log('[blocks] fetch error', e);
    }
  }, []);

  const loadAllUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      setAllUsers((data ?? []).map(dbToStored));
    } catch (e) {
      console.log('[profiles] fetch error', e);
    }
  }, []);

  const loadProfileForAuthUser = useCallback(async (authUserId: string): Promise<UserProfile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUserId)
      .maybeSingle();
    if (error) {
      console.log('[profile] fetch error', error);
      return null;
    }
    if (!data) return null;
    const p: DbProfile = data;
    const mapped: UserProfile = {
      id: p.id,
      username: p.username,
      avatarEmoji: p.avatar_emoji,
      islandId: p.island_id ?? undefined,
      createdAt: p.created_at,
      hasRecovery: !!p.security_question,
    };
    return mapped;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [storedProfile, storedDevice, storedLang, storedAuto, storedAllowDm] = await Promise.all([
          AsyncStorage.getItem(PROFILE_KEY),
          AsyncStorage.getItem(DEVICE_KEY),
          AsyncStorage.getItem(LANG_KEY),
          AsyncStorage.getItem(AUTO_TRANSLATE_KEY),
          AsyncStorage.getItem(ALLOW_DM_ALL_KEY),
        ]);
        if (storedLang) setPreferredLanguage(storedLang);
        if (storedAuto) setAutoTranslate(storedAuto === '1');
        if (storedAllowDm !== null) setAllowDmFromEveryone(storedAllowDm === '1');

        let did = storedDevice ?? '';
        if (!did) {
          did = `d_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
          await AsyncStorage.setItem(DEVICE_KEY, did);
        }
        setDeviceId(did);

        let authUser: { id: string } | null = null;
        try {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) {
            console.log('[UserContext] getSession error — clearing stale tokens', sessionError);
            try { await supabase.auth.signOut(); } catch (e) { console.log('[UserContext] signOut error', e); }
          } else {
            authUser = sessionData.session?.user ?? null;
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log('[UserContext] getSession threw — clearing stale tokens', msg);
          if (/Refresh Token|refresh_token/i.test(msg)) {
            try { await supabase.auth.signOut(); } catch (err) { console.log('[UserContext] signOut error', err); }
          }
        }

        if (authUser) {
          const fresh = await loadProfileForAuthUser(authUser.id);
          if (fresh) {
            setProfile(fresh);
            await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(fresh));
            void refreshBlocks(fresh.id);
          } else {
            console.log('[UserContext] session exists but no profile in DB — signing out stale session');
            try { await supabase.auth.signOut(); } catch (e) { console.log('[UserContext] signOut error', e); }
            await AsyncStorage.removeItem(PROFILE_KEY);
            setProfile(null);
          }
        } else {
          await AsyncStorage.removeItem(PROFILE_KEY);
          setProfile(null);
        }

        await loadAllUsers();
      } catch (e) {
        console.log('[UserContext] load error', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [loadAllUsers, refreshBlocks, loadProfileForAuthUser]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[auth] state change', event, !!session);
      if (event === 'SIGNED_OUT' || !session) {
        setProfile(null);
        setBlocked([]);
        await AsyncStorage.removeItem(PROFILE_KEY);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        const fresh = await loadProfileForAuthUser(session.user.id);
        if (fresh) {
          setProfile(fresh);
          await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(fresh));
          void refreshBlocks(fresh.id);
        } else if (event === 'SIGNED_IN') {
          console.log('[auth] SIGNED_IN but no profile row — staying signed in briefly to let signUp finish');
        }
      }
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [loadProfileForAuthUser, refreshBlocks]);

  useEffect(() => {
    const channel = supabase
      .channel('profiles-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          const row = (payload.new ?? payload.old) as DbProfile | undefined;
          if (!row) return;
          if (payload.eventType === 'DELETE') {
            setAllUsers(prev => prev.filter(u => u.id !== row.id));
            return;
          }
          const mapped = dbToStored(row);
          setAllUsers(prev => {
            const idx = prev.findIndex(u => u.id === mapped.id);
            if (idx === -1) return [mapped, ...prev];
            const next = prev.slice();
            next[idx] = mapped;
            return next;
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel).catch(() => {}); };
  }, []);

  const isUsernameAvailable = useCallback(
    (username: string): boolean => {
      const uname = username.trim().toLowerCase();
      if (!uname) return false;
      return !allUsers.some(u => u.username.toLowerCase() === uname);
    },
    [allUsers],
  );

  const signUp = useCallback(
    async (
      username: string,
      password: string,
      avatarEmoji: string,
      islandId?: string,
      recovery?: { question: string; answer: string },
    ): Promise<{ ok: boolean; error?: string }> => {
      const uname = username.trim().toLowerCase();
      if (!uname) return { ok: false, error: 'Username is required' };
      if (uname.length < 3 || uname.length > 15) return { ok: false, error: '3–15 characters' };
      if (!/^[a-z0-9]+$/.test(uname)) return { ok: false, error: 'Letters and numbers only' };
      if (!password || password.length < 6) return { ok: false, error: 'Password must be at least 6 characters' };
      if (!islandId) return { ok: false, error: 'Pick your island' };

      try {
        const { data: existing, error: checkError } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', uname)
          .maybeSingle();
        if (checkError) console.log('[signUp] check error', checkError);
        if (existing) return { ok: false, error: 'Username already taken' };

        const email = usernameToEmail(uname);
        let authUserId: string | null = null;
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (authError || !authData.user) {
          const msg = authError?.message ?? 'Could not create account';
          console.log('[signUp] auth error', authError);
          if (/already|registered|exists/i.test(msg)) {
            // orphan auth user from a previous failed signup — try to recover by signing in
            const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
            if (signInErr || !signInData.user) {
              return { ok: false, error: 'Username already taken' };
            }
            authUserId = signInData.user.id;
          } else {
            return { ok: false, error: msg };
          }
        } else {
          authUserId = authData.user.id;
          if (!authData.session) {
            const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
            if (signInErr) console.log('[signUp] auto signIn error', signInErr);
          }
        }

        if (!authUserId) return { ok: false, error: 'Could not create account' };

        const existingRow = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUserId)
          .maybeSingle();

        let data: DbProfile | null = null;
        if (existingRow.data) {
          const { data: updated, error: updateErr } = await supabase
            .from('profiles')
            .update({
              username: uname,
              avatar_emoji: avatarEmoji,
              island_id: islandId,
              device_id: deviceId || null,
            })
            .eq('id', authUserId)
            .select('*')
            .single();
          if (updateErr || !updated) {
            console.log('[signUp] update error', updateErr);
            return { ok: false, error: updateErr?.message ?? 'Could not update profile' };
          }
          data = updated;
        } else {
          const { data: inserted, error: insertErr } = await supabase
            .from('profiles')
            .insert({
              id: authUserId,
              username: uname,
              avatar_emoji: avatarEmoji,
              island_id: islandId,
              device_id: deviceId || null,
            })
            .select('*')
            .single();
          if (insertErr || !inserted) {
            console.log('[signUp] insert error', insertErr);
            return { ok: false, error: insertErr?.message ?? 'Could not create profile' };
          }
          data = inserted;
        }

        const p: DbProfile = data;
        const newProfile: UserProfile = {
          id: p.id,
          username: p.username,
          avatarEmoji: p.avatar_emoji,
          islandId: p.island_id ?? undefined,
          createdAt: p.created_at,
          hasRecovery: !!p.security_question,
        };
        if (recovery && recovery.question && recovery.answer.trim().length >= 2) {
          const { error: recErr } = await supabase.rpc('set_security_answer', {
            p_question: recovery.question,
            p_answer: recovery.answer,
          });
          if (recErr) {
            console.log('[signUp] recovery error', recErr);
          } else {
            newProfile.hasRecovery = true;
          }
        }

        setProfile(newProfile);
        await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile));
        setAllUsers(prev => {
          const exists = prev.some(u => u.id === newProfile.id);
          return exists ? prev : [dbToStored(p), ...prev];
        });
        console.log('[signUp] ok', newProfile.id);
        return { ok: true };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Network error';
        console.log('[signUp] exception', e);
        return { ok: false, error: msg };
      }
    },
    [deviceId],
  );

  const signIn = useCallback(
    async (username: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      const uname = username.trim().toLowerCase();
      if (!uname) return { ok: false, error: 'Username is required' };
      if (!password) return { ok: false, error: 'Password is required' };
      try {
        const email = usernameToEmail(uname);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data.user) {
          console.log('[signIn] error', error);
          return { ok: false, error: 'Invalid username or password' };
        }
        const fresh = await loadProfileForAuthUser(data.user.id);
        if (!fresh) {
          console.log('[signIn] no profile row for auth user — cleaning up stale session');
          try { await supabase.auth.signOut(); } catch (e) { console.log('[signIn] signOut error', e); }
          return { ok: false, error: 'Profile not found. Please sign up.' };
        }
        setProfile(fresh);
        await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(fresh));
        void refreshBlocks(fresh.id);
        return { ok: true };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Network error';
        console.log('[signIn] exception', e);
        return { ok: false, error: msg };
      }
    },
    [loadProfileForAuthUser, refreshBlocks],
  );

  const setSecurityAnswer = useCallback(
    async (question: string, answer: string): Promise<{ ok: boolean; error?: string }> => {
      const q = question.trim();
      const a = answer.trim();
      if (!q) return { ok: false, error: 'Pick a question' };
      if (a.length < 2) return { ok: false, error: 'Answer must be at least 2 characters' };
      try {
        const { error } = await supabase.rpc('set_security_answer', {
          p_question: q,
          p_answer: a,
        });
        if (error) {
          console.log('[setSecurityAnswer] error', error);
          return { ok: false, error: error.message };
        }
        setProfile(prev => (prev ? { ...prev, hasRecovery: true } : prev));
        return { ok: true };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Network error';
        return { ok: false, error: msg };
      }
    },
    [],
  );

  const lookupRecoveryQuestion = useCallback(
    async (username: string, islandId: string): Promise<{ ok: boolean; question?: string; error?: string }> => {
      const uname = username.trim().toLowerCase();
      if (!uname) return { ok: false, error: 'Username is required' };
      if (!islandId) return { ok: false, error: 'Pick your island' };
      try {
        const { data, error } = await supabase.rpc('lookup_recovery_question', {
          p_username: uname,
          p_island_id: islandId,
        });
        if (error) {
          console.log('[lookupRecoveryQuestion] error', error);
          return { ok: false, error: error.message };
        }
        if (!data) return { ok: false, error: 'No recovery set up for this username + island' };
        return { ok: true, question: data as string };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Network error';
        return { ok: false, error: msg };
      }
    },
    [],
  );

  const resetPasswordWithRecovery = useCallback(
    async (
      username: string,
      islandId: string,
      answer: string,
      newPassword: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!newPassword || newPassword.length < 6) {
        return { ok: false, error: 'Password must be at least 6 characters' };
      }
      try {
        const { data, error } = await supabase.rpc('reset_password_with_recovery', {
          p_username: username.trim().toLowerCase(),
          p_island_id: islandId,
          p_answer: answer,
          p_new_password: newPassword,
        });
        if (error) {
          console.log('[resetPassword] error', error);
          return { ok: false, error: error.message };
        }
        if (!data) return { ok: false, error: 'Incorrect answer. Try again.' };
        return { ok: true };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Network error';
        return { ok: false, error: msg };
      }
    },
    [],
  );

  const acceptTerms = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      const { error } = await supabase.rpc('accept_terms', { p_version: TERMS_VERSION });
      if (error) {
        console.log('[acceptTerms] error', error);
        return { ok: false, error: error.message };
      }
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Network error';
      return { ok: false, error: msg };
    }
  }, []);

  const submitReport = useCallback(
    async (input: {
      reportedUserId: string;
      messageId?: string;
      roomId?: string;
      kind: 'message' | 'user' | 'dm' | 'island';
      reason?: string;
      snapshotText?: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      try {
        const { error } = await supabase.rpc('submit_report', {
          p_reported_user_id: input.reportedUserId,
          p_message_id: input.messageId ?? null,
          p_room_id: input.roomId ?? null,
          p_kind: input.kind,
          p_reason: input.reason ?? null,
          p_snapshot_text: input.snapshotText ?? null,
        });
        if (error) {
          console.log('[submitReport] error', error);
          return { ok: false, error: error.message };
        }
        return { ok: true };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Network error';
        return { ok: false, error: msg };
      }
    },
    [],
  );

  const deleteAccount = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      const { error } = await supabase.rpc('delete_my_account');
      if (error) {
        console.log('[deleteAccount] error', error);
        return { ok: false, error: error.message };
      }
      try { await supabase.auth.signOut(); } catch (e) { console.log('[deleteAccount] signOut error', e); }
      setProfile(null);
      setBlocked([]);
      await AsyncStorage.removeItem(PROFILE_KEY);
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Network error';
      return { ok: false, error: msg };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.log('[signOut] error', e);
    }
    setProfile(null);
    setBlocked([]);
    await AsyncStorage.removeItem(PROFILE_KEY);
  }, []);

  const updateAvatar = useCallback(async (avatarEmoji: string) => {
    if (!profile) return;
    const updated: UserProfile = { ...profile, avatarEmoji };
    setProfile(updated);
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_emoji: avatarEmoji })
      .eq('id', profile.id);
    if (error) console.log('[updateAvatar] error', error);
  }, [profile]);

  const updateIsland = useCallback(async (islandId: string) => {
    if (!profile) return;
    const updated: UserProfile = { ...profile, islandId };
    setProfile(updated);
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
    const { error } = await supabase
      .from('profiles')
      .update({ island_id: islandId })
      .eq('id', profile.id);
    if (error) console.log('[updateIsland] error', error);
  }, [profile]);

  const blockUser = useCallback(async (userId: string) => {
    if (!profile) return;
    setBlocked(prev => (prev.includes(userId) ? prev : [...prev, userId]));
    const { error } = await supabase
      .from('blocks')
      .upsert({ blocker_id: profile.id, blocked_id: userId });
    if (error) console.log('[blockUser] error', error);
  }, [profile]);

  const unblockUser = useCallback(async (userId: string) => {
    if (!profile) return;
    setBlocked(prev => prev.filter(id => id !== userId));
    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('blocker_id', profile.id)
      .eq('blocked_id', userId);
    if (error) console.log('[unblockUser] error', error);
  }, [profile]);

  const getUserById = useCallback(
    (id: string): StoredUser | undefined => allUsers.find(u => u.id === id),
    [allUsers],
  );

  const updatePreferredLanguage = useCallback(async (lang: string) => {
    setPreferredLanguage(lang);
    await AsyncStorage.setItem(LANG_KEY, lang);
  }, []);

  const updateAutoTranslate = useCallback(async (enabled: boolean) => {
    setAutoTranslate(enabled);
    await AsyncStorage.setItem(AUTO_TRANSLATE_KEY, enabled ? '1' : '0');
  }, []);

  const updateAllowDmFromEveryone = useCallback(async (enabled: boolean) => {
    setAllowDmFromEveryone(enabled);
    await AsyncStorage.setItem(ALLOW_DM_ALL_KEY, enabled ? '1' : '0');
  }, []);

  return useMemo(
    () => ({
      profile, allUsers, isLoading, deviceId, blocked,
      preferredLanguage, autoTranslate, allowDmFromEveryone,
      signUp, signIn, signOut, updateAvatar, updateIsland, isUsernameAvailable,
      blockUser, unblockUser, getUserById,
      updatePreferredLanguage, updateAutoTranslate, updateAllowDmFromEveryone,
      setSecurityAnswer, lookupRecoveryQuestion, resetPasswordWithRecovery,
      acceptTerms, submitReport, deleteAccount,
    }),
    [profile, allUsers, isLoading, deviceId, blocked, preferredLanguage, autoTranslate, allowDmFromEveryone, signUp, signIn, signOut, updateAvatar, updateIsland, isUsernameAvailable, blockUser, unblockUser, getUserById, updatePreferredLanguage, updateAutoTranslate, updateAllowDmFromEveryone, setSecurityAnswer, lookupRecoveryQuestion, resetPasswordWithRecovery, acceptTerms, submitReport, deleteAccount],
  );
});
