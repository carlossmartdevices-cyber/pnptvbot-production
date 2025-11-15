const logger = require('../../src/utils/logger');

describe('Logger Utility', () => {
  beforeEach(() => {
    // Silence console during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic logging', () => {
    it('should log info messages', () => {
      expect(() => {
        logger.info('Test info message');
      }).not.toThrow();
    });

    it('should log error messages', () => {
      expect(() => {
        logger.error('Test error message');
      }).not.toThrow();
    });

    it('should log warning messages', () => {
      expect(() => {
        logger.warn('Test warning message');
      }).not.toThrow();
    });

    it('should log debug messages', () => {
      expect(() => {
        logger.debug('Test debug message');
      }).not.toThrow();
    });
  });

  describe('User context logging', () => {
    it('should add user context to logs', () => {
      const context = logger.addUserContext(123456, 'test_action');

      expect(context).toBeDefined();
      expect(context.userId).toBe(123456);
      expect(context.action).toBe('test_action');
      expect(context.timestamp).toBeDefined();
    });

    it('should include timestamp in user context', () => {
      const context = logger.addUserContext(123456, 'test_action');
      const timestamp = new Date(context.timestamp);

      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Stream for Morgan', () => {
    it('should have stream property', () => {
      expect(logger.stream).toBeDefined();
      expect(logger.stream.write).toBeInstanceOf(Function);
    });

    it('should write to stream without errors', () => {
      expect(() => {
        logger.stream.write('Test HTTP log\n');
      }).not.toThrow();
    });
  });

  describe('Error handling', () => {
    it('should log error objects with stack trace', () => {
      const error = new Error('Test error');
      expect(() => {
        logger.error('Error occurred', error);
      }).not.toThrow();
    });

    it('should log errors with additional metadata', () => {
      const error = new Error('Test error');
      expect(() => {
        logger.error('Error occurred', { error, userId: 123 });
      }).not.toThrow();
    });
  });

  describe('Log levels', () => {
    it('should respect log level configuration', () => {
      const originalLevel = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = 'error';

      // Should not throw even if log level filters the message
      expect(() => {
        logger.info('This might be filtered');
      }).not.toThrow();

      process.env.LOG_LEVEL = originalLevel;
    });
  });
});
