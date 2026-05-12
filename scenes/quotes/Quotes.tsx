import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { listQuotes, getTodaysQuote, CachedQuote } from '@/services/database';
import { useTranslation } from '@/i18n';
import { colors } from '@/theme';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Quotes() {
  const { t } = useTranslation();
  const [today, setToday] = useState<CachedQuote | null>(null);
  const [archive, setArchive] = useState<CachedQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [todays, list] = await Promise.all([getTodaysQuote(), listQuotes(30)]);
    setToday(todays);
    setArchive(list.filter(q => q.id !== todays?.id));
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }>
        <Text style={styles.title}>{t.quotes.title}</Text>
        <Text style={styles.subtitle}>{t.quotes.subtitle}</Text>

        {today && (
          <View style={styles.todayCard}>
            <View style={styles.sparkleRow}>
              <Ionicons name="sparkles" size={16} color={colors.accent} />
              <Text style={styles.todayBadge}>{t.quotes.todayBadge} · {formatDate(today.date)}</Text>
            </View>
            <Text style={styles.quote}>“{today.text}”</Text>
            <Text style={styles.author}>— {today.author}</Text>
            <View style={styles.actionsRow}>
              <View style={styles.actionPill}>
                <Ionicons name="bookmark-outline" size={14} color={colors.accent} />
                <Text style={styles.actionText}>{t.quotes.save}</Text>
              </View>
              <View style={styles.actionPill}>
                <Ionicons name="share-outline" size={14} color={colors.accent} />
                <Text style={styles.actionText}>{t.quotes.share}</Text>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>{t.quotes.archive}</Text>

        {archive.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="format-quote-close" size={28} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t.quotes.empty}</Text>
          </View>
        ) : (
          archive.map(q => (
            <View key={q.id} style={styles.archiveCard}>
              <Text style={styles.archiveDate}>{formatDate(q.date)}</Text>
              <Text style={styles.archiveQuote}>“{q.text}”</Text>
              <Text style={styles.archiveAuthor}>— {q.author}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary },
  subtitle: { color: colors.textSecondary, marginTop: 4, marginBottom: 18 },
  todayCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: 24,
    padding: 22,
    shadowColor: colors.accent,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sparkleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  todayBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  quote: {
    fontSize: 20,
    fontStyle: 'italic',
    fontWeight: '500',
    color: colors.textPrimary,
    lineHeight: 28,
  },
  author: {
    marginTop: 10,
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
  },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  actionText: { fontSize: 13, fontWeight: '600', color: colors.accent },
  sectionTitle: {
    marginTop: 28,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  archiveCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
  },
  archiveDate: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  archiveQuote: {
    fontSize: 14,
    fontStyle: 'italic',
    color: colors.textPrimary,
    lineHeight: 20,
  },
  archiveAuthor: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { color: colors.textMuted, fontSize: 13 },
});
