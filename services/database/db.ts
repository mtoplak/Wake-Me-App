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
  return db;
}

/** Dev-only: wipe all tables and recreate schema. */
export async function resetDb(): Promise<void> {
  const db = await getDb();
  await db.execAsync(WIPE_SQL + SCHEMA_SQL);
}
