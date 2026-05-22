import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import type { HSV } from './hsvColor';
import { hsvToHex, randomPlayableTargetHsv, sanitizeHsv } from './hsvColor';
import { colorMatchAccuracyPercent, COLOR_MATCH_PASS_THRESHOLD } from './colorAccuracy';
import { HsvSliderRow } from './HsvSliderRow';
import {
  delayMs,
  SLIDER_IDLE_WAIT_MS,
  SLIDER_SETTLE_MS,
  waitForSlidersIdle,
} from './sliderSubmitGuard';
import { colors } from '@/theme';

type Props = {
  target: HSV;
  onSuccess: (payload: { accuracyPercent: number }) => void;
  /** Below threshold: new color + memorize phase (parent restarts flow). */
  onFailedMatch: () => void;
};

const FAIL_TOAST_MS = 3000;

export function ColorMatchPhase({ target, onSuccess, onFailedMatch }: Props) {
  const [user, setUser] = useState<HSV>(() => randomPlayableTargetHsv());
  const [resultPercent, setResultPercent] = useState<number | null>(null);
  const [failToastPct, setFailToastPct] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const onFailedMatchRef = useRef(onFailedMatch);
  const mountedRef = useRef(true);
  const slidingCountRef = useRef(0);
  const submitInFlightRef = useRef(false);

  onFailedMatchRef.current = onFailedMatch;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const userHex = useMemo(() => hsvToHex(user), [user]);
  const showResult = resultPercent !== null;
  const uiLocked = isChecking || failToastPct !== null || showResult;

  useEffect(() => {
    if (failToastPct === null) return;
    const id = setTimeout(() => {
      if (!mountedRef.current) return;
      setFailToastPct(null);
      onFailedMatchRef.current();
    }, FAIL_TOAST_MS);
    return () => clearTimeout(id);
  }, [failToastPct]);

  const patchUser = useCallback((patch: Partial<HSV>) => {
    setUser(prev => sanitizeHsv({ ...prev, ...patch }));
  }, []);

  const onHueChange = useCallback((h: number) => patchUser({ h }), [patchUser]);
  const onSatChange = useCallback((s: number) => patchUser({ s }), [patchUser]);
  const onValChange = useCallback((v: number) => patchUser({ v }), [patchUser]);

  const onSlideStart = useCallback(() => {
    slidingCountRef.current += 1;
  }, []);

  const onSlideEnd = useCallback(() => {
    slidingCountRef.current = Math.max(0, slidingCountRef.current - 1);
  }, []);

  const isAnySliding = useCallback(() => slidingCountRef.current > 0, []);

  const submit = useCallback(() => {
    if (uiLocked || submitInFlightRef.current) return;
    submitInFlightRef.current = true;

    void (async () => {
      try {
        await waitForSlidersIdle(isAnySliding, SLIDER_IDLE_WAIT_MS);
        await delayMs(SLIDER_SETTLE_MS);
        if (!mountedRef.current) return;

        setIsChecking(true);
        await delayMs(SLIDER_SETTLE_MS);
        if (!mountedRef.current) return;

        const safeUser = sanitizeHsv(user);
        const safeTarget = sanitizeHsv(target);
        const pct = colorMatchAccuracyPercent(safeTarget, safeUser);

        await delayMs(SLIDER_SETTLE_MS);
        if (!mountedRef.current) return;

        setIsChecking(false);
        if (pct >= COLOR_MATCH_PASS_THRESHOLD) {
          setResultPercent(pct);
        } else {
          setFailToastPct(pct);
        }
      } catch (err) {
        if (__DEV__) {
          console.warn('[colorChallenge] submit failed', err);
        }
        if (mountedRef.current) {
          setIsChecking(false);
          setFailToastPct(0);
        }
      } finally {
        submitInFlightRef.current = false;
      }
    })();
  }, [isAnySliding, target, uiLocked, user]);

  const handleContinue = useCallback(() => {
    if (resultPercent === null) return;
    onSuccess({ accuracyPercent: resultPercent });
  }, [onSuccess, resultPercent]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.matchLayer} pointerEvents={uiLocked ? 'none' : 'auto'}>
        <Text style={styles.title}>Recreate the color</Text>
        <Text style={styles.subtitle}>
          The memorized color stays hidden. You start from a random mix — use the sliders to match what you
          remember.
        </Text>

        <View style={styles.splitWrap}>
          <View style={styles.splitTop}>
            <Text style={styles.previewHeading}>Your guess</Text>
            <View style={[styles.previewStrip, { backgroundColor: userHex }]} />
            <Text style={styles.previewHint}>Adjust hue, saturation, and brightness, then tap Check match.</Text>
          </View>

          <View style={[styles.splitBottom, uiLocked && styles.splitBottomBusy]}>
            <HsvSliderRow
              label="Hue"
              value={user.h}
              minimumValue={0}
              maximumValue={360}
              step={1}
              onValueChange={onHueChange}
              onSlideStart={onSlideStart}
              onSlideEnd={onSlideEnd}
            />
            <HsvSliderRow
              label="Saturation"
              value={user.s}
              minimumValue={0}
              maximumValue={1}
              step={0.01}
              onValueChange={onSatChange}
              onSlideStart={onSlideStart}
              onSlideEnd={onSlideEnd}
            />
            <HsvSliderRow
              label="Brightness"
              value={user.v}
              minimumValue={0}
              maximumValue={1}
              step={0.01}
              onValueChange={onValChange}
              onSlideStart={onSlideStart}
              onSlideEnd={onSlideEnd}
            />
          </View>
        </View>

        {!showResult && (
          <Pressable
            style={[styles.submit, uiLocked && styles.submitDisabled]}
            onPress={submit}
            disabled={uiLocked}
            accessibilityRole="button">
            <Text style={styles.submitText}>Check match</Text>
          </Pressable>
        )}
      </View>

      {isChecking && (
        <View style={styles.checkingOverlay} pointerEvents="none">
          <Text style={styles.checkingText}>Checking your match…</Text>
        </View>
      )}

      {showResult && (
        <View style={styles.resultOverlay}>
          <View style={styles.resultInner}>
            <View style={styles.resultIconWrap}>
              <Ionicons name="checkmark-circle" size={56} color={colors.success} />
            </View>
            <Text style={styles.resultTitle}>Nice work</Text>
            <Text style={styles.resultPercent}>{resultPercent}%</Text>
            <Text style={styles.resultSubtitle}>match with the color you memorized</Text>
            <Pressable
              style={styles.continueBtn}
              onPress={handleContinue}
              accessibilityRole="button">
              <Text style={styles.continueText}>Continue</Text>
              <AntDesign name="arrow-right" size={18} color={colors.white} />
            </Pressable>
          </View>
        </View>
      )}

      {failToastPct !== null && (
        <View style={styles.toastOverlay} pointerEvents="box-none">
          <View style={styles.toastBox}>
            <Text style={styles.toastTitle}>Not quite</Text>
            <Text style={styles.toastBody}>
              {failToastPct}% match — you need {COLOR_MATCH_PASS_THRESHOLD}%. A new color is next.
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingBottom: 12,
    position: 'relative',
  },
  matchLayer: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 6,
    marginBottom: 12,
    lineHeight: 20,
  },
  splitWrap: {
    flex: 1,
    minHeight: 0,
  },
  splitTop: {
    flex: 1,
    minHeight: 0,
  },
  splitBottom: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    gap: 4,
  },
  splitBottomBusy: {
    opacity: 0.55,
  },
  checkingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  checkingText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  previewHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  previewStrip: {
    flex: 1,
    minHeight: 64,
    marginTop: 2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewHint: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    flexShrink: 0,
  },
  submit: {
    marginTop: 12,
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  resultInner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultIconWrap: {
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  resultPercent: {
    fontSize: 64,
    fontWeight: '200',
    color: colors.accent,
    letterSpacing: -2,
  },
  resultSubtitle: {
    marginTop: 8,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 18,
    minWidth: 200,
  },
  continueText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  toastOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  toastBox: {
    backgroundColor: colors.textPrimary,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  toastTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  toastBody: {
    marginTop: 6,
    color: colors.lightGrayPurple,
    fontSize: 14,
    lineHeight: 20,
  },
});
