import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, AntDesign } from '@expo/vector-icons';
import {
  CachedQuote,
  ChallengeBreakdownItem,
  ChallengeInsights,
  EarlyBirdScore,
  WakeStat,
} from '@/services/database';
import { getCurrentUser, pullCloudToLocal, wipeWakeStats } from '@/services';
import { isFirebaseConfigured } from '@/services/firebase';
import { useTranslation } from '@/i18n';
import { colors } from '@/theme';
import {
  breakdownBarWidthPct,
  buildWeek,
  challengeIconName,
  challengeLabel,
  formatWakeChallengeSummary,
  dotStyle,
  earlyBirdTierIcon,
  earlyBirdTierLabel,
  EMPTY_CHALLENGE_INSIGHTS,
  EMPTY_STREAK_SUMMARY,
  formatChallengeDuration,
  hasChallengeInsights,
  loadStreakScreenData,
  maxBreakdownCount,
  relativeDay,
  shouldShowInsightsPlaceholder,
  weekSuccessRatio,
  type StreakSummary,
} from './streakUtils';

export default function Streak() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<StreakSummary>(EMPTY_STREAK_SUMMARY);
  const [stats, setStats] = useState<WakeStat[]>([]);
  const [quote, setQuote] = useState<CachedQuote | null>(null);
  const [insights, setInsights] = useState<ChallengeInsights>(EMPTY_CHALLENGE_INSIGHTS);
  const [earlyBird, setEarlyBird] = useState<EarlyBirdScore | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [wiping, setWiping] = useState(false);

  const load = useCallback(async () => {
    const data = await loadStreakScreenData();
    setSummary(data.summary);
    setStats(data.stats);
    setQuote(data.quote);
    setInsights(data.insights);
    setEarlyBird(data.earlyBird);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (loading) return;
      load();
    }, [load, loading]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isFirebaseConfigured() && getCurrentUser()) {
        await pullCloudToLocal();
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('[streak] cloud pull failed', err);
      }
    }
    await load();
    setRefreshing(false);
  }, [load]);

  const week = useMemo(() => buildWeek(stats, t), [stats, t]);
  const weekRatio = weekSuccessRatio(week);
  const breakdownMax = useMemo(() => maxBreakdownCount(insights), [insights]);
  const hasInsights = hasChallengeInsights(insights);
  const showInsightsPlaceholder = shouldShowInsightsPlaceholder(summary, insights);

  const handleWipeStreak = useCallback(() => {
    const signedIn = isFirebaseConfigured() && !!getCurrentUser();
    Alert.alert(
      t.streak.wipeTitle,
      signedIn ? t.streak.wipeBodyCloud : t.streak.wipeBodyLocal,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.streak.wipeConfirm,
          style: 'destructive',
          onPress: async () => {
            setWiping(true);
            try {
              await wipeWakeStats();
              await load();
            } catch (err) {
              Alert.alert(
                t.streak.wipeFailed,
                err instanceof Error ? err.message : t.common.unknown,
              );
            } finally {
              setWiping(false);
            }
          },
        },
      ],
    );
  }, [load, t]);

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

        {earlyBird && (
          <View style={styles.earlyBirdCard}>
            <View style={styles.earlyBirdHeader}>
              <View style={styles.earlyBirdIconWrap}>
                <Ionicons
                  name={earlyBirdTierIcon(earlyBird.tier)}
                  size={28}
                  color={colors.warning}
                />
              </View>
              <View style={styles.earlyBirdHeaderText}>
                <Text style={styles.insightsTitle}>{t.streak.earlyBirdTitle}</Text>
                <Text style={styles.earlyBirdTier}>{earlyBirdTierLabel(earlyBird.tier, t)}</Text>
              </View>
              <Text style={styles.earlyBirdPercent}>{earlyBird.percent}%</Text>
            </View>
            <View style={styles.earlyBirdBarTrack}>
              <View style={[styles.earlyBirdBarFill, { width: `${earlyBird.percent}%` }]} />
            </View>
            <Text style={styles.earlyBirdHint}>
              {t.streak.earlyBirdDetail(earlyBird.earlyDays, earlyBird.totalDays, earlyBird.thresholdHour)}
            </Text>
            <Text style={styles.insightsHint}>{t.streak.earlyBirdHint(earlyBird.thresholdHour)}</Text>
          </View>
        )}

        {hasInsights ? (
          <>
            {insights.breakdown.length > 0 && (
              <View style={styles.insightsCard}>
                <Text style={styles.insightsTitle}>{t.streak.challengeBreakdown}</Text>
                <Text style={styles.insightsHint}>{t.streak.challengeBreakdownHint}</Text>
                {insights.breakdown.map(item => (
                  <ChallengeBreakdownRow
                    key={item.type}
                    item={item}
                    maxCount={breakdownMax}
                    label={challengeLabel(item.type, t)}
                    icon={challengeIconName(item.type)}
                  />
                ))}
              </View>
            )}

            {insights.avgDurationSec != null && (
              <View style={styles.insightsCard}>
                <Text style={styles.insightsTitle}>{t.streak.challengeTime}</Text>
                <View style={styles.durationHero}>
                  <MaterialCommunityIcons name="timer-outline" size={28} color={colors.accent} />
                  <View>
                    <Text style={styles.durationValue}>
                      {formatChallengeDuration(insights.avgDurationSec, t)}
                    </Text>
                    <Text style={styles.durationLabel}>{t.streak.avgChallengeTime}</Text>
                  </View>
                </View>
                {(insights.fastestDurationSec != null || insights.slowestDurationSec != null) && (
                  <View style={styles.durationRow}>
                    {insights.fastestDurationSec != null && (
                      <View style={styles.durationPill}>
                        <Text style={styles.durationPillLabel}>{t.streak.fastestChallenge}</Text>
                        <Text style={styles.durationPillValue}>
                          {formatChallengeDuration(insights.fastestDurationSec, t)}
                        </Text>
                      </View>
                    )}
                    {insights.slowestDurationSec != null && (
                      <View style={styles.durationPill}>
                        <Text style={styles.durationPillLabel}>{t.streak.slowestChallenge}</Text>
                        <Text style={styles.durationPillValue}>
                          {formatChallengeDuration(insights.slowestDurationSec, t)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </>
        ) : showInsightsPlaceholder ? (
          <View style={styles.insightsEmptyCard}>
            <MaterialCommunityIcons name="chart-bar" size={24} color={colors.textMuted} />
            <Text style={styles.insightsEmptyText}>{t.streak.insightsEmpty}</Text>
          </View>
        ) : null}

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
                  <Text style={styles.historySub}>
                    {formatWakeChallengeSummary(h, t)}
                    {h.challengeDuration != null
                      ? ` · ${formatChallengeDuration(h.challengeDuration, t)}`
                      : ''}
                  </Text>
                </View>
                <Text style={styles.historyTime}>{h.wakeTime}</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.wipeButton}
          onPress={handleWipeStreak}
          disabled={wiping || refreshing}
          activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={18} color={colors.flame} />
          <Text style={styles.wipeButtonText}>
            {wiping ? t.streak.wipeClearing : t.streak.wipeStreak}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChallengeBreakdownRow({
  item,
  maxCount,
  label,
  icon,
}: {
  item: ChallengeBreakdownItem;
  maxCount: number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const widthPct = breakdownBarWidthPct(item.count, maxCount);
  return (
    <View style={styles.breakdownRow}>
      <View style={styles.breakdownLabelWrap}>
        <Ionicons name={icon} size={16} color={colors.accent} />
        <Text style={styles.breakdownLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.breakdownBarTrack}>
        <View style={[styles.breakdownBarFill, { width: `${widthPct}%` }]} />
      </View>
      <Text style={styles.breakdownCount}>{item.count}</Text>
    </View>
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
  earlyBirdCard: {
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
  },
  earlyBirdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  earlyBirdIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  earlyBirdHeaderText: { flex: 1 },
  earlyBirdTier: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
    color: colors.warning,
  },
  earlyBirdPercent: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  earlyBirdBarTrack: {
    marginTop: 16,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  earlyBirdBarFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.warning,
  },
  earlyBirdHint: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
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
  insightsCard: {
    marginTop: 18,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
  },
  insightsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  insightsHint: {
    marginTop: 4,
    marginBottom: 14,
    fontSize: 12,
    color: colors.textMuted,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  breakdownLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 88,
  },
  breakdownLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  breakdownBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  breakdownCount: {
    width: 24,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  durationHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 4,
  },
  durationValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  durationLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  durationPill: {
    flex: 1,
    backgroundColor: colors.accentSoft,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  durationPillLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  durationPillValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '700',
    color: colors.accent,
  },
  insightsEmptyCard: {
    marginTop: 18,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  insightsEmptyText: {
    flex: 1,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
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
  wipeButton: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.flameSoft,
    backgroundColor: colors.surface,
  },
  wipeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.flame,
  },
});
