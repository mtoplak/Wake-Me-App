import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Vibration } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAudioPlayer, setAudioModeAsync, AudioSource } from 'expo-audio';
import { listAlarms, Alarm, getSetting } from '@/services/database';
import { fetchRandomQuote, FetchedQuote } from '@/services/quoteApi';
import { acknowledgeAlarm, setAlarmActiveForeground } from '@/services/alarmScheduler';
import { useTranslation } from '@/i18n';
import { getAlarmSource } from './sounds';
import { ColorChallengeFlow } from './colorChallenge';
import { QrChallengeFlow } from './qrChallenge';
import { VoiceChallengeFlow } from './voiceChallenge';
import { ObjectChallengeFlow } from './objectChallenge';
import { StepsChallengeFlow } from './stepsChallenge';
import { formatAlarmTime, parseRouteAlarmId } from './alarmRingingUtils';
import { shouldPlayAlarmAudio, type RingPhase, type RingSession } from './ringFlow';
import { useAlarmRingSession } from './useAlarmRingSession';
import { useAlarmDismiss } from './useAlarmDismiss';
import { AlarmRingDismissView } from './AlarmRingDismissView';
import { AlarmRingQuoteView } from './AlarmRingQuoteView';

export default function AlarmRinging() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const params = useLocalSearchParams<{ alarmId?: string }>();
  const [alarm, setAlarm] = useState<Alarm | null>(null);
  const [phase, setPhase] = useState<RingPhase>('ringing');
  const [quote, setQuote] = useState<{ text: string; author: string } | null>(null);
  const [voicePhrase, setVoicePhrase] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);
  const fallback = formatAlarmTime(now.getHours(), now.getMinutes());

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
        acknowledgeAlarm(found.id, found).catch(() => {});
      }
    })();
  }, [params.alarmId]);

  const time = alarm
    ? formatAlarmTime(alarm.hour, alarm.minute)
    : { time: fallback.time, meridiem: fallback.meridiem };
  const label = alarm?.label ?? t.alarmRinging.wakeUp;
  const sound = alarm?.sound ?? 'Sunrise';

  const slide = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  const quotePromiseRef = useRef<Promise<FetchedQuote | null> | null>(null);
  const ringSessionRef = useRef<RingSession>({});

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

  const {
    finishWithQuote,
    handleQrChallengeComplete,
    handleStepsChallengeComplete,
    handleObjectChallengeComplete,
    handleColorChallengeComplete,
    handleVoiceChallengeComplete,
  } = useAlarmRingSession({
    alarm,
    setPhase,
    setQuote,
    quotePromiseRef,
    ringSessionRef,
  });

  const onDismiss = useAlarmDismiss({
    alarm,
    routeAlarmId: params.alarmId,
    setAlarm,
    setPhase,
    finishWithQuote,
  });

  const audioSource: AudioSource | null = getAlarmSource(sound);
  const player = useAudioPlayer(audioSource ?? null);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => {});
  }, []);

  useEffect(() => {
    setAlarmActiveForeground(true);
    return () => setAlarmActiveForeground(false);
  }, []);

  useEffect(() => {
    if (!shouldPlayAlarmAudio(phase) || !audioSource) return;
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
      <AlarmRingQuoteView quote={quote} t={t} onContinue={() => router.back()} />
    );
  }

  return (
    <AlarmRingDismissView
      time={time}
      label={label}
      sound={sound}
      slide={slide}
      pulse={pulse}
      trackWidth={trackWidth}
      onTrackLayout={e => setTrackWidth(e.nativeEvent.layout.width)}
      phase="ringing"
      onDismiss={onDismiss}
      t={t}
    />
  );
}
