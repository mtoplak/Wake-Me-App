import { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from '@/i18n';
import { colors } from '@/theme';
import { usePedometerProgress } from './usePedometerProgress';

type Props = {
  stepGoal: number;
  active: boolean;
  onSuccess: (stepsTaken: number) => void;
};

export function StepsChallengeActive({ stepGoal, active, onSuccess }: Props) {
  const { t } = useTranslation();
  const st = t.stepsChallenge;
  const { ready, available, permissionGranted, stepsTaken } = usePedometerProgress(active);
  const completedRef = useRef(false);
  const lastHapticAtRef = useRef(0);

  const progress = Math.min(1, stepGoal > 0 ? stepsTaken / stepGoal : 0);
  const remaining = Math.max(0, stepGoal - stepsTaken);

  const cheer = useMemo(() => {
    if (progress >= 1) return st.cheerDone;
    if (progress >= 0.85) return st.cheerAlmost;
    if (progress >= 0.5) return st.cheerHalf;
    if (stepsTaken > 0) return st.cheerMoving;
    return st.cheerStart;
  }, [progress, stepsTaken, st]);

  useEffect(() => {
    if (!active || !ready || !permissionGranted || completedRef.current) return;
    if (stepsTaken < stepGoal) return;
    completedRef.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSuccess(stepsTaken);
  }, [active, ready, permissionGranted, stepsTaken, stepGoal, onSuccess]);

  useEffect(() => {
    if (!active || stepsTaken === 0) return;
    const milestone = Math.floor(stepsTaken / 10) * 10;
    if (milestone > lastHapticAtRef.current && milestone < stepGoal) {
      lastHapticAtRef.current = milestone;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [active, stepsTaken, stepGoal]);

  if (!ready) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!available) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Ionicons name="footsteps-outline" size={48} color={colors.textMuted} />
          <Text style={styles.blockTitle}>{st.unavailableTitle}</Text>
          <Text style={styles.blockBody}>{st.unavailableBody}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permissionGranted) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Ionicons name="shield-outline" size={48} color={colors.textMuted} />
          <Text style={styles.blockTitle}>{st.permissionTitle}</Text>
          <Text style={styles.blockBody}>{st.permissionBody}</Text>
          <Pressable style={styles.btn} onPress={() => Linking.openSettings()}>
            <Text style={styles.btnText}>{st.openSettings}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.inner}>
        <Text style={styles.cheer}>{cheer}</Text>

        <View style={styles.ringOuter}>
          <View style={[styles.ringProgress, { height: `${Math.round(progress * 100)}%` }]} />
          <View style={styles.ringCenter}>
            <Text style={styles.stepsBig}>{stepsTaken}</Text>
            <Text style={styles.stepsOf}>/ {stepGoal}</Text>
          </View>
        </View>

        <Text style={styles.remaining}>
          {remaining === 0 ? st.goalReached : st.remaining(remaining)}
        </Text>
        <Text style={styles.hint}>{st.activeHint}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cheer: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.accent,
    textAlign: 'center',
    marginBottom: 28,
    minHeight: 48,
  },
  ringOuter: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 4,
    borderColor: colors.border,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    marginBottom: 24,
  },
  ringProgress: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.accentSoft,
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepsBig: {
    fontSize: 52,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -2,
  },
  stepsOf: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  remaining: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  blockTitle: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  blockBody: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  btn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  btnText: { color: colors.white, fontWeight: '700' },
});
