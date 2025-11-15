const {
  sanitizeInput,
  isValidEmail,
  isValidAge,
  isValidLocation,
  validateSchema,
  schemas,
} = require('../../src/utils/validation');

describe('Validation Utilities', () => {
  describe('sanitizeInput', () => {
    it('should remove HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello';
      const result = sanitizeInput(input);
      expect(result).not.toContain('<script>');
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  ';
      const result = sanitizeInput(input);
      expect(result).toBe('Hello World');
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
    });

    it('should reject invalid email', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
    });
  });

  describe('isValidAge', () => {
    it('should accept valid age', () => {
      expect(isValidAge(18)).toBe(true);
      expect(isValidAge(25)).toBe(true);
      expect(isValidAge(100)).toBe(true);
    });

    it('should reject invalid age', () => {
      expect(isValidAge(17)).toBe(false);
      expect(isValidAge(121)).toBe(false);
      expect(isValidAge(-1)).toBe(false);
    });
  });

  describe('isValidLocation', () => {
    it('should validate correct coordinates', () => {
      expect(isValidLocation(40.7128, -74.0060)).toBe(true);
      expect(isValidLocation(0, 0)).toBe(true);
    });

    it('should reject invalid coordinates', () => {
      expect(isValidLocation(91, 0)).toBe(false);
      expect(isValidLocation(0, 181)).toBe(false);
      expect(isValidLocation('invalid', 'invalid')).toBe(false);
    });
  });

  describe('validateSchema', () => {
    it('should validate user profile schema', () => {
      const validData = {
        userId: 123456789,
        firstName: 'John',
        age: 25,
        language: 'en',
      };

      const result = validateSchema(validData, schemas.userProfile);
      expect(result.error).toBeNull();
      expect(result.value).toBeDefined();
    });

    it('should reject invalid user profile', () => {
      const invalidData = {
        userId: 'invalid',
        firstName: '',
        age: 15,
      };

      const result = validateSchema(invalidData, schemas.userProfile);
      expect(result.error).toBeDefined();
    });

    it('should validate payment schema', () => {
      const validData = {
        userId: 123456789,
        amount: 9.99,
        currency: 'USD',
        planId: 'basic',
        provider: 'epayco',
      };

      const result = validateSchema(validData, schemas.payment);
      expect(result.error).toBeNull();
    });
  });
});
