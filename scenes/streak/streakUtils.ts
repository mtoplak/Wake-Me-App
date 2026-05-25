import { Ionicons } from '@expo/vector-icons';
import {
  CachedQuote,
  ChallengeInsights,
  ChallengeType,
  EarlyBirdScore,
  EarlyBirdTier,
  WakeStat,
  getChallengeInsights,
  getEarlyBirdScore,
  getStatsSummary,
  getTodaysQuote,
  listRecentStats,
} from '@/services/database';
import type { Translations } from '@/i18n';
import { colors } from '@/theme';

export type DayStatus = 'success' | 'fail' | 'today' | 'upcoming';

export type DayCell = {
  label: string;
  date: number;
  status: DayStatus;
  iso: string;
};

export type StreakSummary = {
  total: number;
  successes: number;
  successRate: number;
  bestStreak: number;
  currentStreak: number;
};

export type StreakScreenData = {
  summary: StreakSummary;
  stats: WakeStat[];
  quote: CachedQuote | null;
  insights: ChallengeInsights;
  earlyBird: EarlyBirdScore | null;
};

const DAY_KEYS: (keyof Translations['days']['short'])[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

export const EMPTY_CHALLENGE_INSIGHTS: ChallengeInsights = {
  breakdown: [],
  avgDurationSec: null,
  fastestDurationSec: null,
  slowestDurationSec: null,
  timedChallengeCount: 0,
};

export const EMPTY_STREAK_SUMMARY: StreakSummary = {
  total: 0,
  successes: 0,
  successRate: 0,
  bestStreak: 0,
  currentStreak: 0,
};

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function buildWeek(stats: WakeStat[], t: Translations): DayCell[] {
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

export function weekSuccessRatio(week: DayCell[]): string {
  return `${week.filter(d => d.status === 'success').length} / 7`;
}

export function challengeLabel(c: ChallengeType | null, t: Translations): string {
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

/** Recent wake row: list every challenge from that session (e.g. "Steps · Color"). */
export function formatWakeChallengeSummary(stat: WakeStat, t: Translations): string {
  const types =
    stat.completedChallengeTypes.length > 0
      ? stat.completedChallengeTypes
      : stat.challengeType
        ? [stat.challengeType]
        : [];
  if (types.length === 0) return challengeLabel(null, t);
  return types.map(c => challengeLabel(c, t)).join(' · ');
}

export function formatChallengeDuration(sec: number, t: Translations): string {
  if (sec < 60) return t.streak.durationSec(sec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return t.streak.durationMinSec(m, s);
}

export function challengeIconName(type: ChallengeType): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'qr':
      return 'qr-code-outline';
    case 'object':
      return 'scan-outline';
    case 'color':
      return 'color-palette-outline';
    case 'steps':
      return 'footsteps-outline';
    case 'voice':
      return 'mic-outline';
    default:
      return 'alarm-outline';
  }
}

export function relativeDay(iso: string, t: Translations): string {
  const today = new Date();
  const target = new Date(iso);
  const todayIso = isoDay(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (iso === todayIso) return t.streak.today;
  if (iso === isoDay(yesterday)) return t.streak.yesterday;
  return target.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function breakdownBarWidthPct(count: number, maxCount: number): number {
  return Math.max(8, Math.round((count / maxCount) * 100));
}

export function maxBreakdownCount(insights: ChallengeInsights): number {
  return Math.max(1, ...insights.breakdown.map(item => item.count));
}

export function hasChallengeInsights(insights: ChallengeInsights): boolean {
  return insights.breakdown.length > 0 || insights.avgDurationSec != null;
}

export function shouldShowInsightsPlaceholder(
  summary: StreakSummary,
  insights: ChallengeInsights,
): boolean {
  return summary.total > 0 && !hasChallengeInsights(insights);
}

export function earlyBirdTierLabel(tier: EarlyBirdTier, t: Translations): string {
  return t.streak.earlyBirdTier[tier];
}

export function earlyBirdTierIcon(tier: EarlyBirdTier): keyof typeof Ionicons.glyphMap {
  switch (tier) {
    case 'sunriseChampion':
      return 'sunny';
    case 'earlyBird':
      return 'partly-sunny-outline';
    case 'rising':
      return 'cloudy-night-outline';
    default:
      return 'moon-outline';
  }
}

export function dotStyle(status: DayStatus) {
  if (status === 'success') return { backgroundColor: colors.accent };
  if (status === 'fail') return { backgroundColor: colors.flame };
  if (status === 'today') {
    return {
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.accent,
    };
  }
  return { backgroundColor: colors.border };
}

export async function loadStreakScreenData(): Promise<StreakScreenData> {
  const [summary, stats, quote, insights, earlyBird] = await Promise.all([
    getStatsSummary(),
    listRecentStats(20),
    getTodaysQuote(),
    getChallengeInsights(),
    getEarlyBirdScore(),
  ]);
  return { summary, stats, quote, insights, earlyBird };
}