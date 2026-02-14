/**
 * Hangouts API Integration Tests
 * Tests: /api/hangouts/public, /api/hangouts/create, /api/hangouts/join/:callId
 */

const request = require('supertest');
const crypto = require('crypto');

// Mock environment BEFORE requiring modules
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 'test_token_123';
process.env.AGORA_APP_ID = 'test_agora_app_id';
process.env.JAAS_APP_ID = 'test_jaas_app_id';

// Mock modules BEFORE importing app
jest.mock('../../src/models/videoCallModel');
jest.mock('../../src/config/postgres', () => ({
  getPool: jest.fn(() => ({ query: jest.fn() })),
  query: jest.fn(),
  initializePostgres: jest.fn(),
  testConnection: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../src/utils/logger');
jest.mock('../../src/bot/core/middleware/rateLimitGranular');
jest.mock('../../src/services/agora/agoraTokenService');
jest.mock('../../src/bot/services/telegramWebAppAuth', () => ({
  validateTelegramWebAppInitData: jest.fn(),
}));
jest.mock('../../src/bot/services/jaasService', () => ({
  isConfigured: jest.fn(() => false),
}));

const VideoCallModel = require('../../src/models/videoCallModel');
const { query } = require('../../src/config/postgres');
const { consumeRateLimit, getRateLimitInfo } = require('../../src/bot/core/middleware/rateLimitGranular');
const { validateTelegramWebAppInitData } = require('../../src/bot/services/telegramWebAppAuth');

// Import app AFTER mocks are set up
let app;
try {
  app = require('../../src/bot/api/routes');
} catch (error) {
  console.log('Warning: Could not import express app:', error.message);
  app = null;
}

// Test fixtures
const testUserRecord = {
  id: '123456789',
  subscription_status: 'active',
  tier: 'prime',
  role: 'user',
  accepted_terms: true,
  is_active: true,
};

const testUserRecordNoPrime = {
  id: '987654321',
  subscription_status: 'free',
  tier: 'free',
  role: 'user',
  accepted_terms: true,
  is_active: true,
};

const testInactiveUserRecord = {
  id: '111111111',
  subscription_status: 'free',
  role: 'user',
  is_active: false,
};

const testCall = {
  id: 'call-uuid-1',
  creatorId: '123456789',
  creatorName: 'Test User',
  channelName: 'call_abc123',
  title: 'Test Room',
  maxParticipants: 10,
  currentParticipants: 2,
  isPublic: true,
  isActive: true,
  rtcToken: 'mock_token',
  appId: 'test_agora_app_id',
  createdAt: new Date().toISOString(),
};

// Helper: mock validateTelegramWebAppInitData to return a valid user
function mockValidAuth(userId = '123456789', displayName = 'Test User') {
  validateTelegramWebAppInitData.mockReturnValue({
    ok: true,
    user: { id: userId, displayName },
  });
}

function mockInvalidAuth() {
  validateTelegramWebAppInitData.mockReturnValue({
    ok: false,
    reason: 'invalid_signature',
  });
}

// Helper: mock DB query for user lookup
function mockUserQuery(userRecord) {
  query.mockResolvedValue({ rows: userRecord ? [userRecord] : [] });
}

describe('Hangouts API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no auth, no user
    validateTelegramWebAppInitData.mockReturnValue({ ok: false, reason: 'missing_init_data', user: null });
    query.mockResolvedValue({ rows: [] });
  });

  describe('GET /api/hangouts/public - List Public Hangouts', () => {
    it('should return empty list when no public calls exist', async () => {
      VideoCallModel.getAllPublic.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/hangouts/public')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        rooms: [],
        count: 0,
      });
    });

    it('should return public calls with safe fields', async () => {
      VideoCallModel.getAllPublic.mockResolvedValue([testCall]);

      const response = await request(app)
        .get('/api/hangouts/public')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.rooms).toHaveLength(1);
      expect(response.body.rooms[0]).toHaveProperty('id', testCall.id);
      expect(response.body.rooms[0]).toHaveProperty('title', testCall.title);
      // Verify no sensitive fields leaked
      expect(response.body.rooms[0]).not.toHaveProperty('rtcToken');
      expect(response.body.rooms[0]).not.toHaveProperty('channelName');
    });

    it('should handle database errors gracefully', async () => {
      VideoCallModel.getAllPublic.mockRejectedValue(new Error('DB connection failed'));

      const response = await request(app)
        .get('/api/hangouts/public')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to load rooms');
    });

    it('should not require authentication', async () => {
      VideoCallModel.getAllPublic.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/hangouts/public');

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/hangouts/create - Create New Room', () => {
    describe('Authentication', () => {
      it('should return 400 when no creatorId and no auth in non-prod', async () => {
        // In non-prod (NODE_ENV=test), missing auth doesn't return 401 for public rooms
        // But without creatorId it returns 400
        const response = await request(app)
          .post('/api/hangouts/create')
          .send({ title: 'Test Room', isPublic: true })
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should accept valid telegram init data header', async () => {
        mockValidAuth('123456789', 'Test User');
        mockUserQuery(testUserRecord);
        consumeRateLimit.mockResolvedValue(true);
        VideoCallModel.create.mockResolvedValue(testCall);

        const response = await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', 'valid_data')
          .send({ title: 'My Room', isPublic: true })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.callId).toBe('call-uuid-1');
      });

      it('should reject invalid init data signature', async () => {
        mockInvalidAuth();

        const response = await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', 'invalid_data')
          .send({ title: 'Test' })
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Authorization', () => {
      it('should reject creation if user not found in DB', async () => {
        mockValidAuth('123456789');
        mockUserQuery(null); // No user in DB

        const response = await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', 'valid_data')
          .send({ title: 'Test' })
          .expect(403);

        expect(response.body.error).toContain('registered');
      });

      it('should reject if user is inactive', async () => {
        mockValidAuth('111111111');
        mockUserQuery(testInactiveUserRecord);

        const response = await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', 'valid_data')
          .send({ title: 'Test' })
          .expect(403);

        expect(response.body.error).toContain('deactivated');
      });

      it('should reject private room creation if user not PRIME', async () => {
        mockValidAuth('987654321');
        mockUserQuery(testUserRecordNoPrime);

        const response = await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', 'valid_data')
          .send({ title: 'Private Room', isPublic: false })
          .expect(403);

        expect(response.body.error).toContain('Prime');
      });

      it('should allow public room creation if user not PRIME', async () => {
        mockValidAuth('987654321');
        mockUserQuery(testUserRecordNoPrime);
        consumeRateLimit.mockResolvedValue(true);
        VideoCallModel.create.mockResolvedValue({ ...testCall, id: 'pub-room' });

        const response = await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', 'valid_data')
          .send({ title: 'Public Room', isPublic: true })
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('Input Validation', () => {
      beforeEach(() => {
        mockValidAuth('123456789', 'Test User');
        mockUserQuery(testUserRecord);
        consumeRateLimit.mockResolvedValue(true);
        VideoCallModel.create.mockResolvedValue(testCall);
      });

      it('should use creatorId from auth data', async () => {
        await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', 'valid_data')
          .send({ title: 'Test' })
          .expect(200);

        expect(VideoCallModel.create).toHaveBeenCalledWith(
          expect.objectContaining({ creatorId: '123456789' })
        );
      });

      it('should normalize maxParticipants (min 2, max 50)', async () => {
        // Test min clamping
        await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', 'valid_data')
          .send({ maxParticipants: 1 });

        expect(VideoCallModel.create).toHaveBeenCalledWith(
          expect.objectContaining({ maxParticipants: 2 })
        );

        jest.clearAllMocks();
        mockValidAuth('123456789');
        mockUserQuery(testUserRecord);
        consumeRateLimit.mockResolvedValue(true);
        VideoCallModel.create.mockResolvedValue(testCall);

        // Test max clamping
        await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', 'valid_data')
          .send({ maxParticipants: 100 });

        expect(VideoCallModel.create).toHaveBeenCalledWith(
          expect.objectContaining({ maxParticipants: 50 })
        );
      });

      it('should handle null/undefined title', async () => {
        await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', 'valid_data')
          .send({});

        expect(VideoCallModel.create).toHaveBeenCalledWith(
          expect.objectContaining({ title: null })
        );
      });
    });

    describe('Rate Limiting', () => {
      it('should enforce rate limit', async () => {
        mockValidAuth('123456789');
        mockUserQuery(testUserRecord);
        consumeRateLimit.mockResolvedValue(false);
        getRateLimitInfo.mockResolvedValue({ resetIn: 1800 });

        const response = await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', 'valid_data')
          .send({ title: 'Test' })
          .expect(429);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Rate limit');
        expect(response.body.retryAfter).toBe(1800);
      });
    });

    describe('Success Response', () => {
      beforeEach(() => {
        mockValidAuth('123456789', 'Test User');
        mockUserQuery(testUserRecord);
        consumeRateLimit.mockResolvedValue(true);
      });

      it('should return complete room info', async () => {
        VideoCallModel.create.mockResolvedValue({
          ...testCall,
          id: 'new-room-id',
          channelName: 'new_channel',
        });

        const response = await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', 'valid_data')
          .send({ title: 'New Room', isPublic: true })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.id).toBe('new-room-id');
        expect(response.body.callId).toBe('new-room-id');
        expect(response.body.room).toBe('new_channel');
      });
    });
  });

  describe('POST /api/hangouts/join/:callId - Join Room', () => {
    const callId = testCall.id;

    describe('Authentication', () => {
      it('should return 400 when no userId and no auth in non-prod', async () => {
        const response = await request(app)
          .post(`/api/hangouts/join/${callId}`)
          .send({})
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should accept valid telegram init data', async () => {
        mockValidAuth('123456789');
        mockUserQuery(testUserRecord);
        VideoCallModel.getById.mockResolvedValue(testCall);
        VideoCallModel.joinCall.mockResolvedValue({
          call: { ...testCall, currentParticipants: 3 },
          rtcToken: 'join_token',
          appId: 'test_agora_app_id',
        });

        const response = await request(app)
          .post(`/api/hangouts/join/${callId}`)
          .set('x-telegram-init-data', 'valid_data')
          .send({})
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('Room State Validation', () => {
      beforeEach(() => {
        mockValidAuth('123456789');
        mockUserQuery(testUserRecord);
      });

      it('should return 404 if room not found', async () => {
        VideoCallModel.getById.mockResolvedValue(null);

        const response = await request(app)
          .post(`/api/hangouts/join/${callId}`)
          .set('x-telegram-init-data', 'valid_data')
          .send({})
          .expect(404);

        expect(response.body.error).toContain('not found');
      });

      it('should return 410 if room is ended', async () => {
        VideoCallModel.getById.mockResolvedValue({ ...testCall, isActive: false });

        const response = await request(app)
          .post(`/api/hangouts/join/${callId}`)
          .set('x-telegram-init-data', 'valid_data')
          .send({})
          .expect(410);

        expect(response.body.error).toContain('no longer active');
      });
    });

    describe('Capacity Management', () => {
      it('should return 409 if room is full', async () => {
        mockValidAuth('123456789');
        mockUserQuery(testUserRecord);
        VideoCallModel.getById.mockResolvedValue(testCall);
        VideoCallModel.joinCall.mockRejectedValue(new Error('Call is full'));

        const response = await request(app)
          .post(`/api/hangouts/join/${callId}`)
          .set('x-telegram-init-data', 'valid_data')
          .send({})
          .expect(409);

        expect(response.body.error).toContain('full');
      });
    });
  });

  describe('Error Response Format', () => {
    it('should not expose internal database details', async () => {
      VideoCallModel.getAllPublic.mockRejectedValue(
        new Error('PostgreSQL connection timeout')
      );

      const response = await request(app)
        .get('/api/hangouts/public')
        .expect(500);

      expect(response.body.error).not.toContain('PostgreSQL');
    });
  });
});
