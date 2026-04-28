import { getDb } from './db';
import { UserProfile } from './types';

export async function getProfile(): Promise<UserProfile | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<UserProfile>(
    'SELECT id, name, email, language FROM users ORDER BY id ASC LIMIT 1',
  );
  return row ?? null;
}

export async function upsertProfile(profile: Omit<UserProfile, 'id'>): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM users LIMIT 1');
  if (existing) {
    await db.runAsync('UPDATE users SET name = ?, email = ?, language = ? WHERE id = ?', [
      profile.name,
      profile.email,
      profile.language,
      existing.id,
    ]);
  } else {
    await db.runAsync('INSERT INTO users (name, email, language) VALUES (?, ?, ?)', [
      profile.name,
      profile.email,
      profile.language,
    ]);
  }
}
