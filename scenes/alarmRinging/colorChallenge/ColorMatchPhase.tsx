import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import type { HSV } from './hsvColor';
import { hsvToHex, randomPlayableTargetHsv } from './hsvColor';
import { colorMatchAccuracyPercent, COLOR_MATCH_PASS_THRESHOLD } from './colorAccuracy';
import { colors } from '@/theme';

type Props = {
  target: HSV;
  onSuccess: (payload: { accuracyPercent: number }) => void;
  /** Below threshold: new color + memorize phase (parent restarts flow). */
  onFailedMatch: () => void;
};

const FAIL_TOAST_MS = 3000;
const SLIDER_THICKNESS = 44;

type VerticalSliderProps = {
  label: string;
  value: number;
  minimumValue: number;
  maximumValue: number;
  step: number;
  onValueChange: (v: number) => void;
  disabled: boolean;
  trackLength: number;
};

function VerticalSlider({
  label,
  value,
  minimumValue,
  maximumValue,
  step,
  onValueChange,
  disabled,
  trackLength,
}: VerticalSliderProps) {
  return (
    <View style={[styles.vCol, { flex: 1, minWidth: 0 }]}>
      <View
        style={[
          styles.vTrackHost,
          {
            height: trackLength,
            width: '100%',
          },
        ]}>
        <View style={[styles.vTrackRotate, { width: trackLength, height: SLIDER_THICKNESS }]}>
          <Slider
            style={{ width: trackLength, height: SLIDER_THICKNESS }}
            minimumValue={minimumValue}
            maximumValue={maximumValue}
            step={step}
            value={value}
            onValueChange={onValueChange}
            disabled={disabled}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.accent}
          />
        </View>
      </View>
      <Text style={styles.vLabel}>{label}</Text>
    </View>
  );
}

export function ColorMatchPhase({ target, onSuccess, onFailedMatch }: Props) {
  const [user, setUser] = useState<HSV>(() => randomPlayableTargetHsv());
  const [resultPercent, setResultPercent] = useState<number | null>(null);
  const [failToastPct, setFailToastPct] = useState<number | null>(null);
  const [trackLength, setTrackLength] = useState(200);

  const onSliderAreaLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h < 48) return;
    setTrackLength(Math.max(120, Math.floor(h - 40)));
  }, []);

  const userHex = useMemo(() => hsvToHex(user), [user]);
  const slidersLocked = failToastPct !== null;

  useEffect(() => {
    if (failToastPct === null) return;
    const id = setTimeout(() => {
      setFailToastPct(null);
      onFailedMatch();
    }, FAIL_TOAST_MS);
    return () => clearTimeout(id);
  }, [failToastPct, onFailedMatch]);

  const submit = () => {
    const pct = colorMatchAccuracyPercent(target, user);
    if (pct >= COLOR_MATCH_PASS_THRESHOLD) {
      setResultPercent(pct);
      return;
    }
    setFailToastPct(pct);
  };

  if (resultPercent !== null) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.resultInner}>
          <View style={styles.resultIconWrap}>
            <Ionicons name="checkmark-circle" size={56} color={colors.success} />
          </View>
          <Text style={styles.resultTitle}>Nice work</Text>
          <Text style={styles.resultPercent}>{resultPercent}%</Text>
          <Text style={styles.resultSubtitle}>match with the color you memorized</Text>
          <Pressable
            style={styles.continueBtn}
            onPress={() => onSuccess({ accuracyPercent: resultPercent })}
            accessibilityRole="button">
            <Text style={styles.continueText}>Continue</Text>
            <AntDesign name="arrow-right" size={18} color={colors.white} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Text style={styles.title}>Recreate the color</Text>
      <Text style={styles.subtitle}>
        The memorized color stays hidden. You start from a random mix — adjust the vertical sliders to match what you
        remember.
      </Text>

      <View style={styles.splitWrap}>
        <View style={styles.splitTop}>
          <Text style={styles.previewHeading}>Your guess</Text>
          <View style={[styles.previewStrip, { backgroundColor: userHex }]} />
          <Text style={styles.previewHint}>Drag up or down on each bar, then tap Check match when you are ready.</Text>
        </View>

        <View style={styles.splitBottom} onLayout={onSliderAreaLayout}>
          <View style={styles.slidersRow}>
            <VerticalSlider
              label="Hue"
              value={user.h}
              minimumValue={0}
              maximumValue={360}
              step={1}
              onValueChange={h => setUser(u => ({ ...u, h }))}
              disabled={slidersLocked}
              trackLength={trackLength}
            />
            <VerticalSlider
              label="Saturation"
              value={user.s}
              minimumValue={0}
              maximumValue={1}
              step={0.01}
              onValueChange={s => setUser(u => ({ ...u, s }))}
              disabled={slidersLocked}
              trackLength={trackLength}
            />
            <VerticalSlider
              label="Brightness"
              value={user.v}
              minimumValue={0}
              maximumValue={1}
              step={0.01}
              onValueChange={v => setUser(u => ({ ...u, v }))}
              disabled={slidersLocked}
              trackLength={trackLength}
            />
          </View>
        </View>
      </View>

      <Pressable
        style={[styles.submit, slidersLocked && styles.submitDisabled]}
        onPress={submit}
        disabled={slidersLocked}
        accessibilityRole="button">
        <Text style={styles.submitText}>Check match</Text>
      </Pressable>

      {failToastPct !== null && (
        <View style={styles.toastOverlay} pointerEvents="box-none" accessibilityLiveRegion="polite">
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
  slidersRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'stretch',
    justifyContent: 'space-between',
    overflow: 'visible',
    minHeight: 0,
  },
  vCol: {
    alignItems: 'center',
    overflow: 'visible',
  },
  vTrackHost: {
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vTrackRotate: {
    transform: [{ rotate: '-90deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  vLabel: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
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
