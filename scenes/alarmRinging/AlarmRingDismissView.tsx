import { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AntDesign, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/theme';
import type { Translations } from '@/i18n';

const SLIDER_HEIGHT = 64;
const THUMB_SIZE = 56;
const THUMB_INSET = 4;

type Props = {
  time: { time: string; meridiem: string };
  label: string;
  sound: string;
  slide: Animated.Value;
  pulse: Animated.Value;
  trackWidth: number;
  onTrackLayout: (e: LayoutChangeEvent) => void;
  phase: 'ringing';
  onDismiss: () => void;
  t: Translations;
};

export function AlarmRingDismissView({
  time,
  label,
  sound,
  slide,
  pulse,
  trackWidth,
  onTrackLayout,
  phase,
  onDismiss,
  t,
}: Props) {
  const slideRange = Math.max(0, trackWidth - THUMB_SIZE - THUMB_INSET * 2);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => phase === 'ringing',
        onMoveShouldSetPanResponder: () => phase === 'ringing',
        onPanResponderMove: (_, gesture) => {
          const x = Math.max(0, Math.min(slideRange, gesture.dx));
          slide.setValue(x);
        },
        onPanResponderRelease: (_, gesture) => {
          if (slideRange < 24) {
            Animated.spring(slide, {
              toValue: 0,
              useNativeDriver: false,
              friction: 6,
            }).start();
            return;
          }
          if (gesture.dx >= slideRange * 0.85) {
            Animated.timing(slide, {
              toValue: slideRange,
              duration: 120,
              useNativeDriver: false,
            }).start(() => onDismiss());
          } else {
            Animated.spring(slide, {
              toValue: 0,
              useNativeDriver: false,
              friction: 6,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(slide, {
            toValue: 0,
            useNativeDriver: false,
            friction: 6,
          }).start();
        },
      }),
    [onDismiss, phase, slide, slideRange],
  );

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  const fillWidth = Animated.add(slide, new Animated.Value(THUMB_SIZE + THUMB_INSET * 2));
  const hintOpacity = slide.interpolate({
    inputRange: [0, slideRange * 0.6],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.ringWrap}>
        <Text style={styles.greeting}>{t.alarmRinging.alarm}</Text>
        <Text style={styles.timeText}>{time.time}</Text>
        <Text style={styles.meridiem}>{time.meridiem}</Text>
        <Text style={styles.label}>{label}</Text>

        <View style={styles.bellWrap}>
          <Animated.View
            style={[styles.pulse, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]}
          />
          <View style={styles.bellInner}>
            <Ionicons name="alarm" size={56} color={colors.accent} />
          </View>
        </View>

        <View style={styles.soundPill}>
          <MaterialCommunityIcons name="music-note" size={16} color={colors.accent} />
          <Text style={styles.soundText}>{sound}</Text>
        </View>
      </View>

      <View style={styles.sliderTrack} onLayout={onTrackLayout}>
        <Animated.View style={[styles.sliderFill, { width: fillWidth }]} />
        <Animated.Text style={[styles.sliderHint, { opacity: hintOpacity }]}>
          {t.alarmRinging.slideToDismiss}
        </Animated.Text>
        <Animated.View
          {...panResponder.panHandlers}
          style={[styles.sliderThumb, { transform: [{ translateX: slide }] }]}>
          <AntDesign name="arrow-right" size={22} color={colors.white} />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  ringWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  greeting: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 96,
    fontWeight: '200',
    color: colors.textPrimary,
    letterSpacing: -3,
  },
  meridiem: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: -4,
  },
  label: {
    marginTop: 6,
    fontSize: 16,
    color: colors.textSecondary,
  },
  bellWrap: {
    marginTop: 36,
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.accentSoft,
  },
  bellInner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  soundPill: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
  },
  soundText: { fontSize: 13, fontWeight: '600', color: colors.accent },
  sliderTrack: {
    height: SLIDER_HEIGHT,
    marginHorizontal: 24,
    marginBottom: 28,
    borderRadius: SLIDER_HEIGHT / 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: SLIDER_HEIGHT / 2,
    backgroundColor: colors.accentSoft,
  },
  sliderHint: {
    textAlign: 'center',
    color: colors.textMuted,
    fontWeight: '600',
    letterSpacing: 1,
  },
  sliderThumb: {
    position: 'absolute',
    left: THUMB_INSET,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
