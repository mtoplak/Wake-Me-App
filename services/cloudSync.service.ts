/**
 * Cloud sync orchestration.
 *
 * - `pushLocalToCloud`: read everything from SQLite, mirror it into Firestore.
 * - `pullCloudToLocal`: read everything from Firestore, mirror it into SQLite
 *   (suppresses outbound writers so the pull doesn't echo back as a push).
 * - `syncOnSignIn`: on fresh sign-in, prefer cloud state if it exists,
 *   otherwise seed cloud with whatever the user has built up locally.
 *
 * Per-mutation writers (`syncSettingUp`, `syncAlarmUp`, `syncAlarmDeleteUp`,
 * `syncProfileUp`) are re-exported so call-sites in services/database/* can
 * continue to import from this module.
 */

import { collection, doc, getDoc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from './firebase';
import { withSyncSuppressed } from './cloudSyncWriters';
import { getDb } from './database/db';
import { getAllSettings } from './database/settings';
import { getProfile, upsertProfile } from './database/profile';
import { listAlarms } from './database/alarms';
import { Alarm, ChallengeParams, ChallengeType, UserProfile } from './database/types';

export {
  syncAlarmUp,
  syncAlarmDeleteUp,
  syncSettingUp,
  syncProfileUp,
  withSyncSuppressed,
} from './cloudSyncWriters';

function getActiveUid(): string | null {
  if (!isFirebaseConfigured()) return null;
  try {
    return getFirebaseAuth().currentUser?.uid ?? null;
  } catch {
    return null;
  }
}

export async function pushLocalToCloud(): Promise<void> {
  const uid = getActiveUid();
  if (!uid) return;

  const firestore = getFirebaseDb();
  const [settings, profile, alarms] = await Promise.all([
    getAllSettings(),
    getProfile(),
    listAlarms(),
  ]);

  const batch = writeBatch(firestore);

  for (const [key, value] of Object.entries(settings)) {
    batch.set(doc(firestore, 'users', uid, 'settings', key), {
      value,
      updatedAt: serverTimestamp(),
    });
  }

  if (profile) {
    batch.set(doc(firestore, 'users', uid, 'profile', 'main'), {
      name: profile.name,
      email: profile.email,
      language: profile.language,
      updatedAt: serverTimestamp(),
    });
  }

  for (const alarm of alarms) {
    batch.set(doc(firestore, 'users', uid, 'alarms', String(alarm.id)), {
      id: alarm.id,
      hour: alarm.hour,
      minute: alarm.minute,
      label: alarm.label,
      repeatDays: alarm.repeatDays,
      enabled: alarm.enabled,
      sound: alarm.sound,
      vibration: alarm.vibration,
      challenges: alarm.challenges,
      challengeParams: alarm.challengeParams,
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

interface FirestoreAlarm {
  id?: number;
  hour: number;
  minute: number;
  label: string;
  repeatDays: string[];
  enabled: boolean;
  sound: string;
  vibration: boolean;
  challenges: ChallengeType[];
  challengeParams?: ChallengeParams;
}

interface FirestoreProfile {
  name: string;
  email: string;
  language: UserProfile['language'];
}

export async function pullCloudToLocal(): Promise<{ alarms: number; settings: number }> {
  const uid = getActiveUid();
  if (!uid) return { alarms: 0, settings: 0 };

  const firestore = getFirebaseDb();
  const [settingsSnap, profileSnap, alarmsSnap] = await Promise.all([
    getDocs(collection(firestore, 'users', uid, 'settings')),
    getDoc(doc(firestore, 'users', uid, 'profile', 'main')),
    getDocs(collection(firestore, 'users', uid, 'alarms')),
  ]);

  return withSyncSuppressed(async () => {
    const db = await getDb();

    let settingsCount = 0;
    for (const snap of settingsSnap.docs) {
      const data = snap.data() as { value?: string };
      if (typeof data.value !== 'string') continue;
      await db.runAsync(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [snap.id, data.value],
      );
      settingsCount += 1;
    }

    if (profileSnap.exists()) {
      const data = profileSnap.data() as FirestoreProfile;
      await upsertProfile({
        name: data.name ?? '',
        email: data.email ?? '',
        language: (data.language as UserProfile['language']) ?? 'EN',
      });
    }

    // Replace alarms wholesale: delete any local rows missing from cloud, then
    // upsert each cloud alarm. Keeps local in lockstep with the cloud source
    // of truth at sign-in time.
    const cloudIds = new Set<number>();
    for (const snap of alarmsSnap.docs) {
      const data = snap.data() as FirestoreAlarm;
      const idNum = Number(snap.id);
      if (!Number.isFinite(idNum)) continue;
      cloudIds.add(idNum);

      await db.runAsync(
        `INSERT INTO alarms (id, hour, minute, label, repeat_days, enabled, sound, vibration)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           hour = excluded.hour,
           minute = excluded.minute,
           label = excluded.label,
           repeat_days = excluded.repeat_days,
           enabled = excluded.enabled,
           sound = excluded.sound,
           vibration = excluded.vibration`,
        [
          idNum,
          data.hour,
          data.minute,
          data.label,
          (data.repeatDays ?? []).join(','),
          data.enabled ? 1 : 0,
          data.sound ?? 'Sunrise',
          data.vibration ? 1 : 0,
        ],
      );

      await db.runAsync('DELETE FROM alarm_challenges WHERE alarm_id = ?', [idNum]);
      const params = data.challengeParams ?? {};
      for (const c of data.challenges ?? []) {
        await db.runAsync(
          'INSERT INTO alarm_challenges (alarm_id, challenge_type, difficulty, params) VALUES (?, ?, ?, ?)',
          [idNum, c, 'normal', params[c] ?? null],
        );
      }
    }

    const localRows = await db.getAllAsync<{ id: number }>('SELECT id FROM alarms');
    for (const row of localRows) {
      if (!cloudIds.has(row.id)) {
        await db.runAsync('DELETE FROM alarm_challenges WHERE alarm_id = ?', [row.id]);
        await db.runAsync('DELETE FROM alarms WHERE id = ?', [row.id]);
      }
    }

    return { alarms: cloudIds.size, settings: settingsCount };
  });
}

/**
 * Called right after a successful sign-in. If the cloud has any of the user's
 * data, pull it down. Otherwise treat the local SQLite as the seed and push
 * it up so the user starts mirrored.
 *
 * Re-entrant: if a sync is already in flight (e.g. fired by both the auth
 * listener and the Settings sign-in handler), callers share the same promise.
 */
let inFlightSync: Promise<void> | null = null;

export async function syncOnSignIn(): Promise<void> {
  if (inFlightSync) return inFlightSync;
  const uid = getActiveUid();
  if (!uid) return;

  inFlightSync = (async () => {
    const firestore = getFirebaseDb();
    const [settingsSnap, profileSnap, alarmsSnap] = await Promise.all([
      getDocs(collection(firestore, 'users', uid, 'settings')),
      getDoc(doc(firestore, 'users', uid, 'profile', 'main')),
      getDocs(collection(firestore, 'users', uid, 'alarms')),
    ]);

    const cloudHasData = !settingsSnap.empty || profileSnap.exists() || !alarmsSnap.empty;

    if (cloudHasData) {
      await pullCloudToLocal();
    } else {
      await pushLocalToCloud();
    }
  })();

  try {
    await inFlightSync;
  } finally {
    inFlightSync = null;
  }
}

/**
 * Subscribe to Firebase auth state and auto-sync on every transition into a
 * signed-in state. Call once at app boot; returns an unsubscribe fn.
 *
 * This is what restores user data after the SQLite cache is wiped on app
 * launch — Firebase Auth's AsyncStorage persistence brings the user back,
 * and this listener pulls their data from Firestore.
 */
export function subscribeCloudAutoSync(): () => void {
  if (!isFirebaseConfigured()) return () => {};
  return onAuthStateChanged(getFirebaseAuth(), user => {
    if (!user) return;
    syncOnSignIn().catch(err => {
      if (__DEV__) {
        console.warn('[cloudSync] auto-sync on auth change failed', err);
      }
    });
  });
}

export type { Alarm };
