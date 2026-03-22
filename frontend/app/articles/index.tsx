import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, Image, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Fonts, FontSizes, Spacing } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useApi } from '../../src/utils/api';
import { getCached, setCache } from '../../src/utils/cache';

const GUILD_BASE_URL = 'https://guildkhv.com';
const { width } = Dimensions.get('window');

const CATEGORIES = [
  { key: 'all', label: 'Все', icon: 'book-open-variant' },
  { key: 'guide', label: 'Гайды', icon: 'compass' },
  { key: 'blog', label: 'Блог', icon: 'pencil' },
  { key: 'report', label: 'Отчёты', icon: 'file-document' },
];

const CATEGORY_LABELS: Record<string, string> = {
  guide: 'Гайд',
  blog: 'Блог',
  report: 'Отчёт',
};

function formatDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function ArticlesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const api = useApi();
  const [articles, setArticles] = useState<any[]>(getCached('articles_all') || []);
  const [loading, setLoading] = useState(!getCached('articles_all'));
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState('all');
  const currentCatRef = useRef('all');

  useEffect(() => {
    currentCatRef.current = category;
    const cacheKey = `articles_${category}`;
    const cached = getCached(cacheKey);
    if (cached) {
      setArticles(cached);
      setLoading(false);
    } else {
      setArticles([]);
    }
    const reqCat = category;
    (async () => {
      try {
        const params = reqCat !== 'all' ? `?category=${reqCat}` : '';
        const d = await api.get(`/api/articles${params}`, token);
        setCache(cacheKey, d);
        if (currentCatRef.current === reqCat) {
          setArticles(d);
          setLoading(false);
        }
      } catch (e) {
        if (currentCatRef.current === reqCat) setLoading(false);
      }
    })();
  }, [category]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const params = category !== 'all' ? `?category=${category}` : '';
      const d = await api.get(`/api/articles${params}`, token);
      setArticles(d);
      setCache(`articles_${category}`, d);
    } catch (e) {}
    setRefreshing(false);
  };

  const resolveUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${GUILD_BASE_URL}${url}`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Статьи и гайды</Text>
          <Text style={styles.headerSubtitle}>Полезное для искателей приключений</Text>
        </View>
      </View>

      {/* Category Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContainer}>
        {CATEGORIES.map(c => (
          <TouchableOpacity
            key={c.key}
            style={[styles.tabBtn, category === c.key && styles.tabBtnActive]}
            onPress={() => setCategory(c.key)}
          >
            <MaterialCommunityIcons name={c.icon as any} size={16} color={category === c.key ? Colors.bg.main : Colors.text.muted} />
            <Text style={[styles.tabText, category === c.key && styles.tabTextActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent.gold} />}
        contentContainerStyle={{ paddingHorizontal: Spacing.m, paddingBottom: insets.bottom + 20 }}
      >
        {articles.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="book-open-page-variant" size={48} color={Colors.text.muted} />
            <Text style={styles.emptyTitle}>Пока нет статей</Text>
            <Text style={styles.emptyText}>Статьи и гайды появятся здесь</Text>
          </View>
        )}

        {articles.map((article, i) => {
          const coverUrl = resolveUrl(article.cover_image);
          return (
            <TouchableOpacity
              key={article.id}
              style={styles.articleCard}
              onPress={() => router.push(`/articles/${article.slug}`)}
              activeOpacity={0.85}
            >
              {coverUrl ? (
                <Image source={{ uri: coverUrl }} style={styles.articleCover} resizeMode="cover" />
              ) : (
                <View style={styles.articleCoverPlaceholder}>
                  <MaterialCommunityIcons
                    name={article.category === 'guide' ? 'compass' : article.category === 'report' ? 'file-document' : 'pencil'}
                    size={32}
                    color={Colors.accent.gold}
                  />
                </View>
              )}
              <View style={styles.articleContent}>
                <View style={styles.articleMeta}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{CATEGORY_LABELS[article.category] || article.category}</Text>
                  </View>
                  <Text style={styles.articleDate}>{formatDate(article.published_at)}</Text>
                </View>
                <Text style={styles.articleTitle} numberOfLines={2}>{article.title}</Text>
                {article.excerpt ? (
                  <Text style={styles.articleExcerpt} numberOfLines={3}>{article.excerpt}</Text>
                ) : null}
                {article.author ? (
                  <View style={styles.authorRow}>
                    <MaterialCommunityIcons name="account-edit" size={14} color={Colors.text.muted} />
                    <Text style={styles.authorText}>{article.author}</Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.main },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.m, paddingVertical: 12, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.bg.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.heading, fontSize: FontSizes.h2, color: Colors.accent.gold, letterSpacing: 1 },
  headerSubtitle: { fontFamily: Fonts.body, fontSize: FontSizes.small, color: Colors.text.muted, marginTop: 2 },
  tabsScroll: { maxHeight: 48, marginBottom: 12 },
  tabsContainer: { paddingHorizontal: Spacing.m, gap: 8 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.border.default },
  tabBtnActive: { backgroundColor: Colors.accent.gold, borderColor: Colors.accent.gold },
  tabText: { fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.small, color: Colors.text.muted },
  tabTextActive: { color: Colors.bg.main },
  articleCard: { backgroundColor: Colors.bg.card, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(201,169,110,0.15)', marginBottom: 16 },
  articleCover: { width: '100%', height: 160 },
  articleCoverPlaceholder: { width: '100%', height: 120, backgroundColor: '#1a1828', alignItems: 'center', justifyContent: 'center' },
  articleContent: { padding: 16, gap: 8 },
  articleMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(201,169,110,0.15)' },
  categoryText: { fontFamily: Fonts.bodySemiBold, fontSize: 11, color: Colors.accent.gold },
  articleDate: { fontFamily: Fonts.body, fontSize: 11, color: Colors.text.muted },
  articleTitle: { fontFamily: Fonts.heading, fontSize: FontSizes.h3, color: Colors.text.highlight, lineHeight: 24 },
  articleExcerpt: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.muted, lineHeight: 20 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  authorText: { fontFamily: Fonts.body, fontSize: FontSizes.small, color: Colors.text.muted },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontFamily: Fonts.heading, fontSize: FontSizes.h3, color: Colors.text.primary },
  emptyText: { fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.muted },
});
