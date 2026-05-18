import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Language } from '@/i18n';
import { useTranslation } from '@/i18n';
import { colors } from '@/theme';
import { pickRandomVoicePhrase } from './phrases';
import { ensureVoiceChallengePermissions } from './speechPermissions';
import { isSpeechRecognitionAvailable } from './isSpeechRecognitionAvailable';

const VoiceChallengeNativeSession = lazy(() => import('./VoiceChallengeNativeSession'));

type UiStep = 'intro' | 'listen1' | 'listen2' | 'success';

export type VoiceChallengeCompletePayload = {
  durationSec: number;
  /** True when native speech is unavailable (e.g. Expo Go) and the user exits the gate. */
  skipped?: boolean;
};

type Props = {
  language: Language;
  /** `alarm`: track duration for wake stats; unsupported clients may skip with `skipped`. */
  variant?: 'dev' | 'alarm';
  /** Optional user-configured phrase. Falls back to a curated random pick if empty. */
  phraseOverride?: string | null;
  onComplete: (payload?: VoiceChallengeCompletePayload) => void;
};

export function VoiceChallengeFlow({
  language,
  variant = 'dev',
  phraseOverride,
  onComplete,
}: Props) {
  const { t } = useTranslation();
  const vt = t.voiceChallenge;
  const [phrase] = useState(() => {
    const trimmed = phraseOverride?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : pickRandomVoicePhrase(language);
  });

  const [step, setStep] = useState<UiStep>('intro');
  const [listening, setListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const echoPassRef = useRef(0);
  const challengeStartedAtRef = useRef<number | null>(null);

  const handlePhraseMatched = useCallback(() => {
    if (echoPassRef.current === 0) {
      echoPassRef.current = 1;
      setStep('listen2');
      return;
    }
    echoPassRef.current = 2;
    setStep('success');
  }, []);

  const handleLiveTranscript = useCallback((text: string) => {
    setLiveTranscript(text);
  }, []);

  const handleListeningChange = useCallback((active: boolean) => {
    setListening(active);
  }, []);

  const handlePermissionDeniedFromNative = useCallback(() => {
    setPermissionDenied(true);
  }, []);

  const stopRecognitionSafe = useCallback(() => {
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    setLiveTranscript('');
    setListening(true);
  }, []);

  const isWeb = Platform.OS === 'web';
  const supportsNativeSpeech = isSpeechRecognitionAvailable();

  const onIntroContinue = async () => {
    setPermissionDenied(false);
    const ok = await ensureVoiceChallengePermissions();
    if (!ok) {
      setPermissionDenied(true);
      return;
    }
    echoPassRef.current = 0;
    if (variant === 'alarm') {
      challengeStartedAtRef.current = Date.now();
    }
    setStep('listen1');
  };

  const leaveUnsupported = useCallback(() => {
    if (variant === 'alarm') {
      onComplete({ durationSec: 0, skipped: true });
      return;
    }
    onComplete();
  }, [onComplete, variant]);

  const onSuccessDone = useCallback(() => {
    if (variant === 'alarm' && challengeStartedAtRef.current != null) {
      const durationSec = Math.max(1, Math.round((Date.now() - challengeStartedAtRef.current) / 1000));
      onComplete({ durationSec });
      return;
    }
    onComplete();
  }, [onComplete, variant]);

  if (isWeb) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.centerBlock}>
          <Ionicons name="mic-off-outline" size={48} color={colors.textMuted} />
          <Text style={styles.title}>{vt.webUnsupportedTitle}</Text>
          <Text style={styles.body}>{vt.webUnsupportedBody}</Text>
          <Pressable style={styles.primaryBtn} onPress={leaveUnsupported}>
            <Text style={styles.primaryBtnText}>
              {variant === 'alarm' ? vt.skipUnsupportedVoice : vt.close}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!supportsNativeSpeech) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.centerBlock}>
          <Ionicons name="phone-portrait-outline" size={48} color={colors.textMuted} />
          <Text style={styles.title}>{vt.expoGoUnsupportedTitle}</Text>
          <Text style={styles.body}>{vt.expoGoUnsupportedBody}</Text>
          <Pressable style={styles.primaryBtn} onPress={leaveUnsupported}>
            <Text style={styles.primaryBtnText}>
              {variant === 'alarm' ? vt.skipUnsupportedVoice : vt.close}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'intro') {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.pad}>
          <View style={styles.iconWrap}>
            <Ionicons name="mic" size={40} color={colors.accent} />
          </View>
          <Text style={styles.title}>{vt.introTitle}</Text>
          <Text style={styles.body}>{vt.introBody}</Text>
          {permissionDenied ? (
            <View style={styles.warnBox}>
              <Text style={styles.warnText}>{vt.permissionDenied}</Text>
              <Pressable style={styles.secondaryBtn} onPress={() => Linking.openSettings()}>
                <Text style={styles.secondaryBtnText}>{vt.openSettings}</Text>
              </Pressable>
            </View>
          ) : null}
          <Pressable style={styles.primaryBtn} onPress={onIntroContinue}>
            <Text style={styles.primaryBtnText}>{vt.continue}</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.white} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'success') {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.pad}>
          <View style={styles.iconWrap}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          </View>
          <Text style={styles.title}>{vt.successTitle}</Text>
          <Text style={styles.body}>{variant === 'alarm' ? vt.successBodyAlarm : vt.successBody}</Text>
          <Pressable style={styles.primaryBtn} onPress={onSuccessDone}>
            <Text style={styles.primaryBtnText}>{t.common.done}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const listenLabel = step === 'listen1' ? vt.listenRound1 : vt.listenRound2;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Suspense fallback={null}>
        <VoiceChallengeNativeSession
          language={language}
          phrase={phrase}
          listening={listening}
          onLiveTranscript={handleLiveTranscript}
          onListeningChange={handleListeningChange}
          onPhraseMatched={handlePhraseMatched}
          onPermissionDenied={handlePermissionDeniedFromNative}
        />
      </Suspense>
      <View style={styles.pad}>
        <Text style={styles.roundLabel}>{listenLabel}</Text>
        <Text style={styles.phraseLabel}>{vt.phraseLabel}</Text>
        <View style={styles.phraseCard}>
          <Text style={styles.phraseText}>{phrase}</Text>
        </View>

        <Text style={styles.caption}>{vt.heardLabel}</Text>
        <View style={styles.transcriptBox}>
          <Text style={styles.transcriptText}>
            {liveTranscript || (listening ? vt.listening : vt.emptyTranscript)}
          </Text>
        </View>

        <View style={styles.btnRow}>
          <Pressable
            style={[styles.primaryBtn, listening && styles.btnDisabled]}
            onPress={startListening}
            disabled={listening}>
            {listening ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="mic-circle" size={22} color={colors.white} />
                <Text style={styles.primaryBtnText}>{vt.listenCta}</Text>
              </>
            )}
          </Pressable>
          {listening ? (
            <Pressable style={styles.secondaryBtn} onPress={stopRecognitionSafe}>
              <Text style={styles.secondaryBtnText}>{vt.stop}</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.hint}>{vt.listenHint}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  pad: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  centerBlock: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  roundLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 8,
  },
  phraseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
    textAlign: 'center',
  },
  phraseCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  phraseText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 28,
  },
  caption: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 6,
  },
  transcriptBox: {
    minHeight: 56,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  transcriptText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  btnRow: { gap: 12 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 16,
  },
  btnDisabled: { opacity: 0.7 },
  primaryBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  hint: {
    marginTop: 16,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  warnBox: { marginBottom: 16, gap: 10 },
  warnText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
});
