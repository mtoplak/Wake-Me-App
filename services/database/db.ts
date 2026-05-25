import * as SQLite from 'expo-sqlite';
import { SCHEMA_SQL } from './schema';

const DB_NAME = 'wakeup.db';

const WIPE_SQL = `
  DROP TABLE IF EXISTS alarm_challenges;
  DROP TABLE IF EXISTS alarm_notifications;
  DROP TABLE IF EXISTS wake_stats;
  DROP TABLE IF EXISTS alarms;
  DROP TABLE IF EXISTS cached_quotes;
  DROP TABLE IF EXISTS settings;
  DROP TABLE IF EXISTS users;
`;

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  if (!initPromise) initPromise = openAndInit();
  dbInstance = await initPromise;
  return dbInstance;
}

async function openAndInit(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(SCHEMA_SQL);
  await migrateWakeStatsCompletedTypes(db);
  return db;
}

async function migrateWakeStatsCompletedTypes(db: SQLite.SQLiteDatabase): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(wake_stats)');
  if (cols.some(c => c.name === 'completed_challenge_types')) return;

  await db.execAsync('ALTER TABLE wake_stats ADD COLUMN completed_challenge_types TEXT');

  const rows = await db.getAllAsync<{ id: number; challenge_type: string | null }>(
    'SELECT id, challenge_type FROM wake_stats WHERE challenge_type IS NOT NULL',
  );
  for (const row of rows) {
    await db.runAsync('UPDATE wake_stats SET completed_challenge_types = ? WHERE id = ?', [
      JSON.stringify([row.challenge_type]),
      row.id,
    ]);
  }
}

/** Dev-only: wipe all tables and recreate schema. */
export async function resetDb(): Promise<void> {
  const db = await getDb();
  await db.execAsync(WIPE_SQL + SCHEMA_SQL);
}
