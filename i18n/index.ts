import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { State } from '@/utils/store';
import en from './translations/en';
import sl from './translations/sl';

export type Language = 'EN' | 'SL';
export type Translations = typeof en;

const dictionaries: Record<Language, Translations> = {
  EN: en,
  SL: sl,
};

export const DEFAULT_LANGUAGE: Language = 'EN';

export function getTranslations(language: Language): Translations {
  return dictionaries[language] ?? dictionaries[DEFAULT_LANGUAGE];
}

export function useTranslation() {
  const language = useSelector(({ app }: State) => app.language);
  const t = useMemo(() => getTranslations(language), [language]);
  return { t, language };
}

export default useTranslation;
