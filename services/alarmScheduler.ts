import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type * as NotificationsType from 'expo-notifications';
import { getDb } from './database/db';
import type { Alarm } from './database/types';

const ALARM_CATEGORY = 'wake-me-alarm';

// iOS caps individual notification sounds at 30 s and won't loop them. To
// approximate a continuous ring we schedule a burst of N notifications spaced
// 30 s apart. AlarmRinging cancels the remaining ones the moment the user
// reaches the screen — the foreground audio takes over from there.
const NOTIFICATION_INTERVAL_S = 30;
const RING_DURATION_S = 180; // 3 minutes
const N_BURST_NOTIFICATIONS = Math.ceil(RING_DURATION_S / NOTIFICATION_INTERVAL_S);

const JS_DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// Expo Go strips out expo-notifications native code in SDK 53+. Detect it and
// turn the scheduler into a no-op. Lazy-require the module so its side-effect
// init (DevicePushTokenAutoRegistration) never runs in Expo Go.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let cachedNotifs: typeof NotificationsType | null = null;
function getNotifs(): typeof NotificationsType | null {
  if (Platform.OS === 'web') return null;
  if (isExpoGo) return null;
  if (!cachedNotifs) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedNotifs = require('expo-notifications') as typeof NotificationsType;
  }
  return cachedNotifs;
}

let handlerConfigured = false;
let permissionPromise: Promise<boolean> | null = null;

// True while AlarmRinging is on screen — its in-app looped audio is the source
// of truth, so we silence the per-notification sound to avoid the burst
// stuttering over the loop.
let alarmActiveForeground = false;

export function setAlarmActiveForeground(active: boolean): void {
  alarmActiveForeground = active;
}

function configureHandler() {
  if (handlerConfigured) return;
  const Notifications = getNotifs();
  if (!Notifications) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: !alarmActiveForeground,
      shouldShowList: !alarmActiveForeground,
      shouldPlaySound: !alarmActiveForeground,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureAlarmPermissions(): Promise<boolean> {
  const Notifications = getNotifs();
  if (!Notifications) return false;
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
  const Notifications = getNotifs();
  if (!Notifications) return;
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

// Returns the next Date when this alarm should fire after `after`.
// If repeatDays is empty: next occurrence of hour:minute (today if still future,
// else tomorrow).
// If repeatDays has entries: next matching weekday's hour:minute strictly after
// `after`.
export function computeNextOccurrence(alarm: Alarm, after: Date = new Date()): Date {
  if (alarm.repeatDays.length === 0) {
    const d = new Date(after);
    d.setHours(alarm.hour, alarm.minute, 0, 0);
    if (d.getTime() <= after.getTime()) d.setDate(d.getDate() + 1);
    return d;
  }
  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(after);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(alarm.hour, alarm.minute, 0, 0);
    const dayKey = JS_DAY_KEYS[candidate.getDay()];
    if (alarm.repeatDays.includes(dayKey) && candidate.getTime() > after.getTime()) {
      return candidate;
    }
  }
  // Pathological fallback — repeatDays was non-empty but no match found in 8d.
  const d = new Date(after);
  d.setDate(d.getDate() + 1);
  d.setHours(alarm.hour, alarm.minute, 0, 0);
  return d;
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
  const Notifications = getNotifs();
  if (!Notifications) return;
  const ids = await takeStoredNotificationIds(alarmId);
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {}
  }
}

export async function scheduleAlarm(alarm: Alarm): Promise<void> {
  const Notifications = getNotifs();
  if (!Notifications) return;
  await cancelAlarm(alarm.id);
  if (!alarm.enabled) return;

  const granted = await ensureAlarmPermissions();
  if (!granted) return;
  await ensureAndroidChannel(alarm.sound);

  const channelId = androidChannelId(alarm.sound);
  const soundFiles = resolveSound(alarm.sound);
  const threadId = `wake-me-alarm-${alarm.id}`;

  const baseTime = computeNextOccurrence(alarm).getTime();
  const scheduledIds: string[] = [];

  for (let i = 0; i < N_BURST_NOTIFICATIONS; i++) {
    const fireAt = new Date(baseTime + i * NOTIFICATION_INTERVAL_S * 1000);
    const content: NotificationsType.NotificationContentInput = {
      title: alarm.label || 'Wake up',
      body: 'Tap to start your wake-up challenge.',
      sound: Platform.OS === 'ios' ? soundFiles.ios : soundFiles.android,
      data: { alarmId: alarm.id, category: ALARM_CATEGORY, burstIndex: i },
      ...(Platform.OS === 'ios' ? { threadIdentifier: threadId } : {}),
      ...(Platform.OS === 'android' ? { channelId } : {}),
    };
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
        ...(Platform.OS === 'android' ? { channelId } : {}),
      },
    });
    scheduledIds.push(id);
  }

  await storeNotificationIds(alarm.id, scheduledIds);
}

// Called from AlarmRinging the moment the user reaches the screen. Cancels any
// remaining notifications in the in-flight burst, dismisses ones already shown
// in the notification center, and (for repeating alarms) schedules the next
// occurrence. Non-repeating alarms are left alone — they're naturally done.
export async function acknowledgeAlarm(alarmId: number, alarm?: Alarm): Promise<void> {
  const Notifications = getNotifs();
  if (!Notifications) return;

  const ids = await takeStoredNotificationIds(alarmId);
  await Promise.all(
    ids.flatMap(id => [
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {}),
      Notifications.dismissNotificationAsync(id).catch(() => {}),
    ]),
  );

  if (alarm && alarm.enabled && alarm.repeatDays.length > 0) {
    // Re-arm for the next matching weekday (compute strictly after now).
    await scheduleAlarm(alarm);
  }
}

export async function rescheduleAllAlarms(alarms: Alarm[]): Promise<void> {
  const Notifications = getNotifs();
  if (!Notifications) return;
  for (const alarm of alarms) {
    await scheduleAlarm(alarm);
  }
}

// True when running inside Expo Go — useful for showing UI hints since
// notifications + custom sounds are unavailable here.
export function isRunningInExpoGo(): boolean {
  return isExpoGo;
}

// Lazy-loaded reference for adding listeners (notification-tap handling).
// Returns null in Expo Go so callers can no-op cleanly.
export function getNotificationsModule(): typeof NotificationsType | null {
  return getNotifs();
}

export { ALARM_CATEGORY };
