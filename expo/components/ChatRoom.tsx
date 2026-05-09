import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  Pressable,
  Modal,
  Alert,
  PanResponder,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Audio, Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  Send, Plus, Image as ImageIcon, Video as VideoIcon, Mic, X, Play, Pause, Flag, UserX, Smile, Languages, Loader2, Trash2, Reply, CornerDownRight,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useUser } from '@/contexts/UserContext';
import { useChat } from '@/contexts/ChatContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { Message } from '@/types';
import Colors from '@/constants/colors';
import { formatTime } from '@/utils/time';
import { EMOJI_FONT_FAMILY } from '@/constants/avatars';
import MessageText from '@/components/MessageText';
import { translateText } from '@/utils/translate';
import { uploadImageForUser, uploadVoiceForUser, uploadVideoForUser, getSignedMediaUrl, invalidateSignedMediaUrl } from '@/lib/mediaStorage';
import MediaViewer, { MediaViewerItem } from '@/components/MediaViewer';
import { moderateText } from '@/constants/moderation';

const REACTIONS: string[] = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

const REPLY_TOKEN = '\u2023R\u2023';

interface ReplyInfo {
  username: string;
  preview: string;
}

function encodeReply(info: ReplyInfo, text: string): string {
  const preview = info.preview.replace(/\n/g, ' ').slice(0, 100);
  return `${REPLY_TOKEN}${info.username}\u2023${preview}${REPLY_TOKEN}\n${text}`;
}

function parseReply(text: string | undefined): { reply?: ReplyInfo; body: string } {
  if (!text) return { body: '' };
  if (!text.startsWith(REPLY_TOKEN)) return { body: text };
  const end = text.indexOf(REPLY_TOKEN, REPLY_TOKEN.length);
  if (end === -1) return { body: text };
  const inner = text.slice(REPLY_TOKEN.length, end);
  const sepIdx = inner.indexOf('\u2023');
  if (sepIdx === -1) return { body: text };
  const username = inner.slice(0, sepIdx);
  const preview = inner.slice(sepIdx + 1);
  const body = text.slice(end + REPLY_TOKEN.length).replace(/^\n/, '');
  return { reply: { username, preview }, body };
}

function extractMentions(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9_]+)/g) ?? [];
  return Array.from(new Set(matches.map(m => m.slice(1).toLowerCase())));
}

function previewOf(m: Message): string {
  if (m.kind === 'image') return '📷 Photo';
  if (m.kind === 'video') return '🎬 Video';
  if (m.kind === 'voice') return '🎤 Voice note';
  return parseReply(m.text).body;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function SignedImage({ path, style }: { path: string; style: any }) {
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setUri(null);
    getSignedMediaUrl(path)
      .then((u) => { if (!cancelled) setUri(u); })
      .catch((e) => {
        console.log('[SignedImage] sign error', e);
        if (!cancelled) setFailed(true);
      });
    return () => { cancelled = true; };
  }, [path]);

  if (failed) {
    return (
      <View style={[style, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.08)' }]}>
        <Text style={{ fontSize: 11, color: Colors.textSecondary }}>Image unavailable</Text>
      </View>
    );
  }
  if (!uri) {
    return <View style={[style, { backgroundColor: 'rgba(0,0,0,0.06)' }]} />;
  }
  return (
    <Image
      source={{ uri }}
      style={style}
      onError={() => {
        invalidateSignedMediaUrl(path);
        setFailed(true);
      }}
    />
  );
}

function VideoBubble({ path, duration, onPress }: { path: string; duration?: number; onPress: () => void }) {
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

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.bubbleImage}>
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', borderRadius: 16, overflow: 'hidden' }]}>
        {uri && !failed ? (
          <Video
            source={{ uri }}
            style={StyleSheet.absoluteFillObject}
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
            isMuted
            useNativeControls={false}
          />
        ) : null}
      </View>
      <View style={styles.videoOverlay}>
        <View style={styles.videoPlayCircle}>
          <Play size={22} color={Colors.white} fill={Colors.white} />
        </View>
      </View>
      {typeof duration === 'number' && duration > 0 ? (
        <View style={styles.videoDurationBadge}>
          <Text style={styles.videoDurationText}>{formatDuration(duration)}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function VoicePlayer({ uri, duration, isMine }: { uri: string; duration: number; isMine: boolean }) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const toggle = useCallback(async () => {
    try {
      if (!soundRef.current) {
        const resolvedUri = await getSignedMediaUrl(uri);
        const { sound } = await Audio.Sound.createAsync({ uri: resolvedUri });
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((s) => {
          if (!s.isLoaded) return;
          if (s.didJustFinish) {
            setIsPlaying(false);
            sound.setPositionAsync(0).catch(() => {});
          }
        });
      }
      if (isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch (e) {
      console.log('voice play error', e);
    }
  }, [isPlaying, uri]);

  return (
    <View style={styles.voiceWrap}>
      <TouchableOpacity onPress={toggle} style={[styles.voiceBtn, isMine && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
        {isPlaying
          ? <Pause size={16} color={isMine ? Colors.white : Colors.accentLight} />
          : <Play size={16} color={isMine ? Colors.white : Colors.accentLight} />}
      </TouchableOpacity>
      <View style={styles.voiceBars}>
        {Array.from({ length: 18 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.voiceBar,
              {
                height: 6 + ((i * 7) % 14),
                backgroundColor: isMine ? 'rgba(255,255,255,0.7)' : Colors.accentLight,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.voiceDuration, { color: isMine ? 'rgba(255,255,255,0.85)' : Colors.textSecondary }]}>
        {Math.round(duration)}s
      </Text>
    </View>
  );
}

interface TranslationState {
  status: 'idle' | 'loading' | 'done' | 'error';
  translated?: string;
  sourceLanguage?: string;
  isSameLanguage?: boolean;
  error?: string;
  visible?: boolean;
}

function ReplyQuote({ info, isMine }: { info: ReplyInfo; isMine: boolean }) {
  return (
    <View style={[styles.replyQuote, isMine && styles.replyQuoteMine]}>
      <View style={[styles.replyBar, isMine && { backgroundColor: 'rgba(255,255,255,0.6)' }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.replyName, isMine && { color: '#DBEAFE' }]} numberOfLines={1}>
          @{info.username}
        </Text>
        <Text style={[styles.replyPreview, isMine && { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={2}>
          {info.preview}
        </Text>
      </View>
    </View>
  );
}

function BubbleContent({
  message,
  isMine,
  translation,
  targetLanguage,
  onTranslate,
  onToggleShowOriginal,
  canTranslate,
  onOpenMedia,
}: {
  message: Message;
  isMine: boolean;
  translation?: TranslationState;
  targetLanguage: string;
  onTranslate: () => void;
  onToggleShowOriginal: () => void;
  canTranslate: boolean;
  onOpenMedia: (messageId: string) => void;
}) {
  const parsed = parseReply(message.text);
  const showTranslation = !!(translation && translation.status === 'done' && translation.visible && translation.translated);
  const displayText = showTranslation ? (translation?.translated ?? parsed.body) : parsed.body;

  const translateRow = canTranslate ? (
    <View style={styles.translateRow}>
      {translation?.status === 'loading' ? (
        <View style={styles.translateChip}>
          <Loader2 size={11} color={isMine ? '#DBEAFE' : Colors.accentLight} />
          <Text style={[styles.translateChipText, isMine && styles.translateChipTextMine]}>Translating…</Text>
        </View>
      ) : translation?.status === 'done' && translation.isSameLanguage ? (
        <View style={styles.translateChip}>
          <Languages size={11} color={isMine ? '#DBEAFE' : Colors.accentLight} />
          <Text style={[styles.translateChipText, isMine && styles.translateChipTextMine]}>
            Already in {targetLanguage}
          </Text>
        </View>
      ) : translation?.status === 'done' ? (
        <TouchableOpacity onPress={onToggleShowOriginal} style={styles.translateChip} hitSlop={6}>
          <Languages size={11} color={isMine ? '#DBEAFE' : Colors.accentLight} />
          <Text style={[styles.translateChipText, isMine && styles.translateChipTextMine]}>
            {showTranslation
              ? `Translated from ${translation.sourceLanguage ?? 'auto'} · Show original`
              : `Show ${targetLanguage} translation`}
          </Text>
        </TouchableOpacity>
      ) : translation?.status === 'error' ? (
        <TouchableOpacity onPress={onTranslate} style={styles.translateChip} hitSlop={6}>
          <Languages size={11} color="#F87171" />
          <Text style={[styles.translateChipText, { color: '#FCA5A5' }]}>Retry translate</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={onTranslate} style={styles.translateChip} hitSlop={6} testID="translate-btn">
          <Languages size={11} color={isMine ? '#DBEAFE' : Colors.accentLight} />
          <Text style={[styles.translateChipText, isMine && styles.translateChipTextMine]}>
            Translate to {targetLanguage}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  ) : null;

  if (message.kind === 'image' && message.imageUri) {
    return (
      <View>
        {parsed.reply ? <ReplyQuote info={parsed.reply} isMine={isMine} /> : null}
        <TouchableOpacity activeOpacity={0.9} onPress={() => onOpenMedia(message.id)}>
          <SignedImage path={message.imageUri} style={styles.bubbleImage} />
        </TouchableOpacity>
        {parsed.body ? (
          <View style={{ marginTop: 8 }}>
            <MessageText text={displayText} isMine={isMine} />
            {translateRow}
          </View>
        ) : null}
      </View>
    );
  }
  if (message.kind === 'video' && message.videoUri) {
    return (
      <View>
        {parsed.reply ? <ReplyQuote info={parsed.reply} isMine={isMine} /> : null}
        <VideoBubble path={message.videoUri} duration={message.videoDuration} onPress={() => onOpenMedia(message.id)} />
        {parsed.body ? (
          <View style={{ marginTop: 8 }}>
            <MessageText text={displayText} isMine={isMine} />
            {translateRow}
          </View>
        ) : null}
      </View>
    );
  }
  if (message.kind === 'voice' && message.voiceUri) {
    return <VoicePlayer uri={message.voiceUri} duration={message.voiceDuration ?? 0} isMine={isMine} />;
  }
  return (
    <View>
      {parsed.reply ? <ReplyQuote info={parsed.reply} isMine={isMine} /> : null}
      <MessageText text={displayText} isMine={isMine} />
      {translateRow}
    </View>
  );
}

interface Props {
  roomId: string;
  showUsernames?: boolean;
}

interface ReactionDetailState {
  messageId: string;
  emoji: string;
  userIds: string[];
}

function SwipeRow({
  onSwipeReply,
  children,
  enabled,
}: {
  onSwipeReply: () => void;
  children: React.ReactNode;
  enabled: boolean;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const triggeredRef = useRef<boolean>(false);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => enabled && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderMove: (_, g) => {
          const dx = Math.max(0, Math.min(90, g.dx));
          translateX.setValue(dx);
          if (!triggeredRef.current && dx > 60) {
            triggeredRef.current = true;
            if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        },
        onPanResponderRelease: (_, g) => {
          if (g.dx > 60) onSwipeReply();
          Animated.spring(translateX, { toValue: 0, useNativeDriver: USE_NATIVE_DRIVER, friction: 7 }).start();
          triggeredRef.current = false;
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: USE_NATIVE_DRIVER, friction: 7 }).start();
          triggeredRef.current = false;
        },
      }),
    [enabled, onSwipeReply, translateX],
  );

  const iconOpacity = translateX.interpolate({
    inputRange: [0, 40, 80],
    outputRange: [0, 0.4, 1],
    extrapolate: 'clamp',
  });

  return (
    <View {...responder.panHandlers}>
      <Animated.View pointerEvents="none" style={[styles.swipeIcon, { opacity: iconOpacity }]}>
        <Reply size={16} color={Colors.accentLight} />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX }] }}>{children}</Animated.View>
    </View>
  );
}

export default function ChatRoom({ roomId, showUsernames = true }: Props) {
  const insets = useSafeAreaInsets();
  const { profile, allUsers, blocked, blockUser, preferredLanguage, autoTranslate, submitReport } = useUser();
  const { messagesByRoom, sendMessage, toggleReaction, deleteMessage, now } = useChat();
  const { markRoomSeen } = useNotifications();

  useEffect(() => {
    markRoomSeen(roomId);
    return () => { markRoomSeen(roomId); };
  }, [markRoomSeen, roomId]);

  const [text, setText] = useState<string>('');
  const [pendingMedia, setPendingMedia] = useState<{ uri: string; kind: 'image' | 'video'; duration?: number }[]>([]);
  const [viewerStartId, setViewerStartId] = useState<string | null>(null);
  const [plusOpen, setPlusOpen] = useState<boolean>(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordStart, setRecordStart] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string>('');
  const [reactionTarget, setReactionTarget] = useState<Message | null>(null);
  const [actionTarget, setActionTarget] = useState<Message | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [expandedTimeIds, setExpandedTimeIds] = useState<Record<string, boolean>>({});
  const [reactionDetail, setReactionDetail] = useState<ReactionDetailState | null>(null);
  const [translations, setTranslations] = useState<Record<string, TranslationState>>({});
  const listRef = useRef<FlatList<Message>>(null);
  const sendScale = useRef(new Animated.Value(1)).current;
  const inputRef = useRef<TextInput | null>(null);
  const reactionAnimsRef = useRef<Record<string, Animated.Value>>({});

  const targetLanguage = preferredLanguage || 'English';

  const runTranslate = useCallback(async (message: Message) => {
    const mText = parseReply(message.text).body.trim();
    if (!mText) return;
    setTranslations(prev => ({
      ...prev,
      [message.id]: { ...(prev[message.id] ?? {}), status: 'loading', visible: true },
    }));
    try {
      const result = await translateText(mText, targetLanguage);
      setTranslations(prev => ({
        ...prev,
        [message.id]: {
          status: 'done',
          translated: result.translated,
          sourceLanguage: result.sourceLanguage,
          isSameLanguage: result.isSameLanguage,
          visible: !result.isSameLanguage,
        },
      }));
    } catch (e) {
      console.log('translate error', e);
      setTranslations(prev => ({
        ...prev,
        [message.id]: { status: 'error', error: 'Translation failed', visible: false },
      }));
    }
  }, [targetLanguage]);

  const toggleShowTranslation = useCallback((messageId: string) => {
    setTranslations(prev => {
      const cur = prev[messageId];
      if (!cur) return prev;
      return { ...prev, [messageId]: { ...cur, visible: !cur.visible } };
    });
  }, []);

  const rawMessages = messagesByRoom(roomId);
  const messages = useMemo(
    () => rawMessages.filter(m => !blocked.includes(m.userId)),
    [rawMessages, blocked],
  );

  useEffect(() => {
    if (messages.length === 0) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [messages.length]);

  useEffect(() => {
    if (!autoTranslate) return;
    messages.forEach((m) => {
      const body = parseReply(m.text).body;
      if (!body || m.userId === profile?.id) return;
      if (translations[m.id]) return;
      void runTranslate(m);
    });
  }, [autoTranslate, messages, profile?.id, runTranslate, translations]);

  useEffect(() => {
    if (!errorBanner) return;
    const t = setTimeout(() => setErrorBanner(''), 2500);
    return () => clearTimeout(t);
  }, [errorBanner]);

  const mentionQuery = useMemo(() => {
    const match = text.match(/@([a-zA-Z0-9_]*)$/);
    return match ? match[1].toLowerCase() : null;
  }, [text]);

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    return allUsers
      .filter(u => u.id !== profile?.id)
      .filter(u => u.username.toLowerCase().startsWith(mentionQuery))
      .slice(0, 5);
  }, [allUsers, mentionQuery, profile?.id]);

  const onSelectMention = useCallback((username: string) => {
    setText(prev => prev.replace(/@([a-zA-Z0-9_]*)$/, `@${username} `));
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
  }, []);

  const canSend = (text.trim().length > 0 || pendingMedia.length > 0) && !!profile;

  const handleSend = useCallback(() => {
    if (!canSend || !profile || isUploading) return;
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.85, duration: 70, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(sendScale, { toValue: 1, duration: 120, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const modCheck = moderateText(text.trim());
    if (!modCheck.ok) {
      setErrorBanner(modCheck.reason ?? 'Message blocked');
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    let finalText = text.trim();
    if (replyTo) {
      const info: ReplyInfo = { username: replyTo.username, preview: previewOf(replyTo) };
      finalText = encodeReply(info, finalText);
    }

    const base = {
      roomId,
      userId: profile.id,
      username: profile.username,
      avatarEmoji: profile.avatarEmoji,
      mentions: extractMentions(text),
    } as const;

    if (pendingMedia.length > 0) {
      setIsUploading(true);
      const items = pendingMedia.slice();
      void (async () => {
        try {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const isLast = i === items.length - 1;
            const captionForThis = isLast && finalText ? finalText : undefined;
            try {
              if (item.kind === 'video') {
                const remoteUrl = await uploadVideoForUser(profile.id, item.uri);
                const result = sendMessage({
                  ...base,
                  kind: 'video',
                  videoUri: remoteUrl,
                  videoDuration: item.duration,
                  text: captionForThis,
                });
                if (!result.ok) setErrorBanner(result.error ?? 'Could not send');
              } else {
                const remoteUrl = await uploadImageForUser(profile.id, item.uri);
                const result = sendMessage({
                  ...base,
                  kind: 'image',
                  imageUri: remoteUrl,
                  text: captionForThis,
                });
                if (!result.ok) setErrorBanner(result.error ?? 'Could not send');
              }
              await new Promise(r => setTimeout(r, 2100));
            } catch (innerErr) {
              console.log('[upload] media error', innerErr);
              const msg = innerErr instanceof Error ? innerErr.message : 'Could not upload media';
              setErrorBanner(msg);
            }
          }
          setText('');
          setPendingMedia([]);
          setReplyTo(null);
        } finally {
          setIsUploading(false);
        }
      })();
      return;
    }

    const result = sendMessage({ ...base, kind: 'text', text: finalText });
    if (!result.ok) {
      setErrorBanner(result.error ?? 'Could not send');
      return;
    }
    setText('');
    setReplyTo(null);
  }, [canSend, isUploading, pendingImage, profile, replyTo, roomId, sendMessage, sendScale, text]);

  const pickMedia = useCallback(async (mode: 'images' | 'videos' | 'mixed') => {
    console.log('[pickMedia] tapped', mode);
    setPlusOpen(false);
    await new Promise((r) => setTimeout(r, 250));
    try {
      const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
      let status = existing.status;
      let canAskAgain = existing.canAskAgain;
      if (status !== 'granted' && status !== 'limited') {
        const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
        status = req.status;
        canAskAgain = req.canAskAgain;
      }
      if (status !== 'granted' && status !== 'limited') {
        Alert.alert(
          'Library access needed',
          canAskAgain
            ? 'Island Chat needs access to your photos and videos to send media. You can choose "Selected Photos" to share only the ones you pick.'
            : 'Library access is off. Open Settings to let Island Chat access the photos and videos you choose.',
          [{ text: 'OK' }],
        );
        return;
      }
      const mediaTypes: ImagePicker.MediaType[] =
        mode === 'videos' ? ['videos'] : mode === 'images' ? ['images'] : ['images', 'videos'];
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes,
        quality: 0.8,
        allowsEditing: false,
        allowsMultipleSelection: mode === 'mixed' || mode === 'images',
        selectionLimit: mode === 'mixed' || mode === 'images' ? 5 : 1,
        videoMaxDuration: 60,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const items = res.assets.slice(0, 5).map((a) => {
        const isVideo = a.type === 'video' || a.type === 'pairedVideo';
        const durationSec = typeof a.duration === 'number' ? Math.round(a.duration / 1000) : undefined;
        return {
          uri: a.uri,
          kind: isVideo ? ('video' as const) : ('image' as const),
          duration: isVideo ? durationSec : undefined,
        };
      });
      setPendingMedia(items);
    } catch (e) {
      console.log('pickMedia error', e);
      const msg = e instanceof Error ? e.message : 'Could not open library';
      setErrorBanner(msg);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (Platform.OS === 'web') {
      setPlusOpen(false);
      setErrorBanner('Voice notes not supported on web');
      return;
    }
    setPlusOpen(false);
    try {
      console.log('[voice] requesting permission');
      const perm = await Audio.requestPermissionsAsync();
      console.log('[voice] permission result', perm);
      if (!perm.granted) {
        setErrorBanner('Microphone access is required to record voice notes');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      console.log('[voice] creating recording');
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(rec);
      setRecordStart(Date.now());
      if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      console.log('startRecording error', e);
      const msg = e instanceof Error ? e.message : 'Could not start recording';
      setErrorBanner(msg);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recording || !profile) return;
    try {
      console.log('[voice] stopping');
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const duration = (Date.now() - recordStart) / 1000;
      console.log('[voice] stopped', { uri, duration });
      setRecording(null);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      if (!uri) {
        setErrorBanner('Recording failed');
        return;
      }
      if (duration < 0.5) {
        setErrorBanner('Hold longer to record');
        return;
      }
      setIsUploading(true);
      try {
        const remoteUrl = await uploadVoiceForUser(profile.id, uri);
        const res = sendMessage({
          roomId,
          userId: profile.id,
          username: profile.username,
          avatarEmoji: profile.avatarEmoji,
          kind: 'voice',
          voiceUri: remoteUrl,
          voiceDuration: duration,
        });
        if (!res.ok) setErrorBanner(res.error ?? 'Could not send');
      } catch (uploadErr) {
        console.log('[upload] voice error', uploadErr);
        const msg = uploadErr instanceof Error ? uploadErr.message : 'Could not upload voice note';
        setErrorBanner(msg);
      } finally {
        setIsUploading(false);
      }
    } catch (e) {
      console.log('stopRecording error', e);
      setRecording(null);
      const msg = e instanceof Error ? e.message : 'Could not stop recording';
      setErrorBanner(msg);
    }
  }, [profile, recordStart, recording, roomId, sendMessage]);

  const cancelRecording = useCallback(async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
    } catch (e) {
      console.log('cancelRecording error', e);
    }
    setRecording(null);
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    }).catch(() => {});
  }, [recording]);

  const onLongPressMessage = useCallback((m: Message) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (m.userId === profile?.id) {
      setDeleteTarget(m);
    } else {
      setReactionTarget(m);
    }
  }, [profile?.id]);

  const confirmDelete = useCallback(() => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    deleteMessage(target.id);
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [deleteMessage, deleteTarget]);

  const animateReaction = useCallback((key: string) => {
    let anim = reactionAnimsRef.current[key];
    if (!anim) {
      anim = new Animated.Value(1);
      reactionAnimsRef.current[key] = anim;
    }
    Animated.sequence([
      Animated.spring(anim, { toValue: 1.35, useNativeDriver: USE_NATIVE_DRIVER, friction: 3, tension: 220 }),
      Animated.spring(anim, { toValue: 1, useNativeDriver: USE_NATIVE_DRIVER, friction: 4 }),
    ]).start();
  }, []);

  const onReact = useCallback((emoji: string) => {
    if (!profile || !reactionTarget) return;
    toggleReaction(reactionTarget.id, emoji, profile.id);
    animateReaction(`${reactionTarget.id}:${emoji}`);
    setReactionTarget(null);
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
  }, [animateReaction, profile, reactionTarget, toggleReaction]);

  const onReport = useCallback(() => {
    const target = actionTarget;
    setActionTarget(null);
    if (!target) return;
    void (async () => {
      const snapshot = target.kind === 'text' ? (parseReply(target.text).body || '') : `[${target.kind}]`;
      const res = await submitReport({
        reportedUserId: target.userId,
        messageId: target.id,
        roomId: target.roomId,
        kind: target.roomId.startsWith('dm:') ? 'dm' : 'message',
        snapshotText: snapshot.slice(0, 500),
      });
      console.log('[report] submitted', res);
      if (Platform.OS === 'web') return;
      if (res.ok) {
        Alert.alert(
          'Reported',
          'Thanks — our team reviews reports within 24 hours and will remove content and eject users that violate our rules. We recommend blocking this user as well.',
        );
      } else {
        Alert.alert('Could not send report', res.error ?? 'Please try again.');
      }
    })();
  }, [actionTarget, submitReport]);

  const onBlock = useCallback(async () => {
    const target = actionTarget;
    setActionTarget(null);
    if (!target) return;
    await blockUser(target.userId);
    void submitReport({
      reportedUserId: target.userId,
      messageId: target.id,
      roomId: target.roomId,
      kind: 'user',
      reason: 'blocked_by_user',
      snapshotText: target.kind === 'text' ? (parseReply(target.text).body || '').slice(0, 500) : `[${target.kind}]`,
    });
    if (Platform.OS === 'web') return;
    Alert.alert('User blocked', `@${target.username}'s messages are hidden from your feed and our team has been notified.`);
  }, [actionTarget, blockUser, submitReport]);

  const onMentionTap = useCallback((username: string) => {
    const u = allUsers.find(x => x.username.toLowerCase() === username.toLowerCase());
    if (!u || u.id === profile?.id) return;
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    router.push(`/dm/${u.id}`);
  }, [allUsers, profile?.id]);

  const onAvatarTap = useCallback((userId: string) => {
    if (!userId || userId === profile?.id) return;
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    router.push(`/user/${userId}`);
  }, [profile?.id]);

  const onStartReply = useCallback((m: Message) => {
    setReplyTo(m);
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    setTimeout(() => inputRef.current?.focus(), 60);
  }, []);

  const toggleTimestamp = useCallback((id: string) => {
    setExpandedTimeIds(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const isMine = item.userId === profile?.id;
      const remaining = item.expiresAt - now;
      const fading = remaining > 0 && remaining < 30 * 60 * 1000;
      const opacity = fading ? Math.max(0.35, remaining / (30 * 60 * 1000)) : 1;

      const prev = index > 0 ? messages[index - 1] : undefined;
      const next = index < messages.length - 1 ? messages[index + 1] : undefined;
      const GROUP_WINDOW = 3 * 60 * 1000;
      const sameAsPrev = !!prev && prev.userId === item.userId && (item.createdAt - prev.createdAt) < GROUP_WINDOW;
      const sameAsNext = !!next && next.userId === item.userId && (next.createdAt - item.createdAt) < GROUP_WINDOW;
      const showAvatar = !isMine && !sameAsNext;
      const showUsername = !isMine && showUsernames && !sameAsPrev;
      const isTimeExpanded = !!expandedTimeIds[item.id];
      const showTime = isTimeExpanded || !sameAsNext;

      return (
        <SwipeRow enabled={!isMine} onSwipeReply={() => onStartReply(item)}>
          <Pressable
            onPress={() => toggleTimestamp(item.id)}
            onLongPress={() => onLongPressMessage(item)}
            delayLongPress={280}
            style={[
              styles.row,
              isMine ? styles.rowMine : styles.rowOther,
              { opacity, marginBottom: sameAsNext ? 2 : 12 },
            ]}
          >
            {!isMine && (
              showAvatar ? (
                <TouchableOpacity
                  onPress={() => onAvatarTap(item.userId)}
                  activeOpacity={0.7}
                  hitSlop={6}
                  testID={`avatar-${item.userId}`}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarEmoji}>{item.avatarEmoji}</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={styles.avatarSpacer} />
              )
            )}
            <View style={{ maxWidth: '78%' }}>
              {showUsername && (
                <TouchableOpacity onPress={() => onAvatarTap(item.userId)}>
                  <Text style={styles.username}>@{item.username}</Text>
                </TouchableOpacity>
              )}
              {isMine ? (
                <LinearGradient
                  colors={['#3B82F6', '#1D4ED8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.bubble,
                    styles.bubbleMine,
                    sameAsPrev && styles.bubbleMineGrouped,
                    sameAsNext && styles.bubbleMineGroupedBottom,
                  ]}
                >
                  <BubbleContent
                    message={item}
                    isMine
                    translation={translations[item.id]}
                    targetLanguage={targetLanguage}
                    onTranslate={() => runTranslate(item)}
                    onToggleShowOriginal={() => toggleShowTranslation(item.id)}
                    canTranslate={!!parseReply(item.text).body && item.kind !== 'voice'}
                    onOpenMedia={onOpenMedia}
                  />
                </LinearGradient>
              ) : (
                <View
                  style={[
                    styles.bubble,
                    styles.bubbleOther,
                    sameAsPrev && styles.bubbleOtherGrouped,
                    sameAsNext && styles.bubbleOtherGroupedBottom,
                  ]}
                >
                  <BubbleContent
                    message={item}
                    isMine={false}
                    translation={translations[item.id]}
                    targetLanguage={targetLanguage}
                    onTranslate={() => runTranslate(item)}
                    onToggleShowOriginal={() => toggleShowTranslation(item.id)}
                    canTranslate={!!parseReply(item.text).body && item.kind !== 'voice'}
                    onOpenMedia={onOpenMedia}
                  />
                </View>
              )}
              {item.reactions && item.reactions.length > 0 && (
                <View style={[styles.reactionsRow, { justifyContent: isMine ? 'flex-end' : 'flex-start' }]}>
                  {item.reactions.map(r => {
                    const key = `${item.id}:${r.emoji}`;
                    const anim = reactionAnimsRef.current[key] ?? new Animated.Value(1);
                    reactionAnimsRef.current[key] = anim;
                    const active = !!(profile && r.userIds.includes(profile.id));
                    return (
                      <TouchableOpacity
                        key={r.emoji}
                        onPress={() => {
                          if (!profile) return;
                          toggleReaction(item.id, r.emoji, profile.id);
                          animateReaction(key);
                          if (Platform.OS !== 'web') void Haptics.selectionAsync();
                        }}
                        onLongPress={() => setReactionDetail({ messageId: item.id, emoji: r.emoji, userIds: r.userIds })}
                        delayLongPress={260}
                        style={[styles.reactionChip, active && styles.reactionChipActive]}
                      >
                        <Animated.Text style={[styles.reactionEmoji, { transform: [{ scale: anim }] }]}>
                          {r.emoji}
                        </Animated.Text>
                        <Text style={styles.reactionCount}>{r.userIds.length}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {showTime && (
                <Text style={[styles.metaText, { textAlign: isMine ? 'right' : 'left' }]}>
                  {isTimeExpanded ? new Date(item.createdAt).toLocaleString() : formatTime(item.createdAt)}
                </Text>
              )}
            </View>
          </Pressable>
        </SwipeRow>
      );
    },
    [messages, profile, showUsernames, expandedTimeIds, translations, targetLanguage, runTranslate, toggleShowTranslation, now, onAvatarTap, onLongPressMessage, onStartReply, toggleReaction, animateReaction, toggleTimestamp, onOpenMedia],
  );

  void onMentionTap;

  const mediaItems = useMemo<MediaViewerItem[]>(() => {
    return messages
      .filter(m => (m.kind === 'image' && m.imageUri) || (m.kind === 'video' && m.videoUri))
      .map(m => ({
        id: m.id,
        kind: m.kind === 'video' ? ('video' as const) : ('image' as const),
        path: (m.kind === 'video' ? m.videoUri : m.imageUri) as string,
        caption: parseReply(m.text).body || undefined,
        username: m.username,
        avatarEmoji: m.avatarEmoji,
        createdAt: m.createdAt,
      }));
  }, [messages]);

  const onOpenMedia = useCallback((messageId: string) => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    setViewerStartId(messageId);
  }, []);

  const reactionDetailUsers = useMemo(() => {
    if (!reactionDetail) return [];
    return reactionDetail.userIds
      .map(uid => allUsers.find(u => u.id === uid))
      .filter((u): u is NonNullable<typeof u> => !!u);
  }, [allUsers, reactionDetail]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(m) => m.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: 20 }]}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>It&apos;s quiet here</Text>
              <Text style={styles.emptySub}>Be the first to drop a message ✨</Text>
            </View>
          }
        />

        {errorBanner ? (
          <View style={[styles.errorBanner, { bottom: 8 }]}>
            <Text style={styles.errorText}>{errorBanner}</Text>
          </View>
        ) : null}

        {mentionSuggestions.length > 0 && (
          <View style={[styles.mentionBox, { bottom: 8 }]}>
            {mentionSuggestions.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={styles.mentionItem}
                onPress={() => onSelectMention(u.username)}
              >
                <Text style={styles.mentionEmoji}>{u.avatarEmoji}</Text>
                <Text style={styles.mentionName}>@{u.username}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.inputWrap}>
        {replyTo && (
          <View style={styles.replyBar}>
            <CornerDownRight size={14} color={Colors.accentLight} />
            <View style={{ flex: 1 }}>
              <Text style={styles.replyBarName}>Replying to @{replyTo.username}</Text>
              <Text style={styles.replyBarPreview} numberOfLines={1}>{previewOf(replyTo)}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setReplyTo(null)}
              hitSlop={8}
              style={styles.replyBarClose}
              testID="cancel-reply"
            >
              <X size={14} color={Colors.text} />
            </TouchableOpacity>
          </View>
        )}
        {pendingMedia.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.previewRow}
            contentContainerStyle={{ gap: 10, paddingRight: 18 }}
          >
            {pendingMedia.map((item, idx) => (
              <View key={`${item.uri}-${idx}`} style={styles.previewItem}>
                <Image source={{ uri: item.uri }} style={styles.previewImage} />
                {item.kind === 'video' && (
                  <View style={styles.previewVideoBadge} pointerEvents="none">
                    <Play size={14} color={Colors.white} fill={Colors.white} />
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => setPendingMedia(prev => prev.filter((_, i) => i !== idx))}
                  style={styles.previewItemClose}
                  hitSlop={6}
                >
                  <X size={12} color={Colors.white} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
        {recording && (
          <View style={styles.recordingBar}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>Recording…</Text>
            <TouchableOpacity onPress={cancelRecording} style={styles.cancelRecBtn} testID="cancel-recording">
              <Text style={styles.cancelRecText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={stopRecording} style={styles.stopBtn} testID="stop-recording">
              <Text style={styles.stopText}>Send</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.inputBarOuter, { paddingBottom: insets.bottom > 0 ? insets.bottom - 4 : 6 }]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 40 : 0}
            tint="dark"
            style={styles.inputBar}
          >
            <TouchableOpacity
              style={styles.plusBtn}
              onPress={() => {
                setPlusOpen(true);
                if (Platform.OS !== 'web') void Haptics.selectionAsync();
              }}
              testID="plus-button"
            >
              <Plus size={20} color={Colors.text} />
            </TouchableOpacity>

            <TextInput
              ref={inputRef}
              style={styles.textInput}
              value={text}
              onChangeText={setText}
              placeholder={replyTo ? `Reply to @${replyTo.username}…` : 'Type a message…'}
              placeholderTextColor={Colors.textTertiary}
              multiline
              testID="message-input"
            />

            <Animated.View style={{ transform: [{ scale: sendScale }] }}>
              <TouchableOpacity
                onPress={handleSend}
                disabled={!canSend}
                activeOpacity={0.85}
                testID="send-button"
              >
                <LinearGradient
                  colors={canSend ? ['#60A5FA', '#2563EB'] : ['#1F2A44', '#17213A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sendBtn}
                >
                  <Send size={16} color={canSend ? Colors.white : Colors.textTertiary} />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </BlurView>
        </View>
      </View>

      <Modal visible={plusOpen} transparent animationType="fade" onRequestClose={() => setPlusOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPlusOpen(false)}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <TouchableOpacity style={styles.sheetItem} onPress={() => pickMedia('mixed')} testID="send-media">
              <View style={styles.sheetIcon}><ImageIcon size={20} color={Colors.accentLight} /></View>
              <View>
                <Text style={styles.sheetTitle}>Photos & videos</Text>
                <Text style={styles.sheetSub}>Pick up to 5 from your library</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetItem} onPress={() => pickMedia('videos')} testID="send-video">
              <View style={styles.sheetIcon}><VideoIcon size={20} color={Colors.accentLight} /></View>
              <View>
                <Text style={styles.sheetTitle}>Send a video</Text>
                <Text style={styles.sheetSub}>Up to 60 seconds, 50 MB</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetItem, Platform.OS === 'web' && { opacity: 0.4 }]}
              onPress={startRecording}
              disabled={Platform.OS === 'web'}
            >
              <View style={styles.sheetIcon}><Mic size={20} color={Colors.accentLight} /></View>
              <View>
                <Text style={styles.sheetTitle}>Record voice note</Text>
                <Text style={styles.sheetSub}>{Platform.OS === 'web' ? 'Not available on web' : 'Tap to record'}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <MediaViewer
        visible={!!viewerStartId}
        items={mediaItems}
        startId={viewerStartId}
        onClose={() => setViewerStartId(null)}
      />

      <Modal visible={!!reactionTarget} transparent animationType="fade" onRequestClose={() => setReactionTarget(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setReactionTarget(null)}>
          <View style={styles.reactionPicker}>
            <View style={styles.reactionHeader}>
              <Smile size={14} color={Colors.textSecondary} />
              <Text style={styles.reactionHeaderText}>Tap to react</Text>
            </View>
            <View style={styles.reactionGrid}>
              {REACTIONS.map(e => (
                <TouchableOpacity key={e} onPress={() => onReact(e)} style={styles.reactionPickCell}>
                  <Text style={styles.reactionPickEmoji}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.replyActionRow}
              onPress={() => {
                const target = reactionTarget;
                setReactionTarget(null);
                if (target) onStartReply(target);
              }}
              testID="reply-action"
            >
              <Reply size={14} color={Colors.accentLight} />
              <Text style={styles.replyActionText}>Reply</Text>
            </TouchableOpacity>
            {reactionTarget && reactionTarget.userId !== profile?.id && (
              <TouchableOpacity style={styles.reportRow} onPress={() => { setActionTarget(reactionTarget); setReactionTarget(null); }}>
                <Flag size={14} color="#F87171" />
                <Text style={styles.reportText}>Report / Block user</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDeleteTarget(null)}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <TouchableOpacity
              style={styles.sheetItem}
              onPress={() => {
                const target = deleteTarget;
                setDeleteTarget(null);
                if (target) onStartReply(target);
              }}
            >
              <View style={styles.sheetIcon}><Reply size={18} color={Colors.accentLight} /></View>
              <View>
                <Text style={styles.sheetTitle}>Reply</Text>
                <Text style={styles.sheetSub}>Quote this message</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetItem} onPress={confirmDelete} testID="confirm-delete">
              <View style={styles.sheetIcon}><Trash2 size={18} color="#F87171" /></View>
              <View>
                <Text style={[styles.sheetTitle, { color: '#F87171' }]}>Delete message</Text>
                <Text style={styles.sheetSub}>This cannot be undone</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetItem} onPress={() => setDeleteTarget(null)}>
              <View style={[styles.sheetIcon, { backgroundColor: Colors.bgCard }]}><X size={18} color={Colors.text} /></View>
              <View>
                <Text style={styles.sheetTitle}>Cancel</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={!!actionTarget} transparent animationType="fade" onRequestClose={() => setActionTarget(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setActionTarget(null)}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>@{actionTarget?.username}</Text>
            <TouchableOpacity style={styles.sheetItem} onPress={onReport}>
              <View style={styles.sheetIcon}><Flag size={18} color="#F87171" /></View>
              <View>
                <Text style={styles.sheetTitle}>Report message</Text>
                <Text style={styles.sheetSub}>Send to moderators</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetItem} onPress={onBlock}>
              <View style={styles.sheetIcon}><UserX size={18} color="#F87171" /></View>
              <View>
                <Text style={styles.sheetTitle}>Block user</Text>
                <Text style={styles.sheetSub}>Hide their messages from you</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={!!reactionDetail} transparent animationType="fade" onRequestClose={() => setReactionDetail(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setReactionDetail(null)}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.reactionDetailHead}>
              <Text style={styles.reactionDetailEmoji}>{reactionDetail?.emoji}</Text>
              <Text style={styles.sheetTitle}>
                {reactionDetailUsers.length} {reactionDetailUsers.length === 1 ? 'person' : 'people'}
              </Text>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {reactionDetailUsers.map(u => (
                <TouchableOpacity
                  key={u.id}
                  style={styles.reactionUserRow}
                  onPress={() => {
                    setReactionDetail(null);
                    onAvatarTap(u.id);
                  }}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarEmoji}>{u.avatarEmoji}</Text>
                  </View>
                  <Text style={styles.reactionUserName}>@{u.username}</Text>
                </TouchableOpacity>
              ))}
              {reactionDetailUsers.length === 0 && (
                <Text style={styles.emptySub}>No one yet</Text>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 14, paddingTop: 14 },
  empty: { alignItems: 'center', marginTop: 100, paddingHorizontal: 24 },
  emptyTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' as const },
  emptySub: { color: Colors.textSecondary, fontSize: 14, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarSpacer: { width: 32, height: 32 },
  avatarEmoji: { fontSize: 18 },
  username: {
    color: Colors.textSecondary, fontSize: 11, fontWeight: '600' as const,
    marginLeft: 14, marginBottom: 4,
  },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22 },
  bubbleMine: {
    borderBottomRightRadius: 6,
    shadowColor: Colors.accent, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  bubbleMineGrouped: { borderTopRightRadius: 8 },
  bubbleMineGroupedBottom: { borderBottomRightRadius: 8 },
  bubbleOther: {
    backgroundColor: Colors.bubbleReceived,
    borderBottomLeftRadius: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  bubbleOtherGrouped: { borderTopLeftRadius: 8 },
  bubbleOtherGroupedBottom: { borderBottomLeftRadius: 8 },
  bubbleImage: { width: 220, height: 220, borderRadius: 16, backgroundColor: Colors.bgElevated, overflow: 'hidden' },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  videoPlayCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  videoDurationBadge: {
    position: 'absolute', right: 8, bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999,
  },
  videoDurationText: { color: Colors.white, fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.3 },
  metaText: { color: Colors.textTertiary, fontSize: 10, marginTop: 4, marginHorizontal: 6 },
  reactionsRow: { flexDirection: 'row', gap: 4, marginTop: 6, flexWrap: 'wrap' },
  reactionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3,
  },
  reactionChipActive: { borderColor: Colors.accent, backgroundColor: 'rgba(59,130,246,0.15)' },
  reactionEmoji: { fontSize: 13, fontFamily: EMOJI_FONT_FAMILY, lineHeight: 16 },
  reactionCount: { color: Colors.text, fontSize: 11, fontWeight: '700' as const },
  voiceWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 180 },
  voiceBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(59,130,246,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  voiceBars: { flexDirection: 'row', alignItems: 'center', gap: 3, flex: 1 },
  voiceBar: { width: 2.5, borderRadius: 2 },
  voiceDuration: { fontSize: 11, fontWeight: '600' as const },
  mentionBox: {
    position: 'absolute', left: 16, right: 16,
    backgroundColor: Colors.bgElevated,
    borderRadius: 16, padding: 6,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 10 },
  },
  mentionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 10, paddingVertical: 10, borderRadius: 12,
  },
  mentionEmoji: { fontSize: 22 },
  mentionName: { color: Colors.text, fontSize: 15, fontWeight: '600' as const },
  inputWrap: { },

  inputBarOuter: { paddingHorizontal: 12, paddingTop: 4 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    backgroundColor: 'rgba(17,26,46,0.85)',
    borderRadius: 24, paddingHorizontal: 8, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  plusBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
  },
  textInput: {
    flex: 1, color: Colors.text, fontSize: 15, maxHeight: 120,
    paddingHorizontal: 8,
    paddingTop: Platform.OS === 'ios' ? 10 : 6, paddingBottom: Platform.OS === 'ios' ? 10 : 6,
  },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  previewRow: { paddingHorizontal: 18, marginBottom: 6, flexGrow: 0 },
  previewItem: { width: 80, height: 80 },
  previewImage: { width: 80, height: 80, borderRadius: 14, backgroundColor: Colors.bgElevated },
  previewItemClose: {
    position: 'absolute', top: -4, right: -4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center',
  },
  previewVideoBadge: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 14,
  },
  recordingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.35)', borderWidth: 1,
    marginHorizontal: 18, borderRadius: 16, padding: 12,
    marginBottom: 6,
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' },
  recText: { flex: 1, color: Colors.text, fontSize: 13 },
  stopBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, backgroundColor: '#2563EB' },
  stopText: { color: Colors.white, fontWeight: '700' as const, fontSize: 12 },
  cancelRecBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  cancelRecText: { color: Colors.textSecondary, fontWeight: '700' as const, fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 16, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  sheetHandle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, marginBottom: 12,
  },
  sheetItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 10, borderRadius: 16,
  },
  sheetIcon: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: 'rgba(59,130,246,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  sheetTitle: { color: Colors.text, fontSize: 16, fontWeight: '600' as const },
  sheetSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  reactionPicker: {
    marginHorizontal: 16, marginBottom: 32,
    backgroundColor: Colors.bgElevated,
    borderRadius: 24, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  reactionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, marginLeft: 6 },
  reactionHeaderText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' as const },
  reactionGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  reactionPickCell: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  reactionPickEmoji: { fontSize: 22, fontFamily: EMOJI_FONT_FAMILY, lineHeight: 28 },
  translateRow: { marginTop: 6, flexDirection: 'row' },
  translateChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(96,165,250,0.12)',
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.25)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  translateChipText: { color: Colors.accentLight, fontSize: 11, fontWeight: '600' as const },
  translateChipTextMine: { color: '#DBEAFE' },
  replyActionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 12, paddingVertical: 10,
    backgroundColor: 'rgba(96,165,250,0.12)', borderRadius: 12,
  },
  replyActionText: { color: Colors.accentLight, fontSize: 13, fontWeight: '700' as const },
  reportRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 8, paddingVertical: 10,
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12,
  },
  reportText: { color: '#F87171', fontSize: 13, fontWeight: '700' as const },
  errorBanner: {
    position: 'absolute', alignSelf: 'center',
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.4)', borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
  },
  errorText: { color: '#FCA5A5', fontSize: 12, fontWeight: '600' as const },
  swipeIcon: {
    position: 'absolute', left: 12, top: 0, bottom: 0,
    width: 28, alignItems: 'center', justifyContent: 'center',
  },
  replyQuote: {
    flexDirection: 'row', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10, padding: 8, marginBottom: 6,
  },
  replyQuoteMine: { backgroundColor: 'rgba(255,255,255,0.15)' },
  replyBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(96,165,250,0.3)', borderWidth: 1,
    marginHorizontal: 12, borderRadius: 14, padding: 10, marginBottom: 6,
  },
  replyBarName: { color: Colors.accentLight, fontSize: 12, fontWeight: '800' as const },
  replyBarPreview: { color: Colors.textSecondary, fontSize: 12, marginTop: 1 },
  replyBarClose: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
  },
  replyName: { color: Colors.accentLight, fontSize: 11, fontWeight: '800' as const },
  replyPreview: { color: Colors.textSecondary, fontSize: 12, marginTop: 1 },
  reactionDetailHead: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 10, marginBottom: 10,
  },
  reactionDetailEmoji: { fontSize: 28, fontFamily: EMOJI_FONT_FAMILY, lineHeight: 34 },
  reactionUserRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 10, borderRadius: 12,
  },
  reactionUserName: { color: Colors.text, fontSize: 15, fontWeight: '600' as const },
});
