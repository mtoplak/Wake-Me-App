import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/i18n';
import { colors } from '@/theme';
import type { Alarm } from '@/services/database';
import { resolveStepGoal } from './stepGoal';
import { StepsChallengeIntro } from './StepsChallengeIntro';
import { StepsChallengeActive } from './StepsChallengeActive';

type Step = 'intro' | 'active' | 'success';

export type StepsChallengeCompletePayload = {
  durationSec: number;
  stepsTaken: number;
  stepGoal: number;
};

type Props = {
  alarm?: Alarm | null;
  /** Override goal (dev screen). */
  stepGoal?: number;
  onComplete: (payload: StepsChallengeCompletePayload) => void;
};

export function StepsChallengeFlow({ alarm, stepGoal: fixedGoal, onComplete }: Props) {
  const { t } = useTranslation();
  const st = t.stepsChallenge;
  const [step, setStep] = useState<Step>('intro');
  const [stepGoal, setStepGoal] = useState(fixedGoal ?? 30);
  const startedAtRef = useRef<number | null>(null);
  const stepsTakenRef = useRef(0);
  const goalRef = useRef(stepGoal);
  goalRef.current = stepGoal;

  useEffect(() => {
    if (fixedGoal != null) return;
    resolveStepGoal(alarm).then(setStepGoal);
  }, [alarm, fixedGoal]);

  const handleAccept = useCallback(() => {
    startedAtRef.current = Date.now();
    setStep('active');
  }, []);

  const handleSuccess = useCallback(
    (taken: number) => {
      const start = startedAtRef.current ?? Date.now();
      const durationSec = Math.max(1, Math.round((Date.now() - start) / 1000));
      stepsTakenRef.current = taken;
      setStep('success');
      onComplete({
        durationSec,
        stepsTaken: taken,
        stepGoal: goalRef.current,
      });
    },
    [onComplete],
  );

  if (step === 'intro') {
    return <StepsChallengeIntro stepGoal={stepGoal} onAccept={handleAccept} />;
  }

  if (step === 'success') {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.successInner}>
          <Ionicons name="checkmark-circle" size={64} color={colors.success} />
          <Text style={styles.successTitle}>{st.successTitle}</Text>
          <Text style={styles.successBody}>{st.successBody}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <StepsChallengeActive
      stepGoal={stepGoal}
      active={step === 'active'}
      onSuccess={handleSuccess}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  successInner: {
    flex: 1,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    marginTop: 20,
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  successBody: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
