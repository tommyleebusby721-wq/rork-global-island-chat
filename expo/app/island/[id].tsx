import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Shield, Users, X, Info, AlertTriangle } from 'lucide-react-native';
import { getIsland } from '@/constants/islands';
import ChatRoom from '@/components/ChatRoom';
import Colors from '@/constants/colors';
import { useChat } from '@/contexts/ChatContext';
import FlagBadge from '@/components/FlagBadge';

export default function IslandChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const island = getIsland(id ?? '');
  const { membersByRoom, countByRoom } = useChat();
  const [infoOpen, setInfoOpen] = useState<boolean>(false);

  if (!island) {
    return (
      <View style={styles.fallback}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.fbTitle}>Island not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.fbBtn}>
          <Text style={styles.fbBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const members = membersByRoom(island.id);
  const messageCount = countByRoom(island.id);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={["#0B1220", "#0E1836", "#0B1220"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.headerWrap, { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 12 : 8) + 6 }]}>
        <View style={styles.header} testID="island-header">
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn" hitSlop={10}>
            <ChevronLeft size={28} color={Colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setInfoOpen(true)}
            style={styles.headerCenterRow}
          >
            <FlagBadge code={island.flagCode} fallback={island.flag} size={38} />
            <View style={styles.headerTextCol}>
              <Text style={styles.headerTitle} numberOfLines={1}>{island.name}</Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                {members.length} {members.length === 1 ? 'member' : 'members'}
                {island.subtitle ? ` · ${island.subtitle}` : ''}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.actionBtn} hitSlop={8} onPress={() => setInfoOpen(true)}>
              <Shield size={20} color={Colors.accentLight} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ChatRoom roomId={island.id} showUsernames />

      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <FlagBadge code={island.flagCode} fallback={island.flag} size={56} rounded="square" />
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{island.name}</Text>
                {island.subtitle ? <Text style={styles.sheetSubtitle}>{island.subtitle}</Text> : null}
                <Text style={styles.sheetRegion}>{island.region}</Text>
              </View>
              <TouchableOpacity onPress={() => setInfoOpen(false)} style={styles.closeBtn} hitSlop={8}>
                <X size={18} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Users size={16} color={Colors.accentLight} />
                <Text style={styles.statValue}>{members.length}</Text>
                <Text style={styles.statLabel}>Members</Text>
              </View>
              <View style={styles.statCard}>
                <Info size={16} color={Colors.accentLight} />
                <Text style={styles.statValue}>{messageCount}</Text>
                <Text style={styles.statLabel}>Active msgs</Text>
              </View>
              <View style={styles.statCard}>
                <Shield size={16} color={Colors.accentLight} />
                <Text style={styles.statValue}>24h</Text>
                <Text style={styles.statLabel}>Auto-delete</Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>About</Text>
            <Text style={styles.bioText}>{island.bio}</Text>

            <View style={styles.ruleBox}>
              <AlertTriangle size={14} color="#FBBF24" />
              <Text style={styles.ruleText}>
                Public chat — visible to everyone. No website links. Be respectful. 13+.
              </Text>
            </View>

            <Text style={styles.sectionLabel}>Members ({members.length})</Text>
            <ScrollView style={styles.memberList} showsVerticalScrollIndicator={false}>
              {members.length === 0 ? (
                <Text style={styles.emptyMembers}>No one has chatted here in the last 24h.</Text>
              ) : (
                members.map((m) => (
                  <View key={m.id} style={styles.memberRow}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberEmoji}>{m.avatarEmoji}</Text>
                    </View>
                    <Text style={styles.memberName}>@{m.username}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  headerWrap: {
    backgroundColor: 'rgba(11,18,32,0.85)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingBottom: 14, paddingTop: 8, minHeight: 64,
  },
  backBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenterRow: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 4,
  },
  avatarCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  flag: { fontSize: 20 },
  headerTextCol: { flex: 1, justifyContent: 'center' },
  headerTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.3 },
  headerSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 6 },
  actionBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  fallback: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', gap: 14 },
  fbTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' as const },
  fbBtn: { backgroundColor: Colors.accent, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  fbBtnText: { color: Colors.white, fontWeight: '700' as const },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: Colors.border,
    maxHeight: '85%',
  },
  sheetHandle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, marginBottom: 16,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  sheetFlagWrap: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetFlag: { fontSize: 32 },
  sheetTitle: { color: Colors.text, fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.4 },
  sheetSubtitle: { color: Colors.accentLight, fontSize: 13, fontWeight: '600' as const, marginTop: 2 },
  sheetRegion: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 10,
    alignItems: 'center', gap: 6,
  },
  statValue: { color: Colors.text, fontSize: 18, fontWeight: '700' as const },
  statLabel: { color: Colors.textSecondary, fontSize: 11 },
  sectionLabel: {
    color: Colors.textSecondary, fontSize: 11, fontWeight: '700' as const,
    letterSpacing: 1, textTransform: 'uppercase',
    marginBottom: 8, marginTop: 4,
  },
  bioText: { color: Colors.text, fontSize: 14, lineHeight: 21, marginBottom: 16 },
  ruleBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderColor: 'rgba(251,191,36,0.25)', borderWidth: 1,
    borderRadius: 14, padding: 12, marginBottom: 18,
  },
  ruleText: { flex: 1, color: '#FDE68A', fontSize: 12, lineHeight: 17 },
  memberList: { maxHeight: 220 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10,
  },
  memberAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  memberEmoji: { fontSize: 18 },
  memberName: { color: Colors.text, fontSize: 15, fontWeight: '600' as const },
  emptyMembers: { color: Colors.textSecondary, fontSize: 13, paddingVertical: 12 },
});
