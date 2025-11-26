const {
  t,
  getTranslations,
  isLanguageSupported,
  getSupportedLanguages,
  translations,
} = require('../../src/utils/i18n');

describe('i18n Utilities', () => {
  describe('t (translation)', () => {
    it('should return English translation', () => {
      const result = t('welcome', 'en');
      expect(result).toContain('Welcome');
    });

    it('should return Spanish translation', () => {
      const result = t('welcome', 'es');
      expect(result).toContain('Bienvenido');
    });

    it('should fallback to English for invalid language', () => {
      const result = t('welcome', 'invalid');
      expect(result).toBe(t('welcome', 'en'));
    });

    it('should return key if translation not found', () => {
      const result = t('nonexistent_key', 'en');
      expect(result).toBe('nonexistent_key');
    });

    it('should default to English when no language specified', () => {
      const result = t('welcome');
      expect(result).toBe(t('welcome', 'en'));
    });

    it('should translate common keys correctly', () => {
      expect(t('back', 'en')).toContain('Back');
      expect(t('cancel', 'en')).toContain('Cancel');
      expect(t('next', 'en')).toBeDefined();
      expect(t('confirm', 'en')).toBeDefined();
    });

    it('should translate subscription keys', () => {
      expect(t('subscribe', 'en')).toBeDefined();
      expect(t('planBasic', 'en')).toBeDefined();
      expect(t('planPremium', 'en')).toBeDefined();
    });
  });

  describe('getTranslations', () => {
    it('should return all translations for English', () => {
      const trans = getTranslations('en');
      expect(trans).toBeDefined();
      expect(typeof trans).toBe('object');
      expect(trans.welcome).toBeDefined();
    });

    it('should return all translations for Spanish', () => {
      const trans = getTranslations('es');
      expect(trans).toBeDefined();
      expect(trans.welcome).toBeDefined();
    });

    it('should fallback to English for unsupported language', () => {
      const trans = getTranslations('fr');
      expect(trans).toEqual(getTranslations('en'));
    });

    it('should default to English when no language specified', () => {
      const trans = getTranslations();
      expect(trans).toEqual(getTranslations('en'));
    });
  });

  describe('isLanguageSupported', () => {
    it('should return true for supported languages', () => {
      expect(isLanguageSupported('en')).toBe(true);
      expect(isLanguageSupported('es')).toBe(true);
    });

    it('should return false for unsupported languages', () => {
      expect(isLanguageSupported('fr')).toBe(false);
      expect(isLanguageSupported('invalid')).toBe(false);
      expect(isLanguageSupported('')).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(isLanguageSupported(null)).toBe(false);
      expect(isLanguageSupported(undefined)).toBe(false);
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return array of supported languages', () => {
      const languages = getSupportedLanguages();
      expect(Array.isArray(languages)).toBe(true);
      expect(languages).toContain('en');
      expect(languages).toContain('es');
    });

    it('should return at least 2 languages', () => {
      const languages = getSupportedLanguages();
      expect(languages.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('translations object', () => {
    it('should have both English and Spanish', () => {
      expect(translations.en).toBeDefined();
      expect(translations.es).toBeDefined();
    });

    it('should have common keys in both languages', () => {
      const commonKeys = ['welcome', 'back', 'cancel', 'next', 'error', 'success'];
      commonKeys.forEach(key => {
        expect(translations.en[key]).toBeDefined();
        expect(translations.es[key]).toBeDefined();
      });
    });

    it('should not have empty translation values', () => {
      Object.values(translations.en).forEach(value => {
        expect(value).toBeTruthy();
        expect(typeof value).toBe('string');
      });
    });
  });
});
