import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import es from './locales/es';
import type { LanguagePref } from '@/data/db';

export const SUPPORTED = ['es', 'en'] as const;
export type Lang = (typeof SUPPORTED)[number];
const STORAGE_KEY = 'seasonpay.lang';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { es: { translation: es }, en: { translation: en } },
    supportedLngs: SUPPORTED,
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    fallbackLng: 'es',
    interpolation: { escapeValue: false },
    detection: {
      // Primero lo que el usuario eligió; si no, el idioma del celular.
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: STORAGE_KEY,
      caches: [],
    },
    returnNull: false,
  });

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng.startsWith('en') ? 'en' : 'es';
});

/** Idioma del celular (ignorando la elección guardada). */
export function deviceLanguage(): Lang {
  const langs = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : [];
  for (const l of langs) {
    const base = l.toLowerCase().split('-')[0];
    if (base === 'es' || base === 'en') return base;
  }
  return 'es';
}

/** Aplica la preferencia: 'system' sigue al celular. */
export async function applyLanguagePref(pref: LanguagePref): Promise<void> {
  try {
    if (pref === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* almacenamiento bloqueado */
  }
  const target = pref === 'system' ? deviceLanguage() : pref;
  if (!i18n.language?.startsWith(target)) await i18n.changeLanguage(target);
}

export function currentLang(): Lang {
  return i18n.language?.startsWith('en') ? 'en' : 'es';
}

export default i18n;
