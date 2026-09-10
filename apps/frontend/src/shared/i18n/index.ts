import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';

/**
 * i18n setup.
 *
 * Every user-facing string in the app resolves through here — the working
 * agreement allows full localization or none, not a mix. `en` is the only
 * shipped locale today; adding another is a new file plus a resources entry,
 * with no call-site changes.
 */
export const DEFAULT_LOCALE = 'en';

export const resources = {
  en: { translation: en },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  interpolation: {
    // React escapes rendered values already; double-escaping mangles copy.
    escapeValue: false,
  },
  // A missing key must be loud in development and harmless in production.
  returnEmptyString: false,
});

export { i18n };
