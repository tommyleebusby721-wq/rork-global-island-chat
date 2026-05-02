import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AtSign, MessageCircle, Heart, Users } from 'lucide-react-native';
import { useNotifications } from '@/contexts/NotificationsContext';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';

export default function NotificationBanner() {
  const insets = useSafeAreaInsets();
  const { banner, dismissBanner } = useNotifications();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (banner) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: USE_NATIVE_DRIVER, friction: 9, tension: 80 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -140, duration: 220, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    }
  }, [banner, opacity, translateY]);

  if (!banner) return null;

  const onTap = () => {
    if (banner.kind === 'dm' && banner.partnerId) {
      router.push(`/dm/${banner.partnerId}`);
    } else if (banner.islandId) {
      router.push(`/island/${banner.islandId}`);
    }
    dismissBanner();
  };

  const Icon = banner.kind === 'mention' ? AtSign : banner.kind === 'dm' ? MessageCircle : banner.kind === 'reaction' ? Heart : Users;
  const iconColor = banner.kind === 'mention' ? '#FBBF24' : banner.kind === 'dm' ? Colors.accentLight : '#F472B6';

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + 8,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity activeOpacity={0.9} onPress={onTap} style={styles.card}>
        <View style={[styles.iconWrap, { backgroundColor: `${iconColor}22`, borderColor: `${iconColor}55` }]}>
          <Icon size={16} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.title}>{banner.title}</Text>
          <Text numberOfLines={2} style={styles.body}>{banner.body}</Text>
        </View>
        <Text style={styles.emoji}>{banner.emoji}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: 12,
    zIndex: 9999,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(17,26,46,0.96)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 10 },
      default: {},
    }),
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  title: { color: Colors.text, fontSize: 14, fontWeight: '700' as const },
  body: { color: Colors.textSecondary, fontSize: 12, marginTop: 1 },
  emoji: { fontSize: 22 },
});
