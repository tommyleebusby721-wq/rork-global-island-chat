import React from 'react';
import { Tabs, router } from 'expo-router';
import { Platform, View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Palmtree, MessageCircle, UserCircle2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useChat } from '@/contexts/ChatContext';
import { useUser } from '@/contexts/UserContext';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { islandUnreadTotal, mentionUnread, seenAt } = useNotifications();
  const { getDmPartners, messagesByRoom } = useChat();
  const { profile } = useUser();

  React.useEffect(() => {
    if (!profile) return;
    if (profile.hasRecovery) return;
    (async () => {
      const key = `gic_recovery_prompted_v1_${profile.id}`;
      const already = await AsyncStorage.getItem(key);
      if (already) return;
      await AsyncStorage.setItem(key, '1');
      setTimeout(() => { router.push('/setup-recovery'); }, 600);
    })();
  }, [profile]);

  const dmUnread = React.useMemo(() => {
    if (!profile) return 0;
    return getDmPartners(profile.id).reduce((acc, p) => {
      const since = seenAt[p.roomId] ?? 0;
      const msgs = messagesByRoom(p.roomId);
      const hasUnread = msgs.some(m => m.userId !== profile.id && m.createdAt > since);
      return hasUnread ? acc + 1 : acc;
    }, 0);
  }, [getDmPartners, messagesByRoom, profile, seenAt]);
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 6);
  const tabBarHeight = Platform.select({
    ios: 52 + bottomInset,
    android: 62 + bottomInset,
    default: 64,
  }) as number;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.accentLight,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: Platform.OS === 'ios' ? 0 : 2,
          marginTop: Platform.OS === 'ios' ? 2 : 2,
        },
        tabBarIconStyle: {
          marginTop: Platform.OS === 'ios' ? 2 : 0,
        },
        tabBarItemStyle: {
          paddingTop: Platform.OS === 'ios' ? 6 : 6,
          paddingBottom: Platform.OS === 'ios' ? 2 : 4,
        },
        tabBarStyle: {
          position: 'absolute',
          height: tabBarHeight,
          paddingTop: Platform.OS === 'ios' ? 6 : 6,
          paddingBottom: bottomInset,
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(11,18,32,0.98)',
          borderTopColor: Colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView tint="dark" intensity={80} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11,18,32,0.98)' }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="islands"
        options={{
          title: 'Islands',
          tabBarIcon: ({ color, size }) => <Palmtree color={color} size={size} />,
          tabBarBadge: islandUnreadTotal + mentionUnread > 0 ? (islandUnreadTotal + mentionUnread > 99 ? '99+' : String(islandUnreadTotal + mentionUnread)) : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.accent, color: Colors.white, fontSize: 10, fontWeight: '700' as const },
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />,
          tabBarBadge: dmUnread > 0 ? (dmUnread > 99 ? '99+' : String(dmUnread)) : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.accent, color: Colors.white, fontSize: 10, fontWeight: '700' as const },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <UserCircle2 color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
