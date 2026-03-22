import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, Fonts, FontSizes, Spacing } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useApi } from '../../src/utils/api';
import { getCached, setCache } from '../../src/utils/cache';

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()} в ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const api = useApi();
  const [data, setData] = useState<any>(getCached('bookings') || null);
  const [loading, setLoading] = useState(!getCached('bookings'));
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.get('/api/bookings', token);
      setData(d);
      setCache('bookings', d);
    } catch (e) {}
  }, [token]);

  // Refresh on tab focus
  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const cancelBooking = async (gameId: string) => {
    try {
      await api.del(`/api/games/${gameId}/book`, token);
      await load();
    } catch (e: any) { alert(e.message); }
  };

  if (loading) return <View style={[styles.container, { paddingTop: insets.top }]}><ActivityIndicator size="large" color={Colors.accent.gold} style={{ marginTop: 100 }} /></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="bookmark-multiple" size={24} color={Colors.accent.gold} />
        <Text style={styles.headerTitle}>Мои записи</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent.gold} />}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Active */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Активные</Text>
            <View style={styles.countBadge}><Text style={styles.countText}>{data?.active?.length || 0}</Text></View>
          </View>
          {data?.active?.length > 0 ? data.active.map((b: any, i: number) => (
            <View key={b.id} style={styles.bookingCard}>
              <View style={styles.bookingTop}>
                <View style={styles.bookingImagePlaceholder}>
                  <MaterialCommunityIcons name="sword-cross" size={24} color={Colors.accent.gold} />
                </View>
                <View style={styles.bookingInfo}>
                  <Text style={styles.bookingTitle} numberOfLines={1}>{b.game?.title}</Text>
                  <View style={styles.bookingDetail}>
                    <MaterialCommunityIcons name="calendar" size={12} color={Colors.accent.gold} />
                    <Text style={styles.bookingDetailText}>{b.game ? formatDate(b.game.date_time) : ''}</Text>
                  </View>
                  <View style={styles.bookingDetail}>
                    <MaterialCommunityIcons name="account-star" size={12} color={Colors.accent.gold} />
                    <Text style={styles.bookingDetailText}>{b.game?.game_master}</Text>
                  </View>
                  <View style={styles.bookingDetail}>
                    <MaterialCommunityIcons name="map-marker" size={12} color={Colors.accent.gold} />
                    <Text style={styles.bookingDetailText}>{b.game?.location}</Text>
                  </View>
                  <View style={styles.bookingDetail}>
                    <MaterialCommunityIcons name="account-group" size={12} color={Colors.accent.gold} />
                    <Text style={styles.bookingDetailText}>{b.game?.booked_count}/{b.game?.max_players} записано</Text>
                  </View>
                </View>
                <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>Активна</Text></View>
              </View>

              {/* Action buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  testID={`chat-btn-${i}`}
                  style={styles.masterBtn}
                  onPress={() => router.push(`/chat/${b.id}` as any)}
                >
                  <MaterialCommunityIcons name="message-text" size={16} color={Colors.accent.gold} />
                  <Text style={styles.masterBtnText}>Мастеру</Text>
                </TouchableOpacity>
                <TouchableOpacity testID={`cancel-btn-${i}`} style={styles.cancelSmallBtn} onPress={() => cancelBooking(b.game_id)}>
                  <Text style={styles.cancelSmallText}>Отменить</Text>
                </TouchableOpacity>
              </View>
            </View>
          )) : (
            <View style={styles.emptySection}>
              <MaterialCommunityIcons name="bookmark-off-outline" size={40} color={Colors.text.muted} />
              <Text style={styles.emptyText}>Нет активных записей</Text>
              <Text style={styles.emptySubtext}>Запишитесь на игру во вкладке «Сессии»</Text>
            </View>
          )}
        </Animated.View>

        {/* Past */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Прошлые</Text>
            <View style={styles.countBadge}><Text style={styles.countText}>{data?.past?.length || 0}</Text></View>
          </View>
          {data?.past?.length > 0 ? data.past.map((b: any, i: number) => (
            <View key={b.id} style={styles.bookingCard}>
              <View style={styles.bookingTop}>
                <View style={styles.bookingImagePlaceholder}>
                  <MaterialCommunityIcons name="sword-cross" size={24} color={Colors.text.muted} />
                </View>
                <View style={styles.bookingInfo}>
                  <Text style={styles.bookingTitle} numberOfLines={1}>{b.game?.title}</Text>
                  <View style={styles.bookingDetail}>
                    <MaterialCommunityIcons name="calendar" size={12} color={Colors.text.muted} />
                    <Text style={styles.bookingDetailText}>{b.game ? formatDate(b.game.date_time) : ''}</Text>
                  </View>
                  <View style={styles.bookingDetail}>
                    <MaterialCommunityIcons name="account-star" size={12} color={Colors.text.muted} />
                    <Text style={styles.bookingDetailText}>{b.game?.game_master}</Text>
                  </View>
                </View>
                <View style={styles.pastActions}>
                  <View style={[styles.statusBadge, b.status === 'completed' ? styles.completedBadge : styles.cancelledBadge]}>
                    <Text style={[styles.statusBadgeText, b.status === 'completed' ? styles.completedText : styles.cancelledText]}>
                      {b.status === 'completed' ? 'Завершена' : 'Отменена'}
                    </Text>
                  </View>
                  {b.actual_payment > 0 && <Text style={styles.paymentText}>{b.actual_payment} ₽</Text>}
                  {b.is_rated && (
                    <View style={styles.ratedBadge}>
                      <MaterialCommunityIcons name="check" size={14} color={Colors.text.muted} />
                      <Text style={styles.ratedText}>Оценено</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )) : (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>Нет прошлых записей</Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.main, paddingHorizontal: Spacing.m },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: Spacing.m },
  headerTitle: { fontFamily: Fonts.heading, fontSize: FontSizes.h2, color: Colors.accent.gold, letterSpacing: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontFamily: Fonts.heading, fontSize: FontSizes.h3, color: Colors.text.highlight },
  countBadge: { backgroundColor: Colors.accent.violetDark, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countText: { fontFamily: Fonts.body, fontSize: FontSizes.small, color: Colors.text.muted },
  bookingCard: { backgroundColor: Colors.bg.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border.default, padding: 12, marginBottom: 10 },
  bookingTop: { flexDirection: 'row', gap: 10 },
  bookingImagePlaceholder: { width: 56, height: 56, borderRadius: 8, backgroundColor: Colors.bg.main, alignItems: 'center', justifyContent: 'center' },
  bookingInfo: { flex: 1, gap: 2 },
  bookingTitle: { fontFamily: Fonts.heading, fontSize: FontSizes.body, color: Colors.text.highlight, marginBottom: 2 },
  bookingDetail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bookingDetailText: { fontFamily: Fonts.body, fontSize: 11, color: Colors.text.muted },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border.default },
  masterBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, backgroundColor: 'rgba(201,169,110,0.12)', borderWidth: 1, borderColor: 'rgba(201,169,110,0.3)' },
  masterBtnText: { fontFamily: Fonts.heading, fontSize: FontSizes.caption, color: Colors.accent.gold },
  cancelSmallBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: Colors.status.danger },
  cancelSmallText: { fontFamily: Fonts.heading, fontSize: FontSizes.caption, color: Colors.status.danger },
  activeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: Colors.status.success, alignSelf: 'flex-start' },
  activeBadgeText: { fontFamily: Fonts.body, fontSize: 11, color: Colors.status.success },
  pastActions: { alignItems: 'flex-end', gap: 6 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  completedBadge: { borderColor: Colors.status.success },
  cancelledBadge: { borderColor: Colors.text.muted },
  statusBadgeText: { fontFamily: Fonts.body, fontSize: 11 },
  completedText: { color: Colors.status.success },
  cancelledText: { color: Colors.text.muted },
  paymentText: { fontFamily: Fonts.heading, fontSize: FontSizes.caption, color: Colors.text.highlight },
  ratedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratedText: { fontFamily: Fonts.body, fontSize: 11, color: Colors.text.muted },
  emptySection: { paddingVertical: 40, alignItems: 'center', gap: 8 },
  emptyText: { fontFamily: Fonts.heading, fontSize: FontSizes.body, color: Colors.text.muted },
  emptySubtext: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.muted },
});
