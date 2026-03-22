import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, Modal, Image, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Fonts, FontSizes, Spacing } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useApi } from '../../src/utils/api';

const GUILD_BASE_URL = 'https://guildkhv.com';

function PulsingStatus({ emoji }: { emoji: string }) {
  const scale = useSharedValue(1);
  const glow = useSharedValue(0.3);
  
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ), -1, true
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ), -1, true
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }));

  return (
    <View style={pStyles.container}>
      <Animated.View style={[pStyles.glow, glowStyle]} />
      <Animated.View style={[pStyles.badge, animStyle]}>
        <Text style={pStyles.emoji}>{emoji}</Text>
      </Animated.View>
    </View>
  );
}

const pStyles = StyleSheet.create({
  container: { position: 'absolute', bottom: -4, right: -4, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.accent.gold },
  badge: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.bg.card, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.bg.main },
  emoji: { fontSize: 14 },
});

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, token, logout, refreshUser } = useAuth();
  const api = useApi();
  const [refreshing, setRefreshing] = useState(false);
  const [masters, setMasters] = useState<any[]>([]);
  const [showMasters, setShowMasters] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    loadMasters();
  }, []);

  const loadMasters = async () => {
    try {
      const data = await api.get('/api/masters', token);
      setMasters(data);
    } catch (e) {}
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshUser();
    await loadMasters();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await logout();
    // Force navigation to welcome screen
    router.replace('/');
  };

  const handleAvatarUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Нет доступа', 'Разрешите доступ к галерее');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setUploadingAvatar(true);
      try {
        const formData = new FormData();
        const filename = asset.uri.split('/').pop() || 'avatar.jpg';
        const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        formData.append('avatar', {
          uri: asset.uri,
          name: filename,
          type: mimeType,
        } as any);
        await api.upload('/api/profile/avatar', formData, token);
        await refreshUser();
      } catch (e: any) {
        Alert.alert('Ошибка', e.message || 'Не удалось загрузить аватар');
      } finally {
        setUploadingAvatar(false);
      }
    }
  };

  const resolveAvatarUrl = (avatar: string | null | undefined) => {
    if (!avatar) return null;
    if (avatar.startsWith('http')) return avatar;
    return `${GUILD_BASE_URL}${avatar}`;
  };

  const avatarUrl = resolveAvatarUrl(user?.avatar);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent.gold} />}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons name="fleur-de-lis" size={24} color={Colors.accent.gold} />
            <Text style={styles.headerTitle}>Профиль</Text>
          </View>
          <TouchableOpacity testID="logout-btn" onPress={handleLogout} style={styles.logoutBtn}>
            <MaterialCommunityIcons name="logout" size={20} color={Colors.text.muted} />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.profileCard}>
          <TouchableOpacity onPress={handleAvatarUpload} style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={Colors.accent.gold} />
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <MaterialCommunityIcons name="account" size={40} color={Colors.accent.gold} />
              )}
            </View>
            <View style={styles.statusBadge}>
              <PulsingStatus emoji={user?.status_emoji || '🌱'} />
            </View>
            <View style={styles.avatarEditBadge}>
              <MaterialCommunityIcons name="camera" size={12} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{user?.first_name || user?.username}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>{user?.status_emoji} {user?.status_name} · {user?.cashback_rate}%</Text>
          </View>
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.statsGrid}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="gold" size={26} color={Colors.accent.gold} />
            <Text style={styles.statValue}>{Math.round(user?.balance || 0)}</Text>
            <Text style={styles.statLabel}>ЗОЛОТО</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="sword-cross" size={26} color={Colors.accent.violet} />
            <Text style={styles.statValue}>{user?.sessions_count || 0}</Text>
            <Text style={styles.statLabel}>СЕССИЙ</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="bookmark-multiple" size={26} color={Colors.status.success} />
            <Text style={styles.statValue}>{user?.active_bookings || 0}</Text>
            <Text style={styles.statLabel}>ЗАПИСЕЙ</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="clock-outline" size={26} color={Colors.accent.goldLight} />
            <Text style={styles.statValue}>{Math.round(user?.prepaid_hours || 0)}</Text>
            <Text style={styles.statLabel}>ЧАСОВ</Text>
          </View>
        </Animated.View>

        {/* Progress bar */}
        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>До {user?.next_status_emoji} {user?.next_status_name}</Text>
            <Text style={styles.progressPercent}>{Math.round(user?.progress_percent || 0)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${user?.progress_percent || 0}%` }]} />
          </View>
          <Text style={styles.progressHint}>
            Ещё {Math.max(0, (user?.next_status_games || 3) - (user?.sessions_count || 0))} сессий до {user?.next_status_name}
          </Text>
        </Animated.View>

        {/* Achievements */}
        {user?.achievements && user.achievements.length > 0 && (
          <Animated.View entering={FadeInDown.delay(400).duration(500)}>
            <Text style={styles.sectionTitle}>Достижения</Text>
            <View style={styles.achievementsRow}>
              {user.achievements.map((a: any, i: number) => (
                <View key={i} style={styles.achievementBadge}>
                  <Text style={styles.achievementEmoji}>{a.emoji}</Text>
                  <Text style={styles.achievementName}>{a.name}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Masters section */}
        <Animated.View entering={FadeInDown.delay(500).duration(500)}>
          <TouchableOpacity testID="articles-btn" style={styles.menuItem} onPress={() => router.push('/articles')}>
            <MaterialCommunityIcons name="book-open-variant" size={22} color={Colors.accent.gold} />
            <Text style={styles.menuItemText}>Статьи и гайды</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.text.muted} />
          </TouchableOpacity>
          <TouchableOpacity testID="masters-btn" style={styles.menuItem} onPress={() => setShowMasters(true)}>
            <MaterialCommunityIcons name="account-star" size={22} color={Colors.accent.gold} />
            <Text style={styles.menuItemText}>Мастера Гильдии</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.text.muted} />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* Masters Modal */}
      <Modal visible={showMasters} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Мастера Гильдии</Text>
              <TouchableOpacity testID="close-masters" onPress={() => setShowMasters(false)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Наши ведущие проведут вас через лучшие приключения</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {masters.map((m, i) => (
                <View key={m.id} style={styles.masterCard}>
                  <View style={styles.masterAvatar}>
                    <MaterialCommunityIcons name="sword-cross" size={32} color={Colors.accent.gold} />
                  </View>
                  <Text style={styles.masterName}>{m.full_name}</Text>
                  <Text style={styles.masterStyle}>{m.style}</Text>
                  <View style={styles.masterStats}>
                    <Text style={styles.masterStat}>{m.total_sessions} сессий</Text>
                    <Text style={styles.masterStat}>★ {m.avg_rating?.toFixed(1) || '—'}</Text>
                    <Text style={styles.masterStat}>{m.experience_years} лет</Text>
                  </View>
                  <View style={styles.systemsRow}>
                    {m.systems?.map((s: string, j: number) => (
                      <View key={j} style={styles.systemTag}>
                        <Text style={styles.systemTagText}>{s}</Text>
                      </View>
                    ))}
                  </View>
                  {m.bio && <Text style={styles.masterBio} numberOfLines={3}>{m.bio}</Text>}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.main, paddingHorizontal: Spacing.m },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.m },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontFamily: Fonts.heading, fontSize: FontSizes.h2, color: Colors.accent.gold, letterSpacing: 1 },
  logoutBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.bg.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border.default },
  profileCard: { backgroundColor: Colors.bg.card, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(201,169,110,0.2)', padding: 24, alignItems: 'center', marginBottom: Spacing.m },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.bg.main, borderWidth: 2, borderColor: Colors.accent.gold, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatarEditBadge: { position: 'absolute', top: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(124,107,196,0.9)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.bg.card },
  statusBadge: { position: 'absolute', bottom: -4, right: -4, width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.bg.card, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.bg.main },
  statusEmoji: { fontSize: 14 },
  profileName: { fontFamily: Fonts.heading, fontSize: FontSizes.h2, color: Colors.text.highlight },
  profileEmail: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.muted, marginTop: 2 },
  statusChip: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(201,169,110,0.12)' },
  statusChipText: { fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.small, color: Colors.accent.goldLight },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.m },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border.default, gap: 4 },
  statValue: { fontFamily: Fonts.heading, fontSize: FontSizes.h2, color: Colors.text.highlight },
  statLabel: { fontFamily: Fonts.body, fontSize: 10, color: Colors.text.muted, letterSpacing: 1 },
  progressSection: { backgroundColor: Colors.bg.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border.default, marginBottom: Spacing.m },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.primary },
  progressPercent: { fontFamily: Fonts.heading, fontSize: FontSizes.caption, color: Colors.accent.gold },
  progressBar: { height: 8, backgroundColor: Colors.bg.main, borderRadius: 4, marginBottom: 8 },
  progressFill: { height: 8, backgroundColor: Colors.accent.gold, borderRadius: 4 },
  progressHint: { fontFamily: Fonts.body, fontSize: FontSizes.small, color: Colors.text.muted, textAlign: 'right' },
  sectionTitle: { fontFamily: Fonts.heading, fontSize: FontSizes.h3, color: Colors.text.highlight, marginBottom: 12 },
  achievementsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.m },
  achievementBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.bg.card, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border.default },
  achievementEmoji: { fontSize: 18 },
  achievementName: { fontFamily: Fonts.body, fontSize: FontSizes.small, color: Colors.text.primary },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border.default, gap: 12, marginBottom: 8 },
  menuItemText: { flex: 1, fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.body, color: Colors.text.highlight },
  // Masters modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.bg.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle: { fontFamily: Fonts.heading, fontSize: FontSizes.h2, color: Colors.accent.gold },
  modalSubtitle: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.muted, marginBottom: 16 },
  modalCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bg.main, alignItems: 'center', justifyContent: 'center' },
  masterCard: { backgroundColor: Colors.bg.main, borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: Colors.border.default, marginBottom: 12 },
  masterAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.accent.gold, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  masterName: { fontFamily: Fonts.heading, fontSize: FontSizes.h3, color: Colors.text.highlight, letterSpacing: 1 },
  masterStyle: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.muted, fontStyle: 'italic', marginTop: 4 },
  masterStats: { flexDirection: 'row', gap: 16, marginTop: 10 },
  masterStat: { fontFamily: Fonts.body, fontSize: FontSizes.small, color: Colors.text.primary },
  systemsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  systemTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border.default },
  systemTagText: { fontFamily: Fonts.body, fontSize: 11, color: Colors.text.muted },
  masterBio: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.muted, textAlign: 'center', marginTop: 10, lineHeight: 20 },
});
