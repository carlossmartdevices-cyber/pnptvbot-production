const {
  sanitizeInput,
  isValidEmail,
  isValidAge,
  isValidLocation,
  isValidUsername,
  isValidUrl,
  isValidAmount,
  isValidTelegramId,
  validateSchema,
  sanitizeObject,
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
      expect(result).toContain('Hello World');
    });

    it('should handle non-string input', () => {
      expect(sanitizeInput(123)).toBe(123);
      expect(sanitizeInput(null)).toBe(null);
      expect(sanitizeInput(undefined)).toBe(undefined);
    });

    it('should remove dangerous script tags', () => {
      const input = '<img src="x" onerror="alert(1)">Test';
      const result = sanitizeInput(input);
      expect(result).not.toContain('<img');
      expect(result).not.toContain('onerror');
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@example.co.uk')).toBe(true);
    });

    it('should reject invalid email', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
    });
  });

  describe('isValidAge', () => {
    it('should accept valid age', () => {
      expect(isValidAge(18)).toBe(true);
      expect(isValidAge(25)).toBe(true);
      expect(isValidAge(100)).toBe(true);
      expect(isValidAge('25')).toBe(true);
    });

    it('should reject invalid age', () => {
      expect(isValidAge(17)).toBe(false);
      expect(isValidAge(121)).toBe(false);
      expect(isValidAge(-1)).toBe(false);
      expect(isValidAge('invalid')).toBe(false);
      expect(isValidAge(null)).toBe(false);
    });
  });

  describe('isValidUsername', () => {
    it('should accept valid username', () => {
      expect(isValidUsername('john_doe')).toBe(true);
      expect(isValidUsername('user123')).toBe(true);
      expect(isValidUsername('test-user')).toBe(true);
    });

    it('should reject invalid username', () => {
      expect(isValidUsername('ab')).toBe(false); // too short
      expect(isValidUsername('a'.repeat(31))).toBe(false); // too long
      expect(isValidUsername('user@name')).toBe(false); // invalid char
      expect(isValidUsername('user name')).toBe(false); // space
      expect(isValidUsername('')).toBe(false);
      expect(isValidUsername(null)).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('should accept valid URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://example.com/path')).toBe(true);
      expect(isValidUrl('https://example.com:8080')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('ftp://example.com')).toBe(false);
      expect(isValidUrl('example.com')).toBe(false);
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl(null)).toBe(false);
    });
  });

  describe('isValidLocation', () => {
    it('should accept valid coordinates', () => {
      expect(isValidLocation(40.7128, -74.0060)).toBe(true);
      expect(isValidLocation(0, 0)).toBe(true);
      expect(isValidLocation(-90, -180)).toBe(true);
      expect(isValidLocation(90, 180)).toBe(true);
    });

    it('should reject invalid coordinates', () => {
      expect(isValidLocation(91, 0)).toBe(false);
      expect(isValidLocation(0, 181)).toBe(false);
      expect(isValidLocation(-91, 0)).toBe(false);
      expect(isValidLocation(0, -181)).toBe(false);
      expect(isValidLocation('invalid', 'invalid')).toBe(false);
      expect(isValidLocation(null, null)).toBe(false);
    });
  });

  describe('isValidAmount', () => {
    it('should accept valid amounts', () => {
      expect(isValidAmount(0.01)).toBe(true);
      expect(isValidAmount(100)).toBe(true);
      expect(isValidAmount(999999)).toBe(true);
      expect(isValidAmount('50.5')).toBe(true);
    });

    it('should reject invalid amounts', () => {
      expect(isValidAmount(0)).toBe(false);
      expect(isValidAmount(-10)).toBe(false);
      expect(isValidAmount(1000001)).toBe(false);
      expect(isValidAmount('invalid')).toBe(false);
      expect(isValidAmount(null)).toBe(false);
    });
  });

  describe('isValidTelegramId', () => {
    it('should accept valid Telegram IDs', () => {
      expect(isValidTelegramId(123456789)).toBe(true);
      expect(isValidTelegramId('123456789')).toBe(true);
      expect(isValidTelegramId(1)).toBe(true);
    });

    it('should reject invalid Telegram IDs', () => {
      expect(isValidTelegramId(0)).toBe(false);
      expect(isValidTelegramId(-1)).toBe(false);
      expect(isValidTelegramId('invalid')).toBe(false);
      expect(isValidTelegramId(null)).toBe(false);
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
      expect(result.value.userId).toBe(123456789);
    });

    it('should reject invalid user profile', () => {
      const invalidData = {
        userId: 'invalid',
        firstName: '',
        age: 15,
      };

      const result = validateSchema(invalidData, schemas.userProfile);
      expect(result.error).toBeDefined();
      expect(result.value).toBeNull();
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
      expect(result.value).toBeDefined();
    });

    it('should validate location schema', () => {
      const validData = {
        lat: 40.7128,
        lng: -74.0060,
        address: 'New York, NY',
      };

      const result = validateSchema(validData, schemas.location);
      expect(result.error).toBeNull();
      expect(result.value).toBeDefined();
    });

    it('should validate zoom room schema', () => {
      const validData = {
        roomName: 'Test Room',
        privacy: 'public',
        duration: 60,
      };

      const result = validateSchema(validData, schemas.zoomRoom);
      expect(result.error).toBeNull();
      expect(result.value).toBeDefined();
    });

    it('should strip unknown fields', () => {
      const dataWithExtra = {
        userId: 123456789,
        firstName: 'John',
        age: 25,
        language: 'en',
        unknownField: 'should be removed',
      };

      const result = validateSchema(dataWithExtra, schemas.userProfile);
      expect(result.error).toBeNull();
      expect(result.value.unknownField).toBeUndefined();
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize specified fields', () => {
      const obj = {
        name: '<script>alert("xss")</script>John',
        bio: '  Test bio  ',
        age: 25,
      };

      const result = sanitizeObject(obj, ['name', 'bio']);
      expect(result.name).not.toContain('<script>');
      expect(result.bio).toContain('Test bio');
      expect(result.age).toBe(25);
    });

    it('should handle missing fields', () => {
      const obj = {
        name: 'John',
      };

      const result = sanitizeObject(obj, ['name', 'bio']);
      expect(result.name).toBeDefined();
      expect(result.bio).toBeUndefined();
    });

    it('should not modify original object', () => {
      const obj = {
        name: 'John',
        bio: 'Test',
      };

      const result = sanitizeObject(obj, ['name']);
      expect(result).not.toBe(obj);
    });
  });
});
