import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import type { Language } from '@/i18n';
import { useTranslation } from '@/i18n';
import { transcriptMatchesPhrase } from './matchTranscript';
import { speechLocaleForAppLanguage } from './speechLocale';

type Props = {
  language: Language;
  phrase: string;
  listening: boolean;
  onLiveTranscript: (text: string) => void;
  onListeningChange: (active: boolean) => void;
  onPhraseMatched: () => void;
  onPermissionDenied: () => void;
};

export default function VoiceChallengeNativeSession({
  language,
  phrase,
  listening,
  onLiveTranscript,
  onListeningChange,
  onPhraseMatched,
  onPermissionDenied,
}: Props) {
  const { t } = useTranslation();
  const phraseRef = useRef(phrase);
  phraseRef.current = phrase;

  const stopRecognitionSafe = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        /* noop */
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        /* noop */
      }
    };
  }, []);

  useEffect(() => {
    if (!listening) {
      stopRecognitionSafe();
      return;
    }
    onLiveTranscript('');
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      /* noop */
    }
    ExpoSpeechRecognitionModule.start({
      lang: speechLocaleForAppLanguage(language),
      interimResults: true,
      continuous: false,
      contextualStrings: [phraseRef.current],
    });
  }, [listening, language, phrase, onLiveTranscript, stopRecognitionSafe]);

  useSpeechRecognitionEvent('result', ev => {
    const text = ev.results[0]?.transcript ?? '';
    onLiveTranscript(text);
    if (!ev.isFinal) return;
    if (!transcriptMatchesPhrase(text, phraseRef.current)) return;

    stopRecognitionSafe();
    onListeningChange(false);
    onPhraseMatched();
  });

  useSpeechRecognitionEvent('end', () => {
    onListeningChange(false);
  });

  useSpeechRecognitionEvent('error', ev => {
    onListeningChange(false);
    if (ev.error === 'not-allowed') {
      onPermissionDenied();
      return;
    }
    if (ev.error === 'aborted') return;
    Alert.alert(t.voiceChallenge.errorTitle, ev.message || ev.error);
  });

  return null;
}
