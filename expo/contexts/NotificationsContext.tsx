import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useUser } from '@/contexts/UserContext';
import { useChat, dmRoomId } from '@/contexts/ChatContext';
import { ISLANDS, getIsland } from '@/constants/islands';
import type { Message } from '@/types';

const SEEN_KEY = 'gic_seen_v1';
const NOTIF_KEY = 'gic_notif_v1';

export interface InAppNotification {
  id: string;
  kind: 'mention' | 'reaction' | 'island' | 'dm';
  title: string;
  body: string;
  emoji: string;
  roomId?: string;
  partnerId?: string;
  islandId?: string;
  createdAt: number;
  read: boolean;
}

export const [NotificationsProvider, useNotifications] = createContextHook(() => {
  const { profile } = useUser();
  const { messagesByRoom, now, getDmPartners } = useChat();
  const [seenAt, setSeenAt] = useState<Record<string, number>>({});
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [banner, setBanner] = useState<InAppNotification | null>(null);
  const lastSeenRef = useRef<Record<string, number>>({});
  const mountedAt = useRef<number>(Date.now());
  const seenMessageIds = useRef<Set<string>>(new Set());
  const didBootstrap = useRef<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const [s, n] = await Promise.all([
          AsyncStorage.getItem(SEEN_KEY),
          AsyncStorage.getItem(NOTIF_KEY),
        ]);
        if (s) {
          const parsed = JSON.parse(s) as Record<string, number>;
          setSeenAt(parsed);
          lastSeenRef.current = parsed;
        }
        if (n) setNotifications(JSON.parse(n) as InAppNotification[]);
      } catch (e) {
        console.log('notif load', e);
      }
    })();
  }, []);

  const persistSeen = useCallback((next: Record<string, number>) => {
    AsyncStorage.setItem(SEEN_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const persistNotifs = useCallback((next: InAppNotification[]) => {
    AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(next.slice(-50))).catch(() => {});
  }, []);

  const markRoomSeen = useCallback((roomId: string) => {
    setSeenAt(prev => {
      const next = { ...prev, [roomId]: Date.now() };
      lastSeenRef.current = next;
      persistSeen(next);
      return next;
    });
    setNotifications(prev => {
      const next = prev.map(n => (n.roomId === roomId ? { ...n, read: true } : n));
      persistNotifs(next);
      return next;
    });
  }, [persistNotifs, persistSeen]);

  const unreadByRoom = useCallback((roomId: string, messages: Message[]): number => {
    if (!profile) return 0;
    const since = lastSeenRef.current[roomId] ?? mountedAt.current;
    return messages.filter(m => m.userId !== profile.id && m.createdAt > since).length;
  }, [profile]);

  const islandUnread = useMemo(() => {
    const map: Record<string, number> = {};
    let total = 0;
    for (const island of ISLANDS) {
      const msgs = messagesByRoom(island.id);
      const n = unreadByRoom(island.id, msgs);
      map[island.id] = n;
      total += n;
    }
    return { map, total };
  }, [messagesByRoom, unreadByRoom, now]);

  const mentionUnread = useMemo(() => {
    if (!profile) return 0;
    let count = 0;
    for (const island of ISLANDS) {
      const msgs = messagesByRoom(island.id);
      const since = lastSeenRef.current[island.id] ?? mountedAt.current;
      for (const m of msgs) {
        if (m.userId === profile.id) continue;
        if (m.createdAt <= since) continue;
        if (m.mentions?.includes(profile.username.toLowerCase())) count += 1;
      }
    }
    return count;
  }, [messagesByRoom, profile, now]);

  const pushBanner = useCallback((n: InAppNotification) => {
    setBanner(n);
    setNotifications(prev => {
      const next = [...prev, n];
      persistNotifs(next);
      return next;
    });
    setTimeout(() => {
      setBanner(b => (b?.id === n.id ? null : b));
    }, 3600);
  }, [persistNotifs]);

  const notifyMention = useCallback((message: Message, islandName: string) => {
    if (!profile) return;
    pushBanner({
      id: `n_${message.id}`,
      kind: 'mention',
      title: `@${message.username} mentioned you`,
      body: `in ${islandName} · ${(message.text ?? '').slice(0, 80)}`,
      emoji: message.avatarEmoji,
      roomId: message.roomId,
      islandId: message.roomId,
      createdAt: Date.now(),
      read: false,
    });
  }, [profile, pushBanner]);

  const notifyDm = useCallback((message: Message, partnerName: string, partnerId: string) => {
    pushBanner({
      id: `n_${message.id}`,
      kind: 'dm',
      title: `@${partnerName}`,
      body: message.text ? message.text.slice(0, 90) : message.kind === 'image' ? '📷 photo' : '🎤 voice note',
      emoji: message.avatarEmoji,
      roomId: message.roomId,
      partnerId,
      createdAt: Date.now(),
      read: false,
    });
  }, [pushBanner]);

  const dismissBanner = useCallback(() => setBanner(null), []);

  useEffect(() => {
    if (!profile) return;
    const allRooms: string[] = ISLANDS.map(i => i.id);
    const islandMessages: Message[] = allRooms.flatMap(r => messagesByRoom(r));
    if (!didBootstrap.current) {
      for (const m of islandMessages) seenMessageIds.current.add(m.id);
      didBootstrap.current = true;
      return;
    }
    for (const m of islandMessages) {
      if (seenMessageIds.current.has(m.id)) continue;
      seenMessageIds.current.add(m.id);
      if (m.userId === profile.id) continue;
      if (m.createdAt < mountedAt.current) continue;
      const uname = profile.username.toLowerCase();
      if (m.mentions?.includes(uname)) {
        const island = getIsland(m.roomId);
        notifyMention(m, island?.name ?? 'an island');
      }
    }
  }, [messagesByRoom, profile, now, notifyMention]);

  useEffect(() => {
    if (!profile) return;
    const partners = getDmPartners(profile.id);
    for (const p of partners) {
      const msgs = messagesByRoom(p.roomId);
      for (const m of msgs) {
        if (seenMessageIds.current.has(m.id)) continue;
        seenMessageIds.current.add(m.id);
        if (m.userId === profile.id) continue;
        if (m.createdAt < mountedAt.current) continue;
        notifyDm(m, p.partnerUsername || m.username, p.partnerId);
      }
    }
  }, [messagesByRoom, profile, now, getDmPartners, notifyDm]);

  const clearBadgeForRoom = markRoomSeen;

  return useMemo(() => ({
    seenAt,
    markRoomSeen,
    clearBadgeForRoom,
    islandUnread: islandUnread.map,
    islandUnreadTotal: islandUnread.total,
    mentionUnread,
    banner,
    dismissBanner,
    notifications,
    notifyMention,
    notifyDm,
    dmRoomId,
  }), [seenAt, markRoomSeen, clearBadgeForRoom, islandUnread.map, islandUnread.total, mentionUnread, banner, dismissBanner, notifications, notifyMention, notifyDm]);
});
