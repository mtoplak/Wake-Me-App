import { useCallback, useRef, useState } from 'react';
import { FaceChallengeIntro } from './FaceChallengeIntro';
import { FaceDetectionPhase } from './FaceDetectionPhase';
import { pickRandomFaceChallengeMode, type FaceChallengeMode } from './faceChallenges';

type Step = 'intro' | 'scan';

export type FaceChallengeCompletePayload = {
  durationSec: number;
  mode: FaceChallengeMode;
  /** User continued without face detection (Expo Go / web / no camera). */
  skipped?: boolean;
};

type Props = {
  /** When set, always use this mode (dev preview). Otherwise random per alarm. */
  modeOverride?: FaceChallengeMode;
  onComplete: (payload: FaceChallengeCompletePayload) => void;
};

export function FaceChallengeFlow({ modeOverride, onComplete }: Props) {
  const [mode] = useState<FaceChallengeMode>(() => modeOverride ?? pickRandomFaceChallengeMode());
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
      onComplete({ durationSec, mode, skipped });
    },
    [onComplete, mode],
  );

  const handleSuccess = useCallback(() => {
    finish(false);
  }, [finish]);

  const handleSkipUnsupported = useCallback(() => {
    finish(true);
  }, [finish]);

  if (step === 'intro') {
    return <FaceChallengeIntro mode={mode} onAccept={handleAccept} />;
  }

  return (
    <FaceDetectionPhase
      mode={mode}
      onSuccess={handleSuccess}
      onSkipUnsupported={handleSkipUnsupported}
    />
  );
}
