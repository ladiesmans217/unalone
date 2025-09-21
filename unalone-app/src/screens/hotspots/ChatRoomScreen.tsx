import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { APP_COLORS, APP_CONFIG } from '../../utils/constants';
import { ChatMessage, RootStackParamList } from '../../types';
import { chatService } from '../../services/ChatService';
import { StackScreenProps } from '@react-navigation/stack';
import { useAuth } from '../../contexts/AuthContext';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { friendsService } from '../../services/FriendsService';

type Props = StackScreenProps<RootStackParamList, 'ChatRoom'>;

const ChatRoomScreen: React.FC<Props> = ({ route, navigation }) => {
  const { hotspotId, hotspotName } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    navigation.setOptions({ title: hotspotName ? `Chat · ${hotspotName}` : 'Chat' });
  }, [hotspotName]);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const history = await chatService.getRecentMessages(hotspotId);
        setMessages(history);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
      } catch {}
      unsub = await chatService.connect(hotspotId, (msg) => {
        setMessages((prev) => [...prev, msg]);
        listRef.current?.scrollToEnd({ animated: true });
      });
    })();
    return () => { unsub?.(); };
  }, [hotspotId]);

  const send = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    chatService.send(trimmed);
    setInput('');
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const mine = item.userId === user?.id;
    return (
      <View style={[styles.msgRow, mine ? styles.rowRight : styles.rowLeft]}>
        {!mine && (
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Add friend',
                `Send friend request to ${item.nickname}?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Send', onPress: async () => {
                    try { await friendsService.sendRequest(item.userId); } catch (e: any) { Alert.alert('Error', e?.message || 'Failed'); }
                  }}
                ]
              );
            }}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{(item.nickname || 'U').charAt(0).toUpperCase()}</Text>
          </TouchableOpacity>
        )}
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
          {!mine && <Text style={styles.nickname}>{item.nickname}</Text>}
          <Text style={[styles.content, mine ? styles.contentMine : styles.contentOther]}>{item.content}</Text>
          <Text style={[styles.time, mine ? styles.timeMine : styles.timeOther]}>{new Date(item.createdAt).toLocaleTimeString()}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: 80 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      />
      <View style={[styles.inputRow, { paddingBottom: 8 + insets.bottom }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message"
          placeholderTextColor={APP_COLORS.textSecondary}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <TouchableOpacity onPress={send} style={styles.sendBtn}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_COLORS.background },
  list: { padding: 12 },
  msgRow: { flexDirection: 'row', marginVertical: 6, alignItems: 'flex-end' },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: APP_COLORS.primary, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  avatarText: { color: 'white', fontWeight: 'bold' },
  bubble: { maxWidth: '75%', padding: 10, borderRadius: 12 },
  bubbleOther: { backgroundColor: 'white', borderWidth: 1, borderColor: APP_COLORS.border },
  bubbleMine: { backgroundColor: APP_COLORS.primary },
  nickname: { fontSize: 12, color: APP_COLORS.textSecondary, marginBottom: 4 },
  content: {},
  contentOther: { color: 'black' },
  contentMine: { color: 'white' },
  time: { fontSize: 10, marginTop: 4 },
  timeOther: { color: APP_COLORS.textSecondary },
  timeMine: { color: 'rgba(255,255,255,0.85)' },
  inputRow: { flexDirection: 'row', padding: 8, borderTopWidth: 1, borderTopColor: APP_COLORS.border, backgroundColor: 'white' },
  input: { flex: 1, backgroundColor: APP_COLORS.background, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginRight: 8 },
  sendBtn: { backgroundColor: APP_COLORS.primary, paddingHorizontal: 16, borderRadius: 8, justifyContent: 'center' },
  sendText: { color: 'white', fontWeight: 'bold' },
});

export default ChatRoomScreen;
