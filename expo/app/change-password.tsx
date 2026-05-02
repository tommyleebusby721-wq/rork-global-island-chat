import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, Lock, Eye, EyeOff, ShieldCheck, Check } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

export default function ChangePasswordScreen() {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<string>('');
  const [next, setNext] = useState<string>('');
  const [confirm, setConfirm] = useState<string>('');
  const [showCur, setShowCur] = useState<boolean>(false);
  const [showNew, setShowNew] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);

  const onSave = useCallback(async () => {
    setError('');
    if (!current) return setError('Enter your current password');
    if (!next || next.length < 6) return setError('New password must be at least 6 characters');
    if (next !== confirm) return setError('New passwords do not match');
    if (current === next) return setError('New password must be different from current');

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const email = sessionData.session?.user?.email;
      if (!email) {
        setError('Session expired. Please sign in again.');
        setLoading(false);
        return;
      }
      const { error: reauthErr } = await supabase.auth.signInWithPassword({ email, password: current });
      if (reauthErr) {
        setError('Current password is incorrect');
        setLoading(false);
        return;
      }
      const { error: updateErr } = await supabase.auth.updateUser({ password: next });
      if (updateErr) {
        setError(updateErr.message);
        setLoading(false);
        return;
      }
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);
      setLoading(false);
      setTimeout(() => {
        router.back();
      }, 1200);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setError(msg);
      setLoading(false);
    }
  }, [current, next, confirm]);

  if (success) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <LinearGradient colors={["#0B1220", "#0E1836", "#0B1220"]} style={StyleSheet.absoluteFill} />
        <View style={styles.successWrap}>
          <View style={styles.successCircle}>
            <Check size={36} color={Colors.white} />
          </View>
          <Text style={styles.successTitle}>Password updated</Text>
          <Text style={styles.successSub}>Your password was changed successfully.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={["#0B1220", "#0E1836", "#0B1220"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10} testID="cp-back">
          <ChevronLeft size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change password</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={40}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconWrap}>
            <View style={styles.iconCircle}>
              <ShieldCheck size={30} color={Colors.accentLight} />
            </View>
            <Text style={styles.title}>Update your password</Text>
            <Text style={styles.sub}>
              Pick something strong. You&apos;ll need to sign in again on other devices.
            </Text>
          </View>

          <Text style={styles.label}>Current password</Text>
          <View style={styles.inputWrap}>
            <Lock size={16} color={Colors.textSecondary} />
            <TextInput
              value={current}
              onChangeText={setCurrent}
              placeholder="Current password"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry={!showCur}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              testID="cp-current"
            />
            <TouchableOpacity onPress={() => setShowCur(s => !s)} hitSlop={8}>
              {showCur ? <EyeOff size={16} color={Colors.textSecondary} /> : <Eye size={16} color={Colors.textSecondary} />}
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>New password</Text>
          <View style={styles.inputWrap}>
            <Lock size={16} color={Colors.textSecondary} />
            <TextInput
              value={next}
              onChangeText={setNext}
              placeholder="At least 6 characters"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry={!showNew}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              testID="cp-new"
            />
            <TouchableOpacity onPress={() => setShowNew(s => !s)} hitSlop={8}>
              {showNew ? <EyeOff size={16} color={Colors.textSecondary} /> : <Eye size={16} color={Colors.textSecondary} />}
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirm new password</Text>
          <View style={styles.inputWrap}>
            <Lock size={16} color={Colors.textSecondary} />
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repeat new password"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry={!showNew}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              testID="cp-confirm"
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            onPress={onSave}
            activeOpacity={0.85}
            disabled={loading}
            testID="cp-save"
            style={{ marginTop: 22, opacity: loading ? 0.6 : 1 }}
          >
            <LinearGradient
              colors={["#60A5FA", "#2563EB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveBtn}
            >
              <Text style={styles.saveText}>{loading ? 'Updating…' : 'Update password'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              const go = () => router.replace('/forgot-password');
              if (Platform.OS === 'web') return go();
              Alert.alert('Forgot current password?', 'Use account recovery to reset via your security question.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Continue', onPress: go },
              ]);
            }}
            style={{ marginTop: 16, alignSelf: 'center' }}
          >
            <Text style={styles.forgotText}>Forgot current password?</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingBottom: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1, textAlign: 'center',
    color: Colors.text, fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.2,
  },
  iconWrap: { alignItems: 'center', marginTop: 10, marginBottom: 28, paddingHorizontal: 20 },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(96,165,250,0.12)',
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.3)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  title: { color: Colors.text, fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.4 },
  sub: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  label: {
    color: Colors.textSecondary, fontSize: 11, fontWeight: '800' as const,
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginBottom: 8, marginLeft: 4, marginTop: 16,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    borderRadius: 14,
  },
  input: { flex: 1, color: Colors.text, fontSize: 15, padding: 0 },
  error: {
    marginTop: 12, color: '#F87171', fontSize: 13, fontWeight: '600' as const,
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12,
  },
  saveBtn: {
    paddingVertical: 16, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  saveText: { color: Colors.white, fontSize: 15, fontWeight: '800' as const, letterSpacing: -0.2 },
  forgotText: { color: Colors.accentLight, fontSize: 13, fontWeight: '600' as const },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 12 },
  successCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#10B981',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#10B981', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    marginBottom: 8,
  },
  successTitle: { color: Colors.text, fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.4 },
  successSub: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center' },
});
