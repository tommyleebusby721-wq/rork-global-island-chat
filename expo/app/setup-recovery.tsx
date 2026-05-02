import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldCheck, X } from 'lucide-react-native';
import { useUser } from '@/contexts/UserContext';
import SecurityQuestionPicker from '@/components/SecurityQuestionPicker';
import Colors from '@/constants/colors';

export default function SetupRecoveryScreen() {
  const { setSecurityAnswer } = useUser();
  const insets = useSafeAreaInsets();

  const [question, setQuestion] = useState<string>('');
  const [answer, setAnswer] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const canSubmit = question.length > 0 && answer.trim().length >= 2 && !submitting;

  const handleSave = useCallback(async () => {
    if (!canSubmit) return;
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);
    setError('');
    const res = await setSecurityAnswer(question, answer);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save');
      return;
    }
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }, [answer, canSubmit, question, setSecurityAnswer]);

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
          <View style={styles.topRow}>
            <View style={styles.badge}>
              <ShieldCheck color={Colors.accentLight} size={14} />
              <Text style={styles.badgeText}>secure your account</Text>
            </View>
            <TouchableOpacity
              testID="setup-skip"
              onPress={() => router.back()}
              style={styles.closeBtn}
              activeOpacity={0.85}
            >
              <X size={16} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Set up account{'\n'}recovery</Text>
          <Text style={styles.subtitle}>
            You didn't share an email, so we use a security question + your home island to recover your password.
          </Text>

          <Text style={styles.sectionLabel}>Security question</Text>
          <SecurityQuestionPicker value={question} onChange={setQuestion} testID="setup-question" />

          <Text style={styles.sectionLabel}>Your answer</Text>
          <View style={styles.inputCard}>
            <TextInput
              testID="setup-answer"
              style={styles.input}
              value={answer}
              onChangeText={(t) => { setAnswer(t); setError(''); }}
              placeholder="type your answer"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          </View>
          <Text style={styles.hint}>
            Stored hashed. Case and spaces don't matter. Pick something only you know.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            testID="setup-save"
            onPress={handleSave}
            disabled={!canSubmit}
            activeOpacity={0.9}
            style={{ marginTop: 24 }}
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
                  Save & continue
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            testID="setup-later"
            onPress={() => router.back()}
            style={styles.laterBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.laterText}>Maybe later</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1 },
  scroll: { paddingHorizontal: 24 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(59,130,246,0.3)', borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
  },
  badgeText: { color: Colors.accentLight, fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.5 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 34, fontWeight: '800' as const, color: Colors.text, letterSpacing: -1, lineHeight: 40 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginTop: 10, lineHeight: 22 },
  sectionLabel: {
    color: Colors.textSecondary, fontSize: 12, fontWeight: '700' as const,
    letterSpacing: 1, textTransform: 'uppercase', marginTop: 24, marginBottom: 10,
  },
  inputCard: {
    backgroundColor: Colors.bgElevated, borderRadius: 18,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  input: { color: Colors.text, fontSize: 17, fontWeight: '500' as const, padding: 0 },
  hint: { color: Colors.textTertiary, fontSize: 12, marginTop: 8, marginLeft: 4 },
  error: { color: '#F87171', fontSize: 13, marginTop: 12, marginLeft: 4, fontWeight: '500' as const },
  cta: { borderRadius: 18, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: Colors.white, fontSize: 17, fontWeight: '700' as const, letterSpacing: 0.2 },
  laterBtn: { alignItems: 'center', marginTop: 14, paddingVertical: 8 },
  laterText: { color: Colors.textSecondary, fontSize: 14 },
});
