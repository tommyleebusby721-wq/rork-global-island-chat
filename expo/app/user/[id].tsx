import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, MessageCircle, MapPin, UserX, UserCheck } from 'lucide-react-native';
import { useUser } from '@/contexts/UserContext';
import { useChat } from '@/contexts/ChatContext';
import { getIsland } from '@/constants/islands';
import FlagBadge from '@/components/FlagBadge';
import Colors from '@/constants/colors';
import { EMOJI_FONT_FAMILY } from '@/constants/avatars';

export default function UserProfilePreview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { profile: me, getUserById, blocked, blockUser, unblockUser } = useUser();
  const { userStats } = useChat();

  const user = useMemo(() => getUserById(id ?? ''), [getUserById, id]);
  const island = useMemo(
    () => (user?.islandId ? getIsland(user.islandId) : undefined),
    [user?.islandId],
  );
  const stats = useMemo(() => (user ? userStats(user.id) : undefined), [user, userStats]);
  const favoriteIsland = useMemo(
    () => (stats?.favoriteIslandId ? getIsland(stats.favoriteIslandId) : undefined),
    [stats?.favoriteIslandId],
  );

  const isMe = me?.id === user?.id;
  const isBlocked = !!user && blocked.includes(user.id);

  if (!user) {
    return (
      <View style={styles.fallback}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.fbTitle}>User not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.fbBtn} testID="up-back">
          <Text style={styles.fbBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const onDm = () => {
    router.back();
    setTimeout(() => router.push(`/dm/${user.id}`), 40);
  };

  const onOpenIsland = () => {
    if (!island) return;
    router.back();
    setTimeout(() => router.push(`/island/${island.id}`), 40);
  };

  const onToggleBlock = async () => {
    if (isBlocked) {
      await unblockUser(user.id);
    } else {
      await blockUser(user.id);
    }
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={["#0B1220", "#0E1836", "#0B1220"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.headerWrap, { paddingTop: Math.max(insets.top, 44) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10} testID="back-btn">
          <ChevronLeft size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <LinearGradient
            colors={[Colors.bgCard, Colors.bgElevated]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.avatarRing}>
            <Text style={styles.avatarEmoji}>{user.avatarEmoji}</Text>
          </View>
          <Text style={styles.username} numberOfLines={1}>@{user.username}</Text>

          {island ? (
            <TouchableOpacity onPress={onOpenIsland} style={styles.islandPill} testID="up-island">
              <FlagBadge code={island.flagCode} fallback={island.flag} size={22} />
              <Text style={styles.islandPillText} numberOfLines={1}>
                {island.name}
                {island.subtitle ? ` · ${island.subtitle}` : ''}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.islandPill}>
              <MapPin size={14} color={Colors.textSecondary} />
              <Text style={[styles.islandPillText, { color: Colors.textSecondary }]}>No island set</Text>
            </View>
          )}

          {island ? (
            <View style={styles.bioBox}>
              <Text style={styles.bioLabel}>{island.region}</Text>
              <Text style={styles.bioText} numberOfLines={4}>{island.bio}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.sent ?? 0}</Text>
            <Text style={styles.statLabel}>Messages</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.islandsJoined ?? 0}</Text>
            <Text style={styles.statLabel}>Islands</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValueEmoji}>{favoriteIsland?.flag ?? '🏝️'}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>
              {favoriteIsland ? 'Favorite' : 'No fav yet'}
            </Text>
          </View>
        </View>

        {!isMe && (
          <View style={styles.actions}>
            <TouchableOpacity onPress={onDm} activeOpacity={0.85} testID="up-dm">
              <LinearGradient
                colors={['#60A5FA', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryBtn}
              >
                <MessageCircle size={18} color={Colors.white} />
                <Text style={styles.primaryBtnText}>Message</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={onToggleBlock} style={styles.secondaryBtn} testID="up-block">
              {isBlocked ? (
                <UserCheck size={16} color={Colors.text} />
              ) : (
                <UserX size={16} color="#F87171" />
              )}
              <Text style={[styles.secondaryBtnText, !isBlocked && { color: '#F87171' }]}>
                {isBlocked ? 'Unblock user' : 'Block user'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1, textAlign: 'center',
    color: Colors.text, fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.2,
  },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    borderRadius: 24, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden', alignItems: 'center',
    paddingVertical: 26, paddingHorizontal: 18, marginTop: 8,
  },
  avatarRing: {
    width: 92, height: 92, borderRadius: 46,
    backgroundColor: Colors.bg,
    borderWidth: 2, borderColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: Colors.accent, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
  },
  avatarEmoji: { fontSize: 54, fontFamily: EMOJI_FONT_FAMILY, lineHeight: 64 },
  username: { color: Colors.text, fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.4 },
  islandPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(96,165,250,0.12)',
    borderColor: 'rgba(96,165,250,0.25)', borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    marginTop: 12, maxWidth: '100%',
  },
  islandPillText: { color: Colors.accentLight, fontSize: 13, fontWeight: '700' as const, maxWidth: 240 },
  bioBox: {
    marginTop: 16, width: '100%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    padding: 14,
  },
  bioLabel: {
    color: Colors.textSecondary, fontSize: 10, fontWeight: '700' as const,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6,
  },
  bioText: { color: Colors.text, fontSize: 13, lineHeight: 19 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statCard: {
    flex: 1, backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 16,
    paddingVertical: 14, alignItems: 'center', gap: 4,
  },
  statValue: { color: Colors.text, fontSize: 20, fontWeight: '800' as const },
  statValueEmoji: { fontSize: 22, lineHeight: 28 },
  statLabel: { color: Colors.textSecondary, fontSize: 11 },
  actions: { marginTop: 20, gap: 12 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 16,
  },
  primaryBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' as const, letterSpacing: -0.2 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 16,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
  },
  secondaryBtnText: { color: Colors.text, fontSize: 14, fontWeight: '600' as const },
  fallback: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', gap: 14 },
  fbTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' as const },
  fbBtn: { backgroundColor: Colors.accent, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  fbBtnText: { color: Colors.white, fontWeight: '700' as const },
});
