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

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

const FILTERS = [
  { key: null, label: 'Все' },
  { key: 'income', label: 'Начисления' },
  { key: 'expense', label: 'Списания' },
  { key: 'achievement', label: 'Награды' },
];

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const api = useApi();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);

  const load = useCallback(async (f?: string | null) => {
    try {
      const params = f ? `?type=${f}` : '';
      const d = await api.get(`/api/wallet${params}`, token);
      setData(d);
    } catch (e) {}
  }, [token]);

  useEffect(() => { load(filter).finally(() => setLoading(false)); }, [filter]);
  const onRefresh = async () => { setRefreshing(true); await load(filter); setRefreshing(false); };

  if (loading) return <View style={[styles.container, { paddingTop: insets.top }]}><ActivityIndicator size="large" color={Colors.accent.gold} style={{ marginTop: 100 }} /></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent.gold} />}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Balance Card */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>ВАШ БАЛАНС</Text>
          <Text style={styles.balanceValue}>{Math.round(data?.balance || 0)}</Text>
          <Text style={styles.statusText}>{data?.status_emoji} {data?.status_name} · кэшбэк {Math.round(data?.cashback_rate || 0)}%</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: Colors.status.success }]}>+{Math.round(data?.total_received || 0)}</Text>
              <Text style={styles.statLabel}>ВСЕГО ПОЛУЧЕНО</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: Colors.status.danger }]}>-{Math.round(data?.total_spent || 0)}</Text>
              <Text style={styles.statLabel}>ВСЕГО ПОТРАЧЕНО</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{Math.round(data?.prepaid_hours || 0)}</Text>
              <Text style={styles.statLabel}>ЧАСОВ АБОНЕМЕНТА</Text>
            </View>
          </View>
        </Animated.View>

        {/* Transaction History */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>История операций</Text>
            <Text style={styles.historyCount}>{data?.total || 0} записей</Text>
          </View>

          {/* Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersRow}>
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f.key || 'all'}
                testID={`filter-${f.key || 'all'}`}
                style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Transactions */}
          {data?.transactions?.length > 0 ? data.transactions.map((tx: any, i: number) => (
            <View key={tx.id} style={styles.txRow}>
              <View style={[styles.txIcon, tx.amount > 0 ? styles.txIconIncome : styles.txIconExpense]}>
                <MaterialCommunityIcons
                  name={tx.amount > 0 ? 'arrow-down' : tx.type === 'achievement' ? 'trophy' : 'arrow-up'}
                  size={18}
                  color={tx.amount > 0 ? Colors.status.success : Colors.status.danger}
                />
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
                <Text style={styles.txDate}>{formatDate(tx.created_at)}</Text>
              </View>
              <View style={styles.txAmountCol}>
                <Text style={[styles.txAmount, tx.amount > 0 ? styles.txAmountPos : styles.txAmountNeg]}>
                  {tx.amount > 0 ? '+' : ''}{Math.round(tx.amount)}
                </Text>
                <Text style={styles.txBalance}>{Math.round(tx.balance_after)}</Text>
              </View>
            </View>
          )) : (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>Нет транзакций</Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.main, paddingHorizontal: Spacing.m },
  balanceCard: { backgroundColor: Colors.bg.card, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(201,169,110,0.2)', padding: 24, alignItems: 'center', marginTop: Spacing.m },
  balanceLabel: { fontFamily: Fonts.heading, fontSize: FontSizes.small, color: Colors.text.muted, letterSpacing: 2 },
  balanceValue: { fontFamily: Fonts.heading, fontSize: 56, color: Colors.accent.gold, marginVertical: 4 },
  statusText: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.muted, marginBottom: 20 },
  statsRow: { flexDirection: 'row', width: '100%', gap: 8 },
  statItem: { flex: 1, backgroundColor: Colors.bg.main, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border.default },
  statValue: { fontFamily: Fonts.heading, fontSize: FontSizes.h3, color: Colors.text.highlight },
  statLabel: { fontFamily: Fonts.body, fontSize: 9, color: Colors.text.muted, letterSpacing: 0.5, marginTop: 4, textAlign: 'center' },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 12 },
  historyTitle: { fontFamily: Fonts.heading, fontSize: FontSizes.h3, color: Colors.text.highlight },
  historyCount: { fontFamily: Fonts.body, fontSize: FontSizes.small, color: Colors.text.muted },
  filtersRow: { marginBottom: 16 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.border.default, marginRight: 8 },
  filterBtnActive: { backgroundColor: Colors.accent.gold, borderColor: Colors.accent.gold },
  filterText: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.muted },
  filterTextActive: { color: Colors.bg.main },
  txRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14, marginBottom: 8, gap: 12, borderWidth: 1, borderColor: Colors.border.default },
  txIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  txIconIncome: { backgroundColor: 'rgba(78,173,106,0.15)' },
  txIconExpense: { backgroundColor: 'rgba(199,72,72,0.15)' },
  txInfo: { flex: 1 },
  txDesc: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.primary },
  txDate: { fontFamily: Fonts.body, fontSize: 11, color: Colors.text.muted, marginTop: 2 },
  txAmountCol: { alignItems: 'flex-end' },
  txAmount: { fontFamily: Fonts.heading, fontSize: FontSizes.body },
  txAmountPos: { color: Colors.status.success },
  txAmountNeg: { color: Colors.status.danger },
  txBalance: { fontFamily: Fonts.body, fontSize: 11, color: Colors.text.muted },
  emptySection: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontFamily: Fonts.body, fontSize: FontSizes.body, color: Colors.text.muted },
});
