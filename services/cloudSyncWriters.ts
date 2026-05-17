/**
 * Cloud sync writers — stubbed while Firebase is removed.
 *
 * Re-implement these once a backend is wired back up. The exports and
 * signatures are preserved so call-sites in `services/database/*` continue to
 * compile and run as no-ops.
 */

import { Alarm } from './database/types';

export async function withSyncSuppressed<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}

export function syncAlarmUp(_alarm: Alarm): void {
  // no-op
}

export function syncAlarmDeleteUp(_alarmId: number): void {
  // no-op
}

export function syncSettingUp(_key: string, _value: string): void {
  // no-op
}
