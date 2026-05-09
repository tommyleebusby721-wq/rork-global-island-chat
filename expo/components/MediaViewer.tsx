import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  Image,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  PanResponder,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { X, Play, Pause } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import Colors from '@/constants/colors';
import { getSignedMediaUrl } from '@/lib/mediaStorage';

export interface MediaViewerItem {
  id: string;
  kind: 'image' | 'video';
  path: string;
  caption?: string;
  username: string;
  avatarEmoji: string;
  createdAt: number;
}

interface Props {
  visible: boolean;
  items: MediaViewerItem[];
  startId: string | null;
  onClose: () => void;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function formatHeader(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today, ${time}`;
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + `, ${time}`;
}

function ZoomableImage({ uri }: { uri: string }) {
  return (
    <ScrollView
      style={styles.zoomScroll}
      contentContainerStyle={styles.zoomContent}
      maximumZoomScale={3}
      minimumZoomScale={1}
      pinchGestureEnabled
      bouncesZoom
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      centerContent
    >
      <Image source={{ uri }} style={styles.media} resizeMode="contain" />
    </ScrollView>
  );
}

function ImagePage({ path }: { path: string }) {
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setUri(null);
    getSignedMediaUrl(path)
      .then(u => { if (!cancelled) setUri(u); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [path]);

  if (failed) {
    return (
      <View style={styles.center}>
        <Text style={styles.unavailable}>Image unavailable</Text>
      </View>
    );
  }
  if (!uri) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.white} />
      </View>
    );
  }
  return <ZoomableImage uri={uri} />;
}

function VideoPage({ path, isActive }: { path: string; isActive: boolean }) {
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const videoRef = useRef<Video | null>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setUri(null);
    getSignedMediaUrl(path)
      .then(u => { if (!cancelled) setUri(u); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [path]);

  useEffect(() => {
    if (!isActive) {
      videoRef.current?.pauseAsync().catch(() => {});
      setIsPlaying(false);
    }
  }, [isActive]);

  const onStatus = useCallback((s: AVPlaybackStatus) => {
    if (!s.isLoaded) return;
    setIsPlaying(s.isPlaying);
    if (s.didJustFinish) {
      videoRef.current?.setPositionAsync(0).catch(() => {});
    }
  }, []);

  const togglePlay = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
      if (Platform.OS !== 'web') void Haptics.selectionAsync();
    } catch (e) {
      console.log('[viewer] toggle play error', e);
    }
  }, [isPlaying]);

  const flashControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 2200);
  }, []);

  useEffect(() => {
    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, []);

  if (failed) {
    return (
      <View style={styles.center}>
        <Text style={styles.unavailable}>Video unavailable</Text>
      </View>
    );
  }
  if (!uri) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.white} />
      </View>
    );
  }

  return (
    <TouchableOpacity activeOpacity={1} style={styles.videoWrap} onPress={flashControls}>
      <Video
        ref={(r) => { videoRef.current = r; }}
        source={{ uri }}
        style={styles.media}
        resizeMode={ResizeMode.CONTAIN}
        onPlaybackStatusUpdate={onStatus}
        useNativeControls={false}
        isLooping={false}
      />
      {(showControls || !isPlaying) && (
        <TouchableOpacity activeOpacity={0.85} onPress={togglePlay} style={styles.playOverlay}>
          <View style={styles.playBtn}>
            {isPlaying
              ? <Pause size={32} color={Colors.white} fill={Colors.white} />
              : <Play size={32} color={Colors.white} fill={Colors.white} />}
          </View>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export default function MediaViewer({ visible, items, startId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<MediaViewerItem>>(null);
  const [index, setIndex] = useState<number>(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  const startIndex = useMemo(() => {
    if (!startId) return 0;
    const i = items.findIndex(it => it.id === startId);
    return i >= 0 ? i : 0;
  }, [items, startId]);

  useEffect(() => {
    if (visible) {
      setIndex(startIndex);
      dragY.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 80, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
      const t = setTimeout(() => {
        listRef.current?.scrollToOffset({ offset: startIndex * SCREEN_W, animated: false });
      }, 30);
      return () => clearTimeout(t);
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.92);
    }
  }, [visible, startIndex, fadeAnim, scaleAnim, dragY]);

  const handleClose = useCallback(() => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: USE_NATIVE_DRIVER }).start(() => {
      onClose();
    });
  }, [fadeAnim, onClose]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.6,
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) dragY.setValue(g.dy);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 120 || g.vy > 1.2) {
        Animated.timing(dragY, { toValue: SCREEN_H, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }).start(() => {
          dragY.setValue(0);
          handleClose();
        });
      } else {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: USE_NATIVE_DRIVER, friction: 7 }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(dragY, { toValue: 0, useNativeDriver: USE_NATIVE_DRIVER, friction: 7 }).start();
    },
  }), [dragY, handleClose]);

  const onMomentumEnd = useCallback((e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (i !== index) {
      setIndex(i);
      if (Platform.OS !== 'web') void Haptics.selectionAsync();
    }
  }, [index]);

  const renderItem = useCallback(({ item, index: i }: { item: MediaViewerItem; index: number }) => {
    return (
      <View style={styles.page}>
        {item.kind === 'video'
          ? <VideoPage path={item.path} isActive={i === index} />
          : <ImagePage path={item.path} />}
      </View>
    );
  }, [index]);

  const current = items[index];

  const backdropOpacity = dragY.interpolate({
    inputRange: [0, 250],
    outputRange: [1, 0.2],
    extrapolate: 'clamp',
  });

  if (!visible || items.length === 0) {
    return (
      <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
        <View style={{ flex: 1, backgroundColor: 'black' }} />
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'black', opacity: Animated.multiply(fadeAnim, backdropOpacity) }]} />
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { transform: [{ translateY: dragY }, { scale: scaleAnim }], opacity: fadeAnim },
        ]}
        {...panResponder.panHandlers}
      >
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
        />

        <View pointerEvents="box-none" style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <View style={styles.topInfo} pointerEvents="none">
            {current && (
              <>
                <View style={styles.headerAvatar}>
                  <Text style={styles.headerEmoji}>{current.avatarEmoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.headerName} numberOfLines={1}>@{current.username}</Text>
                  <Text style={styles.headerTime}>{formatHeader(current.createdAt)}</Text>
                </View>
              </>
            )}
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={10} testID="viewer-close">
            <X size={22} color={Colors.white} />
          </TouchableOpacity>
        </View>

        {current?.caption ? (
          <View style={[styles.captionWrap, { paddingBottom: Math.max(insets.bottom + 56, 72) }]} pointerEvents="none">
            <Text style={styles.captionText}>{current.caption}</Text>
          </View>
        ) : null}

        {items.length > 1 && (
          <View style={[styles.dotsWrap, { bottom: Math.max(insets.bottom + 16, 28) }]} pointerEvents="none">
            <View style={styles.dotsInner}>
              <Text style={styles.indexText}>{index + 1} / {items.length}</Text>
            </View>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { width: SCREEN_W, height: SCREEN_H, alignItems: 'center', justifyContent: 'center' },
  center: { width: SCREEN_W, height: SCREEN_H, alignItems: 'center', justifyContent: 'center' },
  zoomScroll: { width: SCREEN_W, height: SCREEN_H },
  zoomContent: { width: SCREEN_W, height: SCREEN_H, alignItems: 'center', justifyContent: 'center' },
  media: { width: SCREEN_W, height: SCREEN_H },
  videoWrap: { width: SCREEN_W, height: SCREEN_H, alignItems: 'center', justifyContent: 'center' },
  unavailable: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  topBar: {
    position: 'absolute', left: 0, right: 0, top: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: 12,
  },
  topInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  headerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerEmoji: { fontSize: 18 },
  headerName: { color: Colors.white, fontSize: 14, fontWeight: '700' as const },
  headerTime: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  captionWrap: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingTop: 14,
  },
  captionText: { color: Colors.white, fontSize: 15, lineHeight: 21 },
  dotsWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  dotsInner: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
  },
  indexText: { color: Colors.white, fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.4 },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  playBtn: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
});
