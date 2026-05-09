import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import createContextHook from '@nkzw/create-context-hook';
import { Message, Reaction } from '@/types';
import { ISLANDS } from '@/constants/islands';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/contexts/UserContext';

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PER_ROOM = 100;
const FETCH_LIMIT = 2000;

export function dmRoomId(a: string, b: string): string {
  return `dm:${[a, b].sort().join(':')}`;
}

interface DbMessage {
  id: string;
  room_id: string;
  user_id: string;
  username: string;
  avatar_emoji: string;
  kind: 'text' | 'image' | 'voice' | 'video';
  text: string | null;
  image_uri: string | null;
  voice_uri: string | null;
  voice_duration: number | null;
  mentions: string[] | null;
  reactions: Reaction[] | null;
  created_at: string;
  expires_at: string;
}

function dbToMessage(r: DbMessage): Message {
  const isVideo = r.kind === 'video';
  return {
    id: r.id,
    roomId: r.room_id,
    userId: r.user_id,
    username: r.username,
    avatarEmoji: r.avatar_emoji,
    kind: r.kind,
    text: r.text ?? undefined,
    imageUri: !isVideo ? (r.image_uri ?? undefined) : undefined,
    videoUri: isVideo ? (r.image_uri ?? undefined) : undefined,
    videoDuration: isVideo ? (r.voice_duration ?? undefined) : undefined,
    voiceUri: !isVideo ? (r.voice_uri ?? undefined) : undefined,
    voiceDuration: !isVideo ? (r.voice_duration ?? undefined) : undefined,
    mentions: r.mentions ?? undefined,
    reactions: r.reactions ?? [],
    createdAt: new Date(r.created_at).getTime(),
    expiresAt: new Date(r.expires_at).getTime(),
  };
}

interface SendInput {
  roomId: string;
  userId: string;
  username: string;
  avatarEmoji: string;
  kind: 'text' | 'image' | 'voice' | 'video';
  text?: string;
  imageUri?: string;
  voiceUri?: string;
  voiceDuration?: number;
  videoUri?: string;
  videoDuration?: number;
  mentions?: string[];
}

export const [ChatProvider, useChat] = createContextHook(() => {
  const { profile } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [now, setNow] = useState<number>(Date.now());
  const lastSentAtRef = useRef<number>(0);
  const recentSendsRef = useRef<number[]>([]);

  const upsertLocal = useCallback((m: Message) => {
    setMessages(prev => {
      const idx = prev.findIndex(x => x.id === m.id);
      if (idx === -1) return [...prev, m];
      const next = prev.slice();
      next[idx] = m;
      return next;
    });
  }, []);

  const removeLocal = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const nowIso = new Date().toISOString();
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .gt('expires_at', nowIso)
          .order('created_at', { ascending: false })
          .limit(FETCH_LIMIT);
        if (error) throw error;
        if (cancelled) return;
        setMessages((data ?? []).map(dbToMessage));
      } catch (e) {
        console.log('[chat] initial fetch error', e);
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as DbMessage | undefined;
          if (!row) return;
          upsertLocal(dbToMessage(row));
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as DbMessage | undefined;
          if (!row) return;
          upsertLocal(dbToMessage(row));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.old as { id?: string } | undefined;
          if (row?.id) removeLocal(row.id);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel).catch(() => {}); };
  }, [removeLocal, upsertLocal]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const activeMessages = useMemo(() => {
    return messages.filter(m => m.expiresAt > now);
  }, [messages, now]);

  const messagesByRoom = useCallback(
    (roomId: string): Message[] => {
      return activeMessages
        .filter(m => m.roomId === roomId)
        .slice(-MAX_PER_ROOM)
        .sort((a, b) => a.createdAt - b.createdAt);
    },
    [activeMessages],
  );

  const lastMessageByRoom = useCallback(
    (roomId: string): Message | undefined => {
      const list = activeMessages.filter(m => m.roomId === roomId);
      if (list.length === 0) return undefined;
      return list.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
    },
    [activeMessages],
  );

  const countByRoom = useCallback(
    (roomId: string): number => activeMessages.filter(m => m.roomId === roomId).length,
    [activeMessages],
  );

  const membersByRoom = useCallback(
    (roomId: string): { id: string; username: string; avatarEmoji: string }[] => {
      const map = new Map<string, { id: string; username: string; avatarEmoji: string }>();
      for (const m of activeMessages) {
        if (m.roomId !== roomId) continue;
        if (!map.has(m.userId)) {
          map.set(m.userId, { id: m.userId, username: m.username, avatarEmoji: m.avatarEmoji });
        }
      }
      return Array.from(map.values());
    },
    [activeMessages],
  );

  const lastSendErrorRef = useRef<string>('');

  const sendMessage = useCallback(
    (input: SendInput): { ok: boolean; error?: string } => {
      const current = Date.now();
      if (current - lastSentAtRef.current < 2000) {
        return { ok: false, error: 'Slow down a bit ✋' };
      }
      const cleaned = recentSendsRef.current.filter(t => current - t < 10000);
      if (cleaned.length >= 5) {
        return { ok: false, error: 'Too many messages, wait a moment' };
      }

      if (input.kind === 'text' && input.text) {
        const linkPattern = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|app|gg|ly|me|xyz|link|site|tv|info|biz|us|uk|eu|ca)(\/|\b))/i;
        if (linkPattern.test(input.text)) {
          return { ok: false, error: 'Website links are not allowed' };
        }
      }

      const sameRoom = messages.filter(m => m.roomId === input.roomId);
      if (sameRoom.length > 0) {
        const last = sameRoom[sameRoom.length - 1];
        if (
          last.userId === input.userId &&
          last.kind === 'text' &&
          input.kind === 'text' &&
          last.text &&
          input.text &&
          last.text.trim().toLowerCase() === input.text.trim().toLowerCase()
        ) {
          return { ok: false, error: 'Duplicate message' };
        }
      }

      lastSentAtRef.current = current;
      recentSendsRef.current = [...cleaned, current];

      const tempId = `tmp_${current}_${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: Message = {
        id: tempId,
        roomId: input.roomId,
        userId: input.userId,
        username: input.username,
        avatarEmoji: input.avatarEmoji,
        kind: input.kind,
        text: input.text,
        imageUri: input.imageUri,
        voiceUri: input.voiceUri,
        voiceDuration: input.voiceDuration,
        videoUri: input.videoUri,
        videoDuration: input.videoDuration,
        mentions: input.mentions,
        createdAt: current,
        expiresAt: current + TTL_MS,
        reactions: [],
      };
      setMessages(prev => [...prev, optimistic]);

      const expiresIso = new Date(current + TTL_MS).toISOString();
      void (async () => {
        try {
          const { data, error } = await supabase
            .from('messages')
            .insert({
              room_id: input.roomId,
              user_id: input.userId,
              username: input.username,
              avatar_emoji: input.avatarEmoji,
              kind: input.kind,
              text: input.text ?? null,
              image_uri: input.kind === 'video' ? (input.videoUri ?? null) : (input.imageUri ?? null),
              voice_uri: input.voiceUri ?? null,
              voice_duration: input.kind === 'video' ? (input.videoDuration ?? null) : (input.voiceDuration ?? null),
              mentions: input.mentions ?? [],
              reactions: [],
              expires_at: expiresIso,
            })
            .select('*')
            .single();
          if (error || !data) {
            console.log('[sendMessage] supabase error', {
              message: error?.message,
              code: (error as { code?: string } | null)?.code,
              details: (error as { details?: string } | null)?.details,
              hint: (error as { hint?: string } | null)?.hint,
            });
            throw error ?? new Error('no data');
          }
          const inserted = dbToMessage(data as DbMessage);
          setMessages(prev => {
            const withoutTemp = prev.filter(m => m.id !== tempId);
            if (withoutTemp.some(m => m.id === inserted.id)) return withoutTemp;
            return [...withoutTemp, inserted];
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Could not send message';
          lastSendErrorRef.current = msg;
          console.log('[sendMessage] error', e);
          setMessages(prev => prev.filter(m => m.id !== tempId));
          Alert.alert('Message not sent', msg);
        }
      })();

      return { ok: true };
    },
    [messages],
  );

  const deleteMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
    void (async () => {
      const { error } = await supabase.from('messages').delete().eq('id', messageId);
      if (error) console.log('[deleteMessage] error', error);
    })();
  }, []);

  const toggleReaction = useCallback(
    (messageId: string, emoji: string, userId: string) => {
      let nextReactions: Reaction[] = [];
      setMessages(prev => {
        const next = prev.map(m => {
          if (m.id !== messageId) return m;
          const reactions: Reaction[] = m.reactions ? [...m.reactions] : [];
          const idx = reactions.findIndex(r => r.emoji === emoji);
          if (idx === -1) {
            reactions.push({ emoji, userIds: [userId] });
          } else {
            const r = reactions[idx];
            if (r.userIds.includes(userId)) {
              const users = r.userIds.filter(u => u !== userId);
              if (users.length === 0) reactions.splice(idx, 1);
              else reactions[idx] = { ...r, userIds: users };
            } else {
              reactions[idx] = { ...r, userIds: [...r.userIds, userId] };
            }
          }
          nextReactions = reactions;
          return { ...m, reactions };
        });
        return next;
      });
      void (async () => {
        const { error } = await supabase
          .from('messages')
          .update({ reactions: nextReactions })
          .eq('id', messageId);
        if (error) console.log('[toggleReaction] error', error);
      })();
    },
    [],
  );

  const getDmPartners = useCallback(
    (currentUserId: string): { partnerId: string; partnerUsername: string; partnerEmoji: string; roomId: string }[] => {
      const map = new Map<string, { partnerId: string; partnerUsername: string; partnerEmoji: string; roomId: string }>();
      for (const m of activeMessages) {
        if (!m.roomId.startsWith('dm:')) continue;
        const parts = m.roomId.slice(3).split(':');
        if (!parts.includes(currentUserId)) continue;
        const partnerId = parts.find(p => p !== currentUserId) ?? '';
        if (!partnerId) continue;
        if (!map.has(partnerId)) {
          const partnerIsMe = m.userId === currentUserId;
          map.set(partnerId, {
            partnerId,
            partnerUsername: partnerIsMe ? '' : m.username,
            partnerEmoji: partnerIsMe ? '👤' : m.avatarEmoji,
            roomId: m.roomId,
          });
        } else if (m.userId !== currentUserId) {
          const existing = map.get(partnerId);
          if (existing) {
            map.set(partnerId, { ...existing, partnerUsername: m.username, partnerEmoji: m.avatarEmoji });
          }
        }
      }
      return Array.from(map.values());
    },
    [activeMessages],
  );

  const islandStats = useMemo(() => {
    const dayAgo = now - TTL_MS;
    const fifteenMinAgo = now - 15 * 60 * 1000;
    const stats: Record<string, {
      count: number;
      lastAt: number;
      activeMembers: number;
      liveNow: number;
      messagesToday: number;
      status: 'live' | 'trending' | 'quiet';
    }> = {};
    for (const island of ISLANDS) {
      const msgs = activeMessages.filter(m => m.roomId === island.id);
      const memberSet = new Set<string>();
      const liveSet = new Set<string>();
      let messagesToday = 0;
      for (const m of msgs) {
        memberSet.add(m.userId);
        if (m.createdAt > dayAgo) messagesToday += 1;
        if (m.createdAt > fifteenMinAgo) liveSet.add(m.userId);
      }
      const activeMembers = memberSet.size;
      const liveNow = liveSet.size;
      let status: 'live' | 'trending' | 'quiet' = 'quiet';
      if (liveNow > 0) status = 'live';
      else if (messagesToday >= 3) status = 'trending';
      stats[island.id] = {
        count: msgs.length,
        lastAt: msgs.reduce((acc, m) => Math.max(acc, m.createdAt), 0),
        activeMembers,
        liveNow,
        messagesToday,
        status,
      };
    }
    return stats;
  }, [activeMessages, now]);

  const userStats = useCallback(
    (userId: string) => {
      let sent = 0;
      let reactionsReceived = 0;
      const islandSet = new Set<string>();
      const islandCounts = new Map<string, number>();
      let lastIslandId: string | undefined;
      let lastIslandAt = 0;
      for (const m of activeMessages) {
        if (m.userId === userId) {
          sent += 1;
          if (m.roomId && !m.roomId.startsWith('dm:')) {
            islandSet.add(m.roomId);
            islandCounts.set(m.roomId, (islandCounts.get(m.roomId) ?? 0) + 1);
            if (m.createdAt > lastIslandAt) {
              lastIslandAt = m.createdAt;
              lastIslandId = m.roomId;
            }
          }
          if (m.reactions) {
            for (const r of m.reactions) reactionsReceived += r.userIds.length;
          }
        }
      }
      let favoriteIslandId: string | undefined;
      let favMax = 0;
      islandCounts.forEach((count, id) => {
        if (count > favMax) { favMax = count; favoriteIslandId = id; }
      });
      return {
        sent,
        reactionsReceived,
        islandsJoined: islandSet.size,
        favoriteIslandId,
        lastIslandId,
      };
    },
    [activeMessages],
  );

  void profile;

  return useMemo(
    () => ({
      isLoaded,
      now,
      messagesByRoom,
      lastMessageByRoom,
      countByRoom,
      membersByRoom,
      sendMessage,
      getLastSendError: () => lastSendErrorRef.current,
      toggleReaction,
      deleteMessage,
      getDmPartners,
      islandStats,
      userStats,
    }),
    [isLoaded, now, messagesByRoom, lastMessageByRoom, countByRoom, membersByRoom, sendMessage, toggleReaction, deleteMessage, getDmPartners, islandStats, userStats],
  );
});
