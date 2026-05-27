import type { ChallengeType } from '@/services/database';

export const RING_FLOW_CHALLENGE_TYPES = new Set<ChallengeType>([
  'steps',
  'object',
  'color',
  'voice',
  'face',
]);

export type RingPhase =
  | 'ringing'
  | 'qrChallenge'
  | 'stepsChallenge'
  | 'objectChallenge'
  | 'colorChallenge'
  | 'voiceChallenge'
  | 'faceChallenge'
  | 'quote';

export type RingSession = {
  wakeRecorded?: boolean;
  qrSec?: number;
  stepsSec?: number;
  objectSec?: number;
  objectSkipped?: boolean;
  colorSec?: number;
  voiceSec?: number;
  voiceSkipped?: boolean;
  faceSec?: number;
  faceSkipped?: boolean;
};

export function phaseForChallenge(type: ChallengeType): RingPhase | null {
  switch (type) {
    case 'steps':
      return 'stepsChallenge';
    case 'object':
      return 'objectChallenge';
    case 'color':
      return 'colorChallenge';
    case 'voice':
      return 'voiceChallenge';
    case 'face':
      return 'faceChallenge';
    default:
      return null;
  }
}

export function sessionHasRecordedActivity(
  challenges: ChallengeType[],
  session: RingSession,
): boolean {
  if (challenges.includes('qr') && (session.qrSec ?? 0) > 0) return true;
  if (challenges.includes('steps') && (session.stepsSec ?? 0) > 0) return true;
  if (challenges.includes('object') && !session.objectSkipped && (session.objectSec ?? 0) > 0) {
    return true;
  }
  if (challenges.includes('color') && (session.colorSec ?? 0) > 0) return true;
  if (challenges.includes('voice') && !session.voiceSkipped && (session.voiceSec ?? 0) > 0) {
    return true;
  }
  if (challenges.includes('face') && !session.faceSkipped && (session.faceSec ?? 0) > 0) {
    return true;
  }
  return false;
}

export function totalChallengeDuration(challenges: ChallengeType[], session: RingSession): number {
  let sum = 0;
  if (challenges.includes('qr')) sum += session.qrSec ?? 0;
  if (challenges.includes('steps')) sum += session.stepsSec ?? 0;
  if (challenges.includes('object') && !session.objectSkipped) sum += session.objectSec ?? 0;
  sum += session.colorSec ?? 0;
  if (!session.voiceSkipped) sum += session.voiceSec ?? 0;
  if (challenges.includes('face') && !session.faceSkipped) sum += session.faceSec ?? 0;
  return Math.max(1, sum);
}

/** Every challenge finished this wake (alarm order) — drives streak breakdown. */
export function completedChallengeTypesInSession(
  challenges: ChallengeType[],
  session: RingSession,
): ChallengeType[] {
  const completed: ChallengeType[] = [];
  for (const c of challenges) {
    switch (c) {
      case 'qr':
        if ((session.qrSec ?? 0) > 0) completed.push(c);
        break;
      case 'steps':
        if ((session.stepsSec ?? 0) > 0) completed.push(c);
        break;
      case 'object':
        if (!session.objectSkipped && (session.objectSec ?? 0) > 0) completed.push(c);
        break;
      case 'color':
        if ((session.colorSec ?? 0) > 0) completed.push(c);
        break;
      case 'voice':
        if (!session.voiceSkipped && (session.voiceSec ?? 0) > 0) completed.push(c);
        break;
      case 'face':
        if (!session.faceSkipped && (session.faceSec ?? 0) > 0) completed.push(c);
        break;
      default:
        break;
    }
  }
  return completed;
}

/** Last completed challenge — shown as primary type in recent wake history. */
export function primaryChallengeType(
  challenges: ChallengeType[],
  session: RingSession,
): ChallengeType {
  let last: ChallengeType | null = null;
  for (const c of challenges) {
    switch (c) {
      case 'qr':
        if ((session.qrSec ?? 0) > 0) last = c;
        break;
      case 'steps':
        if ((session.stepsSec ?? 0) > 0) last = c;
        break;
      case 'object':
        if (!session.objectSkipped && (session.objectSec ?? 0) > 0) last = c;
        break;
      case 'color':
        if ((session.colorSec ?? 0) > 0) last = c;
        break;
      case 'voice':
        if (!session.voiceSkipped && (session.voiceSec ?? 0) > 0) last = c;
        break;
      case 'face':
        if (!session.faceSkipped && (session.faceSec ?? 0) > 0) last = c;
        break;
      default:
        break;
    }
  }
  return last ?? 'color';
}

export function firstRingFlowChallenge(challenges: ChallengeType[]): ChallengeType | null {
  for (const c of challenges) {
    if (RING_FLOW_CHALLENGE_TYPES.has(c)) return c;
  }
  return null;
}

export function nextRingFlowChallenge(
  challenges: ChallengeType[],
  completed: ChallengeType,
): ChallengeType | null {
  const idx = challenges.indexOf(completed);
  if (idx === -1) return null;
  for (let i = idx + 1; i < challenges.length; i++) {
    const c = challenges[i];
    if (RING_FLOW_CHALLENGE_TYPES.has(c)) return c;
  }
  return null;
}

export function formatWakeDateParts(now = new Date()): { date: string; wakeTime: string } {
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const wakeTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return { date, wakeTime };
}

export function buildWakeStatPayload(
  alarmId: number,
  challenges: ChallengeType[],
  session: RingSession,
) {
  const { date, wakeTime } = formatWakeDateParts();
  const completedChallengeTypes = completedChallengeTypesInSession(challenges, session);
  return {
    alarmId,
    date,
    wakeTime,
    success: true as const,
    challengeDuration: totalChallengeDuration(challenges, session),
    challengeType: primaryChallengeType(challenges, session),
    completedChallengeTypes,
  };
}

export function nextPhaseAfterChallenge(
  challenges: ChallengeType[],
  completed: ChallengeType,
): RingPhase | null {
  const next = nextRingFlowChallenge(challenges, completed);
  return next ? phaseForChallenge(next) : null;
}

/** Phases where alarm audio should keep playing. */
export function shouldPlayAlarmAudio(phase: RingPhase): boolean {
  return (
    phase === 'ringing' ||
    phase === 'qrChallenge' ||
    phase === 'stepsChallenge' ||
    phase === 'objectChallenge' ||
    phase === 'colorChallenge' ||
    phase === 'voiceChallenge' ||
    phase === 'faceChallenge'
  );
}
