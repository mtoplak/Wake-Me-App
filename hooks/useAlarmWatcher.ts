import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { listAlarms } from '@/services/database';
import { Alarm } from '@/services/database/types';
import { getNotificationsModule } from '@/services/alarmScheduler';

const POLL_INTERVAL_MS = 15_000;
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
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as { alarmId?: number } | undefined;
      const alarmId = data?.alarmId;
      if (typeof alarmId === 'number') {
        router.push(`/(main)/alarmRinging?alarmId=${alarmId}`);
      }
    });
    return () => sub.remove();
  }, [router]);
}
