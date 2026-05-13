import type { Language } from '@/i18n';

/**
 * Curated wake phrases (no user free-text). Picked at random when the voice
 * challenge runs. Keep lines short enough for on-device ASR, long enough to
 * avoid trivial passes.
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

const VOICE_PHRASES_SL: readonly string[] = [
  'Danes sem buden in pripravljen',
  'Dobro jutro nov dan',
  'Čas je da vstaneš',
  'Jutro prinese nove priložnosti',
  'Sem pripravljen na dan',
  'Oči so odprte zdaj',
  'Nov dan nov začetek',
  'Danes naredim prvi korak',
];

const BY_LANG: Record<Language, readonly string[]> = {
  EN: VOICE_PHRASES_EN,
  SL: VOICE_PHRASES_SL,
};

export function pickRandomVoicePhrase(language: Language): string {
  const list = BY_LANG[language] ?? BY_LANG.EN;
  const i = Math.floor(Math.random() * list.length);
  return list[i] ?? list[0];
}
