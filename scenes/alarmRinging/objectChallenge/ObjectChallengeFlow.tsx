import { useCallback, useRef, useState } from 'react';
import { ObjectChallengeIntro } from './ObjectChallengeIntro';
import { ObjectScanPhase } from './ObjectScanPhase';
import { pickRandomWakeObjectId, type WakeObjectId } from './objects';

type Step = 'intro' | 'scan';

export type ObjectChallengeCompletePayload = {
  durationSec: number;
  objectId: WakeObjectId;
  /** User continued without ML (Expo Go / web). */
  skipped?: boolean;
};

type Props = {
  /** When set, always use this target (dev preview). Otherwise random from library. */
  targetId?: WakeObjectId;
  onComplete: (payload: ObjectChallengeCompletePayload) => void;
};

export function ObjectChallengeFlow({ targetId: fixedTargetId, onComplete }: Props) {
  const [targetId] = useState<WakeObjectId>(() => fixedTargetId ?? pickRandomWakeObjectId());
  const [step, setStep] = useState<Step>('intro');
  const startedAtRef = useRef<number | null>(null);

  const handleAccept = useCallback(() => {
    startedAtRef.current = Date.now();
    setStep('scan');
  }, []);

  const finish = useCallback(
    (skipped?: boolean) => {
      const start = startedAtRef.current ?? Date.now();
      const durationSec = Math.max(1, Math.round((Date.now() - start) / 1000));
      onComplete({ durationSec, objectId: targetId, skipped });
    },
    [onComplete, targetId],
  );

  const handleSuccess = useCallback(() => {
    finish(false);
  }, [finish]);

  const handleSkipUnsupported = useCallback(() => {
    finish(true);
  }, [finish]);

  if (step === 'intro') {
    return <ObjectChallengeIntro targetId={targetId} onAccept={handleAccept} />;
  }

  return (
    <ObjectScanPhase
      targetId={targetId}
      onSuccess={handleSuccess}
      onSkipUnsupported={handleSkipUnsupported}
    />
  );
}
