/**
 * Background "keepalive" service that holds an iOS audio session open while
 * any alarm is armed in the future. Without this, iOS suspends the JS runtime
 * the moment the app is backgrounded and our only way to ring is the local
 * notification — which iOS caps at 30 s and can't loop, leaving audible gaps.
 *
 * Playbook (the trick every iOS alarm app uses):
 *   1) `UIBackgroundModes: ["audio"]` in Info.plist + `shouldPlayInBackground:
 *      true` on the audio session.
 *   2) Loop a near-silent file at very low volume — iOS keeps the app alive
 *      because audio is "actively playing" but the user hears nothing.
 *   3) When alarm time hits while backgrounded, swap the silent source for
 *      the real alarm sound at full volume on the same player so there's no
 *      session-reacquisition gap.
 *   4) When `AlarmRinging` foregrounds, it stops the keepalive and plays its
 *      own audio (the dismiss UI). On exit we re-arm silent loop if more
 *      alarms remain.
 *   5) Scheduled notifications still fire as a backup in case iOS killed the
 *      session (force-quit, system pressure, etc.).
 *
 * iOS-only. Android handles alarms via the alarm-category notification channel
 * and doesn't need (and won't grant) audio-mode background continuation.
 */

import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { AudioPlayer } from 'expo-audio';
import { alarmSounds } from '@/scenes/alarmRinging/sounds';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const silentSource = require('@/assets/sounds/silent.mp3');

type ExpoAudio = typeof import('expo-audio');

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let cachedAudio: ExpoAudio | null = null;
function getAudio(): ExpoAudio | null {
  if (Platform.OS !== 'ios') return null;
  if (isExpoGo) return null;
  if (!cachedAudio) {
    try {
      cachedAudio = require('expo-audio') as ExpoAudio;
    } catch {
      return null;
    }
  }
  return cachedAudio;
}

type Mode = 'idle' | 'silent' | 'alarm';

let player: AudioPlayer | null = null;
let mode: Mode = 'idle';
// `AlarmRinging` owns the audio session while it's mounted — suppress any
// refresh() calls (e.g. from `acknowledgeAlarm` re-arming a repeating alarm)
// that would otherwise spawn a redundant silent loop alongside the ring audio.
let suspended = false;

async function configureSession(mixWithOthers: boolean): Promise<void> {
  const audio = getAudio();
  if (!audio) return;
  await audio.setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: mixWithOthers ? 'mixWithOthers' : 'doNotMix',
  });
}

function ensurePlayer(audio: ExpoAudio, source: number): AudioPlayer {
  if (player) {
    try {
      player.replace(source);
    } catch {
      try {
        player.remove();
      } catch {}
      player = audio.createAudioPlayer(source);
    }
    return player;
  }
  player = audio.createAudioPlayer(source);
  return player;
}

export async function startKeepaliveSilent(): Promise<void> {
  const audio = getAudio();
  if (!audio) return;
  if (mode === 'silent') return;
  await configureSession(true);
  try {
    const p = ensurePlayer(audio, silentSource);
    p.loop = true;
    p.volume = 0.001;
    p.play();
    mode = 'silent';
  } catch {
    mode = 'idle';
  }
}

/**
 * Swap to the real alarm sound at full volume. Called from the notification
 * received listener when the alarm fires while the app is backgrounded — by
 * the time `AlarmRinging` mounts (or instead of it, if user ignores the
 * notification) audio is already ringing.
 */
export async function startKeepaliveAlarm(soundName: string): Promise<void> {
  const audio = getAudio();
  if (!audio) return;
  const source = alarmSounds[soundName] ?? Object.values(alarmSounds)[0];
  if (!source) return;
  await configureSession(false);
  try {
    const p = ensurePlayer(audio, source);
    p.loop = true;
    p.volume = 1;
    p.play();
    mode = 'alarm';
  } catch {
    mode = 'idle';
  }
}

export async function stopKeepalive(): Promise<void> {
  if (player) {
    try {
      player.pause();
    } catch {}
    try {
      player.remove();
    } catch {}
    player = null;
  }
  mode = 'idle';
  const audio = getAudio();
  if (audio) {
    await audio.setIsAudioActiveAsync(false).catch(() => {});
  }
}

export function getKeepaliveMode(): Mode {
  return mode;
}

export function suspendKeepalive(): void {
  suspended = true;
}

export function resumeKeepalive(): void {
  suspended = false;
}

/**
 * Look at the current alarm set and decide whether the silent loop should be
 * running. Called after every schedule / cancel / reschedule and after the
 * dismiss screen exits.
 */
export async function refreshKeepalive(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  if (isExpoGo) return;
  if (suspended) return;
  // Lazy-require to avoid a circular dep with alarmScheduler → keepalive.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { listAlarms } = require('@/services/database') as typeof import('@/services/database');
  let anyEnabled = false;
  try {
    const alarms = await listAlarms();
    anyEnabled = alarms.some(a => a.enabled);
  } catch {
    // DB not ready yet (very early app launch) — bail; next call will retry.
    return;
  }
  if (anyEnabled) {
    if (mode === 'idle') await startKeepaliveSilent();
  } else {
    if (mode !== 'idle') await stopKeepalive();
  }
}
