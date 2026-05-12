import { listAlarms, createAlarm, deleteAlarm, getAllSettings, setSetting } from './database';
import { Alarm } from './database/types';
import { withSyncSuppressed } from './cloudSyncWriters';
import { getAuth, getFirestore } from './firebase';

export { syncAlarmUp, syncAlarmDeleteUp, syncSettingUp } from './cloudSyncWriters';

function userDoc() {
  const auth = getAuth();
  const firestore = getFirestore();
  if (!auth || !firestore) return null;
  const uid = auth().currentUser?.uid;
  if (!uid) return null;
  return firestore().collection('users').doc(uid);
}

interface CloudAlarmDoc {
  hour: number;
  minute: number;
  label: string;
  repeatDays: string[];
  enabled: boolean;
  sound: string;
  vibration: boolean;
  challenges: string[];
}

function toCloudAlarm(a: Alarm): CloudAlarmDoc {
  return {
    hour: a.hour,
    minute: a.minute,
    label: a.label,
    repeatDays: a.repeatDays,
    enabled: a.enabled,
    sound: a.sound,
    vibration: a.vibration,
    challenges: a.challenges,
  };
}

/**
 * Push all local alarms + settings to Firestore.
 * Used after a fresh sign-in when the device has local data the cloud doesn't.
 */
export async function pushLocalToCloud(): Promise<void> {
  const root = userDoc();
  const firestore = getFirestore();
  if (!root || !firestore) return;

  const [alarms, settings] = await Promise.all([listAlarms(), getAllSettings()]);

  const batch = firestore().batch();
  const alarmsCol = root.collection('alarms');
  for (const alarm of alarms) {
    batch.set(alarmsCol.doc(String(alarm.id)), toCloudAlarm(alarm));
  }
  batch.set(root, { settings, updatedAt: firestore.FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();
}

/**
 * Pull cloud alarms + settings into local SQLite, replacing any local rows.
 * Wraps DB writes in withSyncSuppressed so they don't bounce back to Firestore.
 */
export async function pullCloudToLocal(): Promise<{ alarms: number; settings: number }> {
  const root = userDoc();
  if (!root) return { alarms: 0, settings: 0 };

  const [alarmsSnap, rootSnap] = await Promise.all([root.collection('alarms').get(), root.get()]);

  return withSyncSuppressed(async () => {
    const localAlarms = await listAlarms();
    for (const a of localAlarms) await deleteAlarm(a.id);

    let alarmCount = 0;
    for (const docSnap of alarmsSnap.docs) {
      const data = docSnap.data() as CloudAlarmDoc;
      await createAlarm({
        hour: data.hour,
        minute: data.minute,
        label: data.label ?? '',
        repeatDays: data.repeatDays ?? [],
        enabled: data.enabled,
        sound: data.sound,
        vibration: data.vibration,
        challenges: (data.challenges ?? []) as Alarm['challenges'],
      });
      alarmCount += 1;
    }

    let settingCount = 0;
    const remoteSettings = (rootSnap.data()?.settings ?? {}) as Record<string, string>;
    for (const [key, value] of Object.entries(remoteSettings)) {
      await setSetting(key, value);
      settingCount += 1;
    }

    return { alarms: alarmCount, settings: settingCount };
  });
}

/**
 * One-shot sync after sign-in: if cloud has data → pull it; otherwise push local up.
 * No-op in Expo Go (no Firebase available).
 */
export async function syncOnSignIn(): Promise<void> {
  const root = userDoc();
  if (!root) return;
  const alarmsSnap = await root.collection('alarms').limit(1).get();
  if (alarmsSnap.empty) {
    await pushLocalToCloud();
  } else {
    await pullCloudToLocal();
  }
}
