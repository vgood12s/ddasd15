import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Fonts, FontSizes, Spacing } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useApi } from '../../src/utils/api';

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

interface Message {
  id: string;
  booking_id: string;
  sender_id: string;
  sender_type: 'player' | 'master';
  sender_name: string;
  text: string;
  is_read: boolean;
  created_at: string;
}

export default function ChatScreen() {
  const { id: bookingId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const api = useApi();

  const [messages, setMessages] = useState<Message[]>([]);
  const [masterName, setMasterName] = useState('');
  const [gameTitle, setGameTitle] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const loadMessages = useCallback(async () => {
    try {
      const data = await api.get(`/api/bookings/${bookingId}/messages`, token);
      setMessages(data.messages || []);
      setMasterName(data.master_name || 'Мастер');
      setGameTitle(data.game_title || '');
    } catch (e) {}
  }, [bookingId, token]);

  useEffect(() => {
    loadMessages().finally(() => setLoading(false));
    // Poll for new messages every 5s
    pollRef.current = setInterval(loadMessages, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadMessages]);

  const sendMessage = async () => {
    if (!text.trim() || sending) return;
    Keyboard.dismiss();
    setSending(true);
    try {
      await api.post(`/api/bookings/${bookingId}/messages`, { text: text.trim() }, token);
      setText('');
      await loadMessages();
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_type === 'player';
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
        {!isMe && (
          <View style={styles.msgAvatar}>
            <MaterialCommunityIcons name="sword-cross" size={16} color={Colors.accent.gold} />
          </View>
        )}
        <View style={styles.msgContentCol}>
          {!isMe && <Text style={styles.msgSenderName}>{item.sender_name}</Text>}
          <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleThem]}>
            <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextThem]}>{item.text}</Text>
          </View>
          <View style={[styles.msgMeta, isMe && { alignSelf: 'flex-end' }]}>
            <Text style={styles.msgTime}>{formatTime(item.created_at)}</Text>
            {isMe && (
              <MaterialCommunityIcons
                name={item.is_read ? 'check-all' : 'check'}
                size={14}
                color={item.is_read ? Colors.accent.gold : Colors.text.muted}
              />
            )}
          </View>
        </View>
        {isMe && (
          <View style={styles.msgAvatarMe}>
            <MaterialCommunityIcons name="account" size={16} color={Colors.accent.gold} />
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.accent.gold} style={{ marginTop: 100 }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.chatHeader}>
        <TouchableOpacity testID="chat-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerAvatar}>
          <MaterialCommunityIcons name="sword-cross" size={20} color={Colors.accent.gold} />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{masterName}</Text>
          <Text style={styles.headerGame} numberOfLines={1}>{gameTitle}</Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <MaterialCommunityIcons name="message-text-outline" size={48} color={Colors.text.muted} />
            <Text style={styles.emptyChatTitle}>Начните общение</Text>
            <Text style={styles.emptyChatText}>Напишите мастеру, если у вас есть вопросы по игре</Text>
          </View>
        }
      />

      {/* Input */}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TextInput
          testID="chat-input"
          style={styles.textInput}
          value={text}
          onChangeText={setText}
          placeholder="Сообщение..."
          placeholderTextColor={Colors.text.muted}
          multiline
          maxLength={1000}
          returnKeyType="default"
        />
        <TouchableOpacity
          testID="chat-send-btn"
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!text.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={Colors.bg.main} />
          ) : (
            <MaterialCommunityIcons name="send" size={20} color={Colors.bg.main} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.main },
  chatHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.m, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border.default, gap: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.bg.card, alignItems: 'center', justifyContent: 'center' },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accent.gold, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1 },
  headerName: { fontFamily: Fonts.heading, fontSize: FontSizes.body, color: Colors.text.highlight },
  headerGame: { fontFamily: Fonts.body, fontSize: FontSizes.small, color: Colors.text.muted },
  messagesList: { paddingHorizontal: Spacing.m, paddingVertical: Spacing.m, flexGrow: 1 },
  msgRow: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  msgRowLeft: { justifyContent: 'flex-start' },
  msgRowRight: { justifyContent: 'flex-end' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.accent.gold, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  msgAvatarMe: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.accent.gold, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  msgContentCol: { maxWidth: '70%' },
  msgSenderName: { fontFamily: Fonts.bodySemiBold, fontSize: 11, color: Colors.accent.gold, marginBottom: 2 },
  msgBubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  msgBubbleMe: { backgroundColor: Colors.accent.violetDark, borderBottomRightRadius: 4 },
  msgBubbleThem: { backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.border.default, borderBottomLeftRadius: 4 },
  msgText: { fontFamily: Fonts.body, fontSize: FontSizes.caption, lineHeight: 20 },
  msgTextMe: { color: Colors.text.highlight },
  msgTextThem: { color: Colors.text.primary },
  msgMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  msgTime: { fontFamily: Fonts.body, fontSize: 10, color: Colors.text.muted },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyChatTitle: { fontFamily: Fonts.heading, fontSize: FontSizes.h3, color: Colors.text.primary },
  emptyChatText: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.muted, textAlign: 'center', paddingHorizontal: 40 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.m, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border.default, backgroundColor: Colors.bg.card, gap: 8 },
  textInput: { flex: 1, fontFamily: Fonts.body, fontSize: FontSizes.body, color: Colors.text.highlight, backgroundColor: Colors.bg.main, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 100, borderWidth: 1, borderColor: Colors.border.default },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.accent.gold, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
});
