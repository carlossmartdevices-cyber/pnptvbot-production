const { t, isLanguageSupported, getSupportedLanguages } = require('../../src/utils/i18n');

describe('i18n Utilities', () => {
  describe('t (translation)', () => {
    it('should return English translation', () => {
      const result = t('welcome', 'en');
      expect(result).toContain('Welcome to PNPtv');
    });

    it('should return Spanish translation', () => {
      const result = t('welcome', 'es');
      expect(result).toContain('Bienvenido a PNPtv');
    });

    it('should replace parameters', () => {
      const result = t('nearbyUsersFound', 'en', { count: 5 });
      expect(result).toContain('5');
    });

    it('should fallback to English for invalid language', () => {
      const result = t('welcome', 'invalid');
      expect(result).toContain('Welcome to PNPtv');
    });

    it('should return key if translation not found', () => {
      const result = t('nonexistent_key', 'en');
      expect(result).toBe('nonexistent_key');
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
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return array of supported languages', () => {
      const languages = getSupportedLanguages();
      expect(Array.isArray(languages)).toBe(true);
      expect(languages).toContain('en');
      expect(languages).toContain('es');
    });
  });
});
