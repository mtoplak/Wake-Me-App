import { syncWakeStatUp } from '../cloudSyncWriters';
import { getDb } from './db';
import { ChallengeType, WakeStat, WakeStatRecord } from './types';

function map(row: WakeStatRecord): WakeStat {
  return {
    id: row.id,
    alarmId: row.alarm_id,
    date: row.date,
    wakeTime: row.wake_time,
    success: row.success === 1,
    challengeDuration: row.challenge_duration,
    challengeType: (row.challenge_type as ChallengeType | null) ?? null,
  };
}

export async function recordWake(input: {
  alarmId: number | null;
  date: string;
  wakeTime: string;
  success: boolean;
  challengeDuration?: number;
  challengeType?: ChallengeType;
}): Promise<void> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO wake_stats (alarm_id, date, wake_time, success, challenge_duration, challenge_type)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.alarmId,
      input.date,
      input.wakeTime,
      input.success ? 1 : 0,
      input.challengeDuration ?? null,
      input.challengeType ?? null,
    ],
  );
  const id = result.lastInsertRowId;
  syncWakeStatUp({
    id,
    alarmId: input.alarmId,
    date: input.date,
    wakeTime: input.wakeTime,
    success: input.success,
    challengeDuration: input.challengeDuration ?? null,
    challengeType: input.challengeType ?? null,
  });
}

export async function listRecentStats(limit = 30): Promise<WakeStat[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<WakeStatRecord>(
    'SELECT * FROM wake_stats ORDER BY date DESC, wake_time DESC LIMIT ?',
    [limit],
  );
  return rows.map(map);
}

export async function clearAllWakeStats(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM wake_stats');
}

export async function listAllWakeStats(): Promise<WakeStat[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<WakeStatRecord>(
    'SELECT * FROM wake_stats ORDER BY date ASC, wake_time ASC',
  );
  return rows.map(map);
}

/** Reassign a wake_stats row id (e.g. before cloud upload when the doc id is taken). */
export async function reassignWakeStatId(fromId: number, toId: number): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<WakeStatRecord>('SELECT * FROM wake_stats WHERE id = ?', [
    fromId,
  ]);
  if (!row) return;
  await db.runAsync('DELETE FROM wake_stats WHERE id = ?', [fromId]);
  await db.runAsync(
    `INSERT INTO wake_stats (id, alarm_id, date, wake_time, success, challenge_duration, challenge_type)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      toId,
      row.alarm_id,
      row.date,
      row.wake_time,
      row.success,
      row.challenge_duration,
      row.challenge_type,
    ],
  );
}

export async function getStatsSummary(): Promise<{
  total: number;
  successes: number;
  successRate: number;
  bestStreak: number;
  currentStreak: number;
}> {
  const db = await getDb();
  const totalRow = await db.getFirstAsync<{ total: number; successes: number }>(
    `SELECT COUNT(*) as total, COALESCE(SUM(success), 0) as successes FROM wake_stats`,
  );
  const total = totalRow?.total ?? 0;
  const successes = totalRow?.successes ?? 0;

  const dayRows = await db.getAllAsync<{ date: string; success: number }>(
    `SELECT date, MAX(success) as success FROM wake_stats GROUP BY date ORDER BY date ASC`,
  );
  let bestStreak = 0;
  let run = 0;
  for (const d of dayRows) {
    if (d.success === 1) {
      run += 1;
      if (run > bestStreak) bestStreak = run;
    } else {
      run = 0;
    }
  }

  let currentStreak = 0;
  for (let i = dayRows.length - 1; i >= 0; i -= 1) {
    if (dayRows[i].success === 1) currentStreak += 1;
    else break;
  }

  return {
    total,
    successes,
    successRate: total === 0 ? 0 : Math.round((successes / total) * 100),
    bestStreak,
    currentStreak,
  };
}

export type ChallengeBreakdownItem = {
  type: ChallengeType;
  count: number;
};

export type ChallengeInsights = {
  breakdown: ChallengeBreakdownItem[];
  avgDurationSec: number | null;
  fastestDurationSec: number | null;
  slowestDurationSec: number | null;
  timedChallengeCount: number;
};

const CHALLENGE_ORDER: ChallengeType[] = ['qr', 'object', 'color', 'steps', 'voice'];

export async function getChallengeInsights(): Promise<ChallengeInsights> {
  const db = await getDb();

  const breakdownRows = await db.getAllAsync<{ challenge_type: string; count: number }>(
    `SELECT challenge_type, COUNT(*) as count
     FROM wake_stats
     WHERE success = 1 AND challenge_type IS NOT NULL
     GROUP BY challenge_type`,
  );

  const breakdown = breakdownRows
    .map(row => ({
      type: row.challenge_type as ChallengeType,
      count: row.count,
    }))
    .filter(row => CHALLENGE_ORDER.includes(row.type))
    .sort((a, b) => b.count - a.count || CHALLENGE_ORDER.indexOf(a.type) - CHALLENGE_ORDER.indexOf(b.type));

  const durationRow = await db.getFirstAsync<{
    avg_duration: number | null;
    fastest: number | null;
    slowest: number | null;
    timed_count: number;
  }>(
    `SELECT
       ROUND(AVG(challenge_duration)) as avg_duration,
       MIN(challenge_duration) as fastest,
       MAX(challenge_duration) as slowest,
       COUNT(*) as timed_count
     FROM wake_stats
     WHERE success = 1 AND challenge_duration IS NOT NULL`,
  );

  const timedChallengeCount = durationRow?.timed_count ?? 0;

  return {
    breakdown,
    avgDurationSec:
      timedChallengeCount > 0 && durationRow?.avg_duration != null
        ? Math.round(durationRow.avg_duration)
        : null,
    fastestDurationSec: durationRow?.fastest ?? null,
    slowestDurationSec: durationRow?.slowest ?? null,
    timedChallengeCount,
  };
}

/** Mornings counted as "early" when the first successful wake is before this hour. */
export const EARLY_BIRD_THRESHOLD_HOUR = 8;

export type EarlyBirdTier = 'nightOwl' | 'rising' | 'earlyBird' | 'sunriseChampion';

export type EarlyBirdScore = {
  percent: number;
  tier: EarlyBirdTier;
  earlyDays: number;
  totalDays: number;
  thresholdHour: number;
};

function parseWakeTimeMinutes(wakeTime: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(wakeTime.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function tierFromEarlyBirdPercent(percent: number): EarlyBirdTier {
  if (percent >= 75) return 'sunriseChampion';
  if (percent >= 50) return 'earlyBird';
  if (percent >= 25) return 'rising';
  return 'nightOwl';
}

/**
 * % of days with a successful wake where the earliest wake that day was before 7:00.
 * Uses one wake per calendar day (earliest successful `wake_time`).
 */
export async function getEarlyBirdScore(): Promise<EarlyBirdScore | null> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string; wake_time: string }>(
    `SELECT date, wake_time FROM wake_stats
     WHERE success = 1
     ORDER BY date ASC, wake_time ASC`,
  );

  const earliestMinutesByDay = new Map<string, number>();
  for (const row of rows) {
    const minutes = parseWakeTimeMinutes(row.wake_time);
    if (minutes == null) continue;
    const prev = earliestMinutesByDay.get(row.date);
    if (prev === undefined || minutes < prev) {
      earliestMinutesByDay.set(row.date, minutes);
    }
  }

  const totalDays = earliestMinutesByDay.size;
  if (totalDays === 0) return null;

  const thresholdMinutes = EARLY_BIRD_THRESHOLD_HOUR * 60;
  let earlyDays = 0;
  for (const minutes of earliestMinutesByDay.values()) {
    if (minutes < thresholdMinutes) earlyDays += 1;
  }

  const percent = Math.round((earlyDays / totalDays) * 100);
  return {
    percent,
    tier: tierFromEarlyBirdPercent(percent),
    earlyDays,
    totalDays,
    thresholdHour: EARLY_BIRD_THRESHOLD_HOUR,
  };
}
