import { useCallback } from 'react';
import { useLanguageStore } from '@/lib/stores/language-store';
import { translations, Language } from '@/lib/i18n/translations';

export function useTranslation() {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const keys = key.split('.');
      let value: any = translations[language];

      for (const k of keys) {
        if (value && typeof value === 'object') {
          value = value[k];
        } else {
          value = undefined;
          break;
        }
      }

      if (typeof value !== 'string') {
        // Fallback to English if translation not found
        value = translations.en;
        for (const k of keys) {
          if (value && typeof value === 'object') {
            value = value[k];
          } else {
            return key; // Return key if not found in English either
          }
        }
      }

      // Replace parameters
      if (params && typeof value === 'string') {
        Object.entries(params).forEach(([param, paramValue]) => {
          value = value.replace(`{${param}}`, String(paramValue));
        });
      }

      return value as string;
    },
    [language]
  );

  return { t, language, setLanguage };
}
