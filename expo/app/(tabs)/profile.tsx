import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert, Modal, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import ScreenLayout, { LAYOUT } from '@/components/ScreenLayout';
import { LogOut, ChevronRight, Languages, Check, ShieldCheck, UserX, Clock, Pencil, X, Globe2, MapPin, Search, Heart, Sparkles, Flame, TrendingUp, KeyRound, AlertTriangle, Lock, LifeBuoy, Trash2, FileText, Bell, BellOff } from 'lucide-react-native';
import { Linking } from 'react-native';
import { TERMS_URL, PRIVACY_URL } from '@/constants/moderation';
import { useUser, SUPPORTED_LANGUAGES } from '@/contexts/UserContext';
import { useChat } from '@/contexts/ChatContext';
import { Switch, FlatList, TextInput } from 'react-native';
import { AVATAR_EMOJIS, EMOJI_FONT_FAMILY } from '@/constants/avatars';
import { ISLANDS, getIsland } from '@/constants/islands';
import FlagBadge from '@/components/FlagBadge';
import Colors from '@/constants/colors';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const {
    profile, updateAvatar, updateIsland, signOut, deleteAccount,
    preferredLanguage, autoTranslate, updatePreferredLanguage, updateAutoTranslate,
    allowDmFromEveryone, updateAllowDmFromEveryone,
    blocked, unblockUser, allUsers,
    islandSubscriptions, setIslandSubscribed, setDmPushEnabled, registerForPush,
  } = useUser();
  const [deletingAccount, setDeletingAccount] = useState<boolean>(false);
  const [editOpen, setEditOpen] = useState<boolean>(false);
  const [blockedOpen, setBlockedOpen] = useState<boolean>(false);
  const [langOpen, setLangOpen] = useState<boolean>(false);
  const [islandOpen, setIslandOpen] = useState<boolean>(false);
  const [islandNotifOpen, setIslandNotifOpen] = useState<boolean>(false);
  const [islandNotifQuery, setIslandNotifQuery] = useState<string>('');
  const [islandQuery, setIslandQuery] = useState<string>('');
  const [selected, setSelected] = useState<string>(profile?.avatarEmoji ?? AVATAR_EMOJIS[0]);

  const island = useMemo(() => (profile?.islandId ? getIsland(profile.islandId) : undefined), [profile?.islandId]);
  const { userStats } = useChat();
  const stats = useMemo(() => (profile ? userStats(profile.id) : undefined), [profile, userStats]);
  const favoriteIsland = useMemo(() => (stats?.favoriteIslandId ? getIsland(stats.favoriteIslandId) : undefined), [stats?.favoriteIslandId]);
  const lastActiveIsland = useMemo(() => (stats?.lastIslandId ? getIsland(stats.lastIslandId) : undefined), [stats?.lastIslandId]);

  const vibe = useMemo(() => {
    const sent = stats?.sent ?? 0;
    const reactions = stats?.reactionsReceived ?? 0;
    const score = sent + reactions * 2;
    if (score >= 60) return { emoji: '🔥', label: 'Very Active', tint: '#F97316', bg: 'rgba(249,115,22,0.15)' };
    if (score >= 20) return { emoji: '🟢', label: 'Active', tint: '#10B981', bg: 'rgba(16,185,129,0.15)' };
    if (score >= 5) return { emoji: '🌙', label: 'Chill', tint: '#818CF8', bg: 'rgba(129,140,248,0.15)' };
    return { emoji: '🌙', label: 'Chill', tint: '#818CF8', bg: 'rgba(129,140,248,0.15)' };
  }, [stats?.sent, stats?.reactionsReceived]);

  const filteredIslands = useMemo(() => {
    const q = islandQuery.trim().toLowerCase();
    if (!q) return ISLANDS;
    return ISLANDS.filter(i => `${i.name} ${i.subtitle ?? ''} ${i.region}`.toLowerCase().includes(q));
  }, [islandQuery]);

  const onSaveAvatar = useCallback(async () => {
    if (selected !== profile?.avatarEmoji) {
      await updateAvatar(selected);
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setEditOpen(false);
  }, [profile?.avatarEmoji, selected, updateAvatar]);

  const onDeleteAccount = useCallback(() => {
    const run = async () => {
      setDeletingAccount(true);
      const res = await deleteAccount();
      setDeletingAccount(false);
      if (!res.ok) {
        if (Platform.OS === 'web') {
          console.log('[deleteAccount] failed', res.error);
        } else {
          Alert.alert('Could not delete account', res.error ?? 'Please try again.');
        }
        return;
      }
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/welcome');
    };
    if (Platform.OS === 'web') {
      void run();
      return;
    }
    Alert.alert(
      'Delete account?',
      'This permanently deletes your profile, messages, reports and all associated data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'Your username will be released and everything tied to it will be erased.',
              [
                { text: 'Keep account', style: 'cancel' },
                { text: 'Yes, delete forever', style: 'destructive', onPress: () => { void run(); } },
              ],
            );
          },
        },
      ],
    );
  }, [deleteAccount]);

  const onSignOut = useCallback(async () => {
    const confirm = async () => {
      await signOut();
      router.replace('/onboarding');
    };
    if (Platform.OS === 'web') {
      void confirm();
    } else {
      Alert.alert(
        'Sign out?',
        'Your username and account will be kept. You can sign back in anytime.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign out', onPress: confirm },
        ],
      );
    }
  }, [signOut]);

  const blockedUsers = useMemo(
    () => blocked.map(id => allUsers.find(u => u.id === id)).filter((u): u is NonNullable<typeof u> => !!u),
    [blocked, allUsers],
  );

  const activeLang = SUPPORTED_LANGUAGES.find(l => l.code === preferredLanguage) ?? SUPPORTED_LANGUAGES[0];

  return (
    <ScreenLayout title="Profile" subtitle="Your account & preferences">
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + LAYOUT.tabBarClearance, paddingHorizontal: LAYOUT.horizontalPadding, paddingTop: 6 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.identityCard}>
          <LinearGradient
            colors={["rgba(59,130,246,0.18)", "rgba(17,26,46,0)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.bigAvatar}>
            <Text style={styles.bigEmoji}>{profile?.avatarEmoji ?? '🌊'}</Text>
            {island ? (
              <View style={styles.avatarFlag}>
                <FlagBadge code={island.flagCode} fallback={island.flag} size={38} />
              </View>
            ) : null}
          </View>
          <Text style={styles.username}>@{profile?.username ?? 'traveler'}</Text>
          {island ? (
            <View style={styles.homeIslandCard} testID="home-island-card">
              <View style={styles.homeIslandHead}>
                <MapPin size={11} color={Colors.accentLight} />
                <Text style={styles.homeIslandLabel}>HOME ISLAND · MEMBER</Text>
              </View>
              <View style={styles.homeIslandBody}>
                <FlagBadge code={island.flagCode} fallback={island.flag} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.homeIslandName} numberOfLines={1}>
                    {island.name}
                    {island.subtitle ? <Text style={styles.homeIslandSub}>  · {island.subtitle}</Text> : null}
                  </Text>
                  <Text style={styles.homeIslandRegion}>{island.region}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push(`/island/${island.id}`)}
                  style={styles.homeIslandGo}
                  testID="open-home-island"
                  hitSlop={10}
                >
                  <ChevronRight size={16} color={Colors.accentLight} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={styles.tagline}>~ Caribbean Vibes ~</Text>
          )}
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => { setSelected(profile?.avatarEmoji ?? AVATAR_EMOJIS[0]); setEditOpen(true); }}
            testID="edit-profile"
          >
            <Pencil size={14} color={Colors.white} />
            <Text style={styles.editText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard} testID="island-activity-vibe">
            <View style={[styles.statIcon, { backgroundColor: vibe.bg }]}>
              <Text style={styles.vibeEmoji}>{vibe.emoji}</Text>
            </View>
            <Text style={[styles.vibeValue, { color: vibe.tint }]} numberOfLines={1}>{vibe.label}</Text>
            <Text style={styles.statLabel}>🏝 Island Activity</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(244,114,182,0.15)' }]}>
              <Heart size={15} color="#F472B6" />
            </View>
            <Text style={styles.statValue}>{stats?.reactionsReceived ?? 0}</Text>
            <Text style={styles.statLabel}>Reactions</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(251,191,36,0.15)' }]}>
              <Sparkles size={15} color="#FBBF24" />
            </View>
            <Text style={styles.statValue}>{stats?.islandsJoined ?? 0}</Text>
            <Text style={styles.statLabel}>Islands</Text>
          </View>
        </View>

        {(favoriteIsland || lastActiveIsland) && (
          <>
            <Text style={styles.sectionLabel}>Engagement</Text>
            <View style={styles.card}>
              {favoriteIsland && (
                <TouchableOpacity style={styles.row} onPress={() => router.push(`/island/${favoriteIsland.id}`)}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconBubble, { backgroundColor: 'rgba(251,191,36,0.15)' }]}>
                      <Flame size={16} color="#FBBF24" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowHint}>Favorite island</Text>
                      <Text style={styles.rowLabel}>{favoriteIsland.name}</Text>
                    </View>
                  </View>
                  <View style={styles.rowRight}>
                    <FlagBadge code={favoriteIsland.flagCode} fallback={favoriteIsland.flag} size={26} />
                    <ChevronRight size={16} color={Colors.textTertiary} />
                  </View>
                </TouchableOpacity>
              )}
              {favoriteIsland && lastActiveIsland && favoriteIsland.id !== lastActiveIsland.id && (
                <View style={styles.rowDivider} />
              )}
              {lastActiveIsland && lastActiveIsland.id !== favoriteIsland?.id && (
                <TouchableOpacity style={styles.row} onPress={() => router.push(`/island/${lastActiveIsland.id}`)}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconBubble, { backgroundColor: 'rgba(96,165,250,0.15)' }]}>
                      <TrendingUp size={16} color={Colors.accentLight} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowHint}>Recently active</Text>
                      <Text style={styles.rowLabel}>{lastActiveIsland.name}</Text>
                    </View>
                  </View>
                  <View style={styles.rowRight}>
                    <FlagBadge code={lastActiveIsland.flagCode} fallback={lastActiveIsland.flag} size={26} />
                    <ChevronRight size={16} color={Colors.textTertiary} />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Username</Text>
            <Text style={styles.rowValue}>@{profile?.username}</Text>
          </View>
          <View style={styles.rowDivider} />
          <TouchableOpacity style={styles.row} onPress={() => setIslandOpen(true)} testID="island-row">
            <View style={styles.rowLeft}>
              <View style={styles.iconBubble}><MapPin size={16} color={Colors.accentLight} /></View>
              <Text style={styles.rowLabel}>Island</Text>
            </View>
            <View style={styles.rowRight}>
              {island ? (
                <>
                  <FlagBadge code={island.flagCode} fallback={island.flag} size={22} />
                  <Text style={styles.rowValueMuted}>{island.name}</Text>
                </>
              ) : (
                <Text style={styles.rowValueMuted}>Pick your island</Text>
              )}
              <ChevronRight size={16} color={Colors.textTertiary} />
            </View>
          </TouchableOpacity>
          <View style={styles.rowDivider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Joined</Text>
            <Text style={styles.rowValueMuted}>
              {profile ? new Date(profile.createdAt).toLocaleDateString() : ''}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Language & Translation</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => setLangOpen(true)} testID="lang-row">
            <View style={styles.rowLeft}>
              <View style={styles.iconBubble}><Globe2 size={16} color={Colors.accentLight} /></View>
              <Text style={styles.rowLabel}>Preferred language</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowValueMuted}>{activeLang.flag}  {activeLang.label}</Text>
              <ChevronRight size={16} color={Colors.textTertiary} />
            </View>
          </TouchableOpacity>
          <View style={styles.rowDivider} />
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={styles.iconBubble}><Languages size={16} color={Colors.accentLight} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Auto-translate</Text>
                <Text style={styles.rowHint}>Show foreign messages in {activeLang.label}</Text>
              </View>
            </View>
            <Switch
              value={autoTranslate}
              onValueChange={(v) => { void updateAutoTranslate(v); }}
              trackColor={{ false: Colors.bgCard, true: Colors.accent }}
              thumbColor={Colors.white}
              testID="auto-translate-switch"
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={styles.iconBubble}><Bell size={16} color={Colors.accentLight} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Direct messages</Text>
                <Text style={styles.rowHint}>Get notified when someone DMs you</Text>
              </View>
            </View>
            <Switch
              value={profile?.dmPushEnabled ?? true}
              onValueChange={(v) => {
                void (async () => {
                  if (v) {
                    const res = await registerForPush();
                    if (!res.ok && Platform.OS !== 'web') {
                      Alert.alert('Notifications off', res.error ?? 'Enable notifications in your phone settings.');
                      return;
                    }
                  }
                  await setDmPushEnabled(v);
                })();
              }}
              trackColor={{ false: Colors.bgCard, true: '#22C55E' }}
              thumbColor={Colors.white}
              testID="dm-push-switch"
            />
          </View>
          <View style={styles.rowDivider} />
          <TouchableOpacity
            style={styles.row}
            onPress={() => setIslandNotifOpen(true)}
            testID="island-notif-row"
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconBubble}>
                {islandSubscriptions.length > 0
                  ? <Bell size={16} color={Colors.accentLight} />
                  : <BellOff size={16} color={Colors.textTertiary} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Island chats</Text>
                <Text style={styles.rowHint}>
                  {islandSubscriptions.length === 0
                    ? 'No island chats subscribed'
                    : `${islandSubscriptions.length} island${islandSubscriptions.length === 1 ? '' : 's'} subscribed`}
                </Text>
              </View>
            </View>
            <ChevronRight size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Privacy Settings</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={styles.iconBubble}><ShieldCheck size={16} color={Colors.accentLight} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Messages from everyone</Text>
                <Text style={styles.rowHint}>
                  {allowDmFromEveryone ? 'Anyone can DM you' : 'Only people you\u2019ve messaged'}
                </Text>
              </View>
            </View>
            <Switch
              value={allowDmFromEveryone}
              onValueChange={(v) => { void updateAllowDmFromEveryone(v); }}
              trackColor={{ false: Colors.bgCard, true: '#22C55E' }}
              thumbColor={Colors.white}
              testID="allow-dm-switch"
            />
          </View>
          <View style={styles.rowDivider} />
          <TouchableOpacity style={styles.row} onPress={() => setBlockedOpen(true)} testID="blocked-row">
            <View style={styles.rowLeft}>
              <View style={styles.iconBubble}><UserX size={16} color={Colors.accentLight} /></View>
              <Text style={styles.rowLabel}>Blocked users</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowValueMuted}>{blockedUsers.length}</Text>
              <ChevronRight size={16} color={Colors.textTertiary} />
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Safety</Text>
        <View style={styles.infoCard}>
          <Clock size={16} color={Colors.accentLight} />
          <Text style={styles.infoText}>
            Island group chats are public and messages disappear after 24 hours. 13+ only.
          </Text>
        </View>

        {!profile?.hasRecovery && (
          <TouchableOpacity
            testID="recovery-banner"
            onPress={() => router.push('/setup-recovery')}
            activeOpacity={0.9}
            style={styles.recoveryBanner}
          >
            <View style={styles.recoveryIcon}>
              <AlertTriangle size={18} color="#FBBF24" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.recoveryTitle}>Set up account recovery</Text>
              <Text style={styles.recoverySub}>
                Without it you can’t reset a forgotten password.
              </Text>
            </View>
            <ChevronRight size={18} color="#FBBF24" />
          </TouchableOpacity>
        )}

        <Text style={styles.sectionLabel}>Security</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/setup-recovery')}
            testID="recovery-row"
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconBubble}><KeyRound size={16} color={Colors.accentLight} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Account recovery</Text>
                <Text style={styles.rowHint}>
                  {profile?.hasRecovery ? 'Security question set' : 'Not set up yet'}
                </Text>
              </View>
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.rowValueMuted, { color: profile?.hasRecovery ? '#10B981' : '#FBBF24' }]}>
                {profile?.hasRecovery ? 'On' : 'Set up'}
              </Text>
              <ChevronRight size={16} color={Colors.textTertiary} />
            </View>
          </TouchableOpacity>
          <View style={styles.rowDivider} />
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/change-password')}
            testID="change-password-row"
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconBubble}><Lock size={16} color={Colors.accentLight} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Change password</Text>
                <Text style={styles.rowHint}>Update your account password</Text>
              </View>
            </View>
            <ChevronRight size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Help</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/support')}
            testID="support-row"
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconBubble, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                <LifeBuoy size={16} color="#34D399" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Support</Text>
                <Text style={styles.rowHint}>Chat with AI · request islands · report issues</Text>
              </View>
            </View>
            <ChevronRight size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Legal</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => Linking.openURL(TERMS_URL)} testID="terms-row">
            <View style={styles.rowLeft}>
              <View style={styles.iconBubble}><FileText size={16} color={Colors.accentLight} /></View>
              <Text style={styles.rowLabel}>Terms of Use (EULA)</Text>
            </View>
            <ChevronRight size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
          <View style={styles.rowDivider} />
          <TouchableOpacity style={styles.row} onPress={() => Linking.openURL(PRIVACY_URL)} testID="privacy-row">
            <View style={styles.rowLeft}>
              <View style={styles.iconBubble}><ShieldCheck size={16} color={Colors.accentLight} /></View>
              <Text style={styles.rowLabel}>Privacy Policy</Text>
            </View>
            <ChevronRight size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logout} onPress={onSignOut} testID="sign-out">
          <LogOut size={16} color={Colors.white} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={onDeleteAccount}
          disabled={deletingAccount}
          testID="delete-account"
        >
          <Trash2 size={15} color="#F87171" />
          <Text style={styles.deleteText}>
            {deletingAccount ? 'Deleting…' : 'Delete account'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.deleteHint}>
          Permanently erases your profile, messages, and all associated data.
        </Text>
      </ScrollView>

      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setEditOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Edit profile</Text>
            <TouchableOpacity onPress={() => setEditOpen(false)} style={styles.closeBtn}>
              <X size={16} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.sheetSub}>Choose your avatar</Text>
          <View style={styles.grid}>
            {AVATAR_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[styles.cell, selected === emoji && styles.cellSelected]}
                onPress={() => {
                  setSelected(emoji);
                  if (Platform.OS !== 'web') void Haptics.selectionAsync();
                }}
              >
                <Text style={styles.cellEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={onSaveAvatar} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Save changes</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={langOpen} transparent animationType="slide" onRequestClose={() => setLangOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLangOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Preferred language</Text>
            <TouchableOpacity onPress={() => setLangOpen(false)} style={styles.closeBtn}>
              <X size={16} color={Colors.text} />
            </TouchableOpacity>
          </View>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const active = preferredLanguage === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={styles.langRow}
                onPress={() => {
                  void updatePreferredLanguage(lang.code);
                  if (Platform.OS !== 'web') void Haptics.selectionAsync();
                  setLangOpen(false);
                }}
                testID={`lang-${lang.code}`}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <Text style={styles.langLabel}>{lang.label}</Text>
                {active && <Check size={18} color={Colors.accentLight} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </Modal>

      <Modal visible={islandOpen} transparent animationType="slide" onRequestClose={() => setIslandOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIslandOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12, maxHeight: '85%' }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Your island</Text>
            <TouchableOpacity onPress={() => setIslandOpen(false)} style={styles.closeBtn}>
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
              const active = item.id === profile?.islandId;
              return (
                <TouchableOpacity
                  testID={`profile-pick-${item.id}`}
                  style={[styles.langRow, active && { backgroundColor: 'rgba(59,130,246,0.12)' }]}
                  onPress={() => {
                    void updateIsland(item.id);
                    if (Platform.OS !== 'web') void Haptics.selectionAsync();
                    setIslandOpen(false);
                  }}
                >
                  <FlagBadge code={item.flagCode} fallback={item.flag} size={28} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>
                      {item.name}
                      {item.subtitle ? <Text style={{ color: Colors.accentLight, fontSize: 12 }}>  · {item.subtitle}</Text> : null}
                    </Text>
                    <Text style={{ color: Colors.textTertiary, fontSize: 12, marginTop: 2 }}>{item.region}</Text>
                  </View>
                  {active && <Check size={18} color={Colors.accentLight} />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>

      <Modal visible={islandNotifOpen} transparent animationType="slide" onRequestClose={() => setIslandNotifOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIslandNotifOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12, maxHeight: '85%' }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Island notifications</Text>
            <TouchableOpacity onPress={() => setIslandNotifOpen(false)} style={styles.closeBtn}>
              <X size={16} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.sheetSub}>Get a push for every new message in islands you turn on.</Text>
          <View style={styles.searchBar}>
            <Search size={16} color={Colors.textSecondary} />
            <TextInput
              value={islandNotifQuery}
              onChangeText={setIslandNotifQuery}
              placeholder="Search islands…"
              placeholderTextColor={Colors.textTertiary}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {islandNotifQuery.length > 0 && (
              <TouchableOpacity onPress={() => setIslandNotifQuery('')}>
                <X size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={ISLANDS.filter(i => {
              const q = islandNotifQuery.trim().toLowerCase();
              if (!q) return true;
              return `${i.name} ${i.subtitle ?? ''} ${i.region}`.toLowerCase().includes(q);
            })}
            keyExtractor={(i) => i.id}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 460 }}
            renderItem={({ item }) => {
              const subscribed = islandSubscriptions.includes(item.id);
              return (
                <View style={styles.langRow}>
                  <FlagBadge code={item.flagCode} fallback={item.flag} size={26} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{item.name}</Text>
                    <Text style={{ color: Colors.textTertiary, fontSize: 12, marginTop: 2 }}>{item.region}</Text>
                  </View>
                  <Switch
                    value={subscribed}
                    onValueChange={(v) => {
                      void (async () => {
                        if (v) {
                          const res = await registerForPush();
                          if (!res.ok && Platform.OS !== 'web') {
                            Alert.alert('Notifications off', res.error ?? 'Enable notifications in your phone settings.');
                            return;
                          }
                        }
                        await setIslandSubscribed(item.id, v);
                        if (Platform.OS !== 'web') void Haptics.selectionAsync();
                      })();
                    }}
                    trackColor={{ false: Colors.bgCard, true: '#22C55E' }}
                    thumbColor={Colors.white}
                    testID={`island-notif-${item.id}`}
                  />
                </View>
              );
            }}
          />
        </View>
      </Modal>

      <Modal visible={blockedOpen} transparent animationType="slide" onRequestClose={() => setBlockedOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setBlockedOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20, minHeight: 260 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Blocked users</Text>
            <TouchableOpacity onPress={() => setBlockedOpen(false)} style={styles.closeBtn}>
              <X size={16} color={Colors.text} />
            </TouchableOpacity>
          </View>
          {blockedUsers.length === 0 ? (
            <Text style={styles.emptyText}>You haven&apos;t blocked anyone.</Text>
          ) : (
            blockedUsers.map(u => (
              <View key={u.id} style={styles.blockedRow}>
                <View style={styles.smallAvatar}>
                  <Text style={{ fontSize: 22 }}>{u.avatarEmoji}</Text>
                </View>
                <Text style={styles.rowLabel}>@{u.username}</Text>
                <TouchableOpacity style={styles.unblockBtn} onPress={() => unblockUser(u.id)}>
                  <Text style={styles.unblockText}>Unblock</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  identityCard: {
    alignItems: 'center',
    backgroundColor: Colors.bgElevated,
    borderRadius: 28, borderWidth: 1, borderColor: Colors.border,
    padding: 26, marginBottom: 28, overflow: 'hidden',
  },
  bigAvatar: {
    width: 108, height: 108, borderRadius: 54,
    backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(96,165,250,0.4)',
  },
  bigEmoji: { fontSize: 60, fontFamily: EMOJI_FONT_FAMILY, lineHeight: 72 },
  avatarFlag: {
    position: 'absolute', right: -4, bottom: -4,
    borderRadius: 22, borderWidth: 2, borderColor: Colors.bgElevated, overflow: 'hidden',
  },
  islandPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(59,130,246,0.14)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    marginTop: 8,
  },
  islandPillText: { color: Colors.accentLight, fontSize: 12, fontWeight: '600' as const },
  homeIslandCard: {
    alignSelf: 'stretch',
    marginTop: 14,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.35)',
    borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12,
    gap: 8,
  },
  homeIslandHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  homeIslandLabel: {
    color: Colors.accentLight, fontSize: 10,
    fontWeight: '800' as const, letterSpacing: 1.4,
  },
  homeIslandBody: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  homeIslandName: { color: Colors.text, fontSize: 15, fontWeight: '800' as const, letterSpacing: -0.2 },
  homeIslandSub: { color: Colors.accentLight, fontSize: 12, fontWeight: '600' as const },
  homeIslandRegion: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  homeIslandGo: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(59,130,246,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  username: { color: Colors.text, fontSize: 26, fontWeight: '800' as const, marginTop: 14, letterSpacing: -0.5 },
  tagline: { color: Colors.textSecondary, fontSize: 13, marginTop: 4, opacity: 0.85 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.accent, borderRadius: 999,
    paddingHorizontal: 20, paddingVertical: 11, marginTop: 16,
    shadowColor: Colors.accent, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
  },
  editText: { color: Colors.white, fontWeight: '700' as const, fontSize: 14 },
  sectionLabel: {
    color: Colors.textSecondary, fontSize: 11, fontWeight: '700' as const,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10, marginTop: 6, marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.bgElevated,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.border,
    marginBottom: 22,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginLeft: 16 },
  rowLabel: { color: Colors.text, fontSize: 15, fontWeight: '600' as const },
  rowValue: { color: Colors.text, fontSize: 14, fontWeight: '500' as const },
  rowValueMuted: { color: Colors.textSecondary, fontSize: 14 },
  rowHint: { color: Colors.textTertiary, fontSize: 12, marginTop: 2 },
  iconBubble: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.bgElevated, borderRadius: 16,
    padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border,
  },
  infoText: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  logout: {
    marginTop: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#DC2626', borderRadius: 16, paddingVertical: 16,
    shadowColor: '#EF4444', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  logoutText: { color: Colors.white, fontWeight: '700' as const, fontSize: 15 },

  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  statCard: {
    flex: 1, backgroundColor: Colors.bgElevated,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 18, padding: 14, alignItems: 'flex-start', gap: 6,
  },
  statIcon: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  statValue: { color: Colors.text, fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.5 },
  statLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' as const },
  vibeEmoji: { fontSize: 16, lineHeight: 20, fontFamily: EMOJI_FONT_FAMILY },
  vibeValue: { fontSize: 15, fontWeight: '800' as const, letterSpacing: -0.3 },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 16, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 4 },
  sheetTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' as const },
  sheetSub: { color: Colors.textSecondary, fontSize: 13, marginBottom: 12, marginLeft: 4 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  cell: {
    width: 58, height: 58, borderRadius: 18,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cellSelected: { borderColor: Colors.accent, backgroundColor: 'rgba(59,130,246,0.15)' },
  cellEmoji: { fontSize: 28 },
  primaryBtn: {
    backgroundColor: Colors.accent, borderRadius: 16,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  primaryBtnText: { color: Colors.white, fontWeight: '700' as const, fontSize: 15 },
  langRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 10, borderRadius: 12,
  },
  langFlag: { fontSize: 22 },
  langLabel: { flex: 1, color: Colors.text, fontSize: 15, fontWeight: '600' as const },
  blockedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 6,
  },
  smallAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  unblockBtn: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(59,130,246,0.15)',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
  },
  unblockText: { color: Colors.accentLight, fontWeight: '700' as const, fontSize: 12 },
  emptyText: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 30, marginBottom: 20 },
  recoveryBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderColor: 'rgba(251,191,36,0.35)', borderWidth: 1,
    borderRadius: 18, paddingHorizontal: 14, paddingVertical: 14,
    marginBottom: 16,
  },
  recoveryIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(251,191,36,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  recoveryTitle: { color: '#FBBF24', fontSize: 14, fontWeight: '800' as const },
  recoverySub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2, lineHeight: 16 },
  deleteBtn: {
    marginTop: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderColor: 'rgba(248,113,113,0.35)', borderWidth: 1,
    borderRadius: 14, paddingVertical: 14,
  },
  deleteText: { color: '#F87171', fontWeight: '700' as const, fontSize: 14 },
  deleteHint: {
    color: Colors.textTertiary, fontSize: 11, textAlign: 'center',
    marginTop: 8, paddingHorizontal: 16, lineHeight: 16,
  },
});
