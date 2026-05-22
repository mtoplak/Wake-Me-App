import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { colors } from '@/theme';

type Props = {
  label: string;
  value: number;
  minimumValue: number;
  maximumValue: number;
  step: number;
  onValueChange: (v: number) => void;
  onSlideStart?: () => void;
  onSlideEnd?: () => void;
};

function formatValue(label: string, value: number): string {
  if (label === 'Hue') return `${Math.round(value)}°`;
  return `${Math.round(value * 100)}%`;
}

/**
 * Expo @react-native-community/slider wrapper.
 * Never toggles native `disabled` — that can crash iOS when combined with in-flight touches.
 */
function HsvSliderRowInner({
  label,
  value,
  minimumValue,
  maximumValue,
  step,
  onValueChange,
  onSlideStart,
  onSlideEnd,
}: Props) {
  const [localValue, setLocalValue] = useState(value);
  const isSlidingRef = useRef(false);
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  useEffect(() => {
    if (!isSlidingRef.current) {
      setLocalValue(value);
    }
  }, [value]);

  const emit = useCallback((v: number) => {
    setLocalValue(v);
    onValueChangeRef.current(v);
  }, []);

  return (
    <View style={styles.block}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.valueText}>{formatValue(label, localValue)}</Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={step}
        value={localValue}
        onSlidingStart={() => {
          isSlidingRef.current = true;
          onSlideStart?.();
        }}
        onValueChange={emit}
        onSlidingComplete={v => {
          isSlidingRef.current = false;
          emit(v);
          onSlideEnd?.();
        }}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.accent}
      />
    </View>
  );
}

export const HsvSliderRow = memo(HsvSliderRowInner);

const styles = StyleSheet.create({
  block: {
    width: '100%',
    paddingVertical: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  valueText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  slider: {
    width: '100%',
    height: 40,
  },
});
