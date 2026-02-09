// Test setup file
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 'test_token';
process.env.REDIS_HOST = 'localhost';
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.FIREBASE_PRIVATE_KEY = 'test-key';
process.env.FIREBASE_CLIENT_EMAIL = 'test@test.com';
process.env.BROADCAST_QUEUE_POLL_INTERVAL_MS = '50';
process.env.BROADCAST_QUEUE_RETRY_DELAY_MS = '50';
process.env.SKIP_DB_TESTS = 'true';
process.env.EPAYCO_P_CUST_ID = '1565511';
process.env.EPAYCO_P_KEY = '4ae1e189c9af6a730b71bc4f15546b78520ad338';
process.env.EPAYCO_PUBLIC_KEY = '6d5c47f6a632c0bacd5bb31990d4e994';
process.env.EPAYCO_PRIVATE_KEY = 'c3b7fa0d75e65dd28804fb9c18989693';
process.env.QATOUCH_ENABLED = 'false';

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  addUserContext: jest.fn((userId, action) => ({
    userId,
    action,
    timestamp: new Date().toISOString(),
  })),
  stream: { write: () => {} },
}));
