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
