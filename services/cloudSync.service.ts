/**
 * Cloud sync orchestration.
 *
 * - `pushLocalToCloud`: read everything from SQLite, mirror it into Firestore.
 * - `pullCloudToLocal`: read everything from Firestore, mirror it into SQLite
 *   (suppresses outbound writers so the pull doesn't echo back as a push).
 * - `pushUnsyncedToCloud`: upload local-only alarms/wake stats (merge), no pull.
 * - `subscribeCloudReconnectSync`: NetInfo + app foreground → pushUnsyncedToCloud.
 * - `syncOnSignIn`: merge local alarms and wake stats into the cloud, then pull or push.
 *   Local-only rows are kept when pulling (matched by content fingerprint).
 *
 * Per-mutation writers (`syncSettingUp`, `syncAlarmUp`, `syncAlarmDeleteUp`,
 * `syncProfileUp`, `syncWakeStatUp`) are re-exported so call-sites in
 * services/database/* can continue to import from this module.
 */

import { collection, doc, getDoc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { AppState, type AppStateStatus } from 'react-native';
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from './firebase';
import {
  syncAlarmUpAsync,
  syncWakeStatUpAsync,
  withSyncSuppressed,
  WakeStatSyncPayload,
} from './cloudSyncWriters';
import { rescheduleAllAlarms } from './alarmScheduler';
import { getDb } from './database/db';
import { getAllSettings } from './database/settings';
import { getProfile, upsertProfile } from './database/profile';
import { insertAlarmFromCloud, listAlarms, reassignAlarmId } from './database/alarms';
import {
  clearAllWakeStats,
  listAllWakeStats,
  reassignWakeStatId,
} from './database/stats';
import { Alarm, ChallengeParams, ChallengeType, UserProfile } from './database/types';

export {
  syncAlarmUp,
  syncAlarmDeleteUp,
  syncSettingUp,
  syncProfileUp,
  syncWakeStatUp,
  withSyncSuppressed,
} from './cloudSyncWriters';
export type { WakeStatSyncPayload } from './cloudSyncWriters';

function getActiveUid(): string | null {
  if (!isFirebaseConfigured()) return null;
  try {
    return getFirebaseAuth().currentUser?.uid ?? null;
  } catch {
    return null;
  }
}

/** wake_stats.alarm_id must reference an existing alarms row (or be null). */
async function resolveWakeStatAlarmId(
  db: Awaited<ReturnType<typeof getDb>>,
  alarmId: number | null | undefined,
): Promise<number | null> {
  if (alarmId == null || !Number.isFinite(alarmId)) return null;
  const row = await db.getFirstAsync<{ ok: number }>(
    'SELECT 1 AS ok FROM alarms WHERE id = ?',
    [alarmId],
  );
  return row ? alarmId : null;
}

type WakeStatFingerprintFields = Pick<
  WakeStatSyncPayload,
  'date' | 'wakeTime' | 'success' | 'challengeDuration' | 'challengeType' | 'alarmId'
>;

function wakeStatFingerprint(stat: WakeStatFingerprintFields): string {
  return [
    stat.date,
    stat.wakeTime,
    stat.success ? '1' : '0',
    stat.challengeType ?? '',
    stat.challengeDuration ?? '',
    stat.alarmId ?? '',
  ].join('|');
}

function nextUnusedNumericId(used: Set<number>): number {
  let n = 1;
  while (used.has(n)) n += 1;
  return n;
}

function alarmFingerprint(
  alarm: Pick<
    Alarm,
    'hour' | 'minute' | 'label' | 'repeatDays' | 'enabled' | 'sound' | 'vibration' | 'challenges' | 'challengeParams'
  >,
): string {
  const repeatDays = [...alarm.repeatDays].sort().join(',');
  const challenges = [...alarm.challenges].sort().join(',');
  const paramKeys = Object.keys(alarm.challengeParams ?? {}).sort();
  const params = JSON.stringify(alarm.challengeParams ?? {}, paramKeys);
  return [
    alarm.hour,
    alarm.minute,
    alarm.label,
    repeatDays,
    alarm.sound,
    alarm.enabled ? '1' : '0',
    alarm.vibration ? '1' : '0',
    challenges,
    params,
  ].join('|');
}

function firestoreToAlarm(id: number, data: FirestoreAlarm): Alarm {
  return {
    id,
    hour: data.hour,
    minute: data.minute,
    label: data.label,
    repeatDays: data.repeatDays ?? [],
    enabled: data.enabled !== false,
    sound: data.sound ?? 'Sunrise',
    vibration: data.vibration !== false,
    challenges: data.challenges ?? [],
    challengeParams: data.challengeParams ?? {},
  };
}

async function upsertAlarmRowInDb(
  db: Awaited<ReturnType<typeof getDb>>,
  idNum: number,
  data: FirestoreAlarm,
): Promise<void> {
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
      data.enabled !== false ? 1 : 0,
      data.sound ?? 'Sunrise',
      data.vibration !== false ? 1 : 0,
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

/**
 * Upload local alarms not already represented in Firebase (by content fingerprint).
 */
export async function mergeLocalAlarmsToCloud(): Promise<number> {
  const uid = getActiveUid();
  if (!uid) return 0;

  const firestore = getFirebaseDb();
  const [alarmsSnap, localAlarms] = await Promise.all([
    getDocs(collection(firestore, 'users', uid, 'alarms')),
    listAlarms(),
  ]);

  const cloudFingerprints = new Set<string>();
  const cloudFingerprintByDocId = new Map<number, string>();
  const usedDocIds = new Set<number>();

  for (const snap of alarmsSnap.docs) {
    const idNum = Number(snap.id);
    if (!Number.isFinite(idNum)) continue;
    const data = snap.data() as FirestoreAlarm;
    const alarm = firestoreToAlarm(idNum, data);
    const fp = alarmFingerprint(alarm);
    cloudFingerprints.add(fp);
    cloudFingerprintByDocId.set(idNum, fp);
    usedDocIds.add(idNum);
  }

  for (const alarm of localAlarms) usedDocIds.add(alarm.id);

  let uploaded = 0;
  for (const alarm of localAlarms) {
    const fp = alarmFingerprint(alarm);
    if (cloudFingerprints.has(fp)) continue;

    let docId = alarm.id;
    const cloudFpAtDocId = cloudFingerprintByDocId.get(alarm.id);
    if (cloudFpAtDocId !== undefined && cloudFpAtDocId !== fp) {
      docId = nextUnusedNumericId(usedDocIds);
      usedDocIds.add(docId);
      const reassigned = await reassignAlarmId(alarm.id, docId);
      await syncAlarmUpAsync(reassigned);
    } else {
      await syncAlarmUpAsync({ ...alarm, id: docId });
    }

    cloudFingerprints.add(fp);
    uploaded += 1;
  }

  return uploaded;
}

function firestoreWakeStatToPayload(
  id: number,
  data: FirestoreWakeStat,
  alarmId: number | null,
): WakeStatFingerprintFields & { id: number } {
  return {
    id,
    alarmId,
    date: data.date,
    wakeTime: data.wakeTime,
    success: data.success !== false,
    challengeDuration: data.challengeDuration ?? null,
    challengeType: data.challengeType ?? null,
  };
}

/**
 * Upload local wake_stats rows that are not already represented in Firebase
 * (matched by content fingerprint, not SQLite id).
 */
export async function mergeLocalWakeStatsToCloud(): Promise<number> {
  const uid = getActiveUid();
  if (!uid) return 0;

  const firestore = getFirebaseDb();
  const [wakeStatsSnap, localStats] = await Promise.all([
    getDocs(collection(firestore, 'users', uid, 'wakeStats')),
    listAllWakeStats(),
  ]);

  const cloudFingerprints = new Set<string>();
  const cloudFingerprintByDocId = new Map<number, string>();
  const usedDocIds = new Set<number>();

  for (const snap of wakeStatsSnap.docs) {
    const idNum = Number(snap.id);
    if (!Number.isFinite(idNum)) continue;
    const data = snap.data() as FirestoreWakeStat;
    if (typeof data.date !== 'string' || typeof data.wakeTime !== 'string') continue;
    const alarmId = data.alarmId ?? null;
    const fields = firestoreWakeStatToPayload(idNum, data, alarmId);
    const fp = wakeStatFingerprint(fields);
    cloudFingerprints.add(fp);
    cloudFingerprintByDocId.set(idNum, fp);
    usedDocIds.add(idNum);
  }

  for (const stat of localStats) usedDocIds.add(stat.id);

  const db = await getDb();
  let uploaded = 0;

  for (const stat of localStats) {
    const alarmId = await resolveWakeStatAlarmId(db, stat.alarmId);
    const payload: WakeStatSyncPayload = {
      id: stat.id,
      alarmId,
      date: stat.date,
      wakeTime: stat.wakeTime,
      success: stat.success,
      challengeDuration: stat.challengeDuration,
      challengeType: stat.challengeType,
    };
    const fp = wakeStatFingerprint(payload);
    if (cloudFingerprints.has(fp)) continue;

    let docId = stat.id;
    const cloudFpAtDocId = cloudFingerprintByDocId.get(stat.id);
    if (cloudFpAtDocId !== undefined && cloudFpAtDocId !== fp) {
      docId = nextUnusedNumericId(usedDocIds);
      usedDocIds.add(docId);
      await reassignWakeStatId(stat.id, docId);
      payload.id = docId;
    }

    await syncWakeStatUpAsync(payload);
    cloudFingerprints.add(fp);
    uploaded += 1;
  }

  return uploaded;
}

export async function pushLocalToCloud(): Promise<void> {
  const uid = getActiveUid();
  if (!uid) return;

  const firestore = getFirebaseDb();
  const [settings, profile, alarms, wakeStats] = await Promise.all([
    getAllSettings(),
    getProfile(),
    listAlarms(),
    listAllWakeStats(),
  ]);

  const db = await getDb();
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

  for (const stat of wakeStats) {
    const alarmId = await resolveWakeStatAlarmId(db, stat.alarmId);
    batch.set(doc(firestore, 'users', uid, 'wakeStats', String(stat.id)), {
      id: stat.id,
      alarmId,
      date: stat.date,
      wakeTime: stat.wakeTime,
      success: stat.success,
      challengeDuration: stat.challengeDuration,
      challengeType: stat.challengeType,
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

interface FirestoreWakeStat {
  alarmId?: number | null;
  date: string;
  wakeTime: string;
  success?: boolean;
  challengeDuration?: number | null;
  challengeType?: ChallengeType | null;
}

export async function pullCloudToLocal(): Promise<{
  alarms: number;
  settings: number;
  wakeStats: number;
}> {
  const uid = getActiveUid();
  if (!uid) return { alarms: 0, settings: 0, wakeStats: 0 };

  await mergeLocalAlarmsToCloud();
  await mergeLocalWakeStatsToCloud();

  const firestore = getFirebaseDb();
  const [settingsSnap, profileSnap, alarmsSnap, wakeStatsSnap] = await Promise.all([
    getDocs(collection(firestore, 'users', uid, 'settings')),
    getDoc(doc(firestore, 'users', uid, 'profile', 'main')),
    getDocs(collection(firestore, 'users', uid, 'alarms')),
    getDocs(collection(firestore, 'users', uid, 'wakeStats')),
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

    // Merge alarms: upsert cloud rows, keep local-only rows, dedupe by fingerprint.
    const localAlarms = await listAlarms();
    const localFpSet = new Set(localAlarms.map(a => alarmFingerprint(a)));
    const localById = new Map(localAlarms.map(a => [a.id, a]));

    let alarmCount = 0;
    for (const snap of alarmsSnap.docs) {
      const data = snap.data() as FirestoreAlarm;
      const idNum = Number(snap.id);
      if (!Number.isFinite(idNum)) continue;

      const alarm = firestoreToAlarm(idNum, data);
      const fp = alarmFingerprint(alarm);
      if (localFpSet.has(fp)) continue;

      const localAtId = localById.get(idNum);
      if (localAtId && alarmFingerprint(localAtId) !== fp) {
        await insertAlarmFromCloud({
          hour: data.hour,
          minute: data.minute,
          label: data.label,
          repeatDays: data.repeatDays ?? [],
          enabled: data.enabled !== false,
          sound: data.sound,
          vibration: data.vibration !== false,
          challenges: data.challenges ?? [],
          challengeParams: data.challengeParams,
        });
      } else {
        await upsertAlarmRowInDb(db, idNum, data);
      }
      localFpSet.add(fp);
      alarmCount += 1;
    }

    // Merge wake stats: upsert cloud rows, keep local-only rows, dedupe by fingerprint.
    let wakeStatCount = 0;
    for (const snap of wakeStatsSnap.docs) {
      const data = snap.data() as FirestoreWakeStat;
      const idNum = Number(snap.id);
      if (!Number.isFinite(idNum) || typeof data.date !== 'string' || typeof data.wakeTime !== 'string') {
        continue;
      }
      const alarmId = await resolveWakeStatAlarmId(db, data.alarmId);
      const fields = firestoreWakeStatToPayload(idNum, data, alarmId);
      const fp = wakeStatFingerprint(fields);

      const existingFp = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM wake_stats
         WHERE date = ? AND wake_time = ? AND success = ?
           AND COALESCE(challenge_type, '') = COALESCE(?, '')
           AND COALESCE(challenge_duration, -1) = COALESCE(?, -1)
           AND COALESCE(alarm_id, -1) = COALESCE(?, -1)`,
        [
          fields.date,
          fields.wakeTime,
          fields.success ? 1 : 0,
          fields.challengeType,
          fields.challengeDuration,
          fields.alarmId,
        ],
      );
      if (existingFp) continue;

      const localAtId = await db.getFirstAsync<{
        date: string;
        wake_time: string;
        success: number;
        challenge_duration: number | null;
        challenge_type: string | null;
        alarm_id: number | null;
      }>('SELECT date, wake_time, success, challenge_duration, challenge_type, alarm_id FROM wake_stats WHERE id = ?', [
        idNum,
      ]);

      const localFp = localAtId
        ? wakeStatFingerprint({
            date: localAtId.date,
            wakeTime: localAtId.wake_time,
            success: localAtId.success === 1,
            challengeDuration: localAtId.challenge_duration,
            challengeType: (localAtId.challenge_type as ChallengeType | null) ?? null,
            alarmId: localAtId.alarm_id,
          })
        : null;

      if (localAtId && localFp !== fp) {
        await db.runAsync(
          `INSERT INTO wake_stats (alarm_id, date, wake_time, success, challenge_duration, challenge_type)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            alarmId,
            fields.date,
            fields.wakeTime,
            fields.success ? 1 : 0,
            fields.challengeDuration,
            fields.challengeType,
          ],
        );
      } else {
        await db.runAsync(
          `INSERT INTO wake_stats (id, alarm_id, date, wake_time, success, challenge_duration, challenge_type)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             alarm_id = excluded.alarm_id,
             date = excluded.date,
             wake_time = excluded.wake_time,
             success = excluded.success,
             challenge_duration = excluded.challenge_duration,
             challenge_type = excluded.challenge_type`,
          [
            idNum,
            alarmId,
            fields.date,
            fields.wakeTime,
            fields.success ? 1 : 0,
            fields.challengeDuration,
            fields.challengeType,
          ],
        );
      }
      wakeStatCount += 1;
    }

    await rescheduleAllAlarms(await listAlarms());

    return { alarms: alarmCount, settings: settingsCount, wakeStats: wakeStatCount };
  });
}

let inFlightPush: Promise<{ alarms: number; wakeStats: number }> | null = null;
let inFlightSync: Promise<void> | null = null;

const PUSH_DEBOUNCE_MS = 2000;
const RECONNECT_PUSH_DELAYS_MS = [0, 1500, 4000];
let pushDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectBurstTimers: ReturnType<typeof setTimeout>[] = [];
let lastNetworkOnline: boolean | null = null;

/**
 * Upload local alarms and wake stats that are missing from Firestore (by
 * fingerprint). Does not pull — safe to run when connectivity returns.
 */
export async function pushUnsyncedToCloud(): Promise<{ alarms: number; wakeStats: number }> {
  const uid = getActiveUid();
  if (!uid) return { alarms: 0, wakeStats: 0 };

  if (inFlightPush) return inFlightPush;

  inFlightPush = (async () => {
    const alarms = await mergeLocalAlarmsToCloud();
    const wakeStats = await mergeLocalWakeStatsToCloud();
    if (__DEV__) {
      console.log(`[cloudSync] pushUnsynced done → alarms:${alarms} wakeStats:${wakeStats}`);
    }
    return { alarms, wakeStats };
  })();

  try {
    return await inFlightPush;
  } finally {
    inFlightPush = null;
  }
}

/** Debounced push after a failed per-write sync (e.g. offline burst). */
export function schedulePushUnsyncedToCloud(): void {
  if (!getActiveUid()) return;
  if (pushDebounceTimer) clearTimeout(pushDebounceTimer);
  pushDebounceTimer = setTimeout(() => {
    pushDebounceTimer = null;
    pushUnsyncedToCloud().catch(err => {
      if (__DEV__) {
        console.warn('[cloudSync] debounced pushUnsynced failed', err);
      }
    });
  }, PUSH_DEBOUNCE_MS);
}

/** True when we should attempt Firestore I/O (reachability can lag after Wi‑Fi toggles). */
function isConnectedForSync(state: NetInfoState): boolean {
  if (state.isConnected !== true) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

function clearReconnectBurstTimers(): void {
  for (const timer of reconnectBurstTimers) clearTimeout(timer);
  reconnectBurstTimers = [];
}

function runReconnectPushAttempt(label: string): void {
  const uid = getActiveUid();
  if (!uid) {
    if (__DEV__) {
      console.log(`[cloudSync] reconnect push skipped (${label}: not signed in)`);
    }
    return;
  }
  pushUnsyncedToCloud().catch(err => {
    if (__DEV__) {
      console.warn(`[cloudSync] reconnect push failed (${label})`, err);
    }
  });
}

/** Several delayed attempts — `isInternetReachable` often stays false briefly after Wi‑Fi returns. */
function scheduleReconnectPushBurst(): void {
  clearReconnectBurstTimers();
  for (const delayMs of RECONNECT_PUSH_DELAYS_MS) {
    const timer = setTimeout(() => {
      NetInfo.fetch()
        .then(state => {
          if (__DEV__) {
            console.log('[cloudSync] reconnect check', {
              delayMs,
              isConnected: state.isConnected,
              isInternetReachable: state.isInternetReachable,
            });
          }
          if (!isConnectedForSync(state)) return;
          runReconnectPushAttempt(`after ${delayMs}ms`);
        })
        .catch(err => {
          if (__DEV__) {
            console.warn('[cloudSync] NetInfo.fetch failed', err);
          }
        });
    }, delayMs);
    reconnectBurstTimers.push(timer);
  }
}

/**
 * When the device is back online or the app returns to foreground, push local
 * changes that never reached Firestore. Call once at app boot.
 */
export function subscribeCloudReconnectSync(): () => void {
  if (!isFirebaseConfigured()) return () => {};

  const unsubNet = NetInfo.addEventListener(state => {
    const online = isConnectedForSync(state);
    if (online && lastNetworkOnline === false) {
      if (__DEV__) {
        console.log('[cloudSync] network restored → scheduling push burst');
      }
      scheduleReconnectPushBurst();
    }
    lastNetworkOnline = online;
  });

  const subApp = AppState.addEventListener('change', (next: AppStateStatus) => {
    if (next === 'active') {
      NetInfo.fetch().then(state => {
        if (isConnectedForSync(state)) scheduleReconnectPushBurst();
      });
    }
  });

  NetInfo.fetch().then(state => {
    lastNetworkOnline = isConnectedForSync(state);
    if (lastNetworkOnline) scheduleReconnectPushBurst();
  });

  return () => {
    unsubNet();
    subApp.remove();
    clearReconnectBurstTimers();
    if (pushDebounceTimer) {
      clearTimeout(pushDebounceTimer);
      pushDebounceTimer = null;
    }
  };
}

/**
 * Called right after a successful sign-in. If the cloud has any of the user's
 * data, pull it down. Otherwise treat the local SQLite as the seed and push
 * it up so the user starts mirrored.
 *
 * Re-entrant: if a sync is already in flight (e.g. fired by both the auth
 * listener and the Settings sign-in handler), callers share the same promise.
 */
export async function syncOnSignIn(): Promise<void> {
  if (inFlightSync) return inFlightSync;
  const uid = getActiveUid();
  if (!uid) return;

  inFlightSync = (async () => {
    const firestore = getFirebaseDb();
    const [settingsSnap, profileSnap, alarmsSnap, wakeStatsSnap] = await Promise.all([
      getDocs(collection(firestore, 'users', uid, 'settings')),
      getDoc(doc(firestore, 'users', uid, 'profile', 'main')),
      getDocs(collection(firestore, 'users', uid, 'alarms')),
      getDocs(collection(firestore, 'users', uid, 'wakeStats')),
    ]);

    const cloudHasData =
      !settingsSnap.empty ||
      profileSnap.exists() ||
      !alarmsSnap.empty ||
      !wakeStatsSnap.empty;

    if (cloudHasData) {
      await pullCloudToLocal();
    } else {
      await mergeLocalAlarmsToCloud();
      await mergeLocalWakeStatsToCloud();
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
 * Delete all wake stats on this device. When signed into Firebase, also deletes
 * the user's `wakeStats` collection so a later sign-in does not restore them.
 */
export async function wipeWakeStats(): Promise<{ clearedCloud: boolean }> {
  await clearAllWakeStats();
  const uid = getActiveUid();
  if (!uid) return { clearedCloud: false };

  const firestore = getFirebaseDb();
  const snap = await getDocs(collection(firestore, 'users', uid, 'wakeStats'));
  const BATCH_SIZE = 450;
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(firestore);
    for (const d of snap.docs.slice(i, i + BATCH_SIZE)) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }
  return { clearedCloud: true };
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
