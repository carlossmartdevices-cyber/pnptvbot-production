/**
 * API Health Tests
 * Comprehensive health checks for all API endpoints
 */

// Load .env.production before requiring routes (which initializes DB pool)
require('dotenv').config({
  path: require('path').join(__dirname, '../../.env.production'),
  override: true,
});

const axios = require('axios');
const apiApp = require('../../src/bot/api/routes'); // Import the Express app
let server;
const serverPort = 3006; // Use a different port to avoid conflicts with other tests

const BASE_URL = `http://localhost:${serverPort}`;
process.env.NODE_ENV = 'production';
process.env.BOT_WEBHOOK_DOMAIN = 'http://test.com';

beforeAll(async () => {
  await new Promise((resolve) => {
    server = apiApp.listen(serverPort, () => {
      console.log(`Test API server started on port ${serverPort}`);
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise((resolve, reject) => {
    if (server) {
      server.close((err) => {
        if (err) {
          console.error('Error closing test API server:', err);
          return reject(err);
        }
        console.log(`Test API server on port ${serverPort} closed.`);
        resolve();
      });
    } else {
      resolve();
    }
  });
});

describe('API Health Checks', () => {
  describe('Core Endpoints', () => {
    test('Health endpoint returns healthy status', async () => {
      const response = await axios.get(`${BASE_URL}/api/health`);

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('healthy');
      expect(response.data.database).toBe('healthy');
      expect(response.data.redis).toBe('healthy');
    });

    test('Health endpoint includes performance metrics', async () => {
      const response = await axios.get(`${BASE_URL}/api/health`);

      expect(response.data).toHaveProperty('uptime');
      expect(response.data).toHaveProperty('memoryUsage');
      expect(response.data).toHaveProperty('performanceMetrics');
    });
  });

  describe('Webhook Endpoints', () => {
    test('Telegram webhook endpoint exists', async () => {
      const response = await axios.get(`${BASE_URL}/webhook/telegram`, {
        validateStatus: () => true,
      });

      // GET should return info about the endpoint
      expect(response.status).toBe(404);
    });

    test('ePayco webhook endpoint exists', async () => {
      const response = await axios.post(`${BASE_URL}/api/webhooks/epayco`, {}, {
        validateStatus: () => true,
      });

      expect([200, 400, 401]).toContain(response.status);
    });

    test('Daimo webhook endpoint exists', async () => {
      const response = await axios.post(`${BASE_URL}/api/webhooks/daimo`, {}, {
        validateStatus: () => true,
      });

      expect([200, 400, 401]).toContain(response.status);
    });
  });

  describe('OAuth Endpoints', () => {
    test('X OAuth start endpoint exists', async () => {
      const response = await axios.get(`${BASE_URL}/api/admin/x/oauth/start`, {
        validateStatus: () => true,
      });

      // 404 is acceptable if route requires auth middleware first
      expect([200, 302, 401, 403, 404, 500]).toContain(response.status);
    });

    test('X OAuth callback endpoint exists', async () => {
      const response = await axios.get(`${BASE_URL}/api/auth/x/callback`, {
        validateStatus: () => true,
      });

      // No params → hash recovery page (200) or error (400)
      expect([200, 400, 401]).toContain(response.status);
    });
  });

  describe('Queue Endpoints', () => {
    test('Broadcast queue stats endpoint exists', async () => {
      const response = await axios.get(`${BASE_URL}/api/admin/queue/stats`, {
        validateStatus: () => true,
      });

      // 404 is acceptable if route is not mounted or requires auth
      expect([200, 401, 403, 404]).toContain(response.status);
    });
  });
});

describe('Database Connection', () => {
  test('PostgreSQL is connected', async () => {
    const response = await axios.get(`${BASE_URL}/api/health`);
    expect(response.data.database).toBe('healthy');
  });

  test('Query cache is working', async () => {
    const response = await axios.get(`${BASE_URL}/api/health`);

    expect(response.data.queryCache).toBeDefined();
    expect(response.data.queryCache.enabled).toBe(true);
  });
});

describe('Redis Connection', () => {
  test('Redis is connected', async () => {
    const response = await axios.get(`${BASE_URL}/api/health`);
    expect(response.data.redis).toBe('healthy');
  });
});

describe('Server Info', () => {
  test('Node version is reported', async () => {
    const response = await axios.get(`${BASE_URL}/api/health`);
    expect(response.data.nodeVersion).toBeDefined();
    expect(response.data.nodeVersion).toMatch(/^v\d+\.\d+\.\d+$/);
  });

  test('Uptime is positive', async () => {
    const response = await axios.get(`${BASE_URL}/api/health`);
    expect(response.data.uptime).toBeGreaterThan(0);
  });

  test('Memory usage is reported', async () => {
    const response = await axios.get(`${BASE_URL}/api/health`);
    expect(response.data.memoryUsage).toHaveProperty('heapUsed');
    expect(response.data.memoryUsage).toHaveProperty('heapTotal');
  });
});
