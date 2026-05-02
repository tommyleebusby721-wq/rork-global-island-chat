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
  FlatList,
  Modal,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { AtSign, Palmtree, Check, X, Search, ChevronRight, MapPin, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react-native';
import { Link } from 'expo-router';
import { Linking } from 'react-native';
import { useUser } from '@/contexts/UserContext';
import { TERMS_URL, PRIVACY_URL } from '@/constants/moderation';
import SecurityQuestionPicker from '@/components/SecurityQuestionPicker';
import { AVATAR_EMOJIS, EMOJI_FONT_FAMILY } from '@/constants/avatars';
import { ISLANDS, Island } from '@/constants/islands';
import FlagBadge from '@/components/FlagBadge';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';

type UsernameStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'taken';

export default function OnboardingScreen() {
  const { signUp, isUsernameAvailable, acceptTerms } = useUser();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [securityQuestion, setSecurityQuestion] = useState<string>('');
  const [securityAnswer, setSecurityAnswer] = useState<string>('');
  const [avatarEmoji, setAvatarEmoji] = useState<string>(AVATAR_EMOJIS[0]);
  const [islandId, setIslandId] = useState<string>('');
  const [islandPickerOpen, setIslandPickerOpen] = useState<boolean>(false);
  const [islandQuery, setIslandQuery] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);
  const buttonScale = useRef(new Animated.Value(1)).current;

  const selectedIsland = useMemo<Island | undefined>(
    () => ISLANDS.find(i => i.id === islandId),
    [islandId],
  );

  const usernameStatus = useMemo<UsernameStatus>(() => {
    const uname = username.trim().toLowerCase();
    if (!uname) return 'idle';
    if (uname.length < 3) return 'invalid';
    if (!/^[a-z0-9]+$/.test(uname)) return 'invalid';
    return isUsernameAvailable(uname) ? 'available' : 'taken';
  }, [username, isUsernameAvailable]);

  const passwordValid = password.length >= 6;
  const recoveryValid = securityQuestion.length > 0 && securityAnswer.trim().length >= 2;
  const canSubmit =
    usernameStatus === 'available' && passwordValid && !!islandId && recoveryValid && acceptedTerms && !submitting;

  const handleContinue = useCallback(async () => {
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
    const result = await signUp(username, password, avatarEmoji, islandId, {
      question: securityQuestion,
      answer: securityAnswer,
    });
    if (result.ok) {
      try { await acceptTerms(); } catch (e) { console.log('[onboarding] acceptTerms error', e); }
    }
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? 'Something went wrong');
      return;
    }
    router.replace('/(tabs)/islands');
  }, [acceptTerms, avatarEmoji, buttonScale, canSubmit, islandId, password, securityAnswer, securityQuestion, signUp, username]);

  const filteredIslands = useMemo<Island[]>(() => {
    const q = islandQuery.trim().toLowerCase();
    if (!q) return ISLANDS;
    return ISLANDS.filter(i =>
      `${i.name} ${i.subtitle ?? ''} ${i.region}`.toLowerCase().includes(q),
    );
  }, [islandQuery]);

  const onPickIsland = useCallback((id: string) => {
    setIslandId(id);
    setIslandPickerOpen(false);
    setIslandQuery('');
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
  }, []);

  const statusContent = () => {
    if (usernameStatus === 'idle')
      return <Text style={styles.hint}>3–15 characters · letters and numbers</Text>;
    if (usernameStatus === 'invalid')
      return <Text style={styles.hint}>3–15 characters · letters and numbers only</Text>;
    if (usernameStatus === 'checking')
      return (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={Colors.textSecondary} />
          <Text style={styles.hint}>Checking availability…</Text>
        </View>
      );
    if (usernameStatus === 'available')
      return (
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: '#10B981' }]}>
            <Check size={10} color={Colors.white} strokeWidth={3} />
          </View>
          <Text style={styles.available}>@{username.trim()} is available</Text>
        </View>
      );
    return (
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: '#EF4444' }]}>
          <X size={10} color={Colors.white} strokeWidth={3} />
        </View>
        <Text style={styles.taken}>Already taken — try something more unique</Text>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#0B1220", "#0E1836", "#0B1220"]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.badge}>
            <Palmtree color={Colors.accentLight} size={14} />
            <Text style={styles.badgeText} numberOfLines={1} adjustsFontSizeToFit>caribbean · ephemeral · anonymous</Text>
          </View>

          <Text style={styles.title}>Pick your{'\n'}island name</Text>
          <Text style={styles.subtitle}>
            Join Caribbean island chats. Anonymous. Messages disappear in 24h.
          </Text>

          <View style={styles.previewWrap}>
            <View style={styles.previewAvatar} testID="preview-avatar">
              <Text style={styles.previewEmoji}>{avatarEmoji}</Text>
              {selectedIsland ? (
                <View style={styles.previewFlag}>
                  <FlagBadge code={selectedIsland.flagCode} fallback={selectedIsland.flag} size={34} />
                </View>
              ) : null}
            </View>
            <Text style={styles.previewName}>@{username.trim() || 'username'}</Text>
            {selectedIsland ? (
              <Text style={styles.previewIsland}>from {selectedIsland.name}</Text>
            ) : null}
          </View>

          <Text style={styles.sectionLabel}>Username</Text>
          <View style={[
            styles.inputCard,
            usernameStatus === 'available' && styles.inputCardSuccess,
            usernameStatus === 'taken' && styles.inputCardError,
          ]}>
            <AtSign size={18} color={Colors.textSecondary} />
            <TextInput
              testID="username-input"
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
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />
            {usernameStatus === 'available' && (
              <View style={[styles.inlineBadge, { backgroundColor: '#10B981' }]} testID="username-available">
                <Check size={12} color={Colors.white} strokeWidth={3} />
              </View>
            )}
            {usernameStatus === 'taken' && (
              <View style={[styles.inlineBadge, { backgroundColor: '#EF4444' }]} testID="username-taken">
                <X size={12} color={Colors.white} strokeWidth={3} />
              </View>
            )}
          </View>
          <View style={styles.statusLine}>{statusContent()}</View>

          <Text style={styles.sectionLabel}>Password</Text>
          <View style={[
            styles.inputCard,
            password.length > 0 && passwordValid && styles.inputCardSuccess,
          ]}>
            <Lock size={18} color={Colors.textSecondary} />
            <TextInput
              testID="password-input"
              style={styles.input}
              value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }}
              placeholder="create a password"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              returnKeyType="done"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(s => !s)}
              hitSlop={10}
              testID="toggle-password"
            >
              {showPassword ? (
                <EyeOff size={18} color={Colors.textSecondary} />
              ) : (
                <Eye size={18} color={Colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.statusLine}>
            <Text style={styles.hint}>
              {password.length === 0
                ? 'At least 6 characters'
                : passwordValid
                  ? 'Looks good'
                  : 'Too short — at least 6 characters'}
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Account recovery</Text>
          <SecurityQuestionPicker value={securityQuestion} onChange={setSecurityQuestion} testID="onboarding-question" />
          <View style={{ height: 10 }} />
          <View style={[styles.inputCard, recoveryValid && styles.inputCardSuccess]}>
            <ShieldCheck size={18} color={Colors.textSecondary} />
            <TextInput
              testID="security-answer"
              style={styles.input}
              value={securityAnswer}
              onChangeText={(t) => { setSecurityAnswer(t); setError(''); }}
              placeholder="your answer"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
            />
          </View>
          <View style={styles.statusLine}>
            <Text style={styles.hint}>
              Used only if you forget your password. Stored hashed.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Your island</Text>
          <TouchableOpacity
            testID="island-picker"
            style={styles.islandPicker}
            onPress={() => {
              if (Platform.OS !== 'web') void Haptics.selectionAsync();
              setIslandPickerOpen(true);
            }}
            activeOpacity={0.85}
          >
            {selectedIsland ? (
              <>
                <FlagBadge code={selectedIsland.flagCode} fallback={selectedIsland.flag} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.islandPickerName}>
                    {selectedIsland.name}
                    {selectedIsland.subtitle ? (
                      <Text style={styles.islandPickerSub}>  · {selectedIsland.subtitle}</Text>
                    ) : null}
                  </Text>
                  <Text style={styles.islandPickerRegion}>{selectedIsland.region}</Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.islandPickerIcon}>
                  <MapPin size={18} color={Colors.accentLight} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.islandPickerName}>Which island are you from?</Text>
                  <Text style={styles.islandPickerRegion}>Shown on your profile</Text>
                </View>
              </>
            )}
            <ChevronRight size={18} color={Colors.textTertiary} />
          </TouchableOpacity>

          <Text style={styles.sectionLabel}>Choose an avatar</Text>
          <View style={styles.grid}>
            {AVATAR_EMOJIS.map((emoji) => {
              const selected = emoji === avatarEmoji;
              return (
                <TouchableOpacity
                  key={emoji}
                  testID={`avatar-${emoji}`}
                  style={[styles.emojiCell, selected && styles.emojiCellSelected]}
                  onPress={() => {
                    setAvatarEmoji(emoji);
                    if (Platform.OS !== 'web') void Haptics.selectionAsync();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emojiBig}>{emoji}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            testID="accept-terms"
            style={styles.termsRow}
            onPress={() => {
              setAcceptedTerms(v => !v);
              if (Platform.OS !== 'web') void Haptics.selectionAsync();
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.termsCheckbox, acceptedTerms && styles.termsCheckboxOn]}>
              {acceptedTerms ? <Check size={14} color={Colors.white} strokeWidth={3} /> : null}
            </View>
            <Text style={styles.termsText}>
              I am 13+ and agree to the{' '}
              <Text style={styles.termsLink} onPress={() => Linking.openURL(TERMS_URL)}>Terms of Use (EULA)</Text>
              {' '}and{' '}
              <Text style={styles.termsLink} onPress={() => Linking.openURL(PRIVACY_URL)}>Privacy Policy</Text>.
              I understand there is zero tolerance for abusive content or users.
            </Text>
          </TouchableOpacity>

          <Animated.View style={{ transform: [{ scale: buttonScale }], marginTop: 16 }}>
            <TouchableOpacity
              testID="continue-button"
              onPress={handleContinue}
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
                    Enter the islands
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Link href="/login" asChild>
            <TouchableOpacity testID="go-to-login" style={styles.loginLinkWrap} activeOpacity={0.8}>
              <Text style={styles.loginLinkText}>
                Already have an account? <Text style={styles.loginLinkBold}>Log in</Text>
              </Text>
            </TouchableOpacity>
          </Link>

          <Text style={styles.disclaimer}>
            By continuing you confirm you are 13+. Be kind. Island group chats are public.
          </Text>
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
            <Text style={styles.sheetTitle}>Where are you from?</Text>
            <TouchableOpacity onPress={() => setIslandPickerOpen(false)} style={styles.closeBtn}>
              <X size={16} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchBar}>
            <Search size={16} color={Colors.textSecondary} />
            <TextInput
              testID="island-search"
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
            style={{ maxHeight: 480 }}
            renderItem={({ item }) => {
              const active = item.id === islandId;
              return (
                <TouchableOpacity
                  testID={`pick-${item.id}`}
                  style={[styles.islandRow, active && styles.islandRowActive]}
                  onPress={() => onPickIsland(item.id)}
                  activeOpacity={0.85}
                >
                  <FlagBadge code={item.flagCode} fallback={item.flag} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.islandRowName}>
                      {item.name}
                      {item.subtitle ? (
                        <Text style={styles.islandRowSub}>  · {item.subtitle}</Text>
                      ) : null}
                    </Text>
                    <Text style={styles.islandRowRegion}>{item.region}</Text>
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
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(59,130,246,0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 16,
  },
  badgeText: { color: Colors.accentLight, fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.5, flexShrink: 1 },
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
  previewWrap: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  previewAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  previewEmoji: { fontSize: 52 },
  previewFlag: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.bg,
    overflow: 'hidden',
  },
  previewName: { color: Colors.text, fontSize: 16, fontWeight: '600' as const, marginTop: 12 },
  previewIsland: { color: Colors.accentLight, fontSize: 13, fontWeight: '500' as const, marginTop: 2 },
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
  inputCardSuccess: { borderColor: '#10B981' },
  inputCardError: { borderColor: '#EF4444' },
  inlineBadge: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 17,
    fontWeight: '500' as const,
    padding: 0,
  },
  statusLine: { marginTop: 8, marginLeft: 4, minHeight: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: {
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  hint: { color: Colors.textTertiary, fontSize: 12 },
  available: { color: '#10B981', fontSize: 12, fontWeight: '600' as const },
  taken: { color: '#EF4444', fontSize: 12, fontWeight: '600' as const },
  error: { color: '#F87171', fontSize: 13, marginTop: 8, marginLeft: 4, fontWeight: '500' as const },
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 22,
    marginBottom: 10,
  },
  islandPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgElevated,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  islandPickerIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(59,130,246,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  islandPickerName: { color: Colors.text, fontSize: 15, fontWeight: '700' as const },
  islandPickerSub: { color: Colors.accentLight, fontSize: 12, fontWeight: '600' as const },
  islandPickerRegion: { color: Colors.textTertiary, fontSize: 12, marginTop: 2 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  emojiCell: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiCellSelected: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  emojiBig: { fontSize: 30, fontFamily: EMOJI_FONT_FAMILY, lineHeight: 38 },
  cta: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: Colors.white, fontSize: 17, fontWeight: '700' as const, letterSpacing: 0.2 },
  loginLinkWrap: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  loginLinkText: { color: Colors.textSecondary, fontSize: 14 },
  loginLinkBold: { color: Colors.accentLight, fontWeight: '700' as const },
  disclaimer: {
    color: Colors.textTertiary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 16, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: Colors.border,
    maxHeight: '85%',
  },
  sheetHandle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, marginBottom: 12,
  },
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
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    marginBottom: 8,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15, padding: 0 },
  islandRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 10, borderRadius: 14,
    marginBottom: 2,
  },
  islandRowActive: { backgroundColor: 'rgba(59,130,246,0.12)' },
  islandRowName: { color: Colors.text, fontSize: 15, fontWeight: '700' as const },
  islandRowSub: { color: Colors.accentLight, fontSize: 12, fontWeight: '600' as const },
  islandRowRegion: { color: Colors.textTertiary, fontSize: 12, marginTop: 2 },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 20,
    paddingHorizontal: 4,
  },
  termsCheckbox: {
    width: 20, height: 20, borderRadius: 6,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
    backgroundColor: Colors.bgElevated,
  },
  termsCheckboxOn: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  termsText: {
    flex: 1, color: Colors.textSecondary, fontSize: 12, lineHeight: 18,
  },
  termsLink: { color: Colors.accentLight, fontWeight: '700' as const },
});
