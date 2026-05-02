import React, { useCallback, useMemo, useState } from 'react';
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
  Modal,
  Pressable,
  FlatList,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { AtSign, Lock, Eye, EyeOff, Palmtree, ArrowLeft, MapPin, ChevronRight, HelpCircle, Check, X, Search, ShieldCheck } from 'lucide-react-native';
import { useUser } from '@/contexts/UserContext';
import { ISLANDS, Island } from '@/constants/islands';
import FlagBadge from '@/components/FlagBadge';
import Colors from '@/constants/colors';

type Step = 'identify' | 'answer' | 'done';

export default function ForgotPasswordScreen() {
  const { lookupRecoveryQuestion, resetPasswordWithRecovery } = useUser();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('identify');
  const [username, setUsername] = useState<string>('');
  const [islandId, setIslandId] = useState<string>('');
  const [islandPickerOpen, setIslandPickerOpen] = useState<boolean>(false);
  const [islandQuery, setIslandQuery] = useState<string>('');
  const [question, setQuestion] = useState<string>('');
  const [answer, setAnswer] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const selectedIsland = useMemo<Island | undefined>(
    () => ISLANDS.find(i => i.id === islandId),
    [islandId],
  );

  const filteredIslands = useMemo<Island[]>(() => {
    const q = islandQuery.trim().toLowerCase();
    if (!q) return ISLANDS;
    return ISLANDS.filter(i => `${i.name} ${i.subtitle ?? ''} ${i.region}`.toLowerCase().includes(q));
  }, [islandQuery]);

  const canLookup = username.trim().length >= 3 && !!islandId && !submitting;
  const canReset = answer.trim().length >= 2 && newPassword.length >= 6 && !submitting;

  const handleLookup = useCallback(async () => {
    if (!canLookup) return;
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSubmitting(true);
    setError('');
    const res = await lookupRecoveryQuestion(username, islandId);
    setSubmitting(false);
    if (!res.ok || !res.question) {
      setError(res.error ?? 'Could not find an account with recovery set up');
      return;
    }
    setQuestion(res.question);
    setStep('answer');
  }, [canLookup, lookupRecoveryQuestion, username, islandId]);

  const handleReset = useCallback(async () => {
    if (!canReset) return;
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);
    setError('');
    const res = await resetPasswordWithRecovery(username, islandId, answer, newPassword);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not reset password');
      return;
    }
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStep('done');
  }, [canReset, resetPasswordWithRecovery, username, islandId, answer, newPassword]);

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
            testID="fp-back"
            onPress={() => {
              if (step === 'answer') { setStep('identify'); setError(''); return; }
              router.back();
            }}
            style={styles.backBtn}
            activeOpacity={0.8}
          >
            <ArrowLeft size={20} color={Colors.text} />
          </TouchableOpacity>

          <View style={styles.badge}>
            <ShieldCheck color={Colors.accentLight} size={14} />
            <Text style={styles.badgeText}>account recovery</Text>
          </View>

          {step === 'identify' && (
            <>
              <Text style={styles.title}>Forgot password?</Text>
              <Text style={styles.subtitle}>
                Enter your username and your home island. We'll ask the security question you set up.
              </Text>

              <Text style={styles.sectionLabel}>Username</Text>
              <View style={styles.inputCard}>
                <AtSign size={18} color={Colors.textSecondary} />
                <TextInput
                  testID="fp-username"
                  style={styles.input}
                  value={username}
                  onChangeText={(t) => { setUsername(t.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()); setError(''); }}
                  placeholder="username"
                  placeholderTextColor={Colors.textTertiary}
                  maxLength={15}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>

              <Text style={styles.sectionLabel}>Home island</Text>
              <TouchableOpacity
                testID="fp-island"
                style={styles.islandPicker}
                onPress={() => setIslandPickerOpen(true)}
                activeOpacity={0.85}
              >
                {selectedIsland ? (
                  <>
                    <FlagBadge code={selectedIsland.flagCode} fallback={selectedIsland.flag} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.islandName}>{selectedIsland.name}</Text>
                      <Text style={styles.islandRegion}>{selectedIsland.region}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.iconBubble}>
                      <MapPin size={18} color={Colors.accentLight} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.islandName}>Pick your home island</Text>
                      <Text style={styles.islandRegion}>The one you chose at signup</Text>
                    </View>
                  </>
                )}
                <ChevronRight size={18} color={Colors.textTertiary} />
              </TouchableOpacity>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                testID="fp-lookup"
                onPress={handleLookup}
                disabled={!canLookup}
                activeOpacity={0.9}
                style={{ marginTop: 24 }}
              >
                <LinearGradient
                  colors={canLookup ? ['#3B82F6', '#1E40AF'] : ['#1F2A44', '#17213A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cta}
                >
                  {submitting ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <Text style={[styles.ctaText, !canLookup && { color: Colors.textTertiary }]}>
                      Continue
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {step === 'answer' && (
            <>
              <Text style={styles.title}>Verify it's you</Text>
              <Text style={styles.subtitle}>
                Answer your security question and set a new password.
              </Text>

              <View style={styles.questionCard}>
                <View style={styles.qIcon}>
                  <HelpCircle size={16} color={Colors.accentLight} />
                </View>
                <Text style={styles.questionText}>{question}</Text>
              </View>

              <Text style={styles.sectionLabel}>Your answer</Text>
              <View style={styles.inputCard}>
                <ShieldCheck size={18} color={Colors.textSecondary} />
                <TextInput
                  testID="fp-answer"
                  style={styles.input}
                  value={answer}
                  onChangeText={(t) => { setAnswer(t); setError(''); }}
                  placeholder="answer"
                  placeholderTextColor={Colors.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>

              <Text style={styles.sectionLabel}>New password</Text>
              <View style={styles.inputCard}>
                <Lock size={18} color={Colors.textSecondary} />
                <TextInput
                  testID="fp-password"
                  style={styles.input}
                  value={newPassword}
                  onChangeText={(t) => { setNewPassword(t); setError(''); }}
                  placeholder="at least 6 characters"
                  placeholderTextColor={Colors.textTertiary}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleReset}
                />
                <TouchableOpacity onPress={() => setShowPassword(s => !s)} hitSlop={10}>
                  {showPassword ? (
                    <EyeOff size={18} color={Colors.textSecondary} />
                  ) : (
                    <Eye size={18} color={Colors.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                testID="fp-reset"
                onPress={handleReset}
                disabled={!canReset}
                activeOpacity={0.9}
                style={{ marginTop: 24 }}
              >
                <LinearGradient
                  colors={canReset ? ['#3B82F6', '#1E40AF'] : ['#1F2A44', '#17213A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cta}
                >
                  {submitting ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <Text style={[styles.ctaText, !canReset && { color: Colors.textTertiary }]}>
                      Reset password
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {step === 'done' && (
            <>
              <View style={styles.successCard}>
                <View style={styles.successIcon}>
                  <Check size={28} color={Colors.white} strokeWidth={3} />
                </View>
                <Text style={styles.title}>Password reset</Text>
                <Text style={[styles.subtitle, { textAlign: 'center' }]}>
                  You can now log in with your new password.
                </Text>
              </View>
              <TouchableOpacity
                testID="fp-go-login"
                onPress={() => router.replace('/login')}
                activeOpacity={0.9}
                style={{ marginTop: 16 }}
              >
                <LinearGradient
                  colors={['#3B82F6', '#1E40AF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cta}
                >
                  <Text style={styles.ctaText}>Back to log in</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.footerRow}>
            <Palmtree size={14} color={Colors.textTertiary} />
            <Text style={styles.footerText}>we never email. your answer is hashed.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={islandPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIslandPickerOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setIslandPickerOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Your home island</Text>
            <TouchableOpacity onPress={() => setIslandPickerOpen(false)} style={styles.closeBtn}>
              <X size={16} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchBar}>
            <Search size={16} color={Colors.textSecondary} />
            <TextInput
              value={islandQuery}
              onChangeText={setIslandQuery}
              placeholder="Search islands…"
              placeholderTextColor={Colors.textTertiary}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {islandQuery.length > 0 && (
              <TouchableOpacity onPress={() => setIslandQuery('')}>
                <X size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={filteredIslands}
            keyExtractor={(i) => i.id}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 440 }}
            renderItem={({ item }) => {
              const active = item.id === islandId;
              return (
                <TouchableOpacity
                  testID={`fp-pick-${item.id}`}
                  style={[styles.islandRow, active && { backgroundColor: 'rgba(59,130,246,0.12)' }]}
                  onPress={() => {
                    setIslandId(item.id);
                    setIslandPickerOpen(false);
                    setIslandQuery('');
                    if (Platform.OS !== 'web') void Haptics.selectionAsync();
                  }}
                  activeOpacity={0.85}
                >
                  <FlagBadge code={item.flagCode} fallback={item.flag} size={34} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.islandName}>
                      {item.name}
                      {item.subtitle ? <Text style={styles.islandSub}>  · {item.subtitle}</Text> : null}
                    </Text>
                    <Text style={styles.islandRegion}>{item.region}</Text>
                  </View>
                  {active && <Check size={18} color={Colors.accentLight} />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1 },
  scroll: { paddingHorizontal: 24 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(59,130,246,0.3)', borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    marginBottom: 16,
  },
  badgeText: { color: Colors.accentLight, fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.5 },
  title: { fontSize: 34, fontWeight: '800' as const, color: Colors.text, letterSpacing: -1, lineHeight: 40 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginTop: 10, lineHeight: 22 },
  sectionLabel: {
    color: Colors.textSecondary, fontSize: 12, fontWeight: '700' as const,
    letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 10,
  },
  inputCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bgElevated, borderRadius: 18,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  input: { flex: 1, color: Colors.text, fontSize: 17, fontWeight: '500' as const, padding: 0 },
  islandPicker: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.bgElevated, borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  iconBubble: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(59,130,246,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  islandName: { color: Colors.text, fontSize: 15, fontWeight: '700' as const },
  islandSub: { color: Colors.accentLight, fontSize: 12, fontWeight: '600' as const },
  islandRegion: { color: Colors.textTertiary, fontSize: 12, marginTop: 2 },
  questionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderColor: 'rgba(96,165,250,0.3)', borderWidth: 1,
    borderRadius: 18, padding: 16, marginTop: 18,
  },
  qIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  questionText: { flex: 1, color: Colors.text, fontSize: 15, fontWeight: '600' as const, lineHeight: 20 },
  error: { color: '#F87171', fontSize: 13, marginTop: 12, marginLeft: 4, fontWeight: '500' as const },
  cta: { borderRadius: 18, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: Colors.white, fontSize: 17, fontWeight: '700' as const, letterSpacing: 0.2 },
  successCard: {
    alignItems: 'center',
    backgroundColor: Colors.bgElevated,
    borderRadius: 28, borderWidth: 1, borderColor: Colors.border,
    padding: 28, marginTop: 12, gap: 10,
  },
  successIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  footerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center', marginTop: 28,
  },
  footerText: { color: Colors.textTertiary, fontSize: 12 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 16, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: Colors.border,
    maxHeight: '85%',
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 12 },
  sheetHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12, paddingHorizontal: 4,
  },
  sheetTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' as const },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, marginBottom: 8,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15, padding: 0 },
  islandRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 10, borderRadius: 14, marginBottom: 2,
  },
});
