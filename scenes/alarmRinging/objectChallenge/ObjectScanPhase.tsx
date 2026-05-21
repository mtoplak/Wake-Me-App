import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/i18n';
import { colors } from '@/theme';
import type { ObjectCameraView as ObjectCameraViewType } from './ObjectCameraView';
import { isObjectDetectionAvailable, type ImageLabel } from './objectDetection';
import { objectDetectedInLabels } from './matchObjectLabel';
import type { WakeObjectId } from './objects';

// Lazy-load ObjectCameraView. It imports react-native-vision-camera, whose
// native module throws a CameraError at require-time inside Expo Go. We only
// ever render it when isObjectDetectionAvailable() is true (dev/release build),
// so a runtime require() — evaluated at render, not at module init — keeps the
// vision-camera module out of the Expo Go startup graph.
let CachedObjectCameraView: typeof ObjectCameraViewType | null = null;
function getObjectCameraView(): typeof ObjectCameraViewType {
  if (!CachedObjectCameraView) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    CachedObjectCameraView = require('./ObjectCameraView').ObjectCameraView;
  }
  return CachedObjectCameraView as typeof ObjectCameraViewType;
}

const WRONG_TOAST_MS = 1600;
/**
 * Number of consecutive frames the matcher must succeed before we declare a
 * win. The frame processor runs at ~5 Hz, so 2 in a row ≈ 400 ms of stable
 * detection. This is the main guard against false positives from random
 * misclassifications: a real object held in frame produces stable top-3 hits,
 * while a flicker (one rogue rank-3 guess) doesn't survive the next frame.
 */
const REQUIRED_CONSECUTIVE_MATCHES = 2;

type Props = {
  targetId: WakeObjectId;
  onSuccess: () => void;
  onSkipUnsupported?: () => void;
};

export function ObjectScanPhase({ targetId, onSuccess, onSkipUnsupported }: Props) {
  const { t } = useTranslation();
  const ot = t.objectChallenge;
  const targetName = ot.objects[targetId];
  const matchedRef = useRef(false);
  const matchStreakRef = useRef(0);
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [wrongAt, setWrongAt] = useState(0);
  const toastFade = useRef(new Animated.Value(0)).current;
  const lastWrongAtRef = useRef(0);
  const mlAvailable = isObjectDetectionAvailable();

  const handleLabels = useCallback(
    (labels: ImageLabel[]) => {
      if (matchedRef.current) return;
      if (__DEV__) {
        // Throttled debug print of top-5: confirms what MobileNet actually sees
        // each scan. Remove (or gate behind a feature flag) once tuning is done.
        console.log(
          `[object-challenge] target=${targetId} top5=`,
          labels.map(l => `${l.text}:${l.confidence.toFixed(2)}`).join(' | '),
        );
      }
      if (objectDetectedInLabels(targetId, labels)) {
        matchStreakRef.current += 1;
        if (matchStreakRef.current >= REQUIRED_CONSECUTIVE_MATCHES) {
          matchedRef.current = true;
          onSuccess();
        }
        return;
      }
      matchStreakRef.current = 0;
      // Only flash the "wrong" toast when the model is meaningfully confident
      // about its top guess — i.e. the gap from top-1 to top-2 is wide. Without
      // this check, an empty/dark room (uniform-ish distribution where all top-5
      // are ~1.0 relative to each other) would buzz constantly.
      const top2Ratio = labels[1]?.confidence ?? 1;
      const isConfident = top2Ratio < 0.75;
      if (isConfident && Date.now() - lastWrongAtRef.current > WRONG_TOAST_MS) {
        lastWrongAtRef.current = Date.now();
        setWrongAt(Date.now());
      }
    },
    [onSuccess, targetId],
  );

  useEffect(() => {
    if (wrongAt === 0) return;
    Animated.timing(toastFade, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
    }).start();
    const id = setTimeout(() => {
      Animated.timing(toastFade, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }, WRONG_TOAST_MS);
    return () => clearTimeout(id);
  }, [wrongAt, toastFade]);

  if (!mlAvailable) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.unsupported}>
          <Ionicons name="phone-portrait-outline" size={48} color={colors.textMuted} />
          <Text style={styles.unsupportedTitle}>{ot.expoGoUnsupportedTitle}</Text>
          <Text style={styles.unsupportedBody}>{ot.expoGoUnsupportedBody}</Text>
          <Pressable style={styles.skipBtn} onPress={onSkipUnsupported}>
            <Text style={styles.skipBtnText}>{ot.skipUnsupported}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const ObjectCameraView = getObjectCameraView();
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ObjectCameraView
        paused={matchedRef.current}
        onLabels={handleLabels}
        onModelStatus={setModelStatus}
        overlay={
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.topCard}>
              <Text style={styles.findLabel}>{ot.findLabel}</Text>
              <Text style={styles.targetName}>{targetName}</Text>
              <Text style={styles.hint}>{ot.scanHint}</Text>
              {modelStatus === 'loading' ? (
                <View style={styles.scanRow}>
                  <ActivityIndicator color={colors.accent} size="small" />
                  <Text style={styles.scanningText}>{ot.scanning}</Text>
                </View>
              ) : null}
            </View>

            <Animated.View style={[styles.toastWrap, { opacity: toastFade }]}>
              <View style={styles.toast}>
                <Ionicons name="close-circle" size={18} color={colors.white} />
                <Text style={styles.toastText}>{ot.wrongObject}</Text>
              </View>
            </Animated.View>
          </View>
        }
      />
    </SafeAreaView>
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
  findLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  targetName: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.85)',
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  scanningText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  toastWrap: { alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(220,38,38,0.92)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  toastText: { color: colors.white, fontWeight: '700' },
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
