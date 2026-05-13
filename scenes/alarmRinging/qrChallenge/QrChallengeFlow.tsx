import { useCallback, useRef, useState } from 'react';
import { QrChallengeIntro } from './QrChallengeIntro';
import { QrScanPhase } from './QrScanPhase';

type Step = 'intro' | 'scan';

export type QrChallengeCompletePayload = {
  durationSec: number;
};

type Props = {
  requiredValue: string;
  onComplete: (payload: QrChallengeCompletePayload) => void;
};

export function QrChallengeFlow({ requiredValue, onComplete }: Props) {
  const [step, setStep] = useState<Step>('intro');
  const startedAtRef = useRef<number | null>(null);

  const handleAccept = useCallback(() => {
    startedAtRef.current = Date.now();
    setStep('scan');
  }, []);

  const handleSuccess = useCallback(() => {
    const start = startedAtRef.current ?? Date.now();
    const durationSec = Math.max(1, Math.round((Date.now() - start) / 1000));
    onComplete({ durationSec });
  }, [onComplete]);

  if (step === 'intro') {
    return <QrChallengeIntro onAccept={handleAccept} />;
  }
  return <QrScanPhase requiredValue={requiredValue} onSuccess={handleSuccess} />;
}
