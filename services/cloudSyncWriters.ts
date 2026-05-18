/**
 * Cloud sync writers — fire-and-forget pushes of local DB mutations to
 * Firestore.
 *
 * Each writer:
 *   1. Bails out silently if no user is signed in or sync is suppressed.
 *   2. Runs async without awaiting, so DB mutators stay snappy.
 *   3. Logs (in dev) on failure but never throws — local SQLite remains the
 *      source of truth.
 *
 * Firestore layout (per user):
 *   users/{uid}/settings/{key}         → { value, updatedAt }
 *   users/{uid}/profile/main           → { name, email, language, updatedAt }
 *   users/{uid}/alarms/{alarmId}       → { ...alarm fields, updatedAt }
 */

import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Alarm } from './database/types';
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from './firebase';

let suppressed = 0;

export async function withSyncSuppressed<T>(fn: () => Promise<T>): Promise<T> {
  suppressed += 1;
  try {
    return await fn();
  } finally {
    suppressed -= 1;
  }
}

function getActiveUid(): string | null {
  if (suppressed > 0) return null;
  if (!isFirebaseConfigured()) return null;
  try {
    return getFirebaseAuth().currentUser?.uid ?? null;
  } catch {
    return null;
  }
}

function logSyncError(operation: string, err: unknown): void {
  if (__DEV__) {
    console.warn(`[cloudSync] ${operation} failed`, err);
  }
}

function logSyncOk(operation: string, key: string): void {
  if (__DEV__) {
    console.log(`[cloudSync] ${operation} → ${key}`);
  }
}

function alarmToFirestore(alarm: Alarm) {
  return {
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
  };
}

export function syncAlarmUp(alarm: Alarm): void {
  const uid = getActiveUid();
  if (!uid) return;
  const ref = doc(getFirebaseDb(), 'users', uid, 'alarms', String(alarm.id));
  setDoc(ref, alarmToFirestore(alarm))
    .then(() => logSyncOk('alarm', String(alarm.id)))
    .catch(err => logSyncError('syncAlarmUp', err));
}

export function syncAlarmDeleteUp(alarmId: number): void {
  const uid = getActiveUid();
  if (!uid) return;
  const ref = doc(getFirebaseDb(), 'users', uid, 'alarms', String(alarmId));
  deleteDoc(ref)
    .then(() => logSyncOk('alarm-delete', String(alarmId)))
    .catch(err => logSyncError('syncAlarmDeleteUp', err));
}

export function syncSettingUp(key: string, value: string): void {
  const uid = getActiveUid();
  if (!uid) return;
  const ref = doc(getFirebaseDb(), 'users', uid, 'settings', key);
  setDoc(ref, { value, updatedAt: serverTimestamp() })
    .then(() => logSyncOk('setting', key))
    .catch(err => logSyncError('syncSettingUp', err));
}

export function syncProfileUp(profile: { name: string; email: string; language: string }): void {
  const uid = getActiveUid();
  if (!uid) return;
  const ref = doc(getFirebaseDb(), 'users', uid, 'profile', 'main');
  setDoc(ref, { ...profile, updatedAt: serverTimestamp() })
    .then(() => logSyncOk('profile', 'main'))
    .catch(err => logSyncError('syncProfileUp', err));
}
