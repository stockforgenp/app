/**
 * Language (i18n) Context & Hook
 * Provides seamless English (en) <-> Nepali (np) language conversion
 * Persists selection to localStorage and SQLite app_settings
 */
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  SupportedLanguage,
  TRANSLATIONS,
  toNepaliDigits,
  BilingualPair,
  setI18nLanguage,
  interpolateParams,
} from '../lib/i18n/translations.ts';
import {
  getSavedLanguage,
  syncLanguageAndCurrency,
} from '../lib/services/settingsService.ts';

interface LanguageContextType {
  language: SupportedLanguage;
  currencySymbol: string;
  setLanguage: (lang: SupportedLanguage) => void;
  toggleLanguage: () => void;
  t: (
    keyOrPair: string | BilingualPair,
    fallbackOrNepaliOrParams?: string | Record<string, string | number>,
    params?: Record<string, string | number>
  ) => string;
  tr: (enText: string, npText: string) => string;
  formatNumberByLang: (val: number | string) => string;
  isNepali: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'stockforge_language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored === 'en' || stored === 'np') {
        return stored;
      }
    } catch {
      // Ignore localStorage errors
    }
    return 'en';
  });

  useEffect(() => {
    document.documentElement.lang = language === 'np' ? 'ne' : 'en';
  }, [language]);

  // Sync with SQLite on initial mount once DB is available
  useEffect(() => {
    try {
      const savedLang = getSavedLanguage();
      if (savedLang === 'en' || savedLang === 'np') {
        setLanguageState(savedLang);
        setI18nLanguage(savedLang);
        localStorage.setItem(LANGUAGE_STORAGE_KEY, savedLang);
        syncLanguageAndCurrency(savedLang);
      }
    } catch {
      // DB might not be ready yet on first tick
    }
  }, []);

  const setLanguage = useCallback((newLang: SupportedLanguage) => {
    setLanguageState(newLang);
    setI18nLanguage(newLang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
      syncLanguageAndCurrency(newLang);
    } catch {
      // Ignore persistence errors if DB initializing
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'np' : 'en');
  }, [language, setLanguage]);

  const t = useCallback(
    (
      keyOrPair: string | BilingualPair,
      fallbackOrNepaliOrParams?: string | Record<string, string | number>,
      params?: Record<string, string | number>
    ): string => {
      // 1. Bilingual object { en: '...', np: '...' }
      if (
        typeof keyOrPair === 'object' &&
        keyOrPair !== null &&
        'en' in keyOrPair &&
        'np' in keyOrPair
      ) {
        const raw = language === 'np' ? keyOrPair.np : keyOrPair.en;
        const interParams =
          typeof fallbackOrNepaliOrParams === 'object'
            ? fallbackOrNepaliOrParams
            : params;
        return interpolateParams(raw, interParams, language);
      }

      const key = String(keyOrPair);

      // 2. Inline string pair: t('English', 'नेपाली')
      if (
        typeof fallbackOrNepaliOrParams === 'string' &&
        !TRANSLATIONS.en[key] &&
        !TRANSLATIONS.np[key] &&
        /[\u0900-\u097F]/.test(fallbackOrNepaliOrParams)
      ) {
        const chosen = language === 'np' ? fallbackOrNepaliOrParams : key;
        return interpolateParams(chosen, params, language);
      }

      // 3. Key lookup with optional fallback or params
      let fallback = key;
      let interParams: Record<string, string | number> | undefined;

      if (typeof fallbackOrNepaliOrParams === 'string') {
        fallback = fallbackOrNepaliOrParams;
        interParams = params;
      } else if (
        fallbackOrNepaliOrParams &&
        typeof fallbackOrNepaliOrParams === 'object'
      ) {
        interParams = fallbackOrNepaliOrParams;
      }

      const dict = TRANSLATIONS[language] || TRANSLATIONS.en;
      const rawText = dict[key] || TRANSLATIONS.en[key] || fallback;

      return interpolateParams(rawText, interParams, language);
    },
    [language]
  );

  const trHook = useCallback(
    (enText: string, npText: string): string => {
      return language === 'np' ? npText : enText;
    },
    [language]
  );

  const formatNumberByLang = useCallback(
    (val: number | string): string => {
      if (language === 'np') {
        return toNepaliDigits(val);
      }
      return String(val);
    },
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        currencySymbol: language === 'np' ? 'रु.' : 'Rs.',
        setLanguage,
        toggleLanguage,
        t,
        tr: trHook,
        formatNumberByLang,
        isNepali: language === 'np',
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
