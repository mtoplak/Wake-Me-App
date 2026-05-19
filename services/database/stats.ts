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
