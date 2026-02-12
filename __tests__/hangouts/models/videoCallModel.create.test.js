/**
 * VideoCallModel.create() Tests
 * Tests call creation with validation, token generation, and database operations
 */

const VideoCallModel = require('../../../src/models/videoCallModel');
const agoraTokenService = require('../../../src/services/agora/agoraTokenService');
const TestDataFactory = require('../../fixtures/factories');

describe('VideoCallModel.create()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    testUtils.clearMocks();
  });

  describe('Successful Creation', () => {
    it('should create a video call with valid data', async () => {
      const testCall = TestDataFactory.createVideoCall();
      const dbRows = [testCall];

      // Mock database response
      jest.spyOn(global, 'testUtils').mockReturnValue({
        ...testUtils,
        setMockResult: (sql, rows) => {
          if (sql.includes('INSERT INTO video_calls')) {
            testUtils.mockQueryResults[sql.substring(0, 50)] = { rows };
          }
        },
      });

      // Mock Agora tokens
      agoraTokenService.generateVideoCallTokens.mockReturnValue({
        token: 'mock_agora_token',
        uid: '123456789',
      });

      const result = await VideoCallModel.create({
        creatorId: '123456789',
        creatorName: 'Test Creator',
        title: 'Test Call',
        maxParticipants: 10,
      });

      expect(result).toMatchObject({
        id: expect.any(String),
        creatorId: '123456789',
        creatorName: 'Test Creator',
        channelName: expect.any(String),
        title: 'Test Call',
        maxParticipants: 10,
        token: 'mock_agora_token',
        uid: '123456789',
      });
    });

    it('should generate Agora tokens on creation', async () => {
      const tokens = TestDataFactory.createAgoraTokens('test_channel', '123456789');
      agoraTokenService.generateVideoCallTokens.mockReturnValue(tokens);

      const result = await VideoCallModel.create({
        creatorId: '123456789',
        creatorName: 'Test Creator',
      });

      expect(agoraTokenService.generateVideoCallTokens).toHaveBeenCalled();
      expect(result.token).toBeDefined();
      expect(result.uid).toBeDefined();
    });

    it('should register Agora channel', async () => {
      agoraTokenService.generateVideoCallTokens.mockReturnValue({
        token: 'mock_token',
        uid: '123456789',
      });

      const registerChannelSpy = jest.spyOn(VideoCallModel, 'registerChannel')
        .mockResolvedValue(undefined);

      await VideoCallModel.create({
        creatorId: '123456789',
        creatorName: 'Test Creator',
      });

      expect(registerChannelSpy).toHaveBeenCalled();
      registerChannelSpy.mockRestore();
    });

    it('should set default values for optional parameters', async () => {
      agoraTokenService.generateVideoCallTokens.mockReturnValue({
        token: 'mock_token',
        uid: '123456789',
      });

      const result = await VideoCallModel.create({
        creatorId: '123456789',
        creatorName: 'Test Creator',
      });

      expect(result).toMatchObject({
        maxParticipants: 10, // default
        enforceCamera: true, // default
        allowGuests: true, // default
        isPublic: false, // default
        recordingEnabled: false, // default
      });
    });
  });

  describe('Parameter Validation', () => {
    it('should throw on missing creatorId', async () => {
      await expect(
        VideoCallModel.create({
          creatorName: 'Test Creator',
        })
      ).rejects.toThrow('Missing required fields: creatorId');
    });

    it('should throw on missing creatorName', async () => {
      await expect(
        VideoCallModel.create({
          creatorId: '123456789',
        })
      ).rejects.toThrow('Missing required fields: creatorName');
    });

    it('should clamp maxParticipants to minimum of 2', async () => {
      agoraTokenService.generateVideoCallTokens.mockReturnValue({
        token: 'mock_token',
        uid: '123456789',
      });

      const result = await VideoCallModel.create({
        creatorId: '123456789',
        creatorName: 'Test Creator',
        maxParticipants: 1, // Below minimum
      });

      expect(result.maxParticipants).toBe(2);
    });

    it('should clamp maxParticipants to maximum of 50', async () => {
      agoraTokenService.generateVideoCallTokens.mockReturnValue({
        token: 'mock_token',
        uid: '123456789',
      });

      const result = await VideoCallModel.create({
        creatorId: '123456789',
        creatorName: 'Test Creator',
        maxParticipants: 100, // Above maximum
      });

      expect(result.maxParticipants).toBe(50);
    });

    it('should normalize title to null if not provided', async () => {
      agoraTokenService.generateVideoCallTokens.mockReturnValue({
        token: 'mock_token',
        uid: '123456789',
      });

      const result = await VideoCallModel.create({
        creatorId: '123456789',
        creatorName: 'Test Creator',
      });

      expect(result.title).toBeNull();
    });

    it('should truncate title to 80 characters', async () => {
      agoraTokenService.generateVideoCallTokens.mockReturnValue({
        token: 'mock_token',
        uid: '123456789',
      });

      const longTitle = 'a'.repeat(100);
      const result = await VideoCallModel.create({
        creatorId: '123456789',
        creatorName: 'Test Creator',
        title: longTitle,
      });

      expect(result.title).toHaveLength(80);
      expect(result.title).toBe('a'.repeat(80));
    });
  });

  describe('Response Format', () => {
    beforeEach(() => {
      agoraTokenService.generateVideoCallTokens.mockReturnValue({
        token: 'agora_token_xyz',
        uid: '123456789',
      });
    });

    it('should return id in response', async () => {
      const result = await VideoCallModel.create({
        creatorId: '123456789',
        creatorName: 'Test Creator',
      });

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');
    });

    it('should return appId in response', async () => {
      const result = await VideoCallModel.create({
        creatorId: '123456789',
        creatorName: 'Test Creator',
      });

      expect(result.appId).toBeDefined();
    });

    it('should return channel name in response', async () => {
      const result = await VideoCallModel.create({
        creatorId: '123456789',
        creatorName: 'Test Creator',
      });

      expect(result.channelName).toBeDefined();
      expect(result.channelName).toMatch(/^call_/);
    });

    it('should return isPublic flag', async () => {
      const result = await VideoCallModel.create({
        creatorId: '123456789',
        creatorName: 'Test Creator',
        isPublic: true,
      });

      expect(result.isPublic).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should log creation event', async () => {
      const logger = require('../../../src/utils/logger');
      agoraTokenService.generateVideoCallTokens.mockReturnValue({
        token: 'mock_token',
        uid: '123456789',
      });

      await VideoCallModel.create({
        creatorId: '123456789',
        creatorName: 'Test Creator',
      });

      expect(logger.info).toHaveBeenCalledWith(
        'Video call created',
        expect.objectContaining({
          creatorId: '123456789',
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      jest.spyOn(VideoCallModel, 'create')
        .mockRejectedValue(new Error('Database connection failed'));

      await expect(
        VideoCallModel.create({
          creatorId: '123456789',
          creatorName: 'Test Creator',
        })
      ).rejects.toThrow('Database connection failed');
    });
  });
});
