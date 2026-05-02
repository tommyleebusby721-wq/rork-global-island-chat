import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Platform,
  Animated,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, ChevronRight, X, Flame, Sparkles, Compass, Moon } from 'lucide-react-native';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import * as Haptics from 'expo-haptics';
import { ISLANDS, Island } from '@/constants/islands';
import { useChat } from '@/contexts/ChatContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useUser } from '@/contexts/UserContext';
import Colors from '@/constants/colors';
import FlagBadge from '@/components/FlagBadge';
import ScreenLayout, { LAYOUT } from '@/components/ScreenLayout';

type Row =
  | { type: 'hero' }
  | { type: 'discovery' }
  | { type: 'jump'; island: Island }
  | { type: 'header'; title: string; count: number }
  | { type: 'item'; island: Island };

function AnimatedCard({ onPress, children, testID }: { onPress: () => void; children: React.ReactNode; testID?: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: USE_NATIVE_DRIVER, friction: 8 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: USE_NATIVE_DRIVER, friction: 6 }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        testID={testID}
        activeOpacity={0.9}
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={onPress}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function IslandsScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState<string>('');
  const { islandStats, lastMessageByRoom, userStats } = useChat();
  const { islandUnread } = useNotifications();
  const { profile } = useUser();

  const me = profile ? userStats(profile.id) : undefined;

  const filtered = useMemo<Island[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ISLANDS;
    return ISLANDS.filter(i => `${i.name} ${i.subtitle ?? ''} ${i.region}`.toLowerCase().includes(q));
  }, [query]);

  const trending = useMemo(() => {
    return [...ISLANDS]
      .map(i => ({ i, s: islandStats[i.id] }))
      .sort((a, b) => (b.s?.messagesToday ?? 0) - (a.s?.messagesToday ?? 0))
      .slice(0, 6)
      .map(x => x.i);
  }, [islandStats]);

  const newIslands = useMemo(() => {
    return [...ISLANDS]
      .filter(i => (islandStats[i.id]?.messagesToday ?? 0) === 0)
      .slice(0, 6);
  }, [islandStats]);

  const recommended = useMemo(() => {
    const home = profile?.islandId;
    const homeIsland = ISLANDS.find(i => i.id === home);
    return [...ISLANDS]
      .filter(i => i.id !== home)
      .sort((a, b) => {
        const regionBoost = (x: Island) => (homeIsland && x.region === homeIsland.region ? 1 : 0);
        const sa = (islandStats[a.id]?.messagesToday ?? 0) + regionBoost(a) * 5;
        const sb = (islandStats[b.id]?.messagesToday ?? 0) + regionBoost(b) * 5;
        return sb - sa;
      })
      .slice(0, 6);
  }, [islandStats, profile?.islandId]);

  const jumpBack = useMemo(() => {
    if (!me?.lastIslandId) return undefined;
    return ISLANDS.find(i => i.id === me.lastIslandId);
  }, [me?.lastIslandId]);

  const rows = useMemo<Row[]>(() => {
    const q = query.trim();
    const list: Row[] = [];
    if (!q) {
      list.push({ type: 'hero' });
      if (jumpBack) list.push({ type: 'jump', island: jumpBack });
      list.push({ type: 'discovery' });
    }
    const byRegion = new Map<string, Island[]>();
    for (const i of filtered) {
      const arr = byRegion.get(i.region) ?? [];
      arr.push(i);
      byRegion.set(i.region, arr);
    }
    for (const [title, items] of byRegion.entries()) {
      list.push({ type: 'header', title, count: items.length });
      for (const island of items) list.push({ type: 'item', island });
    }
    return list;
  }, [filtered, jumpBack, query]);

  const openIsland = useCallback((id: string) => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    router.push(`/island/${id}`);
  }, []);

  const renderIslandCard = (island: Island) => {
    const stats = islandStats[island.id];
    const last = lastMessageByRoom(island.id);
    const unread = islandUnread[island.id] ?? 0;
    const status = stats?.status ?? 'quiet';
    const preview = last?.text
      ? `@${last.username}: ${last.text}`
      : last?.kind === 'image'
        ? `@${last.username}: 📷 photo`
        : last?.kind === 'voice'
          ? `@${last.username}: 🎤 voice note`
          : 'No messages yet · be the first';
    return (
      <AnimatedCard
        key={`i-${island.id}`}
        testID={`island-${island.id}`}
        onPress={() => openIsland(island.id)}
      >
        <View style={[styles.card, status === 'live' && styles.cardLive]}>
          {status === 'live' && <View style={styles.glow} />}
          <View style={styles.cardRow}>
            <View>
              <FlagBadge code={island.flagCode} fallback={island.flag} size={54} />
              {status === 'live' && (
                <View style={styles.liveDot}>
                  <View style={styles.liveDotInner} />
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.islandName} numberOfLines={1}>
                  {island.name}
                  {island.subtitle ? <Text style={styles.subtitleInline}>  · {island.subtitle}</Text> : null}
                </Text>
                {unread > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{unread > 99 ? '99+' : unread}</Text>
                  </View>
                ) : (
                  <ChevronRight size={16} color={Colors.textTertiary} />
                )}
              </View>
              <Text numberOfLines={1} style={styles.preview}>{preview}</Text>
              <View style={styles.chipsRow}>
                {status === 'live' && (
                  <View style={[styles.chip, styles.chipLive]}>
                    <View style={styles.chipPulse} />
                    <Text style={styles.chipLiveText}>LIVE · {stats?.liveNow}</Text>
                  </View>
                )}
                {status === 'trending' && (
                  <View style={[styles.chip, styles.chipTrend]}>
                    <Flame size={10} color="#F59E0B" />
                    <Text style={styles.chipTrendText}>Trending</Text>
                  </View>
                )}
                {status === 'quiet' && (
                  <View style={[styles.chip, styles.chipQuiet]}>
                    <Moon size={10} color={Colors.textTertiary} />
                    <Text style={styles.chipQuietText}>Quiet</Text>
                  </View>
                )}
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{stats?.activeMembers ?? 0} online</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>+{stats?.messagesToday ?? 0} today</Text>
              </View>
            </View>
          </View>
        </View>
      </AnimatedCard>
    );
  };

  const renderDiscoveryStrip = (title: string, items: Island[], icon: React.ReactNode, accent: string) => (
    <View style={{ marginBottom: 18 }}>
      <View style={styles.stripHeader}>
        <View style={[styles.stripIcon, { backgroundColor: `${accent}1f`, borderColor: `${accent}44` }]}>
          {icon}
        </View>
        <Text style={styles.stripTitle}>{title}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
      >
        {items.map(i => {
          const s = islandStats[i.id];
          return (
            <TouchableOpacity
              key={`${title}-${i.id}`}
              activeOpacity={0.85}
              onPress={() => openIsland(i.id)}
              style={styles.miniCard}
            >
              <FlagBadge code={i.flagCode} fallback={i.flag} size={46} />
              <Text numberOfLines={1} style={styles.miniName}>{i.name}</Text>
              <Text style={styles.miniMeta}>
                {s?.liveNow ? `🟢 ${s.liveNow}` : s?.messagesToday ? `+${s.messagesToday}` : '😴 quiet'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <ScreenLayout
      eyebrow="EXPLORE"
      title="Caribbean Islands"
      subtitle="Where the diaspora connects"
    >
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Search size={16} color={Colors.textSecondary} />
          <TextInput
            testID="island-search"
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search islands…"
            placeholderTextColor={Colors.textTertiary}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} testID="clear-search">
              <X size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item, i) =>
          item.type === 'header'
            ? `h-${item.title}`
            : item.type === 'item'
              ? `i-${item.island.id}-${i}`
              : item.type === 'jump'
                ? `jump-${item.island.id}`
                : `${item.type}-${i}`
        }
        renderItem={({ item }) => {
          if (item.type === 'hero') {
            return null;
          }
          if (item.type === 'jump') {
            const island = item.island;
            return (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => openIsland(island.id)}
                style={styles.jumpBack}
              >
                <FlagBadge code={island.flagCode} fallback={island.flag} size={42} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.jumpLabel}>JUMP BACK IN</Text>
                  <Text style={styles.jumpName}>{island.name}</Text>
                </View>
                <ChevronRight size={18} color={Colors.accentLight} />
              </TouchableOpacity>
            );
          }
          if (item.type === 'discovery') {
            return (
              <View style={{ marginTop: 6, marginBottom: 8 }}>
                {renderDiscoveryStrip('Trending now', trending, <Flame size={13} color="#F59E0B" />, '#F59E0B')}
                {renderDiscoveryStrip('Recommended for you', recommended, <Compass size={13} color={Colors.accentLight} />, Colors.accentLight)}
                {newIslands.length > 0 && renderDiscoveryStrip('Quiet islands · start something', newIslands, <Sparkles size={13} color="#A78BFA" />, '#A78BFA')}
                <Text style={[styles.sectionTitle, { marginHorizontal: 16, marginTop: 4 }]}>All islands</Text>
              </View>
            );
          }
          if (item.type === 'header') {
            return (
              <View style={styles.sectionHead}>
                <Text style={styles.sectionHeader}>{item.title}</Text>
                <Text style={styles.sectionCount}>{item.count}</Text>
              </View>
            );
          }
          return <View style={{ paddingHorizontal: 16 }}>{renderIslandCard(item.island)}</View>;
        }}
        contentContainerStyle={{ paddingBottom: insets.bottom + LAYOUT.tabBarClearance, paddingTop: 4 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No results</Text>
            <Text style={styles.emptySub}>Try a different name</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 8 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15, padding: 0 },

  jumpBack: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.35)',
    borderRadius: 20, padding: 12,
  },
  jumpLabel: { color: Colors.accentLight, fontSize: 10, fontWeight: '800' as const, letterSpacing: 1.4 },
  jumpName: { color: Colors.text, fontSize: 16, fontWeight: '700' as const, marginTop: 2 },

  stripHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, marginBottom: 10, marginTop: 4,
  },
  stripIcon: {
    width: 26, height: 26, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  stripTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' as const, letterSpacing: -0.2 },

  miniCard: {
    width: 124,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 18, padding: 12,
    alignItems: 'center', gap: 8,
  },
  miniName: { color: Colors.text, fontSize: 12, fontWeight: '700' as const, maxWidth: '100%' },
  miniMeta: { color: Colors.textSecondary, fontSize: 10, fontWeight: '600' as const },

  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginTop: 14, marginBottom: 8,
  },
  sectionTitle: { color: Colors.text, fontSize: 17, fontWeight: '800' as const, letterSpacing: -0.3 },
  sectionHeader: {
    color: Colors.textSecondary, fontSize: 11, fontWeight: '700' as const,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  sectionCount: { color: Colors.textTertiary, fontSize: 11, fontWeight: '700' as const },

  card: {
    backgroundColor: Colors.bgElevated,
    borderRadius: 20, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardLive: {
    borderColor: 'rgba(74,222,128,0.45)',
    backgroundColor: 'rgba(22,163,74,0.08)',
  },
  glow: {
    position: 'absolute', top: -40, right: -40,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(74,222,128,0.15)',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  liveDot: {
    position: 'absolute', bottom: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#0B1220',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#0B1220',
  },
  liveDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E' },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  islandName: { color: Colors.text, fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.2, flex: 1 },
  subtitleInline: { color: Colors.accentLight, fontSize: 12, fontWeight: '600' as const },
  preview: { color: Colors.textSecondary, fontSize: 13, marginTop: 4 },
  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  chipLive: { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: 'rgba(74,222,128,0.4)' },
  chipLiveText: { color: '#4ADE80', fontSize: 9, fontWeight: '800' as const, letterSpacing: 0.6 },
  chipPulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  chipTrend: { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(251,191,36,0.35)' },
  chipTrendText: { color: '#F59E0B', fontSize: 10, fontWeight: '800' as const, letterSpacing: 0.3 },
  chipQuiet: { backgroundColor: Colors.bgCard, borderColor: Colors.border },
  chipQuietText: { color: Colors.textTertiary, fontSize: 10, fontWeight: '700' as const },
  metaDot: { color: Colors.textTertiary, fontSize: 11 },
  metaText: { color: Colors.textTertiary, fontSize: 11, fontWeight: '600' as const },

  unreadBadge: {
    minWidth: 22, height: 22, borderRadius: 11,
    paddingHorizontal: 7,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.accent, shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  unreadText: { color: Colors.white, fontSize: 11, fontWeight: '800' as const },

  empty: { alignItems: 'center', marginTop: 80 },
  emptyTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' as const },
  emptySub: { color: Colors.textSecondary, fontSize: 13, marginTop: 6 },
});
