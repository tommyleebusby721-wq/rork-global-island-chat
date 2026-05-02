import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router, Link, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { AtSign, Lock, Eye, EyeOff, Palmtree, ArrowLeft } from 'lucide-react-native';
import { useUser } from '@/contexts/UserContext';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';

export default function LoginScreen() {
  const { signIn } = useUser();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const buttonScale = useRef(new Animated.Value(1)).current;

  const canSubmit = useMemo(
    () => username.trim().length >= 3 && password.length >= 1 && !submitting,
    [username, password, submitting],
  );

  const handleLogin = useCallback(async () => {
    if (!canSubmit) return;
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.96, duration: 60, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(buttonScale, { toValue: 1, duration: 120, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();

    setSubmitting(true);
    setError('');
    const result = await signIn(username, password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? 'Something went wrong');
      return;
    }
    router.replace('/(tabs)/islands');
  }, [buttonScale, canSubmit, password, signIn, username]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={["#0B1220", "#0E1836", "#0B1220"]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            testID="login-back"
            onPress={() => router.back()}
            style={styles.backBtn}
            activeOpacity={0.8}
          >
            <ArrowLeft size={20} color={Colors.text} />
          </TouchableOpacity>

          <View style={styles.badge}>
            <Palmtree color={Colors.accentLight} size={14} />
            <Text style={styles.badgeText}>welcome back</Text>
          </View>

          <Text style={styles.title}>Log in</Text>
          <Text style={styles.subtitle}>
            Enter your username and password to return to your island.
          </Text>

          <Text style={styles.sectionLabel}>Username</Text>
          <View style={styles.inputCard}>
            <AtSign size={18} color={Colors.textSecondary} />
            <TextInput
              testID="login-username"
              style={styles.input}
              value={username}
              onChangeText={(t) => {
                setUsername(t.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());
                setError('');
              }}
              placeholder="username"
              placeholderTextColor={Colors.textTertiary}
              maxLength={15}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <Text style={styles.sectionLabel}>Password</Text>
          <View style={styles.inputCard}>
            <Lock size={18} color={Colors.textSecondary} />
            <TextInput
              testID="login-password"
              style={styles.input}
              value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }}
              placeholder="your password"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(s => !s)}
              hitSlop={10}
              testID="login-toggle-password"
            >
              {showPassword ? (
                <EyeOff size={18} color={Colors.textSecondary} />
              ) : (
                <Eye size={18} color={Colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            testID="login-forgot"
            style={styles.forgotWrap}
            onPress={() => router.push('/forgot-password')}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Animated.View style={{ transform: [{ scale: buttonScale }], marginTop: 24 }}>
            <TouchableOpacity
              testID="login-submit"
              onPress={handleLogin}
              disabled={!canSubmit}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={canSubmit ? ['#3B82F6', '#1E40AF'] : ['#1F2A44', '#17213A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cta}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={[styles.ctaText, !canSubmit && { color: Colors.textTertiary }]}>
                    Log in
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Link href="/onboarding" asChild>
            <TouchableOpacity testID="go-to-signup" style={styles.signupLinkWrap} activeOpacity={0.8}>
              <Text style={styles.signupLinkText}>
                New here? <Text style={styles.signupLinkBold}>Create an account</Text>
              </Text>
            </TouchableOpacity>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1 },
  scroll: { paddingHorizontal: 24 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(59,130,246,0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 16,
  },
  badgeText: { color: Colors.accentLight, fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.5 },
  title: {
    fontSize: 38,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -1,
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 10,
    lineHeight: 22,
  },
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 22,
    marginBottom: 10,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.bgElevated,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 17,
    fontWeight: '500' as const,
    padding: 0,
  },
  error: { color: '#F87171', fontSize: 13, marginTop: 12, marginLeft: 4, fontWeight: '500' as const },
  cta: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: Colors.white, fontSize: 17, fontWeight: '700' as const, letterSpacing: 0.2 },
  signupLinkWrap: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 8,
  },
  signupLinkText: { color: Colors.textSecondary, fontSize: 14 },
  signupLinkBold: { color: Colors.accentLight, fontWeight: '700' as const },
});
