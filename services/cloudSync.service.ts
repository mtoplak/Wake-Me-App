/**
 * Cloud sync service — stubbed while Firebase is removed.
 *
 * Original implementation pushed alarms + settings to Firestore and pulled
 * them back on sign-in. Re-implement once a backend is wired back up. The
 * exports are preserved so call-sites in scenes/* continue to compile and run
 * as no-ops.
 */

export { syncAlarmUp, syncAlarmDeleteUp, syncSettingUp } from './cloudSyncWriters';

export async function pushLocalToCloud(): Promise<void> {
  // no-op
}

export async function pullCloudToLocal(): Promise<{ alarms: number; settings: number }> {
  return { alarms: 0, settings: 0 };
}

export async function syncOnSignIn(): Promise<void> {
  // no-op
}
