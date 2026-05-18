import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
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
    // Don't pre-abort: on iOS abort() and start() dispatch as separate async
    // tasks and the abort can land after the new session is up, immediately
    // killing it and surfacing as "no-speech".
    try {
      ExpoSpeechRecognitionModule.start({
        lang: speechLocaleForAppLanguage(language),
        interimResults: true,
        // Continuous keeps the iOS 3s no-speech timer from firing on sleepy
        // users; we stop the session ourselves the moment the phrase matches.
        continuous: true,
        contextualStrings: [phraseRef.current],
      });
    } catch {
      /* surfaced via the 'error' event */
    }
  }, [listening, language, phrase, onLiveTranscript, stopRecognitionSafe]);

  useSpeechRecognitionEvent('result', ev => {
    const text = ev.results[0]?.transcript ?? '';
    onLiveTranscript(text);
    // Match on any result (interim or final): the matcher requires every
    // significant word in the phrase to appear, so partial prefixes won't
    // false-positive.
    if (!transcriptMatchesPhrase(text, phraseRef.current)) return;

    stopRecognitionSafe();
    onListeningChange(false);
    onPhraseMatched();
  });

  useSpeechRecognitionEvent('end', () => {
    onListeningChange(false);
  });

  useSpeechRecognitionEvent('error', ev => {
    // 'aborted' fires for our own stop()/abort() calls — don't propagate as a
    // listening state change because it would tear down a session we may have
    // just (re)started in the same tick.
    if (ev.error === 'aborted') return;
    onListeningChange(false);
    if (ev.error === 'not-allowed') {
      onPermissionDenied();
      return;
    }
    // 'no-speech' = user just didn't say anything yet. Let them tap again
    // instead of throwing an alert in their face mid-alarm.
    if (ev.error === 'no-speech') return;
    Alert.alert(t.voiceChallenge.errorTitle, ev.message || ev.error);
  });

  return null;
}
