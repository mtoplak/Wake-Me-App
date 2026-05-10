import { getDb } from './db';
import { Alarm, AlarmChallengeRecord, AlarmInput, AlarmRecord, ChallengeType } from './types';
import { cancelAlarm, scheduleAlarm } from '../alarmScheduler';

function mapAlarm(row: AlarmRecord, challenges: ChallengeType[]): Alarm {
  return {
    id: row.id,
    hour: row.hour,
    minute: row.minute,
    label: row.label,
    repeatDays: row.repeat_days ? row.repeat_days.split(',').filter(Boolean) : [],
    enabled: row.enabled === 1,
    sound: row.sound,
    vibration: row.vibration === 1,
    challenges,
  };
}

export async function listAlarms(): Promise<Alarm[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<AlarmRecord>(
    'SELECT * FROM alarms ORDER BY hour ASC, minute ASC',
  );
  if (rows.length === 0) return [];
  const ids = rows.map(r => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const challengeRows = await db.getAllAsync<AlarmChallengeRecord>(
    `SELECT * FROM alarm_challenges WHERE alarm_id IN (${placeholders})`,
    ids,
  );
  const byAlarm = new Map<number, ChallengeType[]>();
  for (const c of challengeRows) {
    const list = byAlarm.get(c.alarm_id) ?? [];
    list.push(c.challenge_type);
    byAlarm.set(c.alarm_id, list);
  }
  return rows.map(r => mapAlarm(r, byAlarm.get(r.id) ?? []));
}

export async function createAlarm(input: AlarmInput): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO alarms (hour, minute, label, repeat_days, enabled, sound, vibration)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.hour,
      input.minute,
      input.label,
      input.repeatDays.join(','),
      input.enabled === false ? 0 : 1,
      input.sound ?? 'Sunrise',
      input.vibration === false ? 0 : 1,
    ],
  );
  const alarmId = result.lastInsertRowId;
  for (const c of input.challenges) {
    await db.runAsync(
      'INSERT INTO alarm_challenges (alarm_id, challenge_type, difficulty) VALUES (?, ?, ?)',
      [alarmId, c, 'normal'],
    );
  }
  await scheduleAlarm({
    id: alarmId,
    hour: input.hour,
    minute: input.minute,
    label: input.label,
    repeatDays: input.repeatDays,
    enabled: input.enabled !== false,
    sound: input.sound ?? 'Sunrise',
    vibration: input.vibration !== false,
    challenges: input.challenges,
  });
  return alarmId;
}

async function loadAlarmById(id: number): Promise<Alarm | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<AlarmRecord>('SELECT * FROM alarms WHERE id = ?', [id]);
  if (!row) return null;
  const challengeRows = await db.getAllAsync<AlarmChallengeRecord>(
    'SELECT * FROM alarm_challenges WHERE alarm_id = ?',
    [id],
  );
  return mapAlarm(
    row,
    challengeRows.map(c => c.challenge_type),
  );
}

export async function setAlarmEnabled(id: number, enabled: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE alarms SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
  if (enabled) {
    const alarm = await loadAlarmById(id);
    if (alarm) await scheduleAlarm(alarm);
  } else {
    await cancelAlarm(id);
  }
}

export async function deleteAlarm(id: number): Promise<void> {
  const db = await getDb();
  await cancelAlarm(id);
  await db.runAsync('DELETE FROM alarms WHERE id = ?', [id]);
}

export async function countAlarms(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM alarms');
  return row?.count ?? 0;
}
