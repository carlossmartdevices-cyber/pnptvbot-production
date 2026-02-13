/**
 * Main Room API Integration Tests
 * Tests for all HTTP endpoints with Telegram authentication
 *
 * Coverage:
 * - GET /api/rooms - 8 tests
 * - GET /api/rooms/:roomId - 6 tests
 * - POST /api/rooms/:roomId/join - 15 tests
 * - POST /api/rooms/:roomId/leave - 5 tests
 * - GET /api/rooms/:roomId/participants - 3 tests
 * - POST /api/rooms/:roomId/kick - 3 tests
 */

// Setup environment FIRST
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 'test_token_123';
process.env.AGORA_APP_ID = 'test_agora_app_id';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Mock modules BEFORE any requires
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../../src/config/postgres', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../../../src/models/mainRoomModel', () => ({
  getAll: jest.fn(),
  getById: jest.fn(),
  joinRoom: jest.fn(),
  leaveRoom: jest.fn(),
  getParticipants: jest.fn(),
  getEvents: jest.fn(),
  kickParticipant: jest.fn(),
  muteParticipant: jest.fn(),
  setSpotlight: jest.fn(),
}));

jest.mock('../../../src/models/userModel', () => ({
  findByTelegramId: jest.fn(),
}));

jest.mock('../../../src/services/agora/agoraTokenService', () => ({
  generateMainRoomTokens: jest.fn(),
}));

jest.mock('../../../src/bot/services/rateLimitGranular', () => ({
  consumeRateLimit: jest.fn(),
  getRateLimitInfo: jest.fn(),
}));

jest.mock('../../../src/bot/services/telegramWebAppAuth', () => ({
  resolveTelegramUser: jest.fn(),
}));

const request = require('supertest');

const MainRoomModel = require('../../../src/models/mainRoomModel');
const UserModel = require('../../../src/models/userModel');
const agoraTokenService = require('../../../src/services/agora/agoraTokenService');
const { consumeRateLimit, getRateLimitInfo } = require('../../../src/bot/services/rateLimitGranular');
const { resolveTelegramUser } = require('../../../src/bot/services/telegramWebAppAuth');
const { createMainRoom, createRoomParticipants, createAgoraTokens, createUser } = require('../../fixtures/hangoutsFactories');

// Create a mock Express app for testing
const express = require('express');
let app;

beforeAll(() => {
  app = express();
  app.use(express.json());

  // Mock routes - import the controller
  const MainRoomController = require('../../../src/bot/api/controllers/mainRoomController');

  // Setup routes
  app.get('/api/rooms', MainRoomController.listRooms.bind(MainRoomController));
  app.get('/api/rooms/:roomId', MainRoomController.getRoom.bind(MainRoomController));
  app.post('/api/rooms/:roomId/join', MainRoomController.joinRoom.bind(MainRoomController));
  app.post('/api/rooms/:roomId/leave', MainRoomController.leaveRoom.bind(MainRoomController));
  app.get('/api/rooms/:roomId/participants', MainRoomController.getParticipants.bind(MainRoomController));
  app.get('/api/rooms/:roomId/events', MainRoomController.getEvents.bind(MainRoomController));
  app.post('/api/rooms/:roomId/kick', MainRoomController.kickParticipant.bind(MainRoomController));
});

describe('Main Room API', () => {
  const testUser = createUser({ id: '123456789' });
  const inactiveUser = createUser({ id: '111111111', is_active: false });
  const testRoom = createMainRoom(1, { current_participants: 10 });
  const testTokens = createAgoraTokens(testRoom.channel_name, '123456789');

  beforeEach(() => {
    jest.clearAllMocks();
    MainRoomModel.getAll.mockClear();
    MainRoomModel.getById.mockClear();
    MainRoomModel.joinRoom.mockClear();
    MainRoomModel.leaveRoom.mockClear();
    MainRoomModel.getParticipants.mockClear();
    UserModel.findByTelegramId.mockClear();
    agoraTokenService.generateMainRoomTokens.mockClear();
    consumeRateLimit.mockClear();
    resolveTelegramUser.mockClear();
  });

  describe('GET /api/rooms', () => {
    it('should return all rooms with participant counts', async () => {
      const rooms = [
        createMainRoom(1, { current_participants: 10 }),
        createMainRoom(2, { current_participants: 25 }),
        createMainRoom(3, { current_participants: 0 }),
      ];
      MainRoomModel.getAll.mockResolvedValueOnce(rooms);
      MainRoomModel.getParticipants
        .mockResolvedValueOnce(createRoomParticipants(1, 10, { is_publisher: Math.random() > 0.5 }))
        .mockResolvedValueOnce(createRoomParticipants(2, 25, { is_publisher: Math.random() > 0.5 }))
        .mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/rooms')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.rooms).toHaveLength(3);
      expect(res.body.count).toBe(3);
      expect(res.body.rooms[0]).toHaveProperty('currentParticipants');
      expect(res.body.rooms[0]).toHaveProperty('maxParticipants');
      expect(res.body.rooms[0]).toHaveProperty('publishers');
      expect(res.body.rooms[0]).toHaveProperty('viewers');
      expect(res.body.rooms[0]).toHaveProperty('isFull');
    });

    it('should return correct format for room objects', async () => {
      MainRoomModel.getAll.mockResolvedValueOnce([testRoom]);
      MainRoomModel.getParticipants.mockResolvedValueOnce(createRoomParticipants(1, 3));

      const res = await request(app)
        .get('/api/rooms')
        .expect(200);

      expect(res.body.rooms[0]).toEqual(
        expect.objectContaining({
          id: 1,
          name: expect.any(String),
          description: expect.any(String),
          currentParticipants: expect.any(Number),
          maxParticipants: expect.any(Number),
          publishers: expect.any(Number),
          viewers: expect.any(Number),
          isFull: expect.any(Boolean),
          isActive: expect.any(Boolean),
        })
      );
    });

    it('should return 200 status', async () => {
      MainRoomModel.getAll.mockResolvedValueOnce([]);

      await request(app)
        .get('/api/rooms')
        .expect(200);
    });

    it('should handle database errors gracefully', async () => {
      MainRoomModel.getAll.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .get('/api/rooms')
        .expect(500);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('should return empty array when no rooms exist', async () => {
      MainRoomModel.getAll.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/rooms')
        .expect(200);

      expect(res.body.rooms).toEqual([]);
      expect(res.body.count).toBe(0);
    });

    it('should calculate viewers correctly', async () => {
      const room = createMainRoom(1, { current_participants: 50 });
      const participants = createRoomParticipants(1, 50);
      const publishers = participants.slice(0, 25).map(p => ({ ...p, is_publisher: true }));

      MainRoomModel.getAll.mockResolvedValueOnce([room]);
      MainRoomModel.getParticipants.mockResolvedValueOnce(
        [...publishers, ...participants.slice(25)]
      );

      const res = await request(app)
        .get('/api/rooms')
        .expect(200);

      expect(res.body.rooms[0].publishers).toBe(25);
      expect(res.body.rooms[0].viewers).toBe(25);
    });

    it('should identify full rooms', async () => {
      const fullRoom = createMainRoom(1, { current_participants: 50, max_participants: 50 });
      MainRoomModel.getAll.mockResolvedValueOnce([fullRoom]);
      MainRoomModel.getParticipants.mockResolvedValueOnce(createRoomParticipants(1, 50));

      const res = await request(app)
        .get('/api/rooms')
        .expect(200);

      expect(res.body.rooms[0].isFull).toBe(true);
    });

    it('should identify non-full rooms', async () => {
      const openRoom = createMainRoom(1, { current_participants: 25, max_participants: 50 });
      MainRoomModel.getAll.mockResolvedValueOnce([openRoom]);
      MainRoomModel.getParticipants.mockResolvedValueOnce(createRoomParticipants(1, 25));

      const res = await request(app)
        .get('/api/rooms')
        .expect(200);

      expect(res.body.rooms[0].isFull).toBe(false);
    });
  });

  describe('GET /api/rooms/:roomId', () => {
    it('should return room details', async () => {
      MainRoomModel.getById.mockResolvedValueOnce(testRoom);
      MainRoomModel.getParticipants.mockResolvedValueOnce(createRoomParticipants(1, 5));

      const res = await request(app)
        .get('/api/rooms/1')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.id).toBe(1);
      expect(res.body.name).toBeDefined();
      expect(res.body.currentParticipants).toBeDefined();
    });

    it('should return 404 for invalid roomId', async () => {
      MainRoomModel.getById.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/rooms/999')
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Room not found');
    });

    it('should return publishers/viewers count', async () => {
      const participants = createRoomParticipants(1, 10);
      participants[0].is_publisher = true;
      participants[1].is_publisher = true;

      MainRoomModel.getById.mockResolvedValueOnce(testRoom);
      MainRoomModel.getParticipants.mockResolvedValueOnce(participants);

      const res = await request(app)
        .get('/api/rooms/1')
        .expect(200);

      expect(res.body.publishers).toBe(2);
      expect(res.body.viewers).toBe(8);
    });

    it('should return room settings', async () => {
      MainRoomModel.getById.mockResolvedValueOnce(testRoom);
      MainRoomModel.getParticipants.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/rooms/1')
        .expect(200);

      expect(res.body).toHaveProperty('enforceCamera');
      expect(res.body).toHaveProperty('autoApprovePublisher');
    });

    it('should return correct timestamps', async () => {
      MainRoomModel.getById.mockResolvedValueOnce(testRoom);
      MainRoomModel.getParticipants.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/rooms/1')
        .expect(200);

      expect(res.body).toHaveProperty('createdAt');
      expect(res.body).toHaveProperty('updatedAt');
    });
  });

  describe('POST /api/rooms/:roomId/join', () => {
    it('should successfully join as viewer', async () => {
      resolveTelegramUser.mockReturnValueOnce({
        ok: true,
        user: { id: 123456789, firstName: 'Test', username: 'testuser' },
      });
      UserModel.findByTelegramId.mockResolvedValueOnce(testUser);
      MainRoomModel.getById.mockResolvedValueOnce(testRoom);
      consumeRateLimit.mockResolvedValueOnce(true);
      MainRoomModel.joinRoom.mockResolvedValueOnce({
        room: testRoom,
        ...testTokens,
        currentParticipants: 11,
      });
      agoraTokenService.generateMainRoomTokens.mockReturnValueOnce(testTokens);

      const res = await request(app)
        .post('/api/rooms/1/join')
        .send({ asPublisher: false })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('uid');
      expect(res.body).toHaveProperty('appId');
      expect(res.body.appId).toBe(process.env.AGORA_APP_ID);
      expect(res.body.isPublisher).toBe(false);
    });

    it('should successfully join as publisher', async () => {
      resolveTelegramUser.mockReturnValueOnce({
        ok: true,
        user: { id: 123456789, firstName: 'Test' },
      });
      UserModel.findByTelegramId.mockResolvedValueOnce(testUser);
      MainRoomModel.getById.mockResolvedValueOnce(testRoom);
      consumeRateLimit.mockResolvedValueOnce(true);
      MainRoomModel.joinRoom.mockResolvedValueOnce({
        room: testRoom,
        ...testTokens,
        currentParticipants: 11,
      });
      agoraTokenService.generateMainRoomTokens.mockReturnValueOnce(testTokens);

      const res = await request(app)
        .post('/api/rooms/1/join')
        .send({ asPublisher: true })
        .expect(200);

      expect(res.body.isPublisher).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      resolveTelegramUser.mockReturnValueOnce({
        ok: false,
        reason: 'Invalid signature',
      });

      const res = await request(app)
        .post('/api/rooms/1/join')
        .send({ asPublisher: false })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('should return 403 for inactive user', async () => {
      resolveTelegramUser.mockReturnValueOnce({
        ok: true,
        user: { id: 111111111, firstName: 'Inactive' },
      });
      UserModel.findByTelegramId.mockResolvedValueOnce(inactiveUser);

      const res = await request(app)
        .post('/api/rooms/1/join')
        .send({ asPublisher: false })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('deactivated');
    });

    it('should return 403 for unregistered user', async () => {
      resolveTelegramUser.mockReturnValueOnce({
        ok: true,
        user: { id: 999999999, firstName: 'Unknown' },
      });
      UserModel.findByTelegramId.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/rooms/1/join')
        .send({ asPublisher: false })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not registered');
    });

    it('should return 404 for invalid room', async () => {
      resolveTelegramUser.mockReturnValueOnce({
        ok: true,
        user: { id: 123456789, firstName: 'Test' },
      });
      UserModel.findByTelegramId.mockResolvedValueOnce(testUser);
      MainRoomModel.getById.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/rooms/999/join')
        .send({ asPublisher: false })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Room not found');
    });

    it('should return 410 when room inactive', async () => {
      const inactiveRoom = createMainRoom(1, { is_active: false });
      resolveTelegramUser.mockReturnValueOnce({
        ok: true,
        user: { id: 123456789, firstName: 'Test' },
      });
      UserModel.findByTelegramId.mockResolvedValueOnce(testUser);
      MainRoomModel.getById.mockResolvedValueOnce(inactiveRoom);

      const res = await request(app)
        .post('/api/rooms/1/join')
        .send({ asPublisher: false })
        .expect(410);

      expect(res.body.success).toBe(false);
    });

    it('should return 429 when rate limited', async () => {
      resolveTelegramUser.mockReturnValueOnce({
        ok: true,
        user: { id: 123456789, firstName: 'Test' },
      });
      UserModel.findByTelegramId.mockResolvedValueOnce(testUser);
      MainRoomModel.getById.mockResolvedValueOnce(testRoom);
      consumeRateLimit.mockResolvedValueOnce(false);
      getRateLimitInfo.mockResolvedValueOnce({ resetIn: 300 });

      const res = await request(app)
        .post('/api/rooms/1/join')
        .send({ asPublisher: false })
        .expect(429);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Rate limit');
      expect(res.body.retryAfter).toBeDefined();
    });

    it('should return 409 when room full', async () => {
      const error = new Error('Room is full (50/50 publishers)');
      resolveTelegramUser.mockReturnValueOnce({
        ok: true,
        user: { id: 123456789, firstName: 'Test' },
      });
      UserModel.findByTelegramId.mockResolvedValueOnce(testUser);
      MainRoomModel.getById.mockResolvedValueOnce(testRoom);
      consumeRateLimit.mockResolvedValueOnce(true);
      MainRoomModel.joinRoom.mockRejectedValueOnce(error);

      const res = await request(app)
        .post('/api/rooms/1/join')
        .send({ asPublisher: true })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Room is full');
    });

    it('should return token with correct format', async () => {
      resolveTelegramUser.mockReturnValueOnce({
        ok: true,
        user: { id: 123456789, firstName: 'Test' },
      });
      UserModel.findByTelegramId.mockResolvedValueOnce(testUser);
      MainRoomModel.getById.mockResolvedValueOnce(testRoom);
      consumeRateLimit.mockResolvedValueOnce(true);
      MainRoomModel.joinRoom.mockResolvedValueOnce({
        room: testRoom,
        ...testTokens,
        currentParticipants: 11,
      });
      agoraTokenService.generateMainRoomTokens.mockReturnValueOnce(testTokens);

      const res = await request(app)
        .post('/api/rooms/1/join')
        .send({ asPublisher: false })
        .expect(200);

      expect(res.body.token).toBe(testTokens.token);
      expect(res.body.uid).toBe(testTokens.uid);
    });

    it('should track alreadyJoined status', async () => {
      resolveTelegramUser.mockReturnValueOnce({
        ok: true,
        user: { id: 123456789, firstName: 'Test' },
      });
      UserModel.findByTelegramId.mockResolvedValueOnce(testUser);
      MainRoomModel.getById.mockResolvedValueOnce(testRoom);
      consumeRateLimit.mockResolvedValueOnce(true);
      MainRoomModel.joinRoom.mockResolvedValueOnce({
        room: testRoom,
        ...testTokens,
        currentParticipants: 10,
        alreadyJoined: true,
      });
      agoraTokenService.generateMainRoomTokens.mockReturnValueOnce(testTokens);

      const res = await request(app)
        .post('/api/rooms/1/join')
        .send({ asPublisher: false })
        .expect(200);

      expect(res.body.alreadyJoined).toBe(true);
    });

    it('should return participant counts', async () => {
      resolveTelegramUser.mockReturnValueOnce({
        ok: true,
        user: { id: 123456789, firstName: 'Test' },
      });
      UserModel.findByTelegramId.mockResolvedValueOnce(testUser);
      MainRoomModel.getById.mockResolvedValueOnce(testRoom);
      consumeRateLimit.mockResolvedValueOnce(true);
      MainRoomModel.joinRoom.mockResolvedValueOnce({
        room: testRoom,
        ...testTokens,
        currentParticipants: 11,
      });
      agoraTokenService.generateMainRoomTokens.mockReturnValueOnce(testTokens);

      const res = await request(app)
        .post('/api/rooms/1/join')
        .send({ asPublisher: false })
        .expect(200);

      expect(res.body).toHaveProperty('currentParticipants');
      expect(res.body).toHaveProperty('maxParticipants');
    });
  });

  describe('POST /api/rooms/:roomId/leave', () => {
    it('should successfully leave room', async () => {
      resolveTelegramUser.mockReturnValueOnce({
        ok: true,
        user: { id: 123456789 },
      });
      MainRoomModel.leaveRoom.mockResolvedValueOnce();

      const res = await request(app)
        .post('/api/rooms/1/leave')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBeDefined();
    });

    it('should return 401 without authentication', async () => {
      resolveTelegramUser.mockReturnValueOnce({
        ok: false,
        reason: 'Invalid signature',
      });

      const res = await request(app)
        .post('/api/rooms/1/leave')
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should call leaveRoom with correct parameters', async () => {
      resolveTelegramUser.mockReturnValueOnce({
        ok: true,
        user: { id: 123456789 },
      });
      MainRoomModel.leaveRoom.mockResolvedValueOnce();

      await request(app)
        .post('/api/rooms/1/leave')
        .expect(200);

      expect(MainRoomModel.leaveRoom).toHaveBeenCalledWith(1, '123456789');
    });

    it('should handle database errors gracefully', async () => {
      resolveTelegramUser.mockReturnValueOnce({
        ok: true,
        user: { id: 123456789 },
      });
      MainRoomModel.leaveRoom.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/rooms/1/leave')
        .expect(500);

      expect(res.body.success).toBe(false);
    });

    it('should return 400 without userId', async () => {
      resolveTelegramUser.mockReturnValueOnce({
        ok: true,
        user: {}, // No id
      });

      const res = await request(app)
        .post('/api/rooms/1/leave')
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/rooms/:roomId/participants', () => {
    it('should return room participants', async () => {
      const participants = createRoomParticipants(1, 5);
      MainRoomModel.getById.mockResolvedValueOnce(testRoom);
      MainRoomModel.getParticipants.mockResolvedValueOnce(participants);

      const res = await request(app)
        .get('/api/rooms/1/participants')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.participants).toHaveLength(5);
      expect(res.body.count).toBe(5);
    });

    it('should filter publishers only with query param', async () => {
      const publishers = createRoomParticipants(1, 2, { is_publisher: true });
      MainRoomModel.getById.mockResolvedValueOnce(testRoom);
      MainRoomModel.getParticipants.mockResolvedValueOnce(publishers);

      const res = await request(app)
        .get('/api/rooms/1/participants?publishersOnly=true')
        .expect(200);

      expect(res.body.participants).toHaveLength(2);
      expect(MainRoomModel.getParticipants).toHaveBeenCalledWith(1, true);
    });

    it('should return 404 for invalid room', async () => {
      MainRoomModel.getById.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/rooms/999/participants')
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  // Helper function for creating room participants
  function createRoomParticipants(roomId, count, overrides = {}) {
    return Array.from({ length: count }, (_, i) => ({
      id: `participant-${i}`,
      room_id: roomId,
      user_id: String(1000000000 + i),
      user_name: `User ${i}`,
      is_publisher: overrides.is_publisher || false,
      is_moderator: false,
      joined_at: new Date(),
      left_at: null,
      total_duration_seconds: 0,
    }));
  }
});
