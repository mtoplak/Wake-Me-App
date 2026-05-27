/**
 * BCP-47 tag passed to `expo-speech-recognition` `start({ lang })`. The voice
 * challenge is English-only because `sl-SI` isn't a supported recognizer
 * locale on many devices; see `phrases.ts`.
 */
export function speechLocale(): string {
  return 'en-US';
}
