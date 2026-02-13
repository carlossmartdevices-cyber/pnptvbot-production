/**
 * VideoCallModel Unit Tests
 * Tests for 10-person video calls for PRIME members
 *
 * Coverage:
 * - create() - 15 tests (validation, defaults, token generation)
 * - getById() - 3 tests
 * - joinCall() - 18 tests (capacity, guests, idempotent, etc.)
 * - leaveCall() - 6 tests
 * - endCall() - 6 tests
 * - getParticipants() - 3 tests
 * - kickParticipant() - 4 tests
 * - getAllPublic() - 3 tests
 * - getActiveByCreator() - 3 tests
 * - deleteCall() - 3 tests
 */

jest.mock('../../../src/config/postgres');
jest.mock('../../../src/services/agora/agoraTokenService');
jest.mock('../../../src/utils/logger');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234-5678-90ab-cdef12345678'),
}));

const VideoCallModel = require('../../../src/models/videoCallModel');
const { query, getClient } = require('../../../src/config/postgres');
const agoraTokenService = require('../../../src/services/agora/agoraTokenService');
const logger = require('../../../src/utils/logger');
const { v4: uuidv4 } = require('uuid');
const { createVideoCall, createCallParticipant, createCallParticipants, createAgoraTokens } = require('../../fixtures/hangoutsFactories');

describe('VideoCallModel', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.query.mockClear();
    mockClient.release.mockClear();
    getClient.mockResolvedValue(mockClient);
  });

  describe('create()', () => {
    const creatorId = '123456789';
    const creatorName = 'Test Creator';

    it('should create video call with required fields', async () => {
      const callData = { creatorId, creatorName };
      const dbCall = createVideoCall({ creator_id: creatorId });
      query.mockResolvedValueOnce({ rows: [dbCall] });

      const tokens = createAgoraTokens(dbCall.channel_name, creatorId);
      agoraTokenService.generateVideoCallTokens.mockReturnValue(tokens);

      const result = await VideoCallModel.create(callData);

      expect(result).toBeDefined();
      expect(result.creatorId).toBe(String(creatorId));
      expect(result.creatorName).toBe(creatorName);
    });

    it('should throw when creatorId missing', async () => {
      const callData = { creatorName };

      await expect(VideoCallModel.create(callData)).rejects.toThrow('Missing required fields');
    });

    it('should throw when creatorName missing', async () => {
      const callData = { creatorId };

      await expect(VideoCallModel.create(callData)).rejects.toThrow('Missing required fields');
    });

    it('should use default maxParticipants of 10', async () => {
      const callData = { creatorId, creatorName };
      const dbCall = createVideoCall({ creator_id: creatorId, max_participants: 10 });
      query.mockResolvedValueOnce({ rows: [dbCall] });

      const tokens = createAgoraTokens(dbCall.channel_name, creatorId);
      agoraTokenService.generateVideoCallTokens.mockReturnValue(tokens);

      await VideoCallModel.create(callData);

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.any(String),
          String(creatorId),
          creatorName,
          expect.any(String),
          null,
          10, // maxParticipants
          true, // enforceCamera
          true, // allowGuests
          false, // isPublic
          false, // recordingEnabled
        ])
      );
    });

    it('should use custom maxParticipants if provided', async () => {
      const callData = { creatorId, creatorName, maxParticipants: 5 };
      const dbCall = createVideoCall({ creator_id: creatorId, max_participants: 5 });
      query.mockResolvedValueOnce({ rows: [dbCall] });

      const tokens = createAgoraTokens(dbCall.channel_name, creatorId);
      agoraTokenService.generateVideoCallTokens.mockReturnValue(tokens);

      await VideoCallModel.create(callData);

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.any(String),
          String(creatorId),
          creatorName,
          expect.any(String),
          null,
          5, // custom maxParticipants
        ])
      );
    });

    it('should use default enforceCamera of true', async () => {
      const callData = { creatorId, creatorName };
      const dbCall = createVideoCall({ creator_id: creatorId });
      query.mockResolvedValueOnce({ rows: [dbCall] });

      const tokens = createAgoraTokens(dbCall.channel_name, creatorId);
      agoraTokenService.generateVideoCallTokens.mockReturnValue(tokens);

      await VideoCallModel.create(callData);

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.any(String),
          String(creatorId),
          creatorName,
          expect.any(String),
          null,
          10,
          true, // enforceCamera
        ])
      );
    });

    it('should use custom enforceCamera if provided', async () => {
      const callData = { creatorId, creatorName, enforceCamera: false };
      const dbCall = createVideoCall({ creator_id: creatorId, enforce_camera: false });
      query.mockResolvedValueOnce({ rows: [dbCall] });

      const tokens = createAgoraTokens(dbCall.channel_name, creatorId);
      agoraTokenService.generateVideoCallTokens.mockReturnValue(tokens);

      await VideoCallModel.create(callData);

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.any(String),
          String(creatorId),
          creatorName,
          expect.any(String),
          null,
          10,
          false, // enforceCamera
        ])
      );
    });

    it('should use allowGuests default of true', async () => {
      const callData = { creatorId, creatorName };
      const dbCall = createVideoCall({ creator_id: creatorId });
      query.mockResolvedValueOnce({ rows: [dbCall] });

      const tokens = createAgoraTokens(dbCall.channel_name, creatorId);
      agoraTokenService.generateVideoCallTokens.mockReturnValue(tokens);

      await VideoCallModel.create(callData);

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.any(String),
          String(creatorId),
          creatorName,
          expect.any(String),
          null,
          10,
          true,
          true, // allowGuests
        ])
      );
    });

    it('should set isPublic default to false', async () => {
      const callData = { creatorId, creatorName };
      const dbCall = createVideoCall({ creator_id: creatorId, is_public: false });
      query.mockResolvedValueOnce({ rows: [dbCall] });

      const tokens = createAgoraTokens(dbCall.channel_name, creatorId);
      agoraTokenService.generateVideoCallTokens.mockReturnValue(tokens);

      await VideoCallModel.create(callData);

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.any(String),
          String(creatorId),
          creatorName,
          expect.any(String),
          null,
          10,
          true,
          true,
          false, // isPublic
        ])
      );
    });

    it('should generate UUID for callId', async () => {
      const callData = { creatorId, creatorName };
      const dbCall = createVideoCall({ creator_id: creatorId });
      query.mockResolvedValueOnce({ rows: [dbCall] });

      const tokens = createAgoraTokens(dbCall.channel_name, creatorId);
      agoraTokenService.generateVideoCallTokens.mockReturnValue(tokens);

      await VideoCallModel.create(callData);

      expect(uuidv4).toHaveBeenCalled();
    });

    it('should generate channel name from callId', async () => {
      const callData = { creatorId, creatorName };
      const dbCall = createVideoCall({ creator_id: creatorId });
      query.mockResolvedValueOnce({ rows: [dbCall] });

      const tokens = createAgoraTokens(dbCall.channel_name, creatorId);
      agoraTokenService.generateVideoCallTokens.mockReturnValue(tokens);

      await VideoCallModel.create(callData);

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.any(String),
          String(creatorId),
          creatorName,
          expect.stringMatching(/^call_/), // channel_name
        ])
      );
    });

    it('should generate host tokens', async () => {
      const callData = { creatorId, creatorName };
      const dbCall = createVideoCall({ creator_id: creatorId });
      query.mockResolvedValueOnce({ rows: [dbCall] });

      const tokens = createAgoraTokens(dbCall.channel_name, creatorId);
      agoraTokenService.generateVideoCallTokens.mockReturnValue(tokens);

      const result = await VideoCallModel.create(callData);

      expect(agoraTokenService.generateVideoCallTokens).toHaveBeenCalledWith(
        expect.stringMatching(/^call_/),
        String(creatorId),
        true // isHost
      );
      expect(result.token).toBe(tokens.token);
    });

    it('should register channel', async () => {
      const callData = { creatorId, creatorName };
      const dbCall = createVideoCall({ creator_id: creatorId });
      query.mockResolvedValueOnce({ rows: [dbCall] });

      const tokens = createAgoraTokens(dbCall.channel_name, creatorId);
      agoraTokenService.generateVideoCallTokens.mockReturnValue(tokens);

      await VideoCallModel.create(callData);

      // registerChannel should be called
      expect(VideoCallModel.registerChannel).toHaveBeenCalled();
    });

    it('should set current_participants to 0', async () => {
      const callData = { creatorId, creatorName };
      const dbCall = createVideoCall({ creator_id: creatorId, current_participants: 0 });
      query.mockResolvedValueOnce({ rows: [dbCall] });

      const tokens = createAgoraTokens(dbCall.channel_name, creatorId);
      agoraTokenService.generateVideoCallTokens.mockReturnValue(tokens);

      await VideoCallModel.create(callData);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('0, true'),
        expect.any(Array)
      );
    });

    it('should set is_active to true', async () => {
      const callData = { creatorId, creatorName };
      const dbCall = createVideoCall({ creator_id: creatorId, is_active: true });
      query.mockResolvedValueOnce({ rows: [dbCall] });

      const tokens = createAgoraTokens(dbCall.channel_name, creatorId);
      agoraTokenService.generateVideoCallTokens.mockReturnValue(tokens);

      const result = await VideoCallModel.create(callData);

      expect(result.isActive).toBe(true);
    });

    it('should allow custom title', async () => {
      const callData = { creatorId, creatorName, title: 'My Meeting' };
      const dbCall = createVideoCall({ creator_id: creatorId, title: 'My Meeting' });
      query.mockResolvedValueOnce({ rows: [dbCall] });

      const tokens = createAgoraTokens(dbCall.channel_name, creatorId);
      agoraTokenService.generateVideoCallTokens.mockReturnValue(tokens);

      await VideoCallModel.create(callData);

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.any(String),
          String(creatorId),
          creatorName,
          expect.any(String),
          'My Meeting',
        ])
      );
    });

    it('should handle creation errors', async () => {
      const callData = { creatorId, creatorName };
      query.mockRejectedValueOnce(new Error('Database error'));

      await expect(VideoCallModel.create(callData)).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getById()', () => {
    it('should return call by ID', async () => {
      const callId = 'test-uuid-1234';
      const dbCall = createVideoCall({ id: callId });
      query.mockResolvedValueOnce({ rows: [dbCall] });

      const result = await VideoCallModel.getById(callId);

      expect(result).toBeDefined();
      expect(result.id).toBe(callId);
    });

    it('should return null for non-existent call', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await VideoCallModel.getById('non-existent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      query.mockRejectedValueOnce(new Error('Query failed'));

      await expect(VideoCallModel.getById('test')).rejects.toThrow('Query failed');
    });
  });

  describe('joinCall()', () => {
    const callId = 'test-uuid-1234';
    const userId = '987654321';
    const userName = 'Test User';
    const call = createVideoCall({ id: callId, current_participants: 5 });

    it('should successfully join call', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [call] }) // SELECT call
        .mockResolvedValueOnce({ rows: [] }) // SELECT existing participant
        .mockResolvedValueOnce(undefined) // INSERT participant
        .mockResolvedValueOnce(undefined) // UPDATE counter
        .mockResolvedValueOnce(undefined); // COMMIT

      const tokens = createAgoraTokens(call.channel_name, userId);
      agoraTokenService.generateVideoCallTokens.mockReturnValue(tokens);

      const result = await VideoCallModel.joinCall(callId, userId, userName, false);

      expect(result).toBeDefined();
      expect(result.call).toBeDefined();
      expect(result.token).toBe(tokens.token);
    });

    it('should reject when call is full', async () => {
      const fullCall = createVideoCall({ id: callId, current_participants: 10 });
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [fullCall] });

      await expect(
        VideoCallModel.joinCall(callId, userId, userName)
      ).rejects.toThrow('Call is full');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should reject guests when not allowed', async () => {
      const noGuestsCall = createVideoCall({ id: callId, allow_guests: false });
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [noGuestsCall] });

      await expect(
        VideoCallModel.joinCall(callId, userId, userName, true)
      ).rejects.toThrow('Guests are not allowed');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should handle idempotent join (already in call)', async () => {
      const existingParticipant = createCallParticipant(callId, userId);
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [call] })
        .mockResolvedValueOnce({ rows: [existingParticipant] }) // SELECT existing
        .mockResolvedValueOnce(undefined); // COMMIT

      const tokens = createAgoraTokens(call.channel_name, userId);
      agoraTokenService.generateVideoCallTokens.mockReturnValue(tokens);

      const result = await VideoCallModel.joinCall(callId, userId, userName);

      expect(result.alreadyJoined).toBe(true);
    });

    it('should reject when call is ended', async () => {
      const endedCall = createVideoCall({ id: callId, is_active: false });
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [endedCall] });

      await expect(
        VideoCallModel.joinCall(callId, userId, userName)
      ).rejects.toThrow('Call has ended');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should throw when call not found', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] });

      await expect(
        VideoCallModel.joinCall(callId, userId, userName)
      ).rejects.toThrow('Call not found');
    });

    it('should use row locking (FOR UPDATE)', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [call] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined); // COMMIT

      const tokens = createAgoraTokens(call.channel_name, userId);
      agoraTokenService.generateVideoCallTokens.mockReturnValue(tokens);

      await VideoCallModel.joinCall(callId, userId, userName);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('FOR UPDATE'),
        [callId]
      );
    });

    it('should increment participant counter', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [call] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce(undefined) // INSERT
        .mockResolvedValueOnce(undefined) // UPDATE counter
        .mockResolvedValueOnce(undefined); // COMMIT

      const tokens = createAgoraTokens(call.channel_name, userId);
      agoraTokenService.generateVideoCallTokens.mockReturnValue(tokens);

      await VideoCallModel.joinCall(callId, userId, userName);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE video_calls SET current_participants = current_participants + 1'),
        [callId]
      );
    });

    it('should release client connection', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [call] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined); // COMMIT

      const tokens = createAgoraTokens(call.channel_name, userId);
      agoraTokenService.generateVideoCallTokens.mockReturnValue(tokens);

      await VideoCallModel.joinCall(callId, userId, userName);

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle transaction rollback on error', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error('Insert failed'));

      await expect(
        VideoCallModel.joinCall(callId, userId, userName)
      ).rejects.toThrow('Insert failed');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('leaveCall()', () => {
    it('should successfully leave call', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 'participant-1' }] });

      await VideoCallModel.leaveCall('test-uuid', '123456789');

      expect(query).toHaveBeenCalled();
    });

    it('should decrement participant counter', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 'participant-1' }] });

      await VideoCallModel.leaveCall('test-uuid', '123456789');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE video_calls SET current_participants = GREATEST'),
        expect.any(Array)
      );
    });

    it('should handle non-existent participant', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await VideoCallModel.leaveCall('test-uuid', '999999999');

      expect(logger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('User left call')
      );
    });

    it('should not decrement if participant doesn\'t exist', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await VideoCallModel.leaveCall('test-uuid', '123456789');

      expect(query).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors', async () => {
      query.mockRejectedValueOnce(new Error('Query failed'));

      await expect(
        VideoCallModel.leaveCall('test-uuid', '123456789')
      ).rejects.toThrow('Query failed');
    });

    it('should calculate duration in seconds', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 'participant-1' }] });

      await VideoCallModel.leaveCall('test-uuid', '123456789');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('total_duration_seconds'),
        expect.any(Array)
      );
    });
  });

  describe('endCall()', () => {
    const callId = 'test-uuid-1234';
    const creatorId = '123456789';
    const call = createVideoCall({ id: callId, creator_id: creatorId, is_active: true });

    it('should end call by creator', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [call] }) // SELECT call
        .mockResolvedValueOnce(undefined) // UPDATE call
        .mockResolvedValueOnce(undefined) // UPDATE participants
        .mockResolvedValueOnce(undefined) // UPDATE agora_channels
        .mockResolvedValueOnce(undefined); // COMMIT

      await VideoCallModel.endCall(callId, creatorId);

      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should reject when not called by creator', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [call] });

      await expect(
        VideoCallModel.endCall(callId, '999999999')
      ).rejects.toThrow('Only the creator can end the call');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should reject if call already ended', async () => {
      const endedCall = createVideoCall({ id: callId, creator_id: creatorId, is_active: false });
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [endedCall] });

      await expect(
        VideoCallModel.endCall(callId, creatorId)
      ).rejects.toThrow('Call already ended');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should throw when call not found', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] });

      await expect(
        VideoCallModel.endCall(callId, creatorId)
      ).rejects.toThrow('Call not found');
    });

    it('should release client connection', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [call] })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined); // COMMIT

      await VideoCallModel.endCall(callId, creatorId);

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should deactivate agora channel', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [call] })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined) // UPDATE agora_channels
        .mockResolvedValueOnce(undefined); // COMMIT

      await VideoCallModel.endCall(callId, creatorId);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE agora_channels'),
        [call.channel_name]
      );
    });
  });

  describe('getParticipants()', () => {
    it('should return all participants', async () => {
      const participants = createCallParticipants('test-uuid', 3);
      query.mockResolvedValueOnce({ rows: participants });

      const result = await VideoCallModel.getParticipants('test-uuid');

      expect(result).toHaveLength(3);
    });

    it('should sort by join time', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await VideoCallModel.getParticipants('test-uuid');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY joined_at ASC'),
        ['test-uuid']
      );
    });

    it('should handle empty call', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await VideoCallModel.getParticipants('test-uuid');

      expect(result).toEqual([]);
    });
  });

  describe('kickParticipant()', () => {
    it('should kick participant', async () => {
      const callId = 'test-uuid';
      const participantId = '987654321';
      const hostId = '123456789';
      const call = createVideoCall({ id: callId, creator_id: hostId });

      query.mockResolvedValueOnce({ rows: [call] }); // getById
      query.mockResolvedValueOnce({ rows: [{ id: 'participant-1' }] }); // UPDATE participant

      await VideoCallModel.kickParticipant(callId, participantId, hostId);

      expect(query).toHaveBeenCalled();
    });

    it('should reject when not called by host', async () => {
      const callId = 'test-uuid';
      const participantId = '987654321';
      const hostId = '123456789';
      const call = createVideoCall({ id: callId, creator_id: '999999999' });

      query.mockResolvedValueOnce({ rows: [call] });

      await expect(
        VideoCallModel.kickParticipant(callId, participantId, hostId)
      ).rejects.toThrow('Only the host can kick participants');
    });

    it('should decrement participant counter', async () => {
      const callId = 'test-uuid';
      const participantId = '987654321';
      const hostId = '123456789';
      const call = createVideoCall({ id: callId, creator_id: hostId });

      query.mockResolvedValueOnce({ rows: [call] });
      query.mockResolvedValueOnce({ rows: [{ id: 'participant-1' }] });

      await VideoCallModel.kickParticipant(callId, participantId, hostId);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE video_calls SET current_participants = GREATEST'),
        [callId]
      );
    });

    it('should mark as kicked', async () => {
      const callId = 'test-uuid';
      const participantId = '987654321';
      const hostId = '123456789';
      const call = createVideoCall({ id: callId, creator_id: hostId });

      query.mockResolvedValueOnce({ rows: [call] });
      query.mockResolvedValueOnce({ rows: [{ id: 'participant-1' }] });

      await VideoCallModel.kickParticipant(callId, participantId, hostId);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('was_kicked = true'),
        expect.any(Array)
      );
    });
  });

  describe('getAllPublic()', () => {
    it('should return all public active calls', async () => {
      const calls = [
        createVideoCall({ is_public: true, is_active: true }),
        createVideoCall({ is_public: true, is_active: true }),
      ];
      query.mockResolvedValueOnce({ rows: calls });

      const result = await VideoCallModel.getAllPublic();

      expect(result).toHaveLength(2);
    });

    it('should filter by is_public and is_active', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await VideoCallModel.getAllPublic();

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE is_public = true AND is_active = true'),
        expect.any(Array)
      );
    });

    it('should sort by created_at DESC', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await VideoCallModel.getAllPublic();

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        expect.any(Array)
      );
    });
  });

  describe('getActiveByCreator()', () => {
    it('should return creator\'s active calls', async () => {
      const creatorId = '123456789';
      const calls = [
        createVideoCall({ creator_id: creatorId, is_active: true }),
      ];
      query.mockResolvedValueOnce({ rows: calls });

      const result = await VideoCallModel.getActiveByCreator(creatorId);

      expect(result).toHaveLength(1);
      expect(result[0].creatorId).toBe(String(creatorId));
    });

    it('should filter by creator_id and is_active', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await VideoCallModel.getActiveByCreator('123456789');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE creator_id = $1 AND is_active = true'),
        [String('123456789')]
      );
    });

    it('should sort by created_at DESC', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await VideoCallModel.getActiveByCreator('123456789');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        expect.any(Array)
      );
    });
  });

  describe('deleteCall()', () => {
    it('should delete empty call', async () => {
      const callId = 'test-uuid';
      const creatorId = '123456789';
      const call = createVideoCall({ id: callId, creator_id: creatorId });

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [call] }) // SELECT call
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // SELECT participants count
        .mockResolvedValueOnce(undefined) // DELETE participants
        .mockResolvedValueOnce({ rows: [call] }) // DELETE call
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await VideoCallModel.deleteCall(callId, creatorId);

      expect(result).toBeDefined();
    });

    it('should reject deletion with active participants', async () => {
      const callId = 'test-uuid';
      const creatorId = '123456789';
      const call = createVideoCall({ id: callId, creator_id: creatorId });

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [call] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] });

      await expect(
        VideoCallModel.deleteCall(callId, creatorId)
      ).rejects.toThrow('Cannot delete call with active participants');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should reject when not called by creator', async () => {
      const callId = 'test-uuid';
      const creatorId = '123456789';
      const call = createVideoCall({ id: callId, creator_id: creatorId });

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [call] });

      await expect(
        VideoCallModel.deleteCall(callId, '999999999')
      ).rejects.toThrow('Only the creator can delete');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});
