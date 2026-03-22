import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, useWindowDimensions, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import RenderHtml from 'react-native-render-html';
import { Colors, Fonts, FontSizes, Spacing } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useApi } from '../../src/utils/api';

const GUILD_BASE_URL = 'https://guildkhv.com';

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

// Web-only iframe renderer
function WebHtmlContent({ html, width }: { html: string; width: number }) {
  const [height, setHeight] = useState(500);
  const fullHtml = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Georgia,serif;color:${Colors.text.primary};background:transparent;font-size:16px;line-height:1.7;overflow-x:hidden;word-wrap:break-word}
h1,h2{color:${Colors.accent.gold};margin:16px 0 10px;font-size:20px}
h3{color:#f0e6d2;margin:12px 0 8px;font-size:18px}
p{margin:8px 0}
strong{color:#f0e6d2}
em{color:${Colors.accent.goldLight}}
a{color:${Colors.accent.gold}}
img{max-width:100%!important;height:auto!important;border-radius:12px;margin:10px 0;display:block}
blockquote{border-left:3px solid ${Colors.accent.gold};padding:12px 14px;margin:14px 0;background:rgba(201,169,110,0.06);border-radius:8px;overflow:hidden}
blockquote img{max-width:100%!important}
ul,ol{margin:10px 0;padding-left:24px}
li{margin:4px 0}
</style></head><body>${html}</body>
<script>
function postH(){parent.postMessage({type:'articleHeight',h:document.body.scrollHeight},'*')}
window.onload=function(){setTimeout(postH,300);setTimeout(postH,1000)};
new MutationObserver(postH).observe(document.body,{childList:true,subtree:true});
</script></html>`;

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'articleHeight' && e.data.h > 100) {
        setHeight(e.data.h + 20);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <iframe
      srcDoc={fullHtml}
      style={{
        width: width,
        height: height,
        border: 'none',
        background: 'transparent',
        overflow: 'hidden',
      }}
      scrolling="no"
      sandbox="allow-scripts allow-same-origin allow-popups"
    />
  );
}

export default function ArticleDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const api = useApi();
  const { width: screenWidth } = useWindowDimensions();
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const contentWidth = screenWidth - Spacing.m * 2;

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get(`/api/articles/${slug}`, token);
        setArticle(data);
      } catch (e) {}
      setLoading(false);
    })();
  }, [slug]);

  const processHtml = (html: string) => {
    return html.replace(/src="\/(?!\/)/g, `src="${GUILD_BASE_URL}/`);
  };

  const htmlStyles = {
    body: { color: Colors.text.primary, fontFamily: Fonts.body, fontSize: 16, lineHeight: 26 },
    h1: { fontFamily: Fonts.heading, color: Colors.accent.gold, fontSize: 24, marginVertical: 12 },
    h2: { fontFamily: Fonts.heading, color: Colors.accent.gold, fontSize: 20, marginVertical: 10 },
    h3: { fontFamily: Fonts.heading, color: Colors.text.highlight, fontSize: 18, marginVertical: 8 },
    p: { marginVertical: 6 },
    strong: { color: Colors.text.highlight },
    em: { color: Colors.accent.goldLight },
    blockquote: { borderLeftWidth: 3, borderLeftColor: Colors.accent.gold, paddingLeft: 14, marginVertical: 12, backgroundColor: 'rgba(201,169,110,0.06)', borderRadius: 8, padding: 12 },
    a: { color: Colors.accent.gold, textDecorationLine: 'underline' as const },
    img: { borderRadius: 12, marginVertical: 8 },
    ul: { marginVertical: 8 },
    ol: { marginVertical: 8 },
    li: { marginVertical: 3 },
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.accent.gold} style={{ marginTop: 100 }} />
      </View>
    );
  }

  if (!article) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="file-alert" size={48} color={Colors.text.muted} />
          <Text style={styles.emptyTitle}>Статья не найдена</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{CATEGORY_LABELS[article.category] || article.category}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: Spacing.m, paddingBottom: insets.bottom + 40 }}
      >
        <Text style={styles.title}>{article.title}</Text>
        <View style={styles.metaRow}>
          {article.author ? (
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="account-edit" size={14} color={Colors.text.muted} />
              <Text style={styles.metaText}>{article.author}</Text>
            </View>
          ) : null}
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="calendar" size={14} color={Colors.text.muted} />
            <Text style={styles.metaText}>{formatDate(article.published_at)}</Text>
          </View>
        </View>
        <View style={styles.divider} />

        {article.content ? (
          Platform.OS === 'web' ? (
            <WebHtmlContent html={processHtml(article.content)} width={contentWidth} />
          ) : (
            <RenderHtml
              contentWidth={contentWidth}
              source={{ html: processHtml(article.content) }}
              tagsStyles={htmlStyles}
              defaultTextProps={{ selectable: true }}
              computeEmbeddedMaxWidth={() => contentWidth - 20}
            />
          )
        ) : (
          <Text style={styles.noContent}>Содержимое статьи пусто</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.main },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.m, paddingVertical: 12, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.bg.card, alignItems: 'center', justifyContent: 'center' },
  categoryBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(201,169,110,0.15)' },
  categoryText: { fontFamily: Fonts.bodySemiBold, fontSize: 12, color: Colors.accent.gold },
  title: { fontFamily: Fonts.heading, fontSize: 22, color: Colors.accent.gold, lineHeight: 30, marginBottom: 12 },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: Fonts.body, fontSize: FontSizes.small, color: Colors.text.muted },
  divider: { height: 1, backgroundColor: Colors.border.default, marginBottom: 20 },
  noContent: { fontFamily: Fonts.body, fontSize: FontSizes.body, color: Colors.text.muted, textAlign: 'center', marginTop: 40 },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontFamily: Fonts.heading, fontSize: FontSizes.h3, color: Colors.text.primary },
});
