import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, AntDesign } from '@expo/vector-icons';
import {
  CachedQuote,
  ChallengeType,
  WakeStat,
  getStatsSummary,
  getTodaysQuote,
  listRecentStats,
} from '@/services/database';
import { useTranslation, type Translations } from '@/i18n';
import { colors } from '@/theme';

type DayStatus = 'success' | 'fail' | 'today' | 'upcoming';
type DayCell = { label: string; date: number; status: DayStatus; iso: string };

const DAY_KEYS: (keyof Translations['days']['short'])[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function buildWeek(stats: WakeStat[], t: Translations): DayCell[] {
  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7; // Mon=0
  const monday = new Date(today);
  monday.setDate(today.getDate() - dayOfWeek);

  const successByDate = new Map<string, boolean>();
  for (const s of stats) {
    const prev = successByDate.get(s.date);
    successByDate.set(s.date, prev === true ? true : s.success);
  }

  const todayIso = isoDay(today);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = isoDay(d);
    let status: DayStatus = 'upcoming';
    if (iso === todayIso) status = 'today';
    else if (successByDate.has(iso)) status = successByDate.get(iso) ? 'success' : 'fail';
    return { label: t.days.short[DAY_KEYS[i]], date: d.getDate(), status, iso };
  });
}

function challengeLabel(c: ChallengeType | null, t: Translations): string {
  switch (c) {
    case 'qr':
      return t.challengeLabel.qr;
    case 'object':
      return t.challengeLabel.object;
    case 'color':
      return t.challengeLabel.color;
    case 'steps':
      return t.challengeLabel.steps;
    case 'voice':
      return t.challengeLabel.voice;
    default:
      return t.challengeLabel.wakeUp;
  }
}

function relativeDay(iso: string, t: Translations): string {
  const today = new Date();
  const target = new Date(iso);
  const todayIso = isoDay(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (iso === todayIso) return t.streak.today;
  if (iso === isoDay(yesterday)) return t.streak.yesterday;
  return target.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function Streak() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    total: 0,
    successes: 0,
    successRate: 0,
    bestStreak: 0,
    currentStreak: 0,
  });
  const [stats, setStats] = useState<WakeStat[]>([]);
  const [quote, setQuote] = useState<CachedQuote | null>(null);

  const load = useCallback(async () => {
    const [s, recent, q] = await Promise.all([
      getStatsSummary(),
      listRecentStats(20),
      getTodaysQuote(),
    ]);
    setSummary(s);
    setStats(recent);
    setQuote(q);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const week = useMemo(() => buildWeek(stats, t), [stats, t]);
  const weekRatio = `${week.filter(d => d.status === 'success').length} / 7`;

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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t.streak.title}</Text>
        <Text style={styles.subtitle}>{t.streak.subtitle}</Text>

        <View style={styles.streakCard}>
          <View style={styles.flameWrap}>
            <MaterialCommunityIcons name="fire" size={56} color={colors.flame} />
          </View>
          <Text style={styles.streakNumber}>{summary.currentStreak}</Text>
          <Text style={styles.streakLabel}>{t.streak.dayStreak}</Text>
          <Text style={styles.streakHint}>
            {summary.bestStreak > summary.currentStreak
              ? t.streak.beatRecord(summary.bestStreak)
              : t.streak.newPersonalBest}
          </Text>
        </View>

        <View style={styles.weekCard}>
          <View style={styles.weekHeader}>
            <Text style={styles.weekTitle}>{t.streak.thisWeek}</Text>
            <Text style={styles.weekRatio}>{weekRatio}</Text>
          </View>
          <View style={styles.weekRow}>
            {week.map(d => (
              <View key={d.iso} style={styles.dayWrap}>
                <Text style={styles.dayName}>{d.label}</Text>
                <View style={[styles.dayDot, dotStyle(d.status)]}>
                  {d.status === 'success' && (
                    <AntDesign name="check" size={14} color={colors.white} />
                  )}
                  {d.status === 'fail' && <AntDesign name="close" size={14} color={colors.white} />}
                  {d.status === 'today' && <View style={styles.todayInner} />}
                </View>
                <Text style={styles.dayDate}>{d.date}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatTile
            icon={<Ionicons name="trophy-outline" size={20} color={colors.warning} />}
            tint={colors.warningSoft}
            label={t.streak.bestStreak}
            value={String(summary.bestStreak)}
          />
          <StatTile
            icon={<Ionicons name="sunny-outline" size={20} color={colors.flame} />}
            tint={colors.flameSoft}
            label={t.streak.wakeUps}
            value={String(summary.total)}
          />
          <StatTile
            icon={
              <MaterialCommunityIcons
                name="check-circle-outline"
                size={20}
                color={colors.success}
              />
            }
            tint={colors.successSoft}
            label={t.streak.successRate}
            value={`${summary.successRate}%`}
          />
        </View>

        {quote && (
          <View style={styles.quoteCard}>
            <Ionicons name="sparkles" size={18} color={colors.accent} />
            <Text style={styles.quote}>“{quote.text}”</Text>
            <Text style={styles.quoteAuthor}>— {quote.author}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>{t.streak.recentWakeUps}</Text>
        {stats.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="alarm-outline" size={26} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t.streak.empty}</Text>
          </View>
        ) : (
          <View style={styles.historyCard}>
            {stats.slice(0, 6).map((h, i, arr) => (
              <View
                key={h.id}
                style={[styles.historyRow, i === arr.length - 1 && styles.historyRowLast]}>
                <View
                  style={[
                    styles.historyIcon,
                    { backgroundColor: h.success ? colors.successSoft : colors.flameSoft },
                  ]}>
                  <Ionicons
                    name={h.success ? 'checkmark' : 'close'}
                    size={16}
                    color={h.success ? colors.success : colors.flame}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyTitle}>{relativeDay(h.date, t)}</Text>
                  <Text style={styles.historySub}>{challengeLabel(h.challengeType, t)}</Text>
                </View>
                <Text style={styles.historyTime}>{h.wakeTime}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatTile({
  icon,
  tint,
  label,
  value,
}: {
  icon: React.ReactNode;
  tint: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statIcon, { backgroundColor: tint }]}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function dotStyle(status: DayStatus) {
  if (status === 'success') return { backgroundColor: colors.accent };
  if (status === 'fail') return { backgroundColor: colors.flame };
  if (status === 'today')
    return {
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.accent,
    };
  return { backgroundColor: colors.border };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary },
  subtitle: { color: colors.textSecondary, marginTop: 4, marginBottom: 16 },
  streakCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingVertical: 28,
    alignItems: 'center',
    shadowColor: colors.flame,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  flameWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.flameSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  streakNumber: {
    fontSize: 56,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -2,
  },
  streakLabel: { fontSize: 16, color: colors.textSecondary, marginTop: -4 },
  streakHint: {
    marginTop: 10,
    fontSize: 12,
    color: colors.flame,
    fontWeight: '600',
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  weekCard: {
    marginTop: 18,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  weekTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  weekRatio: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayWrap: { alignItems: 'center', gap: 6 },
  dayName: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  dayDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  dayDate: { fontSize: 12, color: colors.textSecondary },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    alignItems: 'flex-start',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  quoteCard: {
    marginTop: 18,
    backgroundColor: colors.accentSoft,
    borderRadius: 18,
    padding: 18,
  },
  quote: {
    fontSize: 15,
    fontStyle: 'italic',
    color: colors.textPrimary,
    lineHeight: 22,
    marginTop: 8,
  },
  quoteAuthor: {
    marginTop: 6,
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  historyRowLast: { borderBottomWidth: 0 },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  historySub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  historyTime: { fontSize: 12, color: colors.textMuted },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { color: colors.textMuted, fontSize: 13 },
});
