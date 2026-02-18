/**
 * Hangouts Test Fixtures & Factories
 * Generates consistent test data for unit and integration tests
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Create test user data with subscription status
 * @param {Object} overrides - Override default values
 * @returns {Object} User data
 */
function createUser(overrides = {}) {
  const userId = overrides.id || String(Math.floor(Math.random() * 1000000000));
  return {
    id: userId,
    pnp_user_id: overrides.pnp_user_id || uuidv4(),
    username: overrides.username || `user_${userId.substring(0, 5)}`,
    first_name: overrides.first_name || 'Test',
    last_name: overrides.last_name || 'User',
    telegram_chat_id: overrides.telegram_chat_id || parseInt(userId),
    is_active: overrides.is_active !== undefined ? overrides.is_active : true,
    subscription_status: overrides.subscription_status || 'active',
    plan_id: overrides.plan_id || 'basic',
    plan_expiry: overrides.plan_expiry || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    prime_member: overrides.prime_member !== undefined ? overrides.prime_member : false,
    premium_member: overrides.premium_member !== undefined ? overrides.premium_member : false,
    location_lat: overrides.location_lat || 40.7128,
    location_lng: overrides.location_lng || -74.0060,
    created_at: overrides.created_at || new Date(),
    updated_at: overrides.updated_at || new Date(),
  };
}

/**
 * Create main room data
 * @param {number} id - Room ID (1, 2, or 3)
 * @param {Object} overrides - Override default values
 * @returns {Object} Main room data
 */
function createMainRoom(id = 1, overrides = {}) {
  const roomNames = {
    1: 'General',
    2: 'Music',
    3: 'Gaming',
  };

  const now = new Date();
  return {
    id: overrides.id || id,
    name: overrides.name || roomNames[id] || `Room ${id}`,
    description: overrides.description || `Main hangout room ${id}`,
    channel_name: overrides.channel_name || `main_room_${id}`,
    bot_user_id: overrides.bot_user_id || '123456789',
    max_participants: overrides.max_participants || 50,
    current_participants: overrides.current_participants || 0,
    is_active: overrides.is_active !== undefined ? overrides.is_active : true,
    enforce_camera: overrides.enforce_camera !== undefined ? overrides.enforce_camera : false,
    auto_approve_publisher: overrides.auto_approve_publisher !== undefined ? overrides.auto_approve_publisher : true,
    created_at: overrides.created_at || now,
    updated_at: overrides.updated_at || now,
  };
}

/**
 * Create room participant data
 * @param {number} roomId - Room ID
 * @param {string} userId - User ID
 * @param {Object} overrides - Override default values
 * @returns {Object} Room participant data
 */
function createRoomParticipant(roomId = 1, userId = '123456789', overrides = {}) {
  const now = new Date();
  return {
    id: overrides.id || uuidv4(),
    room_id: overrides.room_id || roomId,
    user_id: overrides.user_id || String(userId),
    user_name: overrides.user_name || `User ${userId.substring(0, 5)}`,
    is_publisher: overrides.is_publisher !== undefined ? overrides.is_publisher : false,
    is_moderator: overrides.is_moderator !== undefined ? overrides.is_moderator : false,
    joined_at: overrides.joined_at || now,
    left_at: overrides.left_at || null,
    total_duration_seconds: overrides.total_duration_seconds || 0,
    created_at: overrides.created_at || now,
    updated_at: overrides.updated_at || now,
  };
}

/**
 * Create video call data
 * @param {Object} overrides - Override default values
 * @returns {Object} Video call data
 */
function createVideoCall(overrides = {}) {
  const callId = overrides.id || uuidv4();
  const creatorId = overrides.creator_id || '123456789';
  const now = new Date();

  return {
    id: callId,
    creator_id: String(creatorId),
    creator_name: overrides.creator_name || 'Test User',
    channel_name: overrides.channel_name || `call_${callId.replace(/-/g, '').substring(0, 16)}`,
    title: overrides.title || null,
    max_participants: overrides.max_participants || 10,
    current_participants: overrides.current_participants || 0,
    is_active: overrides.is_active !== undefined ? overrides.is_active : true,
    enforce_camera: overrides.enforce_camera !== undefined ? overrides.enforce_camera : true,
    allow_guests: overrides.allow_guests !== undefined ? overrides.allow_guests : true,
    is_public: overrides.is_public !== undefined ? overrides.is_public : false,
    recording_enabled: overrides.recording_enabled !== undefined ? overrides.recording_enabled : false,
    created_at: overrides.created_at || now,
    ended_at: overrides.ended_at || null,
    duration_seconds: overrides.duration_seconds || 0,
  };
}

/**
 * Create call participant data
 * @param {string} callId - Call ID
 * @param {string} userId - User ID
 * @param {Object} overrides - Override default values
 * @returns {Object} Call participant data
 */
function createCallParticipant(callId = uuidv4(), userId = '123456789', overrides = {}) {
  const now = new Date();
  return {
    id: overrides.id || uuidv4(),
    call_id: overrides.call_id || callId,
    user_id: overrides.user_id || String(userId),
    user_name: overrides.user_name || `User ${userId.substring(0, 5)}`,
    is_host: overrides.is_host !== undefined ? overrides.is_host : false,
    is_guest: overrides.is_guest !== undefined ? overrides.is_guest : false,
    joined_at: overrides.joined_at || now,
    left_at: overrides.left_at || null,
    was_kicked: overrides.was_kicked !== undefined ? overrides.was_kicked : false,
    total_duration_seconds: overrides.total_duration_seconds || 0,
    created_at: overrides.created_at || now,
    updated_at: overrides.updated_at || now,
  };
}

/**
 * Create Agora token data
 * @param {string} channelName - Agora channel name
 * @param {string|number} userId - Agora user ID (uid)
 * @returns {Object} Token data
 */
function createAgoraTokens(channelName = 'test_channel', userId = 123456789) {
  return {
    token: 'test_agora_token_' + Math.random().toString(36).substring(7),
    uid: String(userId),
    appId: 'test_agora_app_id',
    channel: channelName,
    expiresIn: 3600,
  };
}

/**
 * Create room event data
 * @param {number} roomId - Room ID
 * @param {string} eventType - Event type (e.g., USER_JOINED_VIEWER)
 * @param {Object} overrides - Override default values
 * @returns {Object} Room event data
 */
function createRoomEvent(roomId = 1, eventType = 'USER_JOINED_VIEWER', overrides = {}) {
  const now = new Date();
  return {
    id: overrides.id || uuidv4(),
    room_id: overrides.room_id || roomId,
    event_type: overrides.event_type || eventType,
    initiator_user_id: overrides.initiator_user_id || null,
    target_user_id: overrides.target_user_id || null,
    metadata: overrides.metadata || JSON.stringify({}),
    created_at: overrides.created_at || now,
  };
}

/**
 * Create call event data
 * @param {string} callId - Call ID
 * @param {string} eventType - Event type
 * @param {Object} overrides - Override default values
 * @returns {Object} Call event data
 */
function createCallEvent(callId = uuidv4(), eventType = 'CALL_CREATED', overrides = {}) {
  const now = new Date();
  return {
    id: overrides.id || uuidv4(),
    call_id: overrides.call_id || callId,
    event_type: overrides.event_type || eventType,
    user_id: overrides.user_id || null,
    metadata: overrides.metadata || JSON.stringify({}),
    created_at: overrides.created_at || now,
  };
}

/**
 * Create Telegram WebApp initData (mocked)
 * @param {string} userId - Telegram user ID
 * @param {Object} overrides - Override default values
 * @returns {string} Encoded initData
 */
function createTelegramInitData(userId = '123456789', overrides = {}) {
  const user = {
    id: parseInt(userId),
    is_bot: false,
    first_name: overrides.first_name || 'Test',
    username: overrides.username || 'testuser',
    language_code: 'en',
  };

  const authDate = Math.floor(Date.now() / 1000);
  const queryId = overrides.queryId || 'test_query_' + Math.random().toString(36).substring(7);

  const data = new URLSearchParams({
    user: JSON.stringify(user),
    auth_date: String(authDate),
    query_id: queryId,
  });

  return data.toString();
}

/**
 * Batch create multiple room participants
 * @param {number} roomId - Room ID
 * @param {number} count - Number of participants
 * @param {Object} overrides - Override default values
 * @returns {Array} Array of participant data
 */
function createRoomParticipants(roomId = 1, count = 5, overrides = {}) {
  return Array.from({ length: count }, (_, i) => {
    const userId = String(1000000000 + i);
    return createRoomParticipant(roomId, userId, {
      ...overrides,
      is_publisher: overrides.is_publisher || (i === 0), // First is publisher by default
    });
  });
}

/**
 * Batch create multiple call participants
 * @param {string} callId - Call ID
 * @param {number} count - Number of participants
 * @param {Object} overrides - Override default values
 * @returns {Array} Array of participant data
 */
function createCallParticipants(callId = uuidv4(), count = 5, overrides = {}) {
  return Array.from({ length: count }, (_, i) => {
    const userId = String(1000000000 + i);
    return createCallParticipant(callId, userId, {
      ...overrides,
      is_host: overrides.is_host || (i === 0), // First is host by default
    });
  });
}

module.exports = {
  createUser,
  createMainRoom,
  createRoomParticipant,
  createRoomParticipants,
  createVideoCall,
  createCallParticipant,
  createCallParticipants,
  createAgoraTokens,
  createRoomEvent,
  createCallEvent,
  createTelegramInitData,
};
