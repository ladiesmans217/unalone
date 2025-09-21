import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, StyleSheet, KeyboardAvoidingView, Platform, useWindowDimensions, ActivityIndicator } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Ionicons } from '@expo/vector-icons';
import { aiAssistantService } from '../../services/AIAssistantService';
import { AIChatSession, AIMessage } from '../../types';
import { APP_CONFIG } from '../../utils/constants';

export const AIAssistantScreen: React.FC = () => {
  const [sessions, setSessions] = useState<AIChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<AIChatSession | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList<AIMessage>>(null);
  const { width } = useWindowDimensions();
  const isWide = width >= 800;
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(isWide);
  const [awaitingAI, setAwaitingAI] = useState<boolean>(false);
  const headerHeight = useHeaderHeight();

  useEffect(() => {
    loadSessions(true);
  }, []);

  useEffect(() => {
    if (activeSession) loadMessages(activeSession.id);
  }, [activeSession?.id]);

  const loadSessions = async (autoCreateIfEmpty = false) => {
    const res = await aiAssistantService.listSessions();
    if (res.success && res.data) {
      const list = res.data;
      setSessions(list);
      if (list.length > 0) {
        setActiveSession(list[0]);
      } else if (autoCreateIfEmpty) {
        // Auto-create a new session on first open
        const created = await aiAssistantService.createSession(`Session ${new Date().toLocaleString()}`);
        if (created.success && created.data) {
          setSessions([created.data]);
          setActiveSession(created.data);
          setMessages([]);
        }
      }
    }
  };

  const loadMessages = async (sessionId: string) => {
    const res = await aiAssistantService.getMessages(sessionId, APP_CONFIG.SETTINGS.CHAT_MESSAGE_LIMIT);
    if (res.success && res.data) {
      setMessages(res.data);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
    }
  };

  const startNewSession = async () => {
    const title = `Session ${new Date().toLocaleString()}`;
    const res = await aiAssistantService.createSession(title);
    if (res.success && res.data) {
      setSessions([res.data, ...sessions]);
      setActiveSession(res.data);
      setMessages([]);
    }
  };

  const send = async () => {
    if (!activeSession || !input.trim() || awaitingAI) return;
    const content = input.trim();
    setInput('');

    // Optimistic: show user's message immediately
    const tempUser: AIMessage = {
      id: `local-${Date.now()}`,
      session_id: activeSession.id,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    // Temporary typing indicator from AI
    const tempAI: AIMessage = {
      id: `pending-${Date.now()}`,
      session_id: activeSession.id,
      role: 'ai',
      content: 'Responding…',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUser, tempAI]);
    setAwaitingAI(true);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 30);

    const res = await aiAssistantService.sendMessage(activeSession.id, content);
    setAwaitingAI(false);

    if (res.success && res.data) {
      setMessages(prev => {
        const next = [...prev];
        const uIdx = next.findIndex(m => m.id === tempUser.id);
        if (uIdx >= 0) next[uIdx] = res.data!.user; else next.push(res.data!.user);
        const aIdx = next.findIndex(m => m.id === tempAI.id);
        if (aIdx >= 0) next[aIdx] = res.data!.ai; else next.push(res.data!.ai);
        return next;
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 30);
    } else {
      // Convert typing bubble to an error message
      setMessages(prev => {
        const next = [...prev];
        const aIdx = next.findIndex(m => m.id === tempAI.id);
        if (aIdx >= 0) next[aIdx] = { ...tempAI, content: 'Failed to get AI response. Please try again.' };
        return next;
      });
    }
  };

  const renderSession = ({ item }: { item: AIChatSession }) => (
    <TouchableOpacity
      onPress={() => setActiveSession(item)}
      style={[styles.sessionItem, activeSession?.id === item.id && styles.sessionItemActive]}
    >
      <Text style={styles.sessionTitle} numberOfLines={1}>{item.title || 'New Chat'}</Text>
      <Text style={styles.sessionTime}>{new Date(item.updated_at).toLocaleString()}</Text>
    </TouchableOpacity>
  );

  const renderMessage = ({ item }: { item: AIMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgBubble, isUser ? styles.msgUser : styles.msgAI]}>
        <Text style={[styles.msgText, isUser ? styles.msgTextUser : styles.msgTextAI]}>{item.content}</Text>
        <Text style={[styles.msgTime, isUser ? styles.msgTimeUser : styles.msgTimeAI]}>{new Date(item.created_at).toLocaleTimeString()}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Left: Session list (collapsible) */}
      {sidebarOpen && (
        <View style={styles.leftPane}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>AI Assistant</Text>
            <TouchableOpacity onPress={startNewSession} style={styles.newButton}>
              <Text style={styles.newButtonText}>+ New</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={sessions}
            keyExtractor={(s) => s.id}
            renderItem={renderSession}
            contentContainerStyle={{ paddingBottom: 12 }}
          />
        </View>
      )}

      {/* Right: Chat area */}
      <View style={styles.rightPane}>
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setSidebarOpen((v) => !v)} style={styles.iconButton}>
            <Ionicons name="menu" size={22} color={APP_CONFIG.COLORS.TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={styles.chatTitle} numberOfLines={1}>{activeSession?.title || 'New Chat'}</Text>
          <TouchableOpacity onPress={startNewSession} style={styles.iconButton}>
            <Ionicons name="add-circle" size={22} color={APP_CONFIG.COLORS.PRIMARY} />
          </TouchableOpacity>
        </View>

        {activeSession ? (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.select({ ios: 'padding', android: 'height' })}
            keyboardVerticalOffset={headerHeight}
          >
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              renderItem={renderMessage}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
            />
            <View style={styles.inputRow}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Ask anything about safety, hotspots, or navigation..."
                style={styles.input}
                multiline
              />
              <TouchableOpacity onPress={send} style={[styles.sendButton, awaitingAI && { opacity: 0.7 }]} disabled={awaitingAI}>
                {awaitingAI ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>Send</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Start a new AI session to begin</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: APP_CONFIG.COLORS.BACKGROUND },
  leftPane: { width: 260, borderRightWidth: 1, borderRightColor: '#e5e7eb', padding: 12, backgroundColor: APP_CONFIG.COLORS.SURFACE },
  rightPane: { flex: 1, backgroundColor: APP_CONFIG.COLORS.BACKGROUND },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: 'bold', color: APP_CONFIG.COLORS.TEXT_PRIMARY },
  newButton: { backgroundColor: APP_CONFIG.COLORS.PRIMARY, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  newButtonText: { color: 'white', fontWeight: '600' },
  chatHeader: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: APP_CONFIG.COLORS.SURFACE },
  chatTitle: { flex: 1, textAlign: 'center', color: APP_CONFIG.COLORS.TEXT_PRIMARY, fontWeight: '600' },
  iconButton: { padding: 6, borderRadius: 6 },
  sessionItem: { padding: 10, borderRadius: 8, marginBottom: 8, backgroundColor: '#f3f4f6' },
  sessionItemActive: { backgroundColor: '#e0e7ff' },
  sessionTitle: { color: APP_CONFIG.COLORS.TEXT_PRIMARY, fontWeight: '600' },
  sessionTime: { color: APP_CONFIG.COLORS.TEXT_SECONDARY, fontSize: 12 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: APP_CONFIG.COLORS.TEXT_SECONDARY },
  msgBubble: { marginVertical: 4, padding: 10, borderRadius: 10, maxWidth: '85%' },
  msgUser: { alignSelf: 'flex-end', backgroundColor: APP_CONFIG.COLORS.PRIMARY },
  msgAI: { alignSelf: 'flex-start', backgroundColor: '#e5e7eb' },
  msgText: { fontSize: 15 },
  msgTextUser: { color: 'white' },
  msgTextAI: { color: APP_CONFIG.COLORS.TEXT_PRIMARY },
  msgTime: { fontSize: 11, marginTop: 4 },
  msgTimeUser: { color: '#d1d5db', alignSelf: 'flex-end' },
  msgTimeAI: { color: APP_CONFIG.COLORS.TEXT_SECONDARY, alignSelf: 'flex-start' },
  inputRow: { flexDirection: 'row', padding: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb', gap: 8, backgroundColor: APP_CONFIG.COLORS.SURFACE },
  input: { flex: 1, minHeight: 40, maxHeight: 120, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  sendButton: { backgroundColor: APP_CONFIG.COLORS.PRIMARY, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  sendText: { color: 'white', fontWeight: '600' },
});

export default AIAssistantScreen;
