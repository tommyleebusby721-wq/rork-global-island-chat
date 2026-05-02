import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Easing,
  Image,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Palmtree, ArrowRight, LogIn } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(20)).current;
  const float = useRef(new Animated.Value(0)).current;


  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(rise, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(float, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    ).start();

  }, [fade, rise, float]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });

  const go = (path: '/onboarding' | '/login') => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(path);
  };

  return (
    <View style={styles.root} testID="welcome-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={["#06101F", "#0B1836", "#0E214A", "#0B1220"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.orbOne} />
      <View style={styles.orbTwo} />
      <View style={styles.orbThree} />

      <View style={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }], flex: 1 }}>
          <View style={styles.header}>
            <View style={styles.badge}>
              <Palmtree color={Colors.accentLight} size={14} />
              <Text style={styles.badgeText}>caribbean · anonymous · ephemeral</Text>
            </View>
          </View>

          <View style={styles.heroWrap}>
            <Animated.Image
              source={{ uri: 'https://r2-pub.rork.com/generated-images/2088a80d-0d95-4984-85c8-e9c675ae2b69.png' }}
              style={[styles.heroImage, { transform: [{ translateY }] }]}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>
            Island chats.{"\n"}
            <Text style={styles.titleAccent}>Real people.</Text>
          </Text>
          <Text style={styles.subtitle}>
            Drop into your Caribbean island room. Meet locals, chat anonymously, and vibe —
            messages fade in 24h.
          </Text>

          <View style={styles.features}>
            <FeatureRow emoji="🌴" label="Join your island's group chat" />
            <FeatureRow emoji="💬" label="DMs & translations built in" />
            <FeatureRow emoji="🫧" label="Anonymous — no email required" />
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
          <TouchableOpacity
            testID="welcome-signup"
            activeOpacity={0.9}
            onPress={() => go('/onboarding')}
          >
            <LinearGradient
              colors={['#60A5FA', '#3B82F6', '#1E40AF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryCta}
            >
              <Text style={styles.primaryCtaText}>Create account</Text>
              <ArrowRight color={Colors.white} size={18} />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            testID="welcome-login"
            activeOpacity={0.85}
            onPress={() => go('/login')}
            style={styles.secondaryCta}
          >
            <LogIn color={Colors.text} size={17} />
            <Text style={styles.secondaryCtaText}>I already have an account</Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            By continuing you confirm you're 13+ and agree to be kind.
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

function FeatureRow({ emoji, label }: { emoji: string; label: string }) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIcon}>
        <Text style={styles.featureEmoji}>{emoji}</Text>
      </View>
      <Text style={styles.featureText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg, overflow: 'hidden' },
  orbOne: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 200,
    backgroundColor: 'rgba(59,130,246,0.25)',
    opacity: 0.6,
  },
  orbTwo: {
    position: 'absolute',
    bottom: -160,
    left: -100,
    width: 360,
    height: 360,
    borderRadius: 200,
    backgroundColor: 'rgba(16,185,129,0.12)',
  },
  orbThree: {
    position: 'absolute',
    top: '38%',
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(253,224,71,0.08)',
  },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  header: { alignItems: 'flex-start' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(59,130,246,0.14)',
    borderColor: 'rgba(59,130,246,0.35)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { color: Colors.accentLight, fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.5 },
  heroWrap: { alignItems: 'center', marginTop: 12, marginBottom: 12 },
  heroImage: {
    width: 150,
    height: 115,
  },
  title: {
    fontSize: 40,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -1.2,
    lineHeight: 44,
  },
  titleAccent: { color: Colors.accentLight },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 12,
    lineHeight: 22,
  },
  features: { marginTop: 20, gap: 10 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(23,33,58,0.6)',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  featureIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(59,130,246,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  featureEmoji: { fontSize: 18 },
  featureText: { color: Colors.text, fontSize: 14, fontWeight: '600' as const, flex: 1 },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 20,
    paddingVertical: 17,
    shadowColor: Colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  primaryCtaText: { color: Colors.white, fontSize: 17, fontWeight: '700' as const, letterSpacing: 0.2 },
  secondaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    borderRadius: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(23,33,58,0.8)',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryCtaText: { color: Colors.text, fontSize: 15, fontWeight: '600' as const },
  disclaimer: {
    color: Colors.textTertiary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
  },
});
