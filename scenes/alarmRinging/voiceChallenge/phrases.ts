/**
 * Curated wake phrases. The voice challenge ships English-only because the
 * on-device speech recognizer doesn't reliably support `sl-SI` (and on many
 * locales it's not available at all). Slovenian app users still get English
 * phrases for the challenge.
 */
const VOICE_PHRASES_EN: readonly string[] = [
  'Rise and shine today',
  'I am awake and ready',
  'Good morning world',
  'Today will be a good day',
  'Time to start the day',
  'I open my eyes wide',
  'Let the morning begin',
  'Ready for what comes next',
];

export function pickRandomVoicePhrase(): string {
  const i = Math.floor(Math.random() * VOICE_PHRASES_EN.length);
  return VOICE_PHRASES_EN[i] ?? VOICE_PHRASES_EN[0];
}

export function getVoicePhraseSuggestions(): readonly string[] {
  return VOICE_PHRASES_EN;
}
