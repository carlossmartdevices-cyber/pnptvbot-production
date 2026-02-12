/**
 * Test Data Factories
 * Generates consistent test data for unit and integration tests
 */

const { v4: uuidv4 } = require('uuid');

class TestDataFactory {
  /**
   * Create a test user
   */
  static createUser(overrides = {}) {
    return {
      id: String(Math.floor(Math.random() * 1000000)),
      pnp_user_id: uuidv4(),
      username: `testuser_${Date.now()}`,
      first_name: 'Test',
      last_name: 'User',
      is_active: true,
      telegram_chat_id: Math.floor(Math.random() * 1000000000),
      telegram_group_member: true,
      telegram_prime_member: true,
      prime_member: true,
      premium_member: false,
      created_at: new Date(),
      ...overrides,
    };
  }

  /**
   * Create a test video call
   */
  static createVideoCall(overrides = {}) {
    const callId = uuidv4();
    return {
      id: callId,
      creator_id: '123456789',
      creator_name: 'Test Creator',
      channel_name: `call_${callId.replace(/-/g, '').substring(0, 16)}`,
      title: `Test Call ${Date.now()}`,
      max_participants: 10,
      current_participants: 2,
      enforce_camera: false,
      allow_guests: true,
      is_public: true,
      recording_enabled: false,
      recording_url: null,
      is_active: true,
      status: 'active',
      created_at: new Date(),
      ended_at: null,
      duration_seconds: null,
      metadata: {},
      ...overrides,
    };
  }

  /**
   * Create a test main room
   */
  static createMainRoom(roomId = 1, overrides = {}) {
    return {
      id: roomId,
      name: `Main Room ${roomId}`,
      description: `Community hangout room ${roomId}`,
      channel_name: `main_room_${roomId}`,
      bot_user_id: null,
      max_participants: 50,
      current_participants: Math.floor(Math.random() * 50),
      enforce_camera: false,
      auto_approve_publisher: true,
      is_active: true,
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      updated_at: new Date(),
      ...overrides,
    };
  }

  /**
   * Create a test call participant
   */
  static createCallParticipant(callId, userId, overrides = {}) {
    const joinedAt = new Date(Date.now() - Math.random() * 3600000); // Random time in last hour
    return {
      id: uuidv4(),
      call_id: callId,
      user_id: String(userId),
      user_name: `User ${userId}`,
      is_host: userId === '123456789',
      is_guest: false,
      was_kicked: false,
      joined_at: joinedAt,
      left_at: null,
      total_duration_seconds: null,
      ip_address: '127.0.0.1',
      user_agent: 'Mozilla/5.0 (Test)',
      created_at: joinedAt,
      ...overrides,
    };
  }

  /**
   * Create a test room participant
   */
  static createRoomParticipant(roomId, userId, overrides = {}) {
    const joinedAt = new Date(Date.now() - Math.random() * 3600000);
    return {
      id: uuidv4(),
      room_id: roomId,
      user_id: String(userId),
      user_name: `User ${userId}`,
      is_publisher: Math.random() > 0.7, // 30% chance of being publisher
      is_moderator: false,
      joined_at: joinedAt,
      left_at: null,
      total_duration_seconds: null,
      ip_address: '127.0.0.1',
      user_agent: 'Mozilla/5.0 (Test)',
      created_at: joinedAt,
      ...overrides,
    };
  }

  /**
   * Create a test room event
   */
  static createRoomEvent(roomId, eventType, overrides = {}) {
    return {
      id: uuidv4(),
      room_id: roomId,
      event_type: eventType,
      initiator_user_id: '123456789',
      target_user_id: null,
      metadata: {},
      created_at: new Date(),
      ...overrides,
    };
  }

  /**
   * Create a test Agora channel
   */
  static createAgoraChannel(channelName, overrides = {}) {
    return {
      id: uuidv4(),
      channel_name: channelName,
      channel_type: 'call',
      feature_name: 'hangouts',
      created_by: uuidv4(),
      max_participants: 10,
      is_active: true,
      metadata: {},
      created_at: new Date(),
      deactivated_at: null,
      ...overrides,
    };
  }

  /**
   * Create mock Agora tokens
   */
  static createAgoraTokens(channelName, uid, isHost = false) {
    return {
      token: `rte_${Buffer.from(`${channelName}${uid}`).toString('base64')}_${Date.now()}`,
      uid: String(uid),
      appId: 'test_agora_app_id',
      channel: channelName,
      type: isHost ? 'host' : 'subscriber',
      expireTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    };
  }

  /**
   * Create Telegram init data for testing
   */
  static createTelegramInitData(userId = '123456789', username = 'testuser') {
    const crypto = require('crypto');
    const authDate = Math.floor(Date.now() / 1000);
    const user = JSON.stringify({
      id: parseInt(userId),
      first_name: 'Test',
      username: username,
      is_bot: false,
    });

    // Create proper Telegram signature
    const dataCheckString = `auth_date=${authDate}\nuser=${encodeURIComponent(user)}`;
    const secretKey = crypto.createHmac('sha256', 'WebAppData')
      .update(process.env.BOT_TOKEN || 'test_token')
      .digest();
    const hash = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return {
      auth_date: authDate,
      user: user,
      hash: hash,
      initData: `auth_date=${authDate}&user=${encodeURIComponent(user)}&hash=${hash}`,
    };
  }

  /**
   * Create batch of test data
   */
  static createBatch(count, factory) {
    return Array.from({ length: count }, (_, i) => factory(i));
  }

  /**
   * Create multiple users
   */
  static createUsers(count) {
    return this.createBatch(count, (i) => this.createUser({
      id: String(1000000 + i)
    }));
  }

  /**
   * Create multiple calls
   */
  static createVideoCalls(count) {
    return this.createBatch(count, () => this.createVideoCall());
  }

  /**
   * Create multiple participants in a call
   */
  static createCallParticipants(callId, count) {
    return this.createBatch(count, (i) =>
      this.createCallParticipant(callId, 1000000 + i, {
        is_host: i === 0,
      })
    );
  }

  /**
   * Create multiple participants in a room
   */
  static createRoomParticipants(roomId, count) {
    return this.createBatch(count, (i) =>
      this.createRoomParticipant(roomId, 1000000 + i)
    );
  }
}

module.exports = TestDataFactory;
