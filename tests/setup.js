// Test setup file
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 'test_token';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6380';
process.env.POSTGRES_HOST = 'localhost';
process.env.POSTGRES_PORT = '55432';
process.env.POSTGRES_DATABASE = 'pnptvbot';
process.env.POSTGRES_USER = 'pnptvbot';
process.env.POSTGRES_PASSWORD = 'Apelo801050#';
process.env.POSTGRES_SSL = 'true';
process.env.DATABASE_URL = 'postgresql://pnptvbot:Apelo801050%23@localhost:55432/pnptvbot';
process.env.JWT_SECRET = 'test_secret';

// Set test-specific configurations
jestTimeout = 30000;

// Handle uncaught promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
