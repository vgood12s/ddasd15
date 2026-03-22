import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Keyboard, Image, Alert, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { Colors, Fonts, FontSizes, Spacing } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useApi } from '../../src/utils/api';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const USE_PROXY = process.env.EXPO_PUBLIC_USE_PROXY === 'true';

function apiUrl(path: string) {
  if (USE_PROXY) return `${BACKEND_URL}${path.replace('/api/', '/api/proxy/')}`;
  return `${BACKEND_URL}${path}`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

interface Message {
  id: number;
  booking_id: number;
  sender_id: number;
  sender_type: 'player' | 'master';
  sender_name: string;
  text: string;
  file_url: string | null;
  file_type: string | null;
  is_read: boolean;
  created_at: string;
}

function VoicePlayer({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  const togglePlay = async () => {
    try {
      if (playing && soundRef.current) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
        return;
      }
      if (soundRef.current) {
        await soundRef.current.playAsync();
        setPlaying(true);
        return;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true }, (status) => {
        if (status.isLoaded) {
          setDuration(status.durationMillis || 0);
          setPosition(status.positionMillis || 0);
          if (status.didJustFinish) {
            setPlaying(false);
            setPosition(0);
          }
        }
      });
      soundRef.current = sound;
      setPlaying(true);
    } catch (e) {}
  };

  useEffect(() => {
    return () => { soundRef.current?.unloadAsync(); };
  }, []);

  const progress = duration > 0 ? (position / duration) * 100 : 0;
  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };

  return (
    <View style={voiceStyles.container}>
      <TouchableOpacity onPress={togglePlay} style={voiceStyles.playBtn}>
        <MaterialCommunityIcons name={playing ? 'pause' : 'play'} size={20} color={Colors.accent.gold} />
      </TouchableOpacity>
      <View style={voiceStyles.waveform}>
        <View style={voiceStyles.bar}>
          <View style={[voiceStyles.barFill, { width: `${progress}%` }]} />
        </View>
        <Text style={voiceStyles.time}>
          {playing ? formatMs(position) : formatMs(duration)}
        </Text>
      </View>
    </View>
  );
}

const voiceStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 180 },
  playBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(201,169,110,0.15)', alignItems: 'center', justifyContent: 'center' },
  waveform: { flex: 1, gap: 4 },
  bar: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2 },
  barFill: { height: 4, backgroundColor: Colors.accent.gold, borderRadius: 2 },
  time: { fontFamily: Fonts.body, fontSize: 10, color: Colors.text.muted },
});

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
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
    pollRef.current = setInterval(loadMessages, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (recordTimer.current) clearInterval(recordTimer.current);
    };
  }, [loadMessages]);

  const sendMessage = async (msgText?: string) => {
    const t = (msgText || text).trim();
    if (!t || sending) return;
    Keyboard.dismiss();
    setSending(true);
    try {
      await api.post(`/api/bookings/${bookingId}/messages`, { text: t }, token);
      setText('');
      await loadMessages();
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setSending(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Нет доступа', 'Разрешите доступ к галерее');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      await sendMessage(`📷 [Фото отправлено]`);
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Нет доступа', 'Разрешите доступ к микрофону');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setIsRecording(true);
      setRecordDuration(0);
      recordTimer.current = setInterval(() => setRecordDuration(d => d + 1), 1000);
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось начать запись');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    if (recordTimer.current) clearInterval(recordTimer.current);
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      await sendMessage(`🎤 [Голосовое сообщение ${formatDuration(recordDuration)}]`);
    } catch (e) {}
    setRecording(null);
    setRecordDuration(0);
  };

  const cancelRecording = async () => {
    if (!recording) return;
    if (recordTimer.current) clearInterval(recordTimer.current);
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
    } catch (e) {}
    setRecording(null);
    setRecordDuration(0);
  };

  const formatDuration = (secs: number) => `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`;

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_type === 'player';
    const hasFile = item.file_url && item.file_type;
    const isImage = hasFile && (item.file_type === 'image' || item.file_type?.startsWith('image'));
    const isVoice = hasFile && (item.file_type === 'audio' || item.file_type === 'voice');

    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
        {!isMe && (
          <View style={styles.msgAvatar}>
            <MaterialCommunityIcons name="sword-cross" size={14} color={Colors.accent.gold} />
          </View>
        )}
        <View style={[styles.msgContentCol, isMe && { alignItems: 'flex-end' }]}>
          {!isMe && <Text style={styles.msgSenderName}>{item.sender_name}</Text>}
          <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleThem]}>
            {/* Image */}
            {isImage && item.file_url && (
              <TouchableOpacity onPress={() => setPreviewImage(item.file_url)}>
                <Image
                  source={{ uri: item.file_url }}
                  style={styles.msgImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )}
            {/* Voice */}
            {isVoice && item.file_url && (
              <VoicePlayer url={item.file_url} />
            )}
            {/* File */}
            {hasFile && !isImage && !isVoice && (
              <View style={styles.fileRow}>
                <MaterialCommunityIcons name="file-document-outline" size={20} color={Colors.accent.gold} />
                <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextThem]} numberOfLines={1}>
                  Файл
                </Text>
              </View>
            )}
            {/* Text */}
            {item.text ? (
              <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextThem]}>{item.text}</Text>
            ) : null}
          </View>
          <View style={[styles.msgMeta, isMe && { flexDirection: 'row-reverse' }]}>
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
            <MaterialCommunityIcons name="account" size={14} color={Colors.accent.gold} />
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
        keyExtractor={item => String(item.id)}
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

      {/* Recording overlay */}
      {isRecording && (
        <View style={styles.recordingBar}>
          <View style={styles.recordingPulse} />
          <Text style={styles.recordingText}>Запись • {formatDuration(recordDuration)}</Text>
          <TouchableOpacity testID="cancel-recording-btn" onPress={cancelRecording} style={styles.recordCancelBtn}>
            <MaterialCommunityIcons name="close" size={20} color={Colors.status.danger} />
          </TouchableOpacity>
          <TouchableOpacity testID="stop-recording-btn" onPress={stopRecording} style={styles.recordSendBtn}>
            <MaterialCommunityIcons name="send" size={20} color={Colors.bg.main} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      {!isRecording && (
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <TouchableOpacity testID="attach-btn" onPress={pickImage} style={styles.attachBtn}>
            <MaterialCommunityIcons name="paperclip" size={22} color={Colors.text.muted} />
          </TouchableOpacity>
          <TouchableOpacity testID="mic-btn" onPress={startRecording} style={styles.micBtn}>
            <MaterialCommunityIcons name="microphone" size={22} color={Colors.text.muted} />
          </TouchableOpacity>
          <TextInput
            testID="chat-input"
            style={styles.textInput}
            value={text}
            onChangeText={setText}
            placeholder="Сообщение..."
            placeholderTextColor={Colors.text.muted}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            testID="chat-send-btn"
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!text.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={Colors.bg.main} />
            ) : (
              <MaterialCommunityIcons name="send" size={20} color={Colors.bg.main} />
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Image Preview Modal */}
      <Modal visible={!!previewImage} transparent animationType="fade">
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewImage(null)}>
            <MaterialCommunityIcons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {previewImage && (
            <Image source={{ uri: previewImage }} style={styles.previewImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
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
  msgRow: { flexDirection: 'row', marginBottom: 12, gap: 6 },
  msgRowLeft: { justifyContent: 'flex-start' },
  msgRowRight: { justifyContent: 'flex-end' },
  msgAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.accent.gold, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  msgAvatarMe: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.accent.gold, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  msgContentCol: { maxWidth: '72%' },
  msgSenderName: { fontFamily: Fonts.bodySemiBold, fontSize: 11, color: Colors.accent.gold, marginBottom: 2 },
  msgBubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, overflow: 'hidden' },
  msgBubbleMe: { backgroundColor: Colors.accent.violetDark, borderBottomRightRadius: 4 },
  msgBubbleThem: { backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.border.default, borderBottomLeftRadius: 4 },
  msgText: { fontFamily: Fonts.body, fontSize: FontSizes.caption, lineHeight: 20 },
  msgTextMe: { color: Colors.text.highlight },
  msgTextThem: { color: Colors.text.primary },
  msgImage: { width: 200, height: 150, borderRadius: 12, marginBottom: 6 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  msgMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  msgTime: { fontFamily: Fonts.body, fontSize: 10, color: Colors.text.muted },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyChatTitle: { fontFamily: Fonts.heading, fontSize: FontSizes.h3, color: Colors.text.primary },
  emptyChatText: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.muted, textAlign: 'center', paddingHorizontal: 40 },
  // Recording bar
  recordingBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.m, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border.default, backgroundColor: Colors.bg.card, gap: 10 },
  recordingPulse: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.status.danger },
  recordingText: { flex: 1, fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.body, color: Colors.status.danger },
  recordCancelBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(199,72,72,0.15)', alignItems: 'center', justifyContent: 'center' },
  recordSendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.accent.gold, alignItems: 'center', justifyContent: 'center' },
  // Input
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.s, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border.default, backgroundColor: Colors.bg.card, gap: 6 },
  attachBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  micBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  textInput: { flex: 1, fontFamily: Fonts.body, fontSize: FontSizes.body, color: Colors.text.highlight, backgroundColor: Colors.bg.main, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 100, borderWidth: 1, borderColor: Colors.border.default },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.accent.gold, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  // Preview
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  previewClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: '90%', height: '70%' },
});
