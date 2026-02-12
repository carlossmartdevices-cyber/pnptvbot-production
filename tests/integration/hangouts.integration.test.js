/**
 * Hangouts API Integration Tests
 * Tests: /api/hangouts/public, /api/hangouts/create, /api/hangouts/join/:callId
 *
 * Test Coverage:
 * - Public room listing
 * - Room creation with auth
 * - Room joining with capacity checks
 * - Rate limiting
 * - Error scenarios
 */

const request = require('supertest');
const crypto = require('crypto');

// Mock environment BEFORE requiring modules
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 'test_token_123';
process.env.AGORA_APP_ID = 'test_agora_app_id';
process.env.JAAS_APP_ID = 'test_jaas_app_id';
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.RATE_LIMIT_MAX_REQUESTS = '100';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// Mock modules BEFORE importing app
jest.mock('../../../src/models/videoCallModel');
jest.mock('../../../src/models/userModel');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/bot/services/rateLimitGranular');
jest.mock('../../../src/services/agora/agoraTokenService');

const VideoCallModel = require('../../../src/models/videoCallModel');
const UserModel = require('../../../src/models/userModel');
const { consumeRateLimit, getRateLimitInfo } = require('../../../src/bot/services/rateLimitGranular');
const agoraTokenService = require('../../../src/services/agora/agoraTokenService');

// Import app AFTER mocks are set up
let app;

// Try to import, but gracefully handle if it fails in test
try {
  app = require('../../../src/bot/api/routes');
} catch (error) {
  console.log('Warning: Could not import express app, will use mock:', error.message);
  // In test environment, we'll skip the actual app tests
  app = null;
}

// Test fixtures
const testUser = {
  id: '123456789',
  pnp_user_id: 'uuid-user-1',
  username: 'testuser',
  first_name: 'Test',
  is_active: true,
  telegram_chat_id: 123456789,
  prime_member: true,
  premium_member: false,
  created_at: new Date(),
};

const testUserNoPrime = {
  id: '987654321',
  pnp_user_id: 'uuid-user-2',
  username: 'testuser2',
  first_name: 'Test2',
  is_active: true,
  telegram_chat_id: 987654321,
  prime_member: false,
  premium_member: false,
  created_at: new Date(),
};

const testInactiveUser = {
  id: '111111111',
  pnp_user_id: 'uuid-user-3',
  username: 'inactive',
  is_active: false,
  created_at: new Date(),
};

const testCall = {
  id: 'call-uuid-1',
  creator_id: '123456789',
  creator_name: 'Test User',
  channel_name: 'call_abc123',
  title: 'Test Room',
  max_participants: 10,
  current_participants: 2,
  is_public: true,
  is_active: true,
  enforce_camera: false,
  allow_guests: true,
  created_at: new Date(),
  metadata: {},
};

/**
 * Generate valid Telegram WebApp init data
 */
function generateValidInitData(userId, username = 'testuser') {
  const authDate = Math.floor(Date.now() / 1000);
  const user = JSON.stringify({
    id: userId,
    first_name: 'Test',
    username: username,
    is_bot: false,
  });

  // Create data check string (same format as Telegram)
  const dataCheckString = `auth_date=${authDate}\nuser=${encodeURIComponent(user)}`;

  // Generate hash
  const secretKey = crypto.createHmac('sha256', 'WebAppData')
    .update(process.env.BOT_TOKEN)
    .digest();
  const hash = crypto.createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return `auth_date=${authDate}&user=${encodeURIComponent(user)}&hash=${hash}`;
}

/**
 * Generate invalid init data (bad signature)
 */
function generateInvalidInitData() {
  const authDate = Math.floor(Date.now() / 1000);
  const user = JSON.stringify({ id: '123456789', first_name: 'Test', username: 'testuser' });
  return `auth_date=${authDate}&user=${encodeURIComponent(user)}&hash=invalidsignature`;
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Hangouts API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/hangouts/public - List Public Hangouts', () => {
    it('should return empty list when no public calls exist', async () => {
      VideoCallModel.getAllPublic.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/hangouts/public')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        rooms: [],
        count: 0,
      });
      expect(VideoCallModel.getAllPublic).toHaveBeenCalled();
    });

    it('should return public calls with safe fields', async () => {
      VideoCallModel.getAllPublic.mockResolvedValue([testCall]);

      const response = await request(app)
        .get('/api/hangouts/public')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body.success).toBe(true);
      expect(response.body.rooms).toHaveLength(1);
      expect(response.body.rooms[0]).toEqual({
        id: testCall.id,
        title: testCall.title,
        creatorName: testCall.creator_name,
        currentParticipants: testCall.current_participants,
        maxParticipants: testCall.max_participants,
        createdAt: testCall.created_at.toISOString(),
      });

      // Verify no sensitive fields leaked
      expect(response.body.rooms[0]).not.toHaveProperty('channel_name');
      expect(response.body.rooms[0]).not.toHaveProperty('token');
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

      // Should succeed without auth headers
      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/hangouts/create - Create New Room', () => {
    describe('Authentication', () => {
      it('should reject request without Telegram auth data', async () => {
        const response = await request(app)
          .post('/api/hangouts/create')
          .send({
            title: 'Test Room',
            isPublic: true,
          })
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('authentication');
      });

      it('should accept valid x-telegram-init-data header', async () => {
        const initData = generateValidInitData('123456789');
        UserModel.findByTelegramId.mockResolvedValue(testUser);
        consumeRateLimit.mockResolvedValue(true);
        VideoCallModel.create.mockResolvedValue({
          ...testCall,
          id: 'new-call-id',
        });
        agoraTokenService.generateVideoCallTokens.mockReturnValue({
          token: 'agora_token',
          uid: '123456789',
        });

        const response = await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', initData)
          .send({
            title: 'My Room',
            isPublic: true,
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.callId).toBe('new-call-id');
      });

      it('should reject invalid init data signature', async () => {
        const invalidInitData = generateInvalidInitData();

        const response = await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', invalidInitData)
          .send({ title: 'Test' })
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Authorization', () => {
      it('should reject creation if user not found', async () => {
        const initData = generateValidInitData('123456789');
        UserModel.findByTelegramId.mockResolvedValue(null);

        const response = await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', initData)
          .send({ title: 'Test' })
          .expect(403);

        expect(response.body.error).toContain('registered');
      });

      it('should reject if user is inactive', async () => {
        const initData = generateValidInitData('111111111');
        UserModel.findByTelegramId.mockResolvedValue(testInactiveUser);

        const response = await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', initData)
          .send({ title: 'Test' })
          .expect(403);

        expect(response.body.error).toContain('deactivated');
      });

      it('should reject private room creation if user not PRIME', async () => {
        const initData = generateValidInitData('987654321');
        UserModel.findByTelegramId.mockResolvedValue(testUserNoPrime);

        const response = await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', initData)
          .send({
            title: 'Private Room',
            isPublic: false,
          })
          .expect(403);

        expect(response.body.error).toContain('PRIME');
      });

      it('should allow public room creation if user not PRIME', async () => {
        const initData = generateValidInitData('987654321');
        UserModel.findByTelegramId.mockResolvedValue(testUserNoPrime);
        consumeRateLimit.mockResolvedValue(true);
        VideoCallModel.create.mockResolvedValue(testCall);
        agoraTokenService.generateVideoCallTokens.mockReturnValue({
          token: 'agora_token',
          uid: '987654321',
        });

        const response = await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', initData)
          .send({
            title: 'Public Room',
            isPublic: true,
          })
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('Input Validation', () => {
      beforeEach(() => {
        UserModel.findByTelegramId.mockResolvedValue(testUser);
        consumeRateLimit.mockResolvedValue(true);
        VideoCallModel.create.mockResolvedValue(testCall);
        agoraTokenService.generateVideoCallTokens.mockReturnValue({
          token: 'agora_token',
          uid: '123456789',
        });
      });

      it('should use creatorId from auth data', async () => {
        const initData = generateValidInitData('123456789', 'authuser');

        await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', initData)
          .send({ title: 'Test' })
          .expect(200);

        expect(VideoCallModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            creatorId: '123456789',
          })
        );
      });

      it('should normalize maxParticipants (min 2, max 50)', async () => {
        const initData = generateValidInitData('123456789');

        // Test min clamping
        await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', initData)
          .send({ maxParticipants: 1 });

        expect(VideoCallModel.create).toHaveBeenCalledWith(
          expect.objectContaining({ maxParticipants: 2 })
        );

        jest.clearAllMocks();
        VideoCallModel.create.mockResolvedValue(testCall);

        // Test max clamping
        await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', initData)
          .send({ maxParticipants: 100 });

        expect(VideoCallModel.create).toHaveBeenCalledWith(
          expect.objectContaining({ maxParticipants: 50 })
        );
      });

      it('should handle null/undefined title', async () => {
        const initData = generateValidInitData('123456789');

        await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', initData)
          .send({});

        expect(VideoCallModel.create).toHaveBeenCalledWith(
          expect.objectContaining({ title: null })
        );
      });
    });

    describe('Rate Limiting', () => {
      beforeEach(() => {
        UserModel.findByTelegramId.mockResolvedValue(testUser);
      });

      it('should enforce rate limit (5 calls per hour)', async () => {
        const initData = generateValidInitData('123456789');
        consumeRateLimit.mockResolvedValue(false);
        getRateLimitInfo.mockResolvedValue({
          remaining: 0,
          resetIn: 1800,
        });

        const response = await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', initData)
          .send({ title: 'Test' })
          .expect(429);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Rate limit');
        expect(response.body.retryAfter).toBe(1800);
      });

      it('should include retryAfter in rate limit response', async () => {
        const initData = generateValidInitData('123456789');
        consumeRateLimit.mockResolvedValue(false);
        getRateLimitInfo.mockResolvedValue({
          resetIn: 900,
        });

        const response = await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', initData)
          .send({ title: 'Test' })
          .expect(429);

        expect(response.body.retryAfter).toBe(900);
      });
    });

    describe('Success Response', () => {
      beforeEach(() => {
        UserModel.findByTelegramId.mockResolvedValue(testUser);
        consumeRateLimit.mockResolvedValue(true);
        agoraTokenService.generateVideoCallTokens.mockReturnValue({
          token: 'agora_token_xyz',
          uid: '123456789',
        });
      });

      it('should return complete room info with tokens', async () => {
        const initData = generateValidInitData('123456789');
        VideoCallModel.create.mockResolvedValue({
          ...testCall,
          id: 'new-room-id',
          channel_name: 'new_channel',
        });

        const response = await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', initData)
          .send({
            title: 'New Room',
            isPublic: true,
          })
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          id: 'new-room-id',
          callId: 'new-room-id',
          room: 'new_channel',
          token: 'agora_token_xyz',
          uid: '123456789',
          appId: expect.any(String),
          platform: expect.stringMatching(/jitsi|agora/),
          isPublic: true,
          maxParticipants: 10,
        });
      });

      it('should have jitsiUrl when configured', async () => {
        const initData = generateValidInitData('123456789');
        process.env.JAAS_APP_ID = 'configured_app_id';

        VideoCallModel.create.mockResolvedValue(testCall);

        const response = await request(app)
          .post('/api/hangouts/create')
          .set('x-telegram-init-data', initData)
          .send({ title: 'Test' })
          .expect(200);

        expect(response.body).toHaveProperty('jitsiUrl');
      });
    });
  });

  describe('POST /api/hangouts/join/:callId - Join Room', () => {
    const callId = testCall.id;

    describe('Authentication', () => {
      it('should reject without auth data', async () => {
        const response = await request(app)
          .post(`/api/hangouts/join/${callId}`)
          .send({ userId: '123456789' })
          .expect(401);

        expect(response.body.success).toBe(false);
      });

      it('should accept valid telegram init data', async () => {
        const initData = generateValidInitData('123456789');
        UserModel.findByTelegramId.mockResolvedValue(testUser);
        VideoCallModel.getById.mockResolvedValue(testCall);
        VideoCallModel.joinCall.mockResolvedValue({
          ...testCall,
          current_participants: 3,
        });
        agoraTokenService.generateVideoCallTokens.mockReturnValue({
          token: 'join_token',
          uid: '123456789',
        });

        const response = await request(app)
          .post(`/api/hangouts/join/${callId}`)
          .set('x-telegram-init-data', initData)
          .send({})
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('Authorization', () => {
      beforeEach(() => {
        VideoCallModel.getById.mockResolvedValue(testCall);
      });

      it('should reject if user not found', async () => {
        const initData = generateValidInitData('123456789');
        UserModel.findByTelegramId.mockResolvedValue(null);

        const response = await request(app)
          .post(`/api/hangouts/join/${callId}`)
          .set('x-telegram-init-data', initData)
          .send({})
          .expect(403);

        expect(response.body.error).toContain('registered');
      });

      it('should reject if user is inactive', async () => {
        const initData = generateValidInitData('111111111');
        UserModel.findByTelegramId.mockResolvedValue(testInactiveUser);

        const response = await request(app)
          .post(`/api/hangouts/join/${callId}`)
          .set('x-telegram-init-data', initData)
          .send({})
          .expect(403);

        expect(response.body.error).toContain('deactivated');
      });
    });

    describe('Room State Validation', () => {
      beforeEach(() => {
        UserModel.findByTelegramId.mockResolvedValue(testUser);
      });

      it('should return 404 if room not found', async () => {
        const initData = generateValidInitData('123456789');
        VideoCallModel.getById.mockResolvedValue(null);

        const response = await request(app)
          .post(`/api/hangouts/join/${callId}`)
          .set('x-telegram-init-data', initData)
          .send({})
          .expect(404);

        expect(response.body.error).toContain('not found');
      });

      it('should return 410 if room is ended', async () => {
        const initData = generateValidInitData('123456789');
        const endedCall = { ...testCall, is_active: false };
        VideoCallModel.getById.mockResolvedValue(endedCall);

        const response = await request(app)
          .post(`/api/hangouts/join/${callId}`)
          .set('x-telegram-init-data', initData)
          .send({})
          .expect(410);

        expect(response.body.error).toContain('no longer active');
      });
    });

    describe('Capacity Management', () => {
      beforeEach(() => {
        UserModel.findByTelegramId.mockResolvedValue(testUser);
      });

      it('should return 409 if room is full', async () => {
        const initData = generateValidInitData('123456789');
        const fullCall = { ...testCall, current_participants: 10, max_participants: 10 };
        VideoCallModel.getById.mockResolvedValue(fullCall);
        VideoCallModel.joinCall.mockRejectedValue(new Error('Call is full'));

        const response = await request(app)
          .post(`/api/hangouts/join/${callId}`)
          .set('x-telegram-init-data', initData)
          .send({})
          .expect(409);

        expect(response.body.error).toContain('full');
      });
    });

    describe('Success Response', () => {
      beforeEach(() => {
        UserModel.findByTelegramId.mockResolvedValue(testUser);
        VideoCallModel.getById.mockResolvedValue(testCall);
        VideoCallModel.joinCall.mockResolvedValue({
          ...testCall,
          current_participants: 3,
        });
        agoraTokenService.generateVideoCallTokens.mockReturnValue({
          token: 'join_token_xyz',
          uid: '123456789',
        });
      });

      it('should return room tokens and info', async () => {
        const initData = generateValidInitData('123456789');

        const response = await request(app)
          .post(`/api/hangouts/join/${callId}`)
          .set('x-telegram-init-data', initData)
          .send({})
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          room: testCall.channel_name,
          token: 'join_token_xyz',
          uid: '123456789',
          appId: expect.any(String),
          jitsiUrl: expect.any(String),
          platform: expect.stringMatching(/jitsi|agora/),
          callId: testCall.id,
          isPublic: true,
          isModerator: false,
        });
      });

      it('should mark creator as moderator', async () => {
        const initData = generateValidInitData('123456789');
        const creatorCall = { ...testCall, creator_id: '123456789' };
        VideoCallModel.getById.mockResolvedValue(creatorCall);
        VideoCallModel.joinCall.mockResolvedValue(creatorCall);

        const response = await request(app)
          .post(`/api/hangouts/join/${callId}`)
          .set('x-telegram-init-data', initData)
          .send({})
          .expect(200);

        expect(response.body.isModerator).toBe(true);
      });

      it('should be idempotent - return same tokens if already joined', async () => {
        const initData = generateValidInitData('123456789');
        VideoCallModel.joinCall.mockResolvedValue({
          ...testCall,
          alreadyJoined: true,
        });

        const response = await request(app)
          .post(`/api/hangouts/join/${callId}`)
          .set('x-telegram-init-data', initData)
          .send({})
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.token).toBeTruthy();
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
      expect(response.body.error).not.toContain('connection timeout');
    });

    it('should not expose Agora or Jitsi credentials in errors', async () => {
      const initData = generateValidInitData('123456789');
      UserModel.findByTelegramId.mockResolvedValue(testUser);
      consumeRateLimit.mockResolvedValue(true);
      VideoCallModel.create.mockRejectedValue(
        new Error('AGORA_APP_ID=secret123')
      );

      const response = await request(app)
        .post('/api/hangouts/create')
        .set('x-telegram-init-data', initData)
        .send({ title: 'Test' })
        .expect(500);

      expect(response.body.error).not.toContain('AGORA');
      expect(response.body.error).not.toContain('secret123');
    });
  });
});
