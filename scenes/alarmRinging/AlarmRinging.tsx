import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  PanResponder,
  Easing,
  LayoutChangeEvent,
  Vibration,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AntDesign, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAudioPlayer, setAudioModeAsync, AudioSource } from 'expo-audio';
import { listAlarms, getTodaysQuote, CachedQuote, Alarm } from '@/services/database';
import { acknowledgeAlarm, setAlarmActiveForeground } from '@/services/alarmScheduler';
import { colors } from '@/theme';
import { getAlarmSource } from './sounds';

const SLIDER_HEIGHT = 64;
const THUMB_SIZE = 56;
const THUMB_INSET = 4;

function formatTime(hour: number, minute: number) {
  const meridiem: 'AM' | 'PM' = hour < 12 ? 'AM' : 'PM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return {
    time: `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    meridiem,
  };
}

export default function AlarmRinging() {
  const router = useRouter();
  const params = useLocalSearchParams<{ alarmId?: string }>();
  const [alarm, setAlarm] = useState<Alarm | null>(null);
  const [phase, setPhase] = useState<'ringing' | 'quote'>('ringing');
  const [quote, setQuote] = useState<CachedQuote | null>(null);

  const now = useMemo(() => new Date(), []);
  const fallback = formatTime(now.getHours(), now.getMinutes());

  useEffect(() => {
    (async () => {
      const list = await listAlarms();
      const id = params.alarmId ? Number(params.alarmId) : NaN;
      const found = list.find(a => a.id === id) ?? list.find(a => a.enabled) ?? list[0];
      if (found) {
        setAlarm(found);
        // Silence the remaining notifications in the burst now that we're
        // playing audio in-app. If the alarm repeats, this also schedules the
        // next occurrence.
        acknowledgeAlarm(found.id, found).catch(() => {});
      }
    })();
  }, [params.alarmId]);

  const time = alarm
    ? formatTime(alarm.hour, alarm.minute)
    : { time: fallback.time, meridiem: fallback.meridiem };
  const label = alarm?.label ?? 'Wake up';
  const sound = alarm?.sound ?? 'Sunrise';

  const slide = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const slideRange = Math.max(0, trackWidth - THUMB_SIZE - THUMB_INSET * 2);

  const audioSource: AudioSource | null = getAlarmSource(sound);
  const player = useAudioPlayer(audioSource ?? null);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => {});
  }, []);

  // Hold the suppression flag for the whole lifetime of this screen, not just
  // while the audio effect below is running — otherwise it briefly flips back
  // to false whenever `audioSource`/`player` change (e.g. when the alarm loads
  // and its sound differs from the default).
  useEffect(() => {
    setAlarmActiveForeground(true);
    return () => setAlarmActiveForeground(false);
  }, []);

  useEffect(() => {
    if (phase !== 'ringing' || !audioSource) return;
    player.loop = true;
    player.volume = 1;
    player.seekTo(0).catch(() => {});
    player.play();
    return () => {
      try {
        player.pause();
      } catch {}
    };
  }, [phase, audioSource, player]);

  useEffect(() => {
    if (phase !== 'ringing') return;
    if (!alarm?.vibration && alarm !== null) return;
    if (Platform.OS === 'web') return;
    Vibration.vibrate([0, 600, 400], true);
    return () => Vibration.cancel();
  }, [phase, alarm]);

  useEffect(() => {
    if (phase !== 'ringing') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulse]);

  const onDismiss = async () => {
    const q = await getTodaysQuote();
    setQuote(q);
    setPhase('quote');
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, slideRange],
  );

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  const fillWidth = Animated.add(slide, new Animated.Value(THUMB_SIZE + THUMB_INSET * 2));
  const hintOpacity = slide.interpolate({
    inputRange: [0, slideRange * 0.6],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  if (phase === 'quote') {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.quoteWrap}>
          <View style={styles.sparkle}>
            <Ionicons name="sparkles" size={18} color={colors.accent} />
            <Text style={styles.sparkleText}>Your morning thought</Text>
          </View>
          <Text style={styles.quoteText}>
            “{quote?.text ?? 'Today is a fresh start. Make the first small move.'}”
          </Text>
          <Text style={styles.quoteAuthor}>— {quote?.author ?? 'Unknown'}</Text>

          <Pressable style={styles.continueBtn} onPress={() => router.back()}>
            <Text style={styles.continueText}>Start the day</Text>
            <AntDesign name="arrow-right" size={18} color={colors.white} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.ringWrap}>
        <Text style={styles.greeting}>Alarm</Text>
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

      <View
        style={styles.sliderTrack}
        onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.sliderFill, { width: fillWidth }]} />
        <Animated.Text style={[styles.sliderHint, { opacity: hintOpacity }]}>
          Slide to dismiss
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
  quoteWrap: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  sparkle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  sparkleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  quoteText: {
    fontSize: 26,
    fontWeight: '500',
    fontStyle: 'italic',
    color: colors.textPrimary,
    lineHeight: 36,
  },
  quoteAuthor: {
    marginTop: 18,
    fontSize: 15,
    color: colors.accent,
    fontWeight: '600',
  },
  continueBtn: {
    marginTop: 48,
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  continueText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
