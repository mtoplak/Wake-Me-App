import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { listAlarms } from '@/services/database';
import { Alarm } from '@/services/database/types';
import { getNotificationsModule, setAlarmActiveForeground } from '@/services/alarmScheduler';
import { startKeepaliveAlarm } from '@/services/alarmKeepalive';

const POLL_INTERVAL_MS = 3_000;
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function shouldFire(alarm: Alarm, now: Date, lastFired: Map<number, number>): boolean {
  if (!alarm.enabled) return false;
  if (alarm.hour !== now.getHours() || alarm.minute !== now.getMinutes()) return false;
  if (alarm.repeatDays.length > 0) {
    const todayKey = DAY_KEYS[now.getDay()];
    if (!alarm.repeatDays.includes(todayKey)) return false;
  }
  const last = lastFired.get(alarm.id);
  // Block re-fire within the same minute
  if (last && now.getTime() - last < 60_000) return false;
  return true;
}

export function useAlarmWatcher() {
  const router = useRouter();
  const segments = useSegments();
  const lastFired = useRef<Map<number, number>>(new Map());
  const onAlarmRinging = useRef(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  onAlarmRinging.current = segments.some(s => s === 'alarmRinging');

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;

    const tick = async () => {
      if (onAlarmRinging.current) return;
      try {
        const alarms = await listAlarms();
        const now = new Date();
        const due = alarms.find(a => shouldFire(a, now, lastFired.current));
        if (due && !cancelled) {
          lastFired.current.set(due.id, now.getTime());
          router.push(`/(main)/alarmRinging?alarmId=${due.id}`);
        }
      } catch {}
    };

    const start = () => {
      if (tickRef.current) return;
      tick();
      tickRef.current = setInterval(tick, POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };

    start();
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') start();
      else stop();
    });

    return () => {
      cancelled = true;
      stop();
      sub.remove();
    };
  }, [router]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const Notifications = getNotificationsModule();
    if (!Notifications) return;

    // Fires when the user taps a notification — open the ringing screen.
    // Guarded against duplicate pushes: with the keepalive alive in background
    // the `Received` listener has often already pushed AlarmRinging by the
    // time the user taps, and a second push would stack a hidden instance
    // that resurfaces (and resets to the ringing phase via useFocusEffect)
    // the moment the visible one dismisses.
    const tapSub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as { alarmId?: unknown } | undefined;
      const raw = data?.alarmId;
      const alarmId = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
      if (Number.isFinite(alarmId)) {
        // Mark as fired so the 3 s polling tick respects its 60 s cooldown
        // and doesn't re-navigate when the dismiss screen exits inside the
        // same minute.
        lastFired.current.set(alarmId, Date.now());
        if (!onAlarmRinging.current) {
          router.push(`/(main)/alarmRinging?alarmId=${alarmId}`);
        }
      }
    });

    // Fires the moment a notification is delivered (incl. foreground). Flip the
    // suppression flag *immediately* so the next notification in the 30s burst
    // is silenced, and proactively navigate to the ringing screen so the in-app
    // looped audio takes over instead of waiting for the next watcher tick.
    // While the app is backgrounded, also swap the silent keepalive loop to
    // the real alarm sound so audio is continuous from second 0 — without
    // waiting for the user to tap the notification.
    const receiveSub = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data as
        | { alarmId?: unknown; alarmSound?: unknown }
        | undefined;
      const raw = data?.alarmId;
      const alarmId = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
      if (!Number.isFinite(alarmId)) return;
      // Mark as fired so the 3 s polling tick respects its 60 s cooldown
      // and doesn't re-navigate when the dismiss screen exits inside the
      // same minute.
      lastFired.current.set(alarmId, Date.now());
      setAlarmActiveForeground(true);
      const soundName = typeof data?.alarmSound === 'string' ? data.alarmSound : '';
      if (soundName) {
        startKeepaliveAlarm(soundName).catch(() => {});
      }
      if (!onAlarmRinging.current) {
        router.push(`/(main)/alarmRinging?alarmId=${alarmId}`);
      }
    });

    return () => {
      tapSub.remove();
      receiveSub.remove();
    };
  }, [router]);
}
