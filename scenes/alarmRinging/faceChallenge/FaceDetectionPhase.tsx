import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/i18n';
import { colors } from '@/theme';
import type { FaceCameraView as FaceCameraViewType } from './FaceCameraView';
import { isFaceDetectionAvailable } from './faceDetection';
import {
  buildRandomSequence,
  HEAD_TURN_MIN_YAW_DEG,
  MOUTH_OPEN_MIN_RATIO,
  REQUIRED_CONSECUTIVE_MATCHES,
  SMILE_MIN_PROBABILITY,
  TWO_FACES_REQUIRED_COUNT,
  WINK_CLOSED_EYE_MAX_PROBABILITY,
  WINK_OPEN_EYE_MIN_PROBABILITY,
  type FaceChallengeMode,
  type FaceSequenceAction,
} from './faceChallenges';

// Lazy-load FaceCameraView. It imports react-native-vision-camera and the
// face-detector frame processor, both of which throw at require-time inside
// Expo Go (no native modules). We only ever mount it when
// isFaceDetectionAvailable() is true, so a runtime require — evaluated at
// render, not at module init — keeps the native modules out of the Expo Go
// startup graph.
let CachedFaceCameraView: typeof FaceCameraViewType | null = null;
function getFaceCameraView(): typeof FaceCameraViewType {
  if (!CachedFaceCameraView) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    CachedFaceCameraView = require('./FaceCameraView').FaceCameraView;
  }
  return CachedFaceCameraView as typeof FaceCameraViewType;
}

type Point = { x: number; y: number };
type FaceLandmarks = {
  MOUTH_BOTTOM: Point;
  MOUTH_LEFT: Point;
  MOUTH_RIGHT: Point;
};
type FaceLike = {
  yawAngle: number;
  smilingProbability: number;
  leftEyeOpenProbability: number;
  rightEyeOpenProbability: number;
  bounds: { width: number; height: number; x: number; y: number };
  landmarks?: Partial<FaceLandmarks>;
};

/**
 * Mouth-open ratio: perpendicular distance from MOUTH_BOTTOM to the
 * LEFT–RIGHT corner line, divided by mouth width. Rotation-invariant — we
 * can't assume +Y is "down" because vision-camera frames arrive in the
 * sensor's native (landscape) orientation while the phone is held portrait.
 * Returns null when ML Kit didn't return mouth landmarks for this face.
 */
function mouthOpenRatio(face: FaceLike): number | null {
  const lm = face.landmarks;
  if (!lm?.MOUTH_BOTTOM || !lm.MOUTH_LEFT || !lm.MOUTH_RIGHT) return null;
  const dx = lm.MOUTH_RIGHT.x - lm.MOUTH_LEFT.x;
  const dy = lm.MOUTH_RIGHT.y - lm.MOUTH_LEFT.y;
  const mouthWidth = Math.sqrt(dx * dx + dy * dy);
  if (mouthWidth < 1) return null;
  // |cross product| / |LEFT→RIGHT| = perpendicular distance from BOTTOM to
  // the line. Stays correct regardless of which way the face is rotated.
  const cross =
    dx * (lm.MOUTH_LEFT.y - lm.MOUTH_BOTTOM.y) - (lm.MOUTH_LEFT.x - lm.MOUTH_BOTTOM.x) * dy;
  const perpDist = Math.abs(cross) / mouthWidth;
  return perpDist / mouthWidth;
}

function isMouthOpen(face: FaceLike): boolean {
  const r = mouthOpenRatio(face);
  return r !== null && r >= MOUTH_OPEN_MIN_RATIO;
}

function isWink(face: FaceLike): boolean {
  const left = face.leftEyeOpenProbability;
  const right = face.rightEyeOpenProbability;
  // ML Kit returns -1 when classifications are disabled or the face is too
  // angled for a confident read — guard so a missing read doesn't satisfy the
  // closed-eye check.
  if (left < 0 || right < 0) return false;
  const leftWink =
    left <= WINK_CLOSED_EYE_MAX_PROBABILITY && right >= WINK_OPEN_EYE_MIN_PROBABILITY;
  const rightWink =
    right <= WINK_CLOSED_EYE_MAX_PROBABILITY && left >= WINK_OPEN_EYE_MIN_PROBABILITY;
  return leftWink || rightWink;
}

function actionMatches(action: FaceSequenceAction, face: FaceLike): boolean {
  switch (action) {
    case 'smile':
      return face.smilingProbability >= SMILE_MIN_PROBABILITY;
    case 'wink':
      return isWink(face);
    case 'headTurn':
      return Math.abs(face.yawAngle) >= HEAD_TURN_MIN_YAW_DEG;
    case 'tongue':
      return isMouthOpen(face);
  }
}

type Props = {
  mode: FaceChallengeMode;
  onSuccess: () => void;
  onSkipUnsupported?: () => void;
};

export function FaceDetectionPhase({ mode, onSuccess, onSkipUnsupported }: Props) {
  const { t } = useTranslation();
  const ft = t.faceChallenge;
  const matchedRef = useRef(false);
  const matchStreakRef = useRef(0);
  const stepIndexRef = useRef(0);
  const mlAvailable = isFaceDetectionAvailable();

  // Sequence is fixed per challenge instance — re-shuffling between steps would
  // mean the next prompt could be whatever pose the user happens to be holding,
  // collapsing the challenge to one step.
  const sequence = useMemo<FaceSequenceAction[]>(
    () => (mode === 'sequence' ? buildRandomSequence() : []),
    [mode],
  );
  const [stepIndex, setStepIndex] = useState(0);

  const handleFaces = useCallback(
    (faces: FaceLike[]) => {
      if (matchedRef.current) return;

      if (mode === 'twoFaces') {
        if (faces.length >= TWO_FACES_REQUIRED_COUNT) {
          matchStreakRef.current += 1;
          if (matchStreakRef.current >= REQUIRED_CONSECUTIVE_MATCHES) {
            matchedRef.current = true;
            onSuccess();
          }
          return;
        }
        matchStreakRef.current = 0;
        return;
      }

      // Sequence mode — work off the most prominent (first) face. Detection on
      // a single subject is more reliable than averaging across multiple, and
      // the prompts are designed for one user at a time.
      const primary = faces[0];
      const currentAction = sequence[stepIndexRef.current];
      if (!primary || !currentAction) {
        matchStreakRef.current = 0;
        return;
      }

      if (__DEV__) {
        // Throttled diagnostic: what does ML Kit see while the user tries the
        // current step? Helps tune thresholds against real readings.
        console.log(
          `[face-challenge] action=${currentAction}`,
          `smile=${primary.smilingProbability.toFixed(2)}`,
          `eyes=${primary.leftEyeOpenProbability.toFixed(2)}/${primary.rightEyeOpenProbability.toFixed(2)}`,
          `yaw=${primary.yawAngle.toFixed(1)}`,
          `mouthRatio=${mouthOpenRatio(primary)?.toFixed(3) ?? 'n/a'}`,
        );
      }

      if (actionMatches(currentAction, primary)) {
        matchStreakRef.current += 1;
        if (matchStreakRef.current >= REQUIRED_CONSECUTIVE_MATCHES) {
          matchStreakRef.current = 0;
          const next = stepIndexRef.current + 1;
          if (next >= sequence.length) {
            matchedRef.current = true;
            onSuccess();
            return;
          }
          stepIndexRef.current = next;
          setStepIndex(next);
        }
        return;
      }
      matchStreakRef.current = 0;
    },
    [mode, onSuccess, sequence],
  );

  if (!mlAvailable) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.unsupported}>
          <Ionicons name="phone-portrait-outline" size={48} color={colors.textMuted} />
          <Text style={styles.unsupportedTitle}>{ft.expoGoUnsupportedTitle}</Text>
          <Text style={styles.unsupportedBody}>{ft.expoGoUnsupportedBody}</Text>
          <Pressable style={styles.skipBtn} onPress={onSkipUnsupported}>
            <Text style={styles.skipBtnText}>{ft.skipUnsupported}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const FaceCameraView = getFaceCameraView();
  const overlay =
    mode === 'twoFaces' ? (
      <TwoFacesOverlay
        goalLabel={ft.goalLabel}
        title={ft.modes.twoFaces.title}
        hint={ft.modes.twoFaces.scanHint}
      />
    ) : (
      <SequenceOverlay
        actions={sequence}
        stepIndex={stepIndex}
        progressLabel={ft.sequence.stepProgress(stepIndex + 1, sequence.length)}
        actionLabels={ft.sequence.actions}
      />
    );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <FaceCameraView paused={matchedRef.current} onFaces={handleFaces} overlay={overlay} />
    </SafeAreaView>
  );
}

function TwoFacesOverlay({
  goalLabel,
  title,
  hint,
}: {
  goalLabel: string;
  title: string;
  hint: string;
}) {
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.topCard}>
        <Text style={styles.goalLabel}>{goalLabel}</Text>
        <Text style={styles.goalName}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
    </View>
  );
}

const ACTION_ICON: Record<FaceSequenceAction, keyof typeof Ionicons.glyphMap> = {
  wink: 'eye-outline',
  tongue: 'happy-outline',
  headTurn: 'swap-horizontal-outline',
  smile: 'happy-outline',
};

function SequenceOverlay({
  actions,
  stepIndex,
  progressLabel,
  actionLabels,
}: {
  actions: FaceSequenceAction[];
  stepIndex: number;
  progressLabel: string;
  actionLabels: Record<FaceSequenceAction, { title: string; hint: string }>;
}) {
  const current = actions[stepIndex];
  if (!current) return null;
  const meta = actionLabels[current];
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.topCard}>
        <Text style={styles.goalLabel}>{progressLabel}</Text>
        <View style={styles.actionRow}>
          <Ionicons name={ACTION_ICON[current]} size={28} color={colors.white} />
          <Text style={styles.goalName}>{meta.title}</Text>
        </View>
        <Text style={styles.hint}>{meta.hint}</Text>
        <View style={styles.dotsRow}>
          {actions.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < stepIndex && styles.dotDone,
                i === stepIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  topCard: {
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignSelf: 'stretch',
  },
  goalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  goalName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.85)',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: { backgroundColor: colors.accent },
  dotDone: { backgroundColor: colors.white },
  unsupported: {
    flex: 1,
    padding: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  unsupportedTitle: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  unsupportedBody: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  skipBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  skipBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
