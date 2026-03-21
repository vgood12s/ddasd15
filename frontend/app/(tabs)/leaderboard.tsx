import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, Fonts, FontSizes, Spacing } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useApi } from '../../src/utils/api';

const TABS = [
  { key: 'sessions', label: 'Сессии', icon: 'sword-cross' },
  { key: 'gold', label: 'Золото', icon: 'gold' },
  { key: 'achievements', label: 'Достижения', icon: 'trophy' },
];

const RANK_ICONS: Record<number, { icon: string; color: string }> = {
  1: { icon: 'crown', color: '#FFD700' },
  2: { icon: 'medal', color: '#C0C0C0' },
  3: { icon: 'medal', color: '#CD7F32' },
};

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const api = useApi();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('sessions');

  const load = useCallback(async (sortBy: string) => {
    try {
      const d = await api.get(`/api/leaderboard?sort_by=${sortBy}`, token);
      setData(d);
    } catch (e) {}
  }, [token]);

  useEffect(() => { load(tab).finally(() => setLoading(false)); }, [tab]);
  const onRefresh = async () => { setRefreshing(true); await load(tab); setRefreshing(false); };

  const getValue = (item: any) => {
    if (tab === 'sessions') return `${item.sessions_count} сессий`;
    if (tab === 'gold') return `${item.balance} золота`;
    return `${item.achievement_count} наград`;
  };

  if (loading) return <View style={[styles.container, { paddingTop: insets.top }]}><ActivityIndicator size="large" color={Colors.accent.gold} style={{ marginTop: 100 }} /></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="trophy" size={24} color={Colors.accent.gold} />
        <Text style={styles.headerTitle}>Рейтинг Гильдии</Text>
      </View>
      <Text style={styles.headerSubtitle}>Лучшие искатели приключений</Text>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            testID={`leaderboard-tab-${t.key}`}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
            onPress={() => { setLoading(true); setTab(t.key); }}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent.gold} />}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {data.map((item, i) => {
          const isMe = item.id === user?.id;
          const rank = RANK_ICONS[item.rank];
          return (
            <Animated.View key={item.id} entering={FadeInDown.delay(i * 60).duration(400)}>
              <View style={[styles.leaderRow, isMe && styles.leaderRowMe]}>
                {/* Rank */}
                <View style={styles.rankCol}>
                  {rank ? (
                    <MaterialCommunityIcons name={rank.icon as any} size={24} color={rank.color} />
                  ) : (
                    <Text style={styles.rankText}>{item.rank}</Text>
                  )}
                </View>

                {/* Avatar */}
                <View style={[styles.avatar, isMe && styles.avatarMe]}>
                  <MaterialCommunityIcons name="account" size={22} color={isMe ? Colors.accent.gold : Colors.text.muted} />
                </View>

                {/* Info */}
                <View style={styles.leaderInfo}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.leaderName, isMe && styles.leaderNameMe]}>
                      {item.first_name || item.username}
                    </Text>
                    {isMe && <Text style={styles.youBadge}>(вы)</Text>}
                  </View>
                  <Text style={styles.leaderStatus}>{item.status_emoji} {item.status_name}</Text>
                </View>

                {/* Value */}
                <Text style={styles.leaderValue}>{getValue(item)}</Text>
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.main, paddingHorizontal: Spacing.m },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: Spacing.m },
  headerTitle: { fontFamily: Fonts.heading, fontSize: FontSizes.h2, color: Colors.accent.gold, letterSpacing: 1 },
  headerSubtitle: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.muted, marginBottom: Spacing.m, marginTop: 4 },
  tabsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.border.default },
  tabBtnActive: { backgroundColor: Colors.accent.gold, borderColor: Colors.accent.gold },
  tabText: { fontFamily: Fonts.heading, fontSize: FontSizes.caption, color: Colors.text.muted },
  tabTextActive: { color: Colors.bg.main },
  leaderRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14, marginBottom: 8, gap: 12, borderWidth: 1, borderColor: Colors.border.default },
  leaderRowMe: { borderColor: Colors.accent.gold, backgroundColor: 'rgba(201,169,110,0.08)' },
  rankCol: { width: 32, alignItems: 'center' },
  rankText: { fontFamily: Fonts.heading, fontSize: FontSizes.body, color: Colors.text.muted },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bg.main, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border.default },
  avatarMe: { borderColor: Colors.accent.gold },
  leaderInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  leaderName: { fontFamily: Fonts.heading, fontSize: FontSizes.body, color: Colors.text.highlight },
  leaderNameMe: { color: Colors.accent.gold },
  youBadge: { fontFamily: Fonts.body, fontSize: FontSizes.small, color: Colors.accent.gold },
  leaderStatus: { fontFamily: Fonts.body, fontSize: FontSizes.small, color: Colors.text.muted, marginTop: 2 },
  leaderValue: { fontFamily: Fonts.heading, fontSize: FontSizes.caption, color: Colors.text.primary, textAlign: 'right' },
});
