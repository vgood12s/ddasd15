import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, Modal, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, Fonts, FontSizes, Spacing } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useApi } from '../../src/utils/api';
import { getCached, setCache } from '../../src/utils/cache';

const GUILD_BASE_URL = 'https://guildkhv.com';

function formatDate(iso: string) {
  const d = new Date(iso);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${day}.${month}.${year} в ${h}:${m}`;
}

function SpotsBadge({ spots }: { spots: number }) {
  const color = spots > 2 ? Colors.status.success : spots > 0 ? Colors.accent.goldLight : Colors.status.danger;
  const text = spots > 0 ? `${spots} мест` : 'Нет мест';
  return (
    <View style={[styles.spotsBadge, { backgroundColor: color + '20', borderColor: color }]}>
      <Text style={[styles.spotsBadgeText, { color }]}>{text}</Text>
    </View>
  );
}

export default function GamesScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const api = useApi();
  const [games, setGames] = useState<any[]>(getCached('games') || []);
  const [loading, setLoading] = useState(!getCached('games'));
  const [refreshing, setRefreshing] = useState(false);
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [gameDetail, setGameDetail] = useState<any>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const loadGames = useCallback(async () => {
    try {
      const data = await api.get('/api/games', token);
      setGames(data);
      setCache('games', data);
    } catch (e) {}
  }, [token]);

  useEffect(() => { loadGames().finally(() => setLoading(false)); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGames();
    setRefreshing(false);
  };

  const openGame = async (game: any) => {
    setSelectedGame(game);
    try {
      const detail = await api.get(`/api/games/${game.id}`, token);
      setGameDetail(detail);
    } catch (e) {
      setGameDetail(game);
    }
  };

  const bookGame = async () => {
    if (!gameDetail) return;
    setBookingLoading(true);
    try {
      await api.post(`/api/games/${gameDetail.id}/book`, {}, token);
      setShowConfirm(false);
      const detail = await api.get(`/api/games/${gameDetail.id}`, token);
      setGameDetail(detail);
      await loadGames();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBookingLoading(false);
    }
  };

  const cancelBooking = async () => {
    if (!gameDetail) return;
    setBookingLoading(true);
    try {
      await api.del(`/api/games/${gameDetail.id}/book`, token);
      const detail = await api.get(`/api/games/${gameDetail.id}`, token);
      setGameDetail(detail);
      await loadGames();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.accent.gold} style={{ marginTop: 100 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <MaterialCommunityIcons name="fleur-de-lis" size={24} color={Colors.accent.gold} />
        <Text style={styles.headerTitle}>Доступные сессии</Text>
      </View>
      <Text style={styles.headerSubtitle}>Выберите приключение и запишитесь</Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent.gold} />}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {games.map((game, i) => (
          <Animated.View key={game.id} entering={FadeInDown.delay(i * 100).duration(500)}>
            <TouchableOpacity
              testID={`game-card-${i}`}
              style={styles.gameCard}
              onPress={() => openGame(game)}
              activeOpacity={0.85}
            >
              {/* Game Image */}
              {game.image_url ? (
                <View style={styles.gameImageContainer}>
                  <Image 
                    source={{ uri: game.image_url.startsWith('http') ? game.image_url : `${GUILD_BASE_URL}${game.image_url}` }} 
                    style={styles.gameImage} 
                    resizeMode="cover" 
                  />
                  <View style={styles.gameImageOverlay} />
                  <SpotsBadge spots={game.spots_left} />
                </View>
              ) : (
                <View style={styles.gameImagePlaceholder}>
                  <MaterialCommunityIcons name="sword-cross" size={40} color={Colors.accent.gold} />
                  <SpotsBadge spots={game.spots_left} />
                </View>
              )}

              <View style={styles.gameInfo}>
                <Text style={styles.gameTitle} numberOfLines={1}>{game.title}</Text>
                <Text style={styles.gameDesc} numberOfLines={2}>{game.description}</Text>

                <View style={styles.gameDetails}>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="calendar" size={14} color={Colors.accent.gold} />
                    <Text style={styles.detailText}>{formatDate(game.date_time)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color={Colors.accent.gold} />
                    <Text style={styles.detailText}>{game.duration_text}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="account-star" size={14} color={Colors.accent.gold} />
                    <Text style={styles.detailText}>{game.game_master}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="map-marker" size={14} color={Colors.accent.gold} />
                    <Text style={styles.detailText}>{game.location}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="account-group" size={14} color={Colors.accent.gold} />
                    <Text style={styles.detailText}>{game.booked_count}/{game.max_players} записано</Text>
                  </View>
                </View>

                <View style={styles.gameFooter}>
                  <Text style={styles.gamePrice}>{game.hourly_rate} ₽/час</Text>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </ScrollView>

      {/* Game Detail Modal */}
      <Modal visible={!!selectedGame} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <TouchableOpacity testID="close-game-modal" style={styles.modalClose} onPress={() => { setSelectedGame(null); setGameDetail(null); }}>
              <MaterialCommunityIcons name="close" size={24} color={Colors.text.primary} />
            </TouchableOpacity>

            {gameDetail ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalImagePlaceholder}>
                  <MaterialCommunityIcons name="sword-cross" size={60} color={Colors.accent.gold} />
                </View>

                <Text style={styles.modalTitle}>{gameDetail.title}</Text>

                <View style={styles.modalDetails}>
                  <View style={styles.modalDetailRow}>
                    <MaterialCommunityIcons name="calendar" size={18} color={Colors.accent.gold} />
                    <Text style={styles.modalDetailText}>{formatDate(gameDetail.date_time)}</Text>
                  </View>
                  <View style={styles.modalDetailRow}>
                    <MaterialCommunityIcons name="clock-outline" size={18} color={Colors.accent.gold} />
                    <Text style={styles.modalDetailText}>{gameDetail.duration_text}</Text>
                  </View>
                  <View style={styles.modalDetailRow}>
                    <MaterialCommunityIcons name="account-star" size={18} color={Colors.accent.gold} />
                    <Text style={styles.modalDetailText}>{gameDetail.game_master}</Text>
                  </View>
                  <View style={styles.modalDetailRow}>
                    <MaterialCommunityIcons name="map-marker" size={18} color={Colors.accent.gold} />
                    <Text style={styles.modalDetailText}>{gameDetail.location}</Text>
                  </View>
                </View>

                {/* Spots progress */}
                <View style={styles.spotsSection}>
                  <Text style={styles.spotsText}>{gameDetail.booked_count}/{gameDetail.max_players} записано</Text>
                  <View style={styles.spotsBar}>
                    <View style={[styles.spotsBarFill, { width: `${(gameDetail.booked_count / gameDetail.max_players) * 100}%` }]} />
                  </View>
                </View>

                <Text style={styles.modalDesc}>{gameDetail.description}</Text>

                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Стоимость:</Text>
                  <Text style={styles.priceValue}>{gameDetail.hourly_rate} ₽/час = {gameDetail.hourly_rate * gameDetail.duration_hours} ₽</Text>
                </View>

                {/* Participants */}
                {gameDetail.participants?.length > 0 && (
                  <View style={styles.participantsSection}>
                    <Text style={styles.participantsTitle}>Участники ({gameDetail.participants.length})</Text>
                    {gameDetail.participants.map((p: any, i: number) => (
                      <View key={i} style={styles.participantRow}>
                        <View style={styles.participantAvatar}>
                          <MaterialCommunityIcons name="account" size={20} color={Colors.accent.gold} />
                        </View>
                        <Text style={styles.participantName}>{p.first_name || p.username}</Text>
                        <Text style={styles.participantStatus}>{p.status_emoji} {p.status_name}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Book/Cancel */}
                {gameDetail.is_booked ? (
                  <View style={styles.bookingActions}>
                    <View style={styles.bookedBadge}>
                      <MaterialCommunityIcons name="check-circle" size={20} color={Colors.status.success} />
                      <Text style={styles.bookedText}>Вы записаны</Text>
                    </View>
                    <TouchableOpacity testID="cancel-booking-btn" style={styles.cancelBtn} onPress={cancelBooking} disabled={bookingLoading}>
                      {bookingLoading ? <ActivityIndicator color={Colors.status.danger} /> : <Text style={styles.cancelBtnText}>Отменить</Text>}
                    </TouchableOpacity>
                  </View>
                ) : gameDetail.spots_left > 0 ? (
                  <TouchableOpacity testID="book-game-btn" style={styles.bookBtn} onPress={() => setShowConfirm(true)}>
                    <MaterialCommunityIcons name="sword" size={20} color={Colors.bg.main} />
                    <Text style={styles.bookBtnText}>Записаться</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.fullBadge}>
                    <Text style={styles.fullBadgeText}>Все места заняты</Text>
                  </View>
                )}
              </ScrollView>
            ) : (
              <ActivityIndicator size="large" color={Colors.accent.gold} style={{ marginTop: 40 }} />
            )}
          </View>
        </View>
      </Modal>

      {/* Confirm Booking Modal */}
      <Modal visible={showConfirm} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmContent}>
            <MaterialCommunityIcons name="sword-cross" size={40} color={Colors.accent.gold} style={{ alignSelf: 'center', marginBottom: 16 }} />
            <Text style={styles.confirmTitle}>Подтвердите запись</Text>
            {gameDetail && (
              <>
                <Text style={styles.confirmDetail}>{gameDetail.title}</Text>
                <Text style={styles.confirmDetail}>{formatDate(gameDetail.date_time)}</Text>
                <Text style={styles.confirmDetail}>{gameDetail.duration_text} • {gameDetail.game_master}</Text>
                <Text style={styles.confirmDetail}>{gameDetail.location}</Text>
                <Text style={styles.confirmPrice}>{gameDetail.hourly_rate * gameDetail.duration_hours} ₽</Text>
              </>
            )}
            <View style={styles.confirmButtons}>
              <TouchableOpacity testID="confirm-cancel-btn" style={styles.confirmCancelBtn} onPress={() => setShowConfirm(false)}>
                <Text style={styles.confirmCancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="confirm-book-btn" style={styles.confirmBookBtn} onPress={bookGame} disabled={bookingLoading}>
                {bookingLoading ? <ActivityIndicator color={Colors.bg.main} /> : <Text style={styles.confirmBookText}>Записаться</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.main, paddingHorizontal: Spacing.m },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: Spacing.m },
  headerTitle: { fontFamily: Fonts.heading, fontSize: FontSizes.h2, color: Colors.accent.gold, letterSpacing: 1 },
  headerSubtitle: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.muted, marginBottom: Spacing.m, marginTop: 4 },
  gameCard: { backgroundColor: Colors.bg.card, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(201,169,110,0.15)', marginBottom: Spacing.m, overflow: 'hidden' },
  gameImageContainer: { height: 160, position: 'relative' },
  gameImage: { width: '100%', height: 160 },
  gameImageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, backgroundColor: 'transparent', backgroundImage: 'linear-gradient(transparent, rgba(14,12,21,0.8))' },
  gameImagePlaceholder: { height: 160, backgroundColor: '#1a1828', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  gameInfo: { padding: Spacing.m },
  gameTitle: { fontFamily: Fonts.heading, fontSize: FontSizes.h3, color: Colors.text.highlight, marginBottom: 4 },
  gameDesc: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.muted, marginBottom: Spacing.s, lineHeight: 20 },
  gameDetails: { gap: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontFamily: Fonts.body, fontSize: FontSizes.small, color: Colors.text.primary },
  gameFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.s, paddingTop: Spacing.s, borderTopWidth: 1, borderTopColor: Colors.border.default },
  gamePrice: { fontFamily: Fonts.heading, fontSize: FontSizes.body, color: Colors.accent.gold },
  spotsBadge: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  spotsBadgeText: { fontFamily: Fonts.bodySemiBold, fontSize: 12 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.bg.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, maxHeight: '90%' },
  modalClose: { alignSelf: 'flex-end', width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bg.main, alignItems: 'center', justifyContent: 'center' },
  modalImagePlaceholder: { height: 140, backgroundColor: Colors.bg.main, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: Fonts.heading, fontSize: FontSizes.h2, color: Colors.accent.gold, marginBottom: 16 },
  modalDetails: { gap: 8, marginBottom: 16 },
  modalDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalDetailText: { fontFamily: Fonts.body, fontSize: FontSizes.body, color: Colors.text.primary },
  spotsSection: { marginBottom: 16 },
  spotsText: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.muted, marginBottom: 6 },
  spotsBar: { height: 6, backgroundColor: Colors.bg.main, borderRadius: 3 },
  spotsBarFill: { height: 6, backgroundColor: Colors.accent.gold, borderRadius: 3 },
  modalDesc: { fontFamily: Fonts.body, fontSize: FontSizes.body, color: Colors.text.primary, lineHeight: 24, marginBottom: 16 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border.default, marginBottom: 16 },
  priceLabel: { fontFamily: Fonts.body, fontSize: FontSizes.body, color: Colors.text.muted },
  priceValue: { fontFamily: Fonts.heading, fontSize: FontSizes.body, color: Colors.accent.gold },
  participantsSection: { marginBottom: 16 },
  participantsTitle: { fontFamily: Fonts.heading, fontSize: FontSizes.body, color: Colors.text.highlight, marginBottom: 8 },
  participantRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  participantAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.bg.main, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.accent.gold },
  participantName: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.primary, flex: 1 },
  participantStatus: { fontFamily: Fonts.body, fontSize: FontSizes.small, color: Colors.text.muted },
  bookingActions: { gap: 12, marginBottom: 20 },
  bookedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, backgroundColor: 'rgba(78,173,106,0.15)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(78,173,106,0.3)' },
  bookedText: { fontFamily: Fonts.heading, fontSize: FontSizes.body, color: Colors.status.success },
  cancelBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.status.danger },
  cancelBtnText: { fontFamily: Fonts.heading, fontSize: FontSizes.body, color: Colors.status.danger },
  bookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 12, backgroundColor: Colors.accent.gold, marginBottom: 20 },
  bookBtnText: { fontFamily: Fonts.heading, fontSize: 18, color: Colors.bg.main },
  fullBadge: { paddingVertical: 14, alignItems: 'center', borderRadius: 12, backgroundColor: 'rgba(199,72,72,0.15)', borderWidth: 1, borderColor: 'rgba(199,72,72,0.3)', marginBottom: 20 },
  fullBadgeText: { fontFamily: Fonts.heading, fontSize: FontSizes.body, color: Colors.status.danger },
  // Confirm modal
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  confirmContent: { backgroundColor: Colors.bg.card, borderRadius: 20, padding: 24, width: '100%', borderWidth: 1, borderColor: 'rgba(201,169,110,0.2)' },
  confirmTitle: { fontFamily: Fonts.heading, fontSize: FontSizes.h3, color: Colors.accent.gold, textAlign: 'center', marginBottom: 16 },
  confirmDetail: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.muted, textAlign: 'center', marginBottom: 4 },
  confirmPrice: { fontFamily: Fonts.heading, fontSize: FontSizes.h2, color: Colors.accent.gold, textAlign: 'center', marginTop: 12, marginBottom: 20 },
  confirmButtons: { flexDirection: 'row', gap: 12 },
  confirmCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border.default },
  confirmCancelText: { fontFamily: Fonts.heading, fontSize: FontSizes.body, color: Colors.text.muted },
  confirmBookBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: Colors.accent.gold },
  confirmBookText: { fontFamily: Fonts.heading, fontSize: FontSizes.body, color: Colors.bg.main },
});
