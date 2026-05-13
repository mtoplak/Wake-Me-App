import type { Language } from '@/i18n';

/** BCP-47 tag passed to `expo-speech-recognition` `start({ lang })`. */
export function speechLocaleForAppLanguage(language: Language): string {
  return language === 'SL' ? 'sl-SI' : 'en-US';
}
