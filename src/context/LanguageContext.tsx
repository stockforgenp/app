/**
 * Language (i18n) Context & Hook
 * Provides seamless English (en) <-> Nepali (np) language conversion
 * Persists selection to localStorage and SQLite app_settings
 */
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { SupportedLanguage, TRANSLATIONS, toNepaliDigits } from '../lib/i18n/translations.ts';
import { run, queryOne } from '../lib/db/sqliteEngine.ts';

interface LanguageContextType {
  language: SupportedLanguage;
  currencySymbol: string;
  setLanguage: (lang: SupportedLanguage) => void;
  toggleLanguage: () => void;
  t: (
    key: string,
    fallbackOrParams?: string | Record<string, string | number>,
    params?: Record<string, string | number>
  ) => string;
  formatNumberByLang: (val: number | string) => string;
  isNepali: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'stockforge_language';

function isRsVariant(s?: string | null): boolean {
  if (!s) return true;
  const clean = s.trim().toLowerCase();
  return (
    clean === 'rs.' ||
    clean === 'rs' ||
    clean === 'nrs.' ||
    clean === 'nrs' ||
    clean === 'inr' ||
    clean === 'npr'
  );
}

function isNepaliRupeeVariant(s?: string | null): boolean {
  if (!s) return false;
  const clean = s.trim();
  return clean === 'रु.' || clean === 'रु' || clean === 'रू.' || clean === 'रू';
}

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
      const row = queryOne<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', ['language']);
      if (row?.value === 'en' || row?.value === 'np') {
        setLanguageState(row.value);
        localStorage.setItem(LANGUAGE_STORAGE_KEY, row.value);

        // Ensure currency symbol in SQLite is synchronized with the loaded language
        const curRow = queryOne<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', ['currency_symbol']);
        const cur = curRow?.value;
        if (row.value === 'np' && isRsVariant(cur)) {
          run(
            'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
            ['currency_symbol', 'रु.']
          );
        } else if (row.value === 'en' && isNepaliRupeeVariant(cur)) {
          run(
            'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
            ['currency_symbol', 'Rs.']
          );
        }
      }
    } catch {
      // DB might not be ready yet on first tick
    }
  }, []);

  const setLanguage = useCallback((newLang: SupportedLanguage) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
      run(
        'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        ['language', newLang]
      );

      // When language changes, also change currency symbol between Rs. and Nepali rupee symbol रु.
      const curRow = queryOne<{ value: string }>(
        "SELECT value FROM app_settings WHERE key = 'currency_symbol'"
      );
      const cur = curRow?.value;
      if (newLang === 'np') {
        if (isRsVariant(cur)) {
          run(
            "INSERT INTO app_settings (key, value) VALUES ('currency_symbol', 'रु.') ON CONFLICT(key) DO UPDATE SET value = 'रु.'"
          );
        }
      } else if (newLang === 'en') {
        if (isNepaliRupeeVariant(cur) || !cur) {
          run(
            "INSERT INTO app_settings (key, value) VALUES ('currency_symbol', 'Rs.') ON CONFLICT(key) DO UPDATE SET value = 'Rs.'"
          );
        }
      }
    } catch {
      // Ignore persistence errors if DB initializing
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'np' : 'en');
  }, [language, setLanguage]);

  const t = useCallback(
    (
      key: string,
      fallbackOrParams?: string | Record<string, string | number>,
      params?: Record<string, string | number>
    ): string => {
      let fallback = key;
      let interpolationParams: Record<string, string | number> | undefined;

      if (typeof fallbackOrParams === 'string') {
        fallback = fallbackOrParams;
        interpolationParams = params;
      } else if (fallbackOrParams && typeof fallbackOrParams === 'object') {
        interpolationParams = fallbackOrParams;
      }

      const dict = TRANSLATIONS[language] || TRANSLATIONS.en;
      let text = dict[key] || TRANSLATIONS.en[key] || fallback;

      if (interpolationParams) {
        Object.entries(interpolationParams).forEach(([paramKey, paramVal]) => {
          const valStr =
            language === 'np' && typeof paramVal === 'number'
              ? toNepaliDigits(paramVal)
              : String(paramVal);
          text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), valStr);
        });
      }

      return text;
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
