import { useCallback, useRef, useState } from 'react';
import { ColorChallengeIntro } from './ColorChallengeIntro';
import { ColorMemorizePhase } from './ColorMemorizePhase';
import { ColorMatchPhase } from './ColorMatchPhase';
import { randomPlayableTargetHsv } from './hsvColor';

type Step = 'intro' | 'memorize' | 'match';

export type ColorChallengeCompletePayload = {
  durationSec: number;
  accuracyPercent: number;
};

type Props = {
  onComplete: (payload: ColorChallengeCompletePayload) => void;
};

export function ColorChallengeFlow({ onComplete }: Props) {
  const [target, setTarget] = useState(() => randomPlayableTargetHsv());
  const [step, setStep] = useState<Step>('intro');
  const [matchRound, setMatchRound] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  const handleAccept = useCallback(() => {
    startedAtRef.current = Date.now();
    setStep('memorize');
  }, []);

  const handleMemorizeDone = useCallback(() => {
    setStep('match');
  }, []);

  const handleMatchFailed = useCallback(() => {
    setTarget(randomPlayableTargetHsv());
    setMatchRound(r => r + 1);
    setStep('memorize');
  }, []);

  const handleMatchSuccess = useCallback(
    ({ accuracyPercent }: { accuracyPercent: number }) => {
      const start = startedAtRef.current ?? Date.now();
      const durationSec = Math.max(1, Math.round((Date.now() - start) / 1000));
      try {
        onComplete({ durationSec, accuracyPercent });
      } catch (err) {
        if (__DEV__) {
          console.warn('[colorChallenge] onComplete failed', err);
        }
      }
    },
    [onComplete],
  );

  if (step === 'intro') {
    return <ColorChallengeIntro onAccept={handleAccept} />;
  }
  if (step === 'memorize') {
    return <ColorMemorizePhase target={target} onDone={handleMemorizeDone} />;
  }
  return (
    <ColorMatchPhase
      key={matchRound}
      target={target}
      onSuccess={handleMatchSuccess}
      onFailedMatch={handleMatchFailed}
    />
  );
}
