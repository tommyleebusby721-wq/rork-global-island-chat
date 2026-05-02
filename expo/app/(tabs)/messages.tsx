import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Platform,
  Modal,
  Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Search, Plus, MessageCircle, X, AtSign } from 'lucide-react-native';
import { useUser } from '@/contexts/UserContext';
import { useChat, dmRoomId } from '@/contexts/ChatContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import Colors from '@/constants/colors';
import ScreenLayout, { LAYOUT } from '@/components/ScreenLayout';

function formatInboxTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString();
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const { profile, allUsers } = useUser();
  const { getDmPartners, lastMessageByRoom, messagesByRoom } = useChat();
  const { mentionUnread, seenAt } = useNotifications();
  const [newOpen, setNewOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');

  const partners = useMemo(() => {
    if (!profile) return [];
    const raw = getDmPartners(profile.id);
    return raw.map(p => {
      const u = allUsers.find(x => x.id === p.partnerId);
      return {
        ...p,
        partnerUsername: u?.username || p.partnerUsername,
        partnerEmoji: u?.avatarEmoji || p.partnerEmoji,
      };
    });
  }, [getDmPartners, profile, allUsers]);

  const conversations = useMemo(() => {
    return partners
      .map(p => {
        const last = lastMessageByRoom(p.roomId);
        const allMsgs = messagesByRoom(p.roomId);
        const since = seenAt[p.roomId] ?? 0;
        const unread = profile
          ? allMsgs.filter(m => m.userId !== profile.id && m.createdAt > since).length
          : 0;
        return { ...p, last, unread };
      })
      .sort((a, b) => (b.last?.createdAt ?? 0) - (a.last?.createdAt ?? 0));
  }, [partners, lastMessageByRoom, messagesByRoom, profile, seenAt]);

  const searchable = useMemo(() => {
    const q = query.trim().toLowerCase();
    const others = allUsers.filter(u => u.id !== profile?.id);
    if (!q) return others;
    return others.filter(u => u.username.toLowerCase().includes(q));
  }, [allUsers, profile?.id, query]);

  const openDm = useCallback((partnerId: string) => {
    if (!profile) return;
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    setNewOpen(false);
    router.push(`/dm/${partnerId}`);
  }, [profile]);

  return (
    <ScreenLayout
      title="Inbox"
      subtitle={conversations.length > 0 ? `${conversations.length} conversation${conversations.length === 1 ? '' : 's'}` : 'Private conversations'}
      headerRight={
        <TouchableOpacity
          testID="new-dm"
          onPress={() => setNewOpen(true)}
          style={styles.newBtn}
        >
          <Plus size={20} color={Colors.white} />
        </TouchableOpacity>
      }
    >
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.roomId}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 }}>
            {mentionUnread > 0 && (
              <TouchableOpacity style={styles.mentionsCard} activeOpacity={0.9}>
                <View style={styles.mentionIcon}>
                  <AtSign size={18} color="#FBBF24" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mentionTitle}>You were mentioned</Text>
                  <Text style={styles.mentionSub}>
                    {mentionUnread} new mention{mentionUnread === 1 ? '' : 's'} across your islands
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const preview = item.last?.text
            ?? (item.last?.kind === 'image' ? '📷 Photo' : item.last?.kind === 'voice' ? '🎤 Voice note' : 'Say hi 👋');
          const isMine = profile?.id === item.last?.userId;
          const hasUnread = item.unread > 0 && !isMine;
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => openDm(item.partnerId)}
              style={styles.row}
              testID={`dm-${item.partnerId}`}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarEmoji}>{item.partnerEmoji}</Text>
                {hasUnread && <View style={styles.onlineDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.topLine}>
                  <Text style={[styles.name, hasUnread && { color: Colors.text }]} numberOfLines={1}>
                    @{item.partnerUsername || 'user'}
                  </Text>
                  {item.last && (
                    <Text style={[styles.time, hasUnread && styles.timeUnread]}>
                      {formatInboxTime(item.last.createdAt)}
                    </Text>
                  )}
                </View>
                <View style={styles.bottomLine}>
                  <Text
                    numberOfLines={1}
                    style={[styles.preview, hasUnread && styles.previewUnread]}
                  >
                    {isMine ? 'You: ' : ''}{preview}
                  </Text>
                  {hasUnread && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.unread > 99 ? '99+' : item.unread}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + LAYOUT.tabBarClearance }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <MessageCircle size={26} color={Colors.accentLight} />
            </View>
            <Text style={styles.emptyTitle}>Your inbox is empty</Text>
            <Text style={styles.emptySub}>Tap the + button to start a private chat with someone from an island.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setNewOpen(true)}>
              <Plus size={15} color={Colors.white} />
              <Text style={styles.emptyBtnText}>Start a conversation</Text>
            </TouchableOpacity>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      <Modal visible={newOpen} animationType="slide" transparent onRequestClose={() => setNewOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <Pressable style={styles.backdrop} onPress={() => setNewOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>New message</Text>
            <TouchableOpacity onPress={() => setNewOpen(false)} style={styles.closeBtn}>
              <X size={16} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchBar}>
            <Search size={16} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search users…"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <FlatList
            data={searchable}
            keyExtractor={u => u.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.userRow} onPress={() => openDm(item.id)}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarEmoji}>{item.avatarEmoji}</Text>
                </View>
                <Text style={styles.name}>@{item.username}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.emptySub}>No users found</Text>}
            style={{ marginTop: 10 }}
            keyboardShouldPersistTaps="handled"
          />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenLayout>
  );
}

const dmRoom = dmRoomId;
void dmRoom;

const styles = StyleSheet.create({
  newBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.accent, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  mentionsCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
    borderRadius: 18, padding: 12, marginBottom: 12,
  },
  mentionIcon: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: 'rgba(251,191,36,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  mentionTitle: { color: '#FDE68A', fontSize: 14, fontWeight: '700' as const },
  mentionSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingVertical: 10, paddingHorizontal: 4,
    marginBottom: 2,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  avatarEmoji: { fontSize: 26 },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2, borderColor: Colors.bg,
  },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bottomLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3, gap: 8 },
  name: { color: Colors.text, fontSize: 15, fontWeight: '700' as const, flex: 1 },
  time: { color: Colors.textTertiary, fontSize: 12, fontWeight: '500' as const, marginLeft: 8 },
  timeUnread: { color: Colors.accentLight, fontWeight: '700' as const },
  preview: { color: Colors.textSecondary, fontSize: 13, flex: 1 },
  previewUnread: { color: Colors.text, fontWeight: '600' as const },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: Colors.white, fontSize: 11, fontWeight: '800' as const },

  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: 28, gap: 10 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 22,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.3)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' as const },
  emptySub: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  emptyBtn: {
    marginTop: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999,
  },
  emptyBtnText: { color: Colors.white, fontWeight: '700' as const, fontSize: 14 },

  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: Colors.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 16, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: Colors.border,
    maxHeight: '80%',
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' as const },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15, padding: 0 },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 6,
  },
});
