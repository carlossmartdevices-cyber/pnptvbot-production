/**
 * Groups & Channels Tests
 * Tests for PRIME access, Wall of Fame, moderation, and bans
 */

const axios = require('axios');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

describe('Groups & Channels Configuration', () => {
  test('PRIME channel ID is configured', () => {
    expect(process.env.PRIME_CHANNEL_ID).toBeDefined();
  });

  test('Group ID is configured', () => {
    expect(process.env.GROUP_ID).toBeDefined();
  });

  test('Wall of Fame topic ID is configured', () => {
    expect(process.env.WALL_OF_FAME_TOPIC_ID).toBeDefined();
  });

  test('Notifications topic ID is configured', () => {
    expect(process.env.NOTIFICATIONS_TOPIC_ID).toBeDefined();
  });
});

describe('Moderation System', () => {
  const ModerationModel = require('../../src/models/moderationModel');

  test('ModerationModel is importable', () => {
    expect(ModerationModel).toBeDefined();
  });

  test('ModerationModel has ban methods', () => {
    expect(typeof ModerationModel.banUser).toBe('function');
    expect(typeof ModerationModel.unbanUser).toBe('function');
    expect(typeof ModerationModel.isUserBanned).toBe('function');
  });

  test('ModerationModel has warning methods', () => {
    expect(typeof ModerationModel.addWarning).toBe('function');
    expect(typeof ModerationModel.getUserWarnings).toBe('function');
    expect(typeof ModerationModel.clearWarnings).toBe('function');
  });

  test('ModerationModel has logging methods', () => {
    expect(typeof ModerationModel.addLog).toBe('function');
    expect(typeof ModerationModel.getGroupLogs).toBe('function');
  });
});

describe('Global Ban System', () => {
  const ModerationModel = require('../../src/models/moderationModel');

  test('Can check if user is banned globally', async () => {
    const testUserId = '999999999';
    const isBanned = await ModerationModel.isUserBanned(testUserId, 'global');

    expect(typeof isBanned).toBe('boolean');
  });

  test('Banned users table exists', async () => {
    const { query } = require('../../src/config/postgres');

    const result = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'banned_users'
      )
    `);

    expect(result.rows[0].exists).toBe(true);
  });
});

describe('Global Ban Middleware', () => {
  test('Global ban check middleware is importable', () => {
    const globalBanCheck = require('../../src/bot/core/middleware/globalBanCheck');
    expect(globalBanCheck).toBeDefined();
    expect(typeof globalBanCheck).toBe('function');
  });

  test('Middleware returns a function', () => {
    const globalBanCheck = require('../../src/bot/core/middleware/globalBanCheck');
    const middleware = globalBanCheck();

    expect(typeof middleware).toBe('function');
  });
});

describe('Permission Service', () => {
  const PermissionService = require('../../src/bot/services/permissionService');

  test('PermissionService is importable', () => {
    expect(PermissionService).toBeDefined();
  });

  test('PermissionService has isAdmin method', () => {
    expect(typeof PermissionService.isAdmin).toBe('function');
  });
});

describe('Wall of Fame Guard', () => {
  test('Wall of Fame guard middleware exists', () => {
    const wallOfFameGuard = require('../../src/bot/core/middleware/wallOfFameGuard');
    expect(wallOfFameGuard).toBeDefined();
  });
});

describe('Notifications Topic Guard', () => {
  test('Notifications topic guard middleware exists', () => {
    const notificationsTopicGuard = require('../../src/bot/core/middleware/notificationsTopicGuard');
    expect(notificationsTopicGuard).toBeDefined();
  });
});

describe('Moderation Filter', () => {
  test('Moderation filter middleware exists', () => {
    const moderationFilter = require('../../src/bot/core/middleware/moderationFilter');
    expect(moderationFilter).toBeDefined();
    expect(typeof moderationFilter).toBe('function');
  });
});
