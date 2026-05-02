import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Lock } from 'lucide-react-native';
import { useUser } from '@/contexts/UserContext';
import { dmRoomId } from '@/contexts/ChatContext';
import ChatRoom from '@/components/ChatRoom';
import Colors from '@/constants/colors';

export default function DmScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { profile, getUserById } = useUser();

  const partner = useMemo(() => getUserById(id ?? ''), [getUserById, id]);

  const roomId = useMemo(() => {
    if (!profile || !id) return '';
    return dmRoomId(profile.id, id);
  }, [profile, id]);

  if (!profile || !partner || !roomId) {
    return (
      <View style={styles.fallback}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.fbTitle}>Conversation unavailable</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.fbBtn}>
          <Text style={styles.fbBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={["#0B1220", "#0E1836", "#0B1220"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.headerWrap, { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 12 : 8) + 6 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <ChevronLeft size={28} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push(`/user/${partner.id}`)}
            style={styles.identityBtn}
            activeOpacity={0.7}
            testID="dm-open-profile"
            hitSlop={6}
          >
            <View style={styles.avatarSmall}>
              <Text style={styles.avatarEmoji}>{partner.avatarEmoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>@{partner.username}</Text>
              <View style={styles.subRow}>
                <Lock size={10} color={Colors.textTertiary} />
                <Text style={styles.headerSub}>private · disappears in 24h · tap to view profile</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ChatRoom roomId={roomId} showUsernames={false} />
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
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 8, paddingBottom: 14, paddingTop: 8, minHeight: 64,
  },
  backBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  identityBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 4,
  },
  avatarSmall: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 20 },
  headerTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' as const },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  headerSub: { color: Colors.textSecondary, fontSize: 11 },
  fallback: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', gap: 14 },
  fbTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' as const },
  fbBtn: { backgroundColor: Colors.accent, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  fbBtnText: { color: Colors.white, fontWeight: '700' as const },
});
