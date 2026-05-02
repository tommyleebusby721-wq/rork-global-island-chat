import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  FlatList,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, Send, Bot, Sparkles, MapPin, AlertTriangle, Mail, User } from 'lucide-react-native';
import { generateText, createGateway } from 'ai';
import { useUser } from '@/contexts/UserContext';
import { getIsland } from '@/constants/islands';
import Colors from '@/constants/colors';

const SUPPORT_EMAIL = 'tommyleebusby@hotmail.com';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
}

const gateway = createGateway({
  baseURL: `${process.env.EXPO_PUBLIC_TOOLKIT_URL}/v2/vercel/v3/ai`,
  apiKey: process.env.EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY,
});

const SYSTEM_PROMPT = `You are the friendly support AI for "Island Chat" — a community chat app where people join their home Caribbean island group chat, DM each other, and translate messages.

Be warm, concise (2-5 short sentences), and use emojis sparingly (🏝️ ✨ 💬). Never pretend to perform actions — you can only give advice and help users decide whether to forward their request to the human team.

You can help with:
1. How-to questions (change password, set up recovery, block users, switch islands, auto-translate, DMs, reactions, etc.)
2. Troubleshooting small issues (app not loading a chat, keyboard covering input, missing notifications — suggest restarting the app, checking internet, updating, etc.)
3. Triaging requests that must be forwarded to the team:
   - "Add my island" / "I don't see my island" — ALWAYS say this needs to be forwarded to the team.
   - Bug reports / crashes that can't be fixed by user
   - Account recovery issues the user can't solve
   - Feature requests

When the request clearly needs the human team, END your reply with this exact line on its own:
[FORWARD]

Do NOT add [FORWARD] for generic how-to questions you can answer yourself. Only add it when the user must contact the team.`;

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useUser();
  const island = useMemo(() => (profile?.islandId ? getIsland(profile.islandId) : undefined), [profile?.islandId]);

  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hey 👋 I'm the Island Chat support AI. Ask me anything — how to change your password, set up recovery, request a new island, or report a bug. I'll help directly or forward it to the team.",
      createdAt: Date.now(),
    },
  ]);
  const [input, setInput] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [shouldForward, setShouldForward] = useState<boolean>(false);
  const listRef = useRef<FlatList<Msg>>(null);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
  }, []);

  useEffect(() => { scrollToEnd(); }, [messages, scrollToEnd]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    const userMsg: Msg = { id: `u-${Date.now()}`, role: 'user', text, createdAt: Date.now() };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setSending(true);

    try {
      const { text: reply } = await generateText({
        model: gateway('anthropic/claude-sonnet-4'),
        system: SYSTEM_PROMPT,
        messages: history
          .filter(m => m.id !== 'welcome')
          .map(m => ({ role: m.role, content: m.text })),
      });

      const hasForward = /\[FORWARD\]/i.test(reply);
      const cleaned = reply.replace(/\[FORWARD\]/gi, '').trim();

      const aiMsg: Msg = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: cleaned || "I'll forward this to the team. Tap the button below to send it. 💌",
        createdAt: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
      if (hasForward) setShouldForward(true);
    } catch (e: unknown) {
      console.log('[support] ai error', e);
      const errMsg: Msg = {
        id: `e-${Date.now()}`,
        role: 'assistant',
        text: "I couldn't reach the AI right now. You can still forward your question directly to the team using the button below. 💌",
        createdAt: Date.now(),
      };
      setMessages(prev => [...prev, errMsg]);
      setShouldForward(true);
    } finally {
      setSending(false);
    }
  }, [input, messages, sending]);

  const onForward = useCallback(async () => {
    const transcript = messages
      .filter(m => m.id !== 'welcome')
      .map(m => `${m.role === 'user' ? 'USER' : 'AI'}: ${m.text}`)
      .join('\n\n');

    const body =
      `User: @${profile?.username ?? 'unknown'}\n` +
      `Island: ${island ? `${island.name} (${island.id})` : 'not set'}\n` +
      `Platform: ${Platform.OS}\n` +
      `Date: ${new Date().toLocaleString()}\n\n` +
      `--- Conversation ---\n${transcript}`;

    const subject = 'Island Chat support request';
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Email unavailable', `Please email us directly at ${SUPPORT_EMAIL}.`);
        return;
      }
      await Linking.openURL(url);
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessages(prev => [
        ...prev,
        {
          id: `s-${Date.now()}`,
          role: 'assistant',
          text: `Opened your mail app 📬 I've pre-filled everything — just hit send and we'll get back to you at ${SUPPORT_EMAIL}.`,
          createdAt: Date.now(),
        },
      ]);
      setShouldForward(false);
    } catch (e) {
      console.log('[support] mail error', e);
      Alert.alert('Something went wrong', `Please email us directly at ${SUPPORT_EMAIL}.`);
    }
  }, [messages, profile, island]);

  const quickActions: { id: string; label: string; icon: React.ReactNode; prompt: string }[] = useMemo(() => ([
    {
      id: 'add-island',
      label: 'Request an island',
      icon: <MapPin size={13} color={Colors.accentLight} />,
      prompt: "I don't see my island in the app. Can you add it?",
    },
    {
      id: 'bug',
      label: 'Report a bug',
      icon: <AlertTriangle size={13} color="#FBBF24" />,
      prompt: 'I want to report a bug: ',
    },
    {
      id: 'password',
      label: 'Change password',
      icon: <Sparkles size={13} color="#F472B6" />,
      prompt: 'How do I change my password?',
    },
  ]), []);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={["#0B1220", "#0E1836", "#0B1220"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10} testID="sup-back">
          <ChevronLeft size={28} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.aiBadge}>
            <Bot size={13} color="#34D399" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Support</Text>
            <Text style={styles.headerSub}>AI assistant · online</Text>
          </View>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 }}
          renderItem={({ item }) => {
            const isUser = item.role === 'user';
            return (
              <View style={[styles.msgRow, isUser && { justifyContent: 'flex-end' }]}>
                {!isUser && (
                  <View style={styles.msgAvatar}>
                    <Bot size={14} color="#34D399" />
                  </View>
                )}
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
                  <Text style={[styles.bubbleText, isUser && { color: Colors.white }]}>{item.text}</Text>
                </View>
                {isUser && (
                  <View style={[styles.msgAvatar, { backgroundColor: 'rgba(96,165,250,0.15)' }]}>
                    <User size={14} color={Colors.accentLight} />
                  </View>
                )}
              </View>
            );
          }}
          ListFooterComponent={
            <>
              {sending && (
                <View style={styles.msgRow}>
                  <View style={styles.msgAvatar}>
                    <Bot size={14} color="#34D399" />
                  </View>
                  <View style={[styles.bubble, styles.bubbleAi, { flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
                    <ActivityIndicator size="small" color={Colors.accentLight} />
                    <Text style={styles.bubbleText}>Thinking…</Text>
                  </View>
                </View>
              )}
              {messages.length <= 1 && !sending && (
                <View style={styles.quickWrap}>
                  <Text style={styles.quickLabel}>QUICK ACTIONS</Text>
                  <View style={styles.quickRow}>
                    {quickActions.map(q => (
                      <TouchableOpacity
                        key={q.id}
                        onPress={() => setInput(q.prompt)}
                        style={styles.quickChip}
                        testID={`qa-${q.id}`}
                      >
                        {q.icon}
                        <Text style={styles.quickText}>{q.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </>
          }
          onContentSizeChange={scrollToEnd}
        />

        {shouldForward && (
          <TouchableOpacity
            onPress={onForward}
            activeOpacity={0.85}
            style={[styles.forwardWrap, { marginBottom: 6 }]}
            testID="forward-email"
          >
            <LinearGradient
              colors={["#34D399", "#059669"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.forwardBtn}
            >
              <Mail size={16} color={Colors.white} />
              <Text style={styles.forwardText}>Forward to support team</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) + 6 }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything or describe your issue…"
            placeholderTextColor={Colors.textTertiary}
            multiline
            testID="sup-input"
          />
          <TouchableOpacity
            onPress={send}
            disabled={!input.trim() || sending}
            style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.4 }]}
            testID="sup-send"
          >
            <Send size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerCenter: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  aiBadge: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(52,211,153,0.15)',
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: Colors.text, fontSize: 15, fontWeight: '800' as const, letterSpacing: -0.2 },
  headerSub: { color: '#34D399', fontSize: 11, fontWeight: '600' as const },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
  msgAvatar: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(52,211,153,0.15)',
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleAi: {
    backgroundColor: Colors.bgElevated,
    borderWidth: 1, borderColor: Colors.border,
    borderBottomLeftRadius: 6,
  },
  bubbleUser: {
    backgroundColor: Colors.accent,
    borderBottomRightRadius: 6,
  },
  bubbleText: { color: Colors.text, fontSize: 14, lineHeight: 19 },

  quickWrap: { marginTop: 8, paddingHorizontal: 4 },
  quickLabel: {
    color: Colors.textSecondary, fontSize: 10, fontWeight: '800' as const,
    letterSpacing: 1.2, marginBottom: 10, marginLeft: 4,
  },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
  },
  quickText: { color: Colors.text, fontSize: 12, fontWeight: '600' as const },

  forwardWrap: { marginHorizontal: 14 },
  forwardBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 14, borderRadius: 16,
    shadowColor: '#10B981', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
  },
  forwardText: { color: Colors.white, fontSize: 14, fontWeight: '800' as const, letterSpacing: -0.2 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 14, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    backgroundColor: 'rgba(11,18,32,0.9)',
  },
  input: {
    flex: 1, color: Colors.text, fontSize: 15,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10,
    borderRadius: 18, maxHeight: 120,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.accent, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
});
