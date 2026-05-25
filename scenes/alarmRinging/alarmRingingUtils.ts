import type { Alarm } from '@/services/database';

export function parseRouteAlarmId(raw: string | string[] | undefined): number | null {
  if (raw === undefined) return null;
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (first === undefined || first === '') return null;
  const n = Number(first);
  return Number.isFinite(n) ? n : null;
}

export function formatAlarmTime(hour: number, minute: number) {
  const meridiem: 'AM' | 'PM' = hour < 12 ? 'AM' : 'PM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return {
    time: `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    meridiem,
  };
}

export function hasQrChallenge(alarm: Alarm | null): boolean {
  return !!alarm?.challenges?.includes('qr') && !!alarm.challengeParams?.qr;
}
