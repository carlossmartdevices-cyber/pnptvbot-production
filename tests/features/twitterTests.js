/**
 * X/Twitter Tests
 * Tests for OAuth, posting, and scheduling
 */

const axios = require('axios');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

describe('X/Twitter Integration Tests', () => {
  describe('OAuth Configuration', () => {
    test('Twitter OAuth credentials are configured', () => {
      expect(process.env.TWITTER_CLIENT_ID).toBeDefined();
      expect(process.env.TWITTER_CLIENT_SECRET).toBeDefined();
      expect(process.env.TWITTER_REDIRECT_URI).toBeDefined();
    });

    test('OAuth start endpoint is accessible', async () => {
      const response = await axios.get(`${BASE_URL}/api/admin/x/oauth/start`, {
        validateStatus: () => true,
      });

      // Should redirect or return auth URL
      expect([200, 302, 401, 403]).toContain(response.status);
    });

    test('OAuth callback endpoint exists', async () => {
      const response = await axios.get(`${BASE_URL}/api/auth/x/callback`, {
        params: { code: 'test', state: 'test' },
        validateStatus: () => true,
      });

      // Should handle callback (even if validation fails)
      expect([200, 400, 401]).toContain(response.status);
    });
  });

  describe('X Post Service', () => {
    const XPostService = require('../../src/bot/services/xPostService');

    test('XPostService is importable', () => {
      expect(XPostService).toBeDefined();
    });

    test('normalizeXText truncates long text', () => {
      const longText = 'a'.repeat(300);
      const result = XPostService.normalizeXText(longText);

      expect(result.text.length).toBeLessThanOrEqual(280);
      expect(result.truncated).toBe(true);
    });

    test('normalizeXText keeps short text unchanged', () => {
      const shortText = 'Hello world!';
      const result = XPostService.normalizeXText(shortText);

      expect(result.text).toBe(shortText);
      expect(result.truncated).toBe(false);
    });

    test('Can list active accounts', async () => {
      const accounts = await XPostService.listActiveAccounts();
      expect(Array.isArray(accounts)).toBe(true);
    });

    test('Can get scheduled posts', async () => {
      const posts = await XPostService.getScheduledPosts();
      expect(Array.isArray(posts)).toBe(true);
    });

    test('Can get post history', async () => {
      const history = await XPostService.getPostHistory(10);
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('X Post Scheduler', () => {
    const XPostScheduler = require('../../src/bot/core/schedulers/xPostScheduler');

    test('XPostScheduler is importable', () => {
      expect(XPostScheduler).toBeDefined();
    });

    test('Scheduler can be instantiated', () => {
      const scheduler = new XPostScheduler();
      expect(scheduler).toBeDefined();
      expect(scheduler.isRunning).toBe(false);
    });

    test('Scheduler can start and stop', () => {
      const scheduler = new XPostScheduler();

      scheduler.start();
      expect(scheduler.isRunning).toBe(true);

      scheduler.stop();
      expect(scheduler.isRunning).toBe(false);
    });

    test('Scheduler status is available', () => {
      const scheduler = new XPostScheduler();
      const status = scheduler.getStatus();

      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('processingCount');
      expect(status).toHaveProperty('hasBot');
    });
  });
});

describe('X Post Wizard', () => {
  const { getSession, STEPS } = require('../../src/bot/handlers/admin/xPostWizard');

  test('Wizard session can be created', () => {
    const mockCtx = {
      session: {},
    };

    const session = getSession(mockCtx);
    expect(session).toBeDefined();
    expect(session.step).toBe(STEPS.MENU);
  });

  test('STEPS constants are defined', () => {
    expect(STEPS.MENU).toBeDefined();
    expect(STEPS.SELECT_ACCOUNT).toBeDefined();
    expect(STEPS.COMPOSE_TEXT).toBeDefined();
    expect(STEPS.PREVIEW).toBeDefined();
    expect(STEPS.SCHEDULE).toBeDefined();
  });
});
