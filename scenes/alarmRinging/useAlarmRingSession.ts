import { useCallback, type MutableRefObject } from 'react';
import type { Alarm } from '@/services/database';
import { recordWake } from '@/services/database';
import type { FetchedQuote } from '@/services/quoteApi';
import { fetchRandomQuote } from '@/services/quoteApi';
import type { ColorChallengeCompletePayload } from './colorChallenge';
import type { ObjectChallengeCompletePayload } from './objectChallenge';
import type { QrChallengeCompletePayload } from './qrChallenge';
import type { StepsChallengeCompletePayload } from './stepsChallenge';
import type { VoiceChallengeCompletePayload } from './voiceChallenge';
import type { FaceChallengeCompletePayload } from './faceChallenge';
import {
  buildWakeStatPayload,
  nextPhaseAfterChallenge,
  sessionHasRecordedActivity,
  type RingPhase,
  type RingSession,
} from './ringFlow';

type QuoteState = { text: string; author: string } | null;

type Options = {
  alarm: Alarm | null;
  setPhase: (phase: RingPhase) => void;
  setQuote: (quote: QuoteState) => void;
  quotePromiseRef: MutableRefObject<Promise<FetchedQuote | null> | null>;
  ringSessionRef: MutableRefObject<RingSession>;
};

export function useAlarmRingSession({
  alarm,
  setPhase,
  setQuote,
  quotePromiseRef,
  ringSessionRef,
}: Options) {
  const finishWithQuote = useCallback(async () => {
    const q = await (quotePromiseRef.current ?? fetchRandomQuote());
    setQuote(q);
    setPhase('quote');
  }, [quotePromiseRef, setPhase, setQuote]);

  const persistRingWake = useCallback(async () => {
    if (!alarm || ringSessionRef.current.wakeRecorded) return;
    const challenges = alarm.challenges ?? [];
    const session = ringSessionRef.current;
    if (!sessionHasRecordedActivity(challenges, session)) return;

    ringSessionRef.current.wakeRecorded = true;
    await recordWake(buildWakeStatPayload(alarm.id, challenges, session));
  }, [alarm, ringSessionRef]);

  const completeAlarmSession = useCallback(async () => {
    await persistRingWake();
    await finishWithQuote();
  }, [finishWithQuote, persistRingWake]);

  const advanceAfterChallenge = useCallback(
    (completed: Parameters<typeof nextPhaseAfterChallenge>[1], patch: Partial<RingSession>) => {
      Object.assign(ringSessionRef.current, patch);
      const challenges = alarm?.challenges ?? [];
      const nextPhase = nextPhaseAfterChallenge(challenges, completed);
      if (nextPhase) {
        setPhase(nextPhase);
        return true;
      }
      return false;
    },
    [alarm?.challenges, ringSessionRef, setPhase],
  );

  const handleQrChallengeComplete = useCallback(
    async ({ durationSec }: QrChallengeCompletePayload) => {
      if (advanceAfterChallenge('qr', { qrSec: durationSec })) return;
      await completeAlarmSession();
    },
    [advanceAfterChallenge, completeAlarmSession],
  );

  const handleStepsChallengeComplete = useCallback(
    async ({ durationSec }: StepsChallengeCompletePayload) => {
      if (advanceAfterChallenge('steps', { stepsSec: durationSec })) return;
      await completeAlarmSession();
    },
    [advanceAfterChallenge, completeAlarmSession],
  );

  const handleObjectChallengeComplete = useCallback(
    async ({ durationSec, skipped }: ObjectChallengeCompletePayload) => {
      const patch: Partial<RingSession> = skipped
        ? { objectSkipped: true }
        : { objectSec: durationSec };
      if (advanceAfterChallenge('object', patch)) return;
      await completeAlarmSession();
    },
    [advanceAfterChallenge, completeAlarmSession],
  );

  const handleColorChallengeComplete = useCallback(
    async ({ durationSec }: ColorChallengeCompletePayload) => {
      try {
        if (advanceAfterChallenge('color', { colorSec: durationSec })) return;
        await completeAlarmSession();
      } catch (err) {
        if (__DEV__) {
          console.warn('[AlarmRinging] color challenge complete failed', err);
        }
        try {
          await finishWithQuote();
        } catch {
          setPhase('ringing');
        }
      }
    },
    [advanceAfterChallenge, completeAlarmSession, finishWithQuote, setPhase],
  );

  const handleVoiceChallengeComplete = useCallback(
    async (payload?: VoiceChallengeCompletePayload) => {
      const patch: Partial<RingSession> = payload?.skipped
        ? { voiceSkipped: true }
        : payload
          ? { voiceSec: payload.durationSec }
          : {};
      if (advanceAfterChallenge('voice', patch)) return;
      await completeAlarmSession();
    },
    [advanceAfterChallenge, completeAlarmSession],
  );

  const handleFaceChallengeComplete = useCallback(
    async ({ durationSec, skipped }: FaceChallengeCompletePayload) => {
      const patch: Partial<RingSession> = skipped
        ? { faceSkipped: true }
        : { faceSec: durationSec };
      if (advanceAfterChallenge('face', patch)) return;
      await completeAlarmSession();
    },
    [advanceAfterChallenge, completeAlarmSession],
  );

  return {
    finishWithQuote,
    persistRingWake,
    completeAlarmSession,
    handleQrChallengeComplete,
    handleStepsChallengeComplete,
    handleObjectChallengeComplete,
    handleColorChallengeComplete,
    handleVoiceChallengeComplete,
    handleFaceChallengeComplete,
  };
}
