export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'EN'
);

CREATE TABLE IF NOT EXISTS alarms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  hour INTEGER NOT NULL,
  minute INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  repeat_days TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  sound TEXT NOT NULL DEFAULT 'Sunrise',
  vibration INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS alarm_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alarm_id INTEGER NOT NULL,
  notification_id TEXT NOT NULL,
  FOREIGN KEY (alarm_id) REFERENCES alarms (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS alarm_challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alarm_id INTEGER NOT NULL,
  challenge_type TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'normal',
  params TEXT,
  FOREIGN KEY (alarm_id) REFERENCES alarms (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wake_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alarm_id INTEGER,
  date TEXT NOT NULL,
  wake_time TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 1,
  challenge_duration INTEGER,
  challenge_type TEXT,
  completed_challenge_types TEXT,
  FOREIGN KEY (alarm_id) REFERENCES alarms (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cached_quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  author TEXT NOT NULL,
  date TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alarm_challenges_alarm ON alarm_challenges (alarm_id);
CREATE INDEX IF NOT EXISTS idx_alarm_notifications_alarm ON alarm_notifications (alarm_id);
CREATE INDEX IF NOT EXISTS idx_wake_stats_date ON wake_stats (date);
`;
