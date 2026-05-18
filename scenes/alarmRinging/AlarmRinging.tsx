import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAudioPlayer, setAudioModeAsync, AudioSource } from 'expo-audio';
import { listAlarms, Alarm, recordWake, getSetting, type ChallengeType } from '@/services/database';
import { fetchRandomQuote, FetchedQuote } from '@/services/quoteApi';
import { acknowledgeAlarm, setAlarmActiveForeground } from '@/services/alarmScheduler';
import { useTranslation } from '@/i18n';
import { colors } from '@/theme';
import { getAlarmSource } from './sounds';
import { ColorChallengeFlow, type ColorChallengeCompletePayload } from './colorChallenge';
import { QrChallengeFlow, type QrChallengeCompletePayload } from './qrChallenge';
import { VoiceChallengeFlow, type VoiceChallengeCompletePayload } from './voiceChallenge';
import { ObjectChallengeFlow, type ObjectChallengeCompletePayload } from './objectChallenge';
import { StepsChallengeFlow, type StepsChallengeCompletePayload } from './stepsChallenge';

const SLIDER_HEIGHT = 64;
const THUMB_SIZE = 56;
const THUMB_INSET = 4;

function parseRouteAlarmId(raw: string | string[] | undefined): number | null {
  if (raw === undefined) return null;
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (first === undefined || first === '') return null;
  const n = Number(first);
  return Number.isFinite(n) ? n : null;
}

const RING_FLOW_CHALLENGE_TYPES = new Set<ChallengeType>(['steps', 'object', 'color', 'voice']);

type RingPhase =
  | 'ringing'
  | 'qrChallenge'
  | 'stepsChallenge'
  | 'objectChallenge'
  | 'colorChallenge'
  | 'voiceChallenge'
  | 'quote';

function phaseForChallenge(type: ChallengeType): RingPhase | null {
  switch (type) {
    case 'steps':
      return 'stepsChallenge';
    case 'object':
      return 'objectChallenge';
    case 'color':
      return 'colorChallenge';
    case 'voice':
      return 'voiceChallenge';
    default:
      return null;
  }
}

type RingSession = { colorSec?: number; voiceSec?: number; voiceSkipped?: boolean };

function firstRingFlowChallenge(challenges: ChallengeType[]): ChallengeType | null {
  for (const c of challenges) {
    if (RING_FLOW_CHALLENGE_TYPES.has(c)) return c;
  }
  return null;
}

function nextRingFlowChallenge(challenges: ChallengeType[], completed: ChallengeType): ChallengeType | null {
  const idx = challenges.indexOf(completed);
  if (idx === -1) return null;
  for (let i = idx + 1; i < challenges.length; i++) {
    const c = challenges[i];
    if (RING_FLOW_CHALLENGE_TYPES.has(c)) return c;
  }
  return null;
}

/** Last color/voice in the alarm's list — used as `challenge_type` for the wake row. */
function recordableChallengeType(challenges: ChallengeType[], session: RingSession): ChallengeType {
  if (session.voiceSkipped && (session.colorSec ?? 0) > 0) return 'color';
  const ring = challenges.filter(c => RING_FLOW_CHALLENGE_TYPES.has(c));
  return ring[ring.length - 1] ?? 'color';
}

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
  const { t, language } = useTranslation();
  const params = useLocalSearchParams<{ alarmId?: string }>();
  const [alarm, setAlarm] = useState<Alarm | null>(null);
  const [phase, setPhase] = useState<RingPhase>('ringing');
  const [quote, setQuote] = useState<{ text: string; author: string } | null>(null);
  const [voicePhrase, setVoicePhrase] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);
  const fallback = formatTime(now.getHours(), now.getMinutes());

  useEffect(() => {
    (async () => {
      const [list, savedPhrase] = await Promise.all([
        listAlarms(),
        getSetting('pref.voicePhraseText'),
      ]);
      setVoicePhrase(savedPhrase);
      const routeId = parseRouteAlarmId(params.alarmId);
      const found =
        routeId != null
          ? list.find(a => a.id === routeId)
          : (list.find(a => a.enabled) ?? list[0]);
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
  const label = alarm?.label ?? t.alarmRinging.wakeUp;
  const sound = alarm?.sound ?? 'Sunrise';

  const slide = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const slideRange = Math.max(0, trackWidth - THUMB_SIZE - THUMB_INSET * 2);

  // Prefetch the post-alarm quote while the user is still swiping/doing the
  // challenge, so the transition to the quote screen is instant.
  const quotePromiseRef = useRef<Promise<FetchedQuote | null> | null>(null);
  const ringSessionRef = useRef<RingSession>({});

  // Drawer keeps this screen mounted after "Start the day" — without a reset,
  // phase stays `quote` and the next alarm open shows quote with no ring UI.
  useFocusEffect(
    useCallback(() => {
      setPhase('ringing');
      setQuote(null);
      setTrackWidth(0);
      slide.setValue(0);
      quotePromiseRef.current = fetchRandomQuote();
      ringSessionRef.current = {};
    }, [params.alarmId, slide]),
  );

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
    // Keep alarm audio annoying through the challenge flow; stop once we reach quote.
    const shouldPlayAlarmAudio =
      phase === 'ringing' ||
      phase === 'qrChallenge' ||
      phase === 'stepsChallenge' ||
      phase === 'objectChallenge' ||
      phase === 'colorChallenge' ||
      phase === 'voiceChallenge';
    if (!shouldPlayAlarmAudio || !audioSource) return;
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

  const finishWithQuote = useCallback(async () => {
    const q = await (quotePromiseRef.current ?? fetchRandomQuote());
    setQuote(q);
    setPhase('quote');
  }, []);

  const flushRingWakeAndQuote = useCallback(async () => {
    const list = alarm?.challenges ?? [];
    const colorPart = ringSessionRef.current.colorSec ?? 0;
    const voicePart = ringSessionRef.current.voiceSkipped ? 0 : (ringSessionRef.current.voiceSec ?? 0);
    const totalDur = Math.max(1, colorPart + voicePart);
    const challengeType = recordableChallengeType(list, ringSessionRef.current);
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const wakeTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (alarm) {
      await recordWake({
        alarmId: alarm.id,
        date,
        wakeTime,
        success: true,
        challengeDuration: totalDur,
        challengeType,
      });
    }
    await finishWithQuote();
  }, [alarm, finishWithQuote]);

  const hasQrChallenge = (a: Alarm | null) =>
    !!a?.challenges?.includes('qr') && !!a.challengeParams?.qr;

  const onDismiss = async () => {
    let current = alarm;
    if (!current) {
      const list = await listAlarms();
      const routeId = parseRouteAlarmId(params.alarmId);
      current =
        routeId != null
          ? list.find(a => a.id === routeId) ?? null
          : list.find(a => a.enabled) ?? list[0] ?? null;
    }
    if (hasQrChallenge(current)) {
      setAlarm(current);
      setPhase('qrChallenge');
      return;
    }
    const firstRing = firstRingFlowChallenge(current?.challenges ?? []);
    const firstPhase = firstRing ? phaseForChallenge(firstRing) : null;
    if (firstRing && firstPhase) {
      setAlarm(current);
      setPhase(firstPhase);
      return;
    }
    await finishWithQuote();
  };

  const handleQrChallengeComplete = useCallback(
    async ({ durationSec }: QrChallengeCompletePayload) => {
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const wakeTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (alarm) {
        await recordWake({
          alarmId: alarm.id,
          date,
          wakeTime,
          success: true,
          challengeDuration: durationSec,
          challengeType: 'qr',
        });
      }
      const list = alarm?.challenges ?? [];
      const next = nextRingFlowChallenge(list, 'qr');
      const nextPhase = next ? phaseForChallenge(next) : null;
      if (nextPhase) {
        setPhase(nextPhase);
        return;
      }
      await finishWithQuote();
    },
    [alarm, finishWithQuote],
  );

  const handleStepsChallengeComplete = useCallback(
    async ({ durationSec }: StepsChallengeCompletePayload) => {
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const wakeTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (alarm) {
        await recordWake({
          alarmId: alarm.id,
          date,
          wakeTime,
          success: true,
          challengeDuration: durationSec,
          challengeType: 'steps',
        });
      }
      const list = alarm?.challenges ?? [];
      const next = nextRingFlowChallenge(list, 'steps');
      const nextPhase = next ? phaseForChallenge(next) : null;
      if (nextPhase) {
        setPhase(nextPhase);
        return;
      }
      await finishWithQuote();
    },
    [alarm, finishWithQuote],
  );

  const handleObjectChallengeComplete = useCallback(
    async ({ durationSec, skipped }: ObjectChallengeCompletePayload) => {
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const wakeTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (alarm && !skipped) {
        await recordWake({
          alarmId: alarm.id,
          date,
          wakeTime,
          success: true,
          challengeDuration: durationSec,
          challengeType: 'object',
        });
      }
      const list = alarm?.challenges ?? [];
      const next = nextRingFlowChallenge(list, 'object');
      const nextPhase = next ? phaseForChallenge(next) : null;
      if (nextPhase) {
        setPhase(nextPhase);
        return;
      }
      await finishWithQuote();
    },
    [alarm, finishWithQuote],
  );

  const handleColorChallengeComplete = useCallback(
    async ({ durationSec }: ColorChallengeCompletePayload) => {
      ringSessionRef.current.colorSec = durationSec;
      const list = alarm?.challenges ?? [];
      const next = nextRingFlowChallenge(list, 'color');
      const nextPhase = next ? phaseForChallenge(next) : null;
      if (nextPhase) {
        setPhase(nextPhase);
        return;
      }
      await flushRingWakeAndQuote();
    },
    [alarm, flushRingWakeAndQuote],
  );

  const handleVoiceChallengeComplete = useCallback(
    async (payload?: VoiceChallengeCompletePayload) => {
      if (payload?.skipped) {
        ringSessionRef.current.voiceSkipped = true;
      } else if (payload) {
        ringSessionRef.current.voiceSec = payload.durationSec;
      }
      const list = alarm?.challenges ?? [];
      const next = nextRingFlowChallenge(list, 'voice');
      const nextPhase = next ? phaseForChallenge(next) : null;
      if (nextPhase) {
        setPhase(nextPhase);
        return;
      }
      await flushRingWakeAndQuote();
    },
    [alarm, flushRingWakeAndQuote],
  );

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
          // Before layout, slideRange is 0 and dx >= 0 would dismiss instantly while
          // `alarm` may still be null — skipping challenges and jumping to quote.
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
    [phase, slideRange, alarm],
  );

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  const fillWidth = Animated.add(slide, new Animated.Value(THUMB_SIZE + THUMB_INSET * 2));
  const hintOpacity = slide.interpolate({
    inputRange: [0, slideRange * 0.6],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  if (phase === 'qrChallenge') {
    return (
      <QrChallengeFlow
        requiredValue={alarm?.challengeParams?.qr ?? ''}
        onComplete={handleQrChallengeComplete}
      />
    );
  }

  if (phase === 'stepsChallenge') {
    return <StepsChallengeFlow alarm={alarm} onComplete={handleStepsChallengeComplete} />;
  }

  if (phase === 'objectChallenge') {
    return <ObjectChallengeFlow onComplete={handleObjectChallengeComplete} />;
  }

  if (phase === 'colorChallenge') {
    return <ColorChallengeFlow onComplete={handleColorChallengeComplete} />;
  }

  if (phase === 'voiceChallenge') {
    return (
      <VoiceChallengeFlow
        variant="alarm"
        language={language}
        phraseOverride={voicePhrase}
        onComplete={handleVoiceChallengeComplete}
      />
    );
  }

  if (phase === 'quote') {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.quoteWrap}>
          <View style={styles.sparkle}>
            <Ionicons name="sparkles" size={18} color={colors.accent} />
            <Text style={styles.sparkleText}>{t.alarmRinging.morningThought}</Text>
          </View>
          <Text style={styles.quoteText}>
            “{quote?.text ?? t.alarmRinging.fallbackQuote}”
          </Text>
          <Text style={styles.quoteAuthor}>— {quote?.author ?? t.common.unknown}</Text>

          <Pressable style={styles.continueBtn} onPress={() => router.back()}>
            <Text style={styles.continueText}>{t.alarmRinging.startTheDay}</Text>
            <AntDesign name="arrow-right" size={18} color={colors.white} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

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

      <View
        style={styles.sliderTrack}
        onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}>
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
