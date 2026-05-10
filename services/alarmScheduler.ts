import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { getDb } from './database/db';
import type { Alarm } from './database/types';

const ALARM_CATEGORY = 'wake-me-alarm';

// expo-notifications weekday: Sunday = 1 ... Saturday = 7
const WEEKDAY_MAP: Record<string, number> = {
  sun: 1,
  mon: 2,
  tue: 3,
  wed: 4,
  thu: 5,
  fri: 6,
  sat: 7,
};

let handlerConfigured = false;
let permissionPromise: Promise<boolean> | null = null;

function configureHandler() {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureAlarmPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  configureHandler();
  if (permissionPromise) return permissionPromise;
  permissionPromise = (async () => {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const next = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: true,
      },
    });
    return next.granted;
  })();
  return permissionPromise;
}

// Maps a sound name (as stored on the alarm) to the bundled notification
// asset basenames produced by scripts/generate-notification-sounds.js.
// iOS expects the filename with extension; Android wants the basename
// (the system looks it up in res/raw, which the expo-notifications plugin
// populates from the `sounds:` config in app.config.ts).
const SOUND_FILES: Record<string, { ios: string; android: string }> = {
  Sunrise: { ios: 'sunrise.caf', android: 'sunrise' },
  Chimes: { ios: 'chimes.caf', android: 'chimes' },
  Birds: { ios: 'birds.caf', android: 'birds' },
};

function resolveSound(name: string): { ios: string; android: string } {
  return SOUND_FILES[name] ?? SOUND_FILES.Sunrise;
}

function androidChannelId(soundName: string): string {
  const slug = soundName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `alarms-${slug || 'default'}`;
}

async function ensureAndroidChannel(soundName: string) {
  if (Platform.OS !== 'android') return;
  const channelId = androidChannelId(soundName);
  const sound = resolveSound(soundName);
  await Notifications.setNotificationChannelAsync(channelId, {
    name: `Alarms · ${soundName}`,
    importance: Notifications.AndroidImportance.MAX,
    sound: sound.android,
    vibrationPattern: [0, 600, 400, 600],
    lightColor: '#FF231F7C',
    bypassDnd: true,
  });
}

function nextDateFor(hour: number, minute: number): Date {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target;
}

async function storeNotificationIds(alarmId: number, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  for (const id of ids) {
    await db.runAsync('INSERT INTO alarm_notifications (alarm_id, notification_id) VALUES (?, ?)', [
      alarmId,
      id,
    ]);
  }
}

async function takeStoredNotificationIds(alarmId: number): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ notification_id: string }>(
    'SELECT notification_id FROM alarm_notifications WHERE alarm_id = ?',
    [alarmId],
  );
  await db.runAsync('DELETE FROM alarm_notifications WHERE alarm_id = ?', [alarmId]);
  return rows.map(r => r.notification_id);
}

export async function cancelAlarm(alarmId: number): Promise<void> {
  if (Platform.OS === 'web') return;
  const ids = await takeStoredNotificationIds(alarmId);
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {}
  }
}

export async function scheduleAlarm(alarm: Alarm): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelAlarm(alarm.id);
  if (!alarm.enabled) return;

  const granted = await ensureAlarmPermissions();
  if (!granted) return;
  await ensureAndroidChannel(alarm.sound);

  const channelId = androidChannelId(alarm.sound);
  const soundFiles = resolveSound(alarm.sound);
  const content: Notifications.NotificationContentInput = {
    title: alarm.label || 'Wake up',
    body: 'Tap to start your wake-up challenge.',
    sound: Platform.OS === 'ios' ? soundFiles.ios : soundFiles.android,
    data: { alarmId: alarm.id, category: ALARM_CATEGORY },
    ...(Platform.OS === 'android' ? { channelId } : {}),
  };

  const scheduledIds: string[] = [];

  if (alarm.repeatDays.length === 0) {
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: nextDateFor(alarm.hour, alarm.minute),
        ...(Platform.OS === 'android' ? { channelId } : {}),
      },
    });
    scheduledIds.push(id);
  } else {
    for (const day of alarm.repeatDays) {
      const weekday = WEEKDAY_MAP[day];
      if (!weekday) continue;
      const id = await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour: alarm.hour,
          minute: alarm.minute,
          ...(Platform.OS === 'android' ? { channelId } : {}),
        },
      });
      scheduledIds.push(id);
    }
  }

  await storeNotificationIds(alarm.id, scheduledIds);
}

export async function rescheduleAllAlarms(alarms: Alarm[]): Promise<void> {
  if (Platform.OS === 'web') return;
  for (const alarm of alarms) {
    await scheduleAlarm(alarm);
  }
}

// Fires a notification with the given sound `delaySeconds` from now so you can
// verify sound works on-device. Lock the phone after pressing — custom iOS
// sounds only play when the app is in the background.
//
// Pass `__default__` as soundName to test the iOS system default sound.
// Pass `__none__` to test no sound at all.
export async function fireTestNotification(
  soundName: string,
  delaySeconds = 5,
): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const granted = await ensureAlarmPermissions();
  if (!granted) return null;

  const isDefault = soundName === '__default__';
  const isNone = soundName === '__none__';

  let sound: string | boolean | null;
  let channelId: string;

  if (isNone) {
    sound = false;
    await Notifications.setNotificationChannelAsync('alarms-test-silent', {
      name: 'Alarms · test silent',
      importance: Notifications.AndroidImportance.MAX,
      sound: null,
    });
    channelId = 'alarms-test-silent';
  } else if (isDefault) {
    sound = 'default';
    await Notifications.setNotificationChannelAsync('alarms-test-default', {
      name: 'Alarms · test default',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
    });
    channelId = 'alarms-test-default';
  } else {
    await ensureAndroidChannel(soundName);
    channelId = androidChannelId(soundName);
    const soundFiles = resolveSound(soundName);
    sound = Platform.OS === 'ios' ? soundFiles.ios : soundFiles.android;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `Test: ${isDefault ? 'iOS default' : isNone ? 'silent' : soundName}`,
      body: 'If you hear this, sound is working.',
      sound,
      data: { test: true },
      ...(Platform.OS === 'android' ? { channelId } : {}),
    },
    trigger: {
      type: SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, delaySeconds),
      ...(Platform.OS === 'android' ? { channelId } : {}),
    },
  });
}

export { ALARM_CATEGORY };
