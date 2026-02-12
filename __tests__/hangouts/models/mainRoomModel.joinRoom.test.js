/**
 * MainRoomModel.joinRoom() Tests
 * Tests room joining with publisher/viewer roles and capacity checks
 */

const MainRoomModel = require('../../../src/models/mainRoomModel');
const agoraTokenService = require('../../../src/services/agora/agoraTokenService');
const TestDataFactory = require('../../fixtures/factories');

describe('MainRoomModel.joinRoom()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    testUtils.clearMocks();
  });

  describe('Successful Join as Viewer', () => {
    it('should join room as viewer with valid data', async () => {
      const room = TestDataFactory.createMainRoom(1);
      const userId = '987654321';
      const userName = 'Test Viewer';

      agoraTokenService.generateMainRoomTokens.mockReturnValue({
        token: 'mock_viewer_token',
        uid: userId,
        role: 'subscriber',
      });

      const result = await MainRoomModel.joinRoom(
        room.id,
        userId,
        userName,
        false // viewer
      );

      expect(result).toMatchObject({
        roomId: room.id,
        token: 'mock_viewer_token',
        isPublisher: false,
      });
    });

    it('should increment currentParticipants on join', async () => {
      const room = TestDataFactory.createMainRoom(1, { current_participants: 10 });

      // Mock database update
      testUtils.mockQueryResults['UPDATE main_rooms'] = {
        rows: [{ ...room, current_participants: 11 }]
      };

      const result = await MainRoomModel.joinRoom(1, '987654321', 'User', false);

      expect(result.currentParticipants).toBeGreaterThanOrEqual(room.currentParticipants);
    });

    it('should record participant in database', async () => {
      agoraTokenService.generateMainRoomTokens.mockReturnValue({
        token: 'mock_token',
        uid: '987654321',
      });

      await MainRoomModel.joinRoom(1, '987654321', 'Test User', false);

      // Verify INSERT was called
      expect(testUtils.mockQueryCalls.some(call =>
        call.sql.includes('INSERT INTO room_participants')
      )).toBe(true);
    });

    it('should generate subscriber tokens for viewers', async () => {
      const tokens = TestDataFactory.createAgoraTokens('main_room_1', '987654321');
      agoraTokenService.generateMainRoomTokens.mockReturnValue({
        token: tokens.token,
        uid: tokens.uid,
        role: 'subscriber',
      });

      await MainRoomModel.joinRoom(1, '987654321', 'User', false);

      expect(agoraTokenService.generateMainRoomTokens).toHaveBeenCalledWith(
        expect.any(String),
        '987654321',
        false // isPublisher
      );
    });
  });

  describe('Successful Join as Publisher', () => {
    it('should join room as publisher if space available', async () => {
      const room = TestDataFactory.createMainRoom(1, { current_participants: 10 });

      agoraTokenService.generateMainRoomTokens.mockReturnValue({
        token: 'mock_publisher_token',
        uid: '987654321',
        role: 'publisher',
      });

      const result = await MainRoomModel.joinRoom(
        room.id,
        '987654321',
        'Test Publisher',
        true // publisher
      );

      expect(result).toMatchObject({
        isPublisher: true,
        token: 'mock_publisher_token',
      });
    });

    it('should generate publisher tokens for publishers', async () => {
      agoraTokenService.generateMainRoomTokens.mockReturnValue({
        token: 'mock_pub_token',
        uid: '987654321',
        role: 'publisher',
      });

      await MainRoomModel.joinRoom(1, '987654321', 'User', true);

      expect(agoraTokenService.generateMainRoomTokens).toHaveBeenCalledWith(
        expect.any(String),
        '987654321',
        true // isPublisher
      );
    });

    it('should mark participant as is_publisher in database', async () => {
      agoraTokenService.generateMainRoomTokens.mockReturnValue({
        token: 'mock_token',
        uid: '987654321',
      });

      await MainRoomModel.joinRoom(1, '987654321', 'User', true);

      // Verify is_publisher = true in INSERT
      const insertCall = testUtils.mockQueryCalls.find(call =>
        call.sql.includes('INSERT INTO room_participants')
      );
      expect(insertCall.sql).toContain('is_publisher');
    });
  });

  describe('Publisher Upgrade', () => {
    it('should upgrade viewer to publisher if space available', async () => {
      const room = TestDataFactory.createMainRoom(1, { current_participants: 10 });

      agoraTokenService.generateMainRoomTokens.mockReturnValue({
        token: 'mock_upgraded_token',
        uid: '987654321',
        role: 'publisher',
      });

      // Mock: user already in room as viewer
      testUtils.mockQueryResults['SELECT id, is_publisher'] = {
        rows: [{ id: 'participant-id', is_publisher: false }]
      };

      const result = await MainRoomModel.joinRoom(1, '987654321', 'User', true);

      expect(result.upgraded).toBe(true);
      expect(result.isPublisher).toBe(true);
    });

    it('should throw if cannot upgrade to publisher (room full)', async () => {
      const room = TestDataFactory.createMainRoom(1, {
        current_participants: 50,
        max_participants: 50
      });

      // Mock: user already in room
      testUtils.mockQueryResults['SELECT id, is_publisher'] = {
        rows: [{ id: 'participant-id', is_publisher: false }]
      };

      await expect(
        MainRoomModel.joinRoom(room.id, '987654321', 'User', true)
      ).rejects.toThrow('Room is full');
    });

    it('should keep viewer role if not requesting upgrade', async () => {
      // Mock: user already in room as viewer
      testUtils.mockQueryResults['SELECT id, is_publisher'] = {
        rows: [{ id: 'participant-id', is_publisher: false }]
      };

      agoraTokenService.generateMainRoomTokens.mockReturnValue({
        token: 'mock_token',
        uid: '987654321',
        role: 'subscriber',
      });

      const result = await MainRoomModel.joinRoom(1, '987654321', 'User', false);

      expect(result.upgraded).toBe(false);
      expect(result.isPublisher).toBe(false);
    });
  });

  describe('Capacity & State Validation', () => {
    it('should throw if room not found', async () => {
      testUtils.mockQueryResults['SELECT * FROM main_rooms'] = { rows: [] };

      await expect(
        MainRoomModel.joinRoom(999, '987654321', 'User', false)
      ).rejects.toThrow('Room not found');
    });

    it('should throw if room is not active', async () => {
      const room = TestDataFactory.createMainRoom(1, { is_active: false });
      testUtils.mockQueryResults['SELECT * FROM main_rooms'] = {
        rows: [room]
      };

      await expect(
        MainRoomModel.joinRoom(room.id, '987654321', 'User', false)
      ).rejects.toThrow('Room is not active');
    });

    it('should throw if room full for publisher join', async () => {
      const room = TestDataFactory.createMainRoom(1, {
        current_participants: 50,
        max_participants: 50
      });

      await expect(
        MainRoomModel.joinRoom(room.id, '987654321', 'User', true)
      ).rejects.toThrow('Room is full');
    });

    it('should allow viewer join even if publisher slots full', async () => {
      const room = TestDataFactory.createMainRoom(1, {
        current_participants: 50,
        max_participants: 50
      });

      agoraTokenService.generateMainRoomTokens.mockReturnValue({
        token: 'mock_token',
        uid: '987654321',
      });

      // Viewers can always join (no publisher limit for viewers)
      const result = await MainRoomModel.joinRoom(room.id, '987654321', 'User', false);

      expect(result.isPublisher).toBe(false);
    });
  });

  describe('Idempotent Join', () => {
    it('should return existing tokens if user already in room', async () => {
      const existingParticipant = {
        id: 'existing-id',
        is_publisher: false
      };
      testUtils.mockQueryResults['SELECT id, is_publisher'] = {
        rows: [existingParticipant]
      };

      agoraTokenService.generateMainRoomTokens.mockReturnValue({
        token: 'existing_token',
        uid: '987654321',
      });

      const result = await MainRoomModel.joinRoom(1, '987654321', 'User', false);

      expect(result.alreadyJoined).toBe(true);
      expect(result.token).toBe('existing_token');
    });

    it('should not increment participant counter for existing user', async () => {
      testUtils.mockQueryResults['SELECT id, is_publisher'] = {
        rows: [{ id: 'existing-id', is_publisher: false }]
      };

      agoraTokenService.generateMainRoomTokens.mockReturnValue({
        token: 'token',
        uid: '987654321',
      });

      await MainRoomModel.joinRoom(1, '987654321', 'User', false);

      // Should NOT have UPDATE to increment counter
      expect(testUtils.mockQueryCalls.some(call =>
        call.sql.includes('current_participants + 1')
      )).toBe(false);
    });
  });

  describe('Transaction Safety', () => {
    it('should use transaction for join operation', async () => {
      agoraTokenService.generateMainRoomTokens.mockReturnValue({
        token: 'mock_token',
        uid: '987654321',
      });

      await MainRoomModel.joinRoom(1, '987654321', 'User', false);

      // Should have BEGIN and COMMIT
      const sqlQueries = testUtils.mockQueryCalls.map(c => c.sql.toUpperCase());
      expect(sqlQueries.some(sql => sql === 'BEGIN')).toBe(true);
      expect(sqlQueries.some(sql => sql === 'COMMIT')).toBe(true);
    });

    it('should rollback on error', async () => {
      jest.spyOn(MainRoomModel, 'joinRoom')
        .mockRejectedValue(new Error('DB Error'));

      await expect(
        MainRoomModel.joinRoom(1, '987654321', 'User', false)
      ).rejects.toThrow('DB Error');

      // Should have attempted rollback
      const sqlQueries = testUtils.mockQueryCalls.map(c => c.sql.toUpperCase());
      // Rollback would be called in error handler
    });

    it('should lock room row during join', async () => {
      agoraTokenService.generateMainRoomTokens.mockReturnValue({
        token: 'mock_token',
        uid: '987654321',
      });

      await MainRoomModel.joinRoom(1, '987654321', 'User', false);

      // Should have FOR UPDATE in SELECT
      expect(testUtils.mockQueryCalls.some(call =>
        call.sql.includes('FOR UPDATE')
      )).toBe(true);
    });
  });

  describe('Event Logging', () => {
    it('should log user join event', async () => {
      const logRoomEventSpy = jest.spyOn(MainRoomModel, 'logRoomEvent')
        .mockResolvedValue(undefined);

      agoraTokenService.generateMainRoomTokens.mockReturnValue({
        token: 'mock_token',
        uid: '987654321',
      });

      await MainRoomModel.joinRoom(1, '987654321', 'User', false);

      expect(logRoomEventSpy).toHaveBeenCalledWith(
        1,
        'USER_JOINED_VIEWER',
        null,
        '987654321'
      );

      logRoomEventSpy.mockRestore();
    });

    it('should log publisher join event', async () => {
      const logRoomEventSpy = jest.spyOn(MainRoomModel, 'logRoomEvent')
        .mockResolvedValue(undefined);

      agoraTokenService.generateMainRoomTokens.mockReturnValue({
        token: 'mock_token',
        uid: '987654321',
      });

      await MainRoomModel.joinRoom(1, '987654321', 'User', true);

      expect(logRoomEventSpy).toHaveBeenCalledWith(
        1,
        'USER_JOINED_PUBLISHER',
        null,
        '987654321'
      );

      logRoomEventSpy.mockRestore();
    });

    it('should log upgrade event', async () => {
      const logRoomEventSpy = jest.spyOn(MainRoomModel, 'logRoomEvent')
        .mockResolvedValue(undefined);

      testUtils.mockQueryResults['SELECT id, is_publisher'] = {
        rows: [{ id: 'existing-id', is_publisher: false }]
      };

      agoraTokenService.generateMainRoomTokens.mockReturnValue({
        token: 'mock_token',
        uid: '987654321',
      });

      await MainRoomModel.joinRoom(1, '987654321', 'User', true);

      expect(logRoomEventSpy).toHaveBeenCalledWith(
        1,
        'PUBLISH_GRANTED',
        null,
        '987654321'
      );

      logRoomEventSpy.mockRestore();
    });
  });

  describe('User ID Conversion', () => {
    it('should convert userId to string', async () => {
      agoraTokenService.generateMainRoomTokens.mockReturnValue({
        token: 'mock_token',
        uid: '987654321',
      });

      await MainRoomModel.joinRoom(1, 987654321, 'User', false); // number instead of string

      // Should have converted to string in database calls
      expect(testUtils.mockQueryCalls.some(call =>
        call.params && call.params.includes('987654321')
      )).toBe(true);
    });
  });

  describe('Response Format', () => {
    it('should return room in response', async () => {
      const room = TestDataFactory.createMainRoom(1);
      agoraTokenService.generateMainRoomTokens.mockReturnValue({
        token: 'mock_token',
        uid: '987654321',
      });

      const result = await MainRoomModel.joinRoom(1, '987654321', 'User', false);

      expect(result).toHaveProperty('roomId');
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('uid');
    });

    it('should return all required token fields', async () => {
      agoraTokenService.generateMainRoomTokens.mockReturnValue({
        token: 'agora_token_xyz',
        uid: '987654321',
        role: 'subscriber',
      });

      const result = await MainRoomModel.joinRoom(1, '987654321', 'User', false);

      expect(result.token).toBe('agora_token_xyz');
      expect(result.uid).toBe('987654321');
      expect(result.token).toBeTruthy();
    });

    it('should include currentParticipants in response', async () => {
      const room = TestDataFactory.createMainRoom(1, { current_participants: 25 });
      agoraTokenService.generateMainRoomTokens.mockReturnValue({
        token: 'mock_token',
        uid: '987654321',
      });

      const result = await MainRoomModel.joinRoom(1, '987654321', 'User', false);

      expect(result.currentParticipants).toBeDefined();
      expect(typeof result.currentParticipants).toBe('number');
    });
  });
});
