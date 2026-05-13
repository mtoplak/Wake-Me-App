import { Alarm } from './database/types';
import { getAuth, getFirestore } from './firebase';

let suppressed = false;

/**
 * Suppress per-write cloud sync while running a callback.
 * Used during pullCloudToLocal so SQLite writes don't bounce back to Firestore.
 */
export async function withSyncSuppressed<T>(fn: () => Promise<T>): Promise<T> {
  suppressed = true;
  try {
    return await fn();
  } finally {
    suppressed = false;
  }
}

function userDoc() {
  if (suppressed) return null;
  const auth = getAuth();
  const firestore = getFirestore();
  if (!auth || !firestore) return null;
  const uid = auth().currentUser?.uid;
  if (!uid) return null;
  return firestore().collection('users').doc(uid);
}

function toCloudAlarm(a: Alarm) {
  return {
    hour: a.hour,
    minute: a.minute,
    label: a.label,
    repeatDays: a.repeatDays,
    enabled: a.enabled,
    sound: a.sound,
    vibration: a.vibration,
    challenges: a.challenges,
    challengeParams: a.challengeParams ?? {},
  };
}

export function syncAlarmUp(alarm: Alarm): void {
  const root = userDoc();
  if (!root) return;
  root
    .collection('alarms')
    .doc(String(alarm.id))
    .set(toCloudAlarm(alarm))
    .catch(() => {
      // offline writes are queued by Firestore SDK; ignore transient errors
    });
}

export function syncAlarmDeleteUp(alarmId: number): void {
  const root = userDoc();
  if (!root) return;
  root
    .collection('alarms')
    .doc(String(alarmId))
    .delete()
    .catch(() => {
      // ignore
    });
}

export function syncSettingUp(key: string, value: string): void {
  const root = userDoc();
  if (!root) return;
  const firestore = getFirestore();
  if (!firestore) return;
  root
    .set(
      { settings: { [key]: value }, updatedAt: firestore.FieldValue.serverTimestamp() },
      { merge: true },
    )
    .catch(() => {
      // ignore
    });
}
