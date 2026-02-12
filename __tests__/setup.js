/**
 * Jest Setup File for Hangouts Tests
 * Configures database mocks, transaction handling, and shared utilities
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 'test_bot_token_123';
process.env.AGORA_APP_ID = 'test_agora_app_id';
process.env.JAAS_APP_ID = 'test_jaas_app_id';
process.env.POSTGRES_HOST = 'localhost';
process.env.POSTGRES_PORT = '5432';
process.env.POSTGRES_DATABASE = 'pnptvbot_test';
process.env.POSTGRES_USER = 'test';
process.env.POSTGRES_PASSWORD = 'test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// Suppress logger in tests
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock PostgreSQL pool
let transactionStack = [];
let mockQueryResults = {};
let mockQueryCalls = [];

const mockClient = {
  query: jest.fn(async (sql, params) => {
    mockQueryCalls.push({ sql, params });

    // Handle transactions
    if (sql.toUpperCase() === 'BEGIN') {
      transactionStack.push([]);
      return { rows: [] };
    }
    if (sql.toUpperCase() === 'COMMIT') {
      transactionStack.pop();
      return { rows: [] };
    }
    if (sql.toUpperCase() === 'ROLLBACK') {
      transactionStack.pop();
      return { rows: [] };
    }

    // Return mock results
    const key = sql.substring(0, 50);
    return mockQueryResults[key] || { rows: [] };
  }),
  release: jest.fn(),
};

const mockPool = {
  connect: jest.fn(async () => mockClient),
  query: jest.fn(async (sql, params) => {
    mockQueryCalls.push({ sql, params });
    const key = sql.substring(0, 50);
    return mockQueryResults[key] || { rows: [] };
  }),
  end: jest.fn(),
};

jest.mock('../src/config/postgres', () => ({
  getPool: () => mockPool,
  getClient: () => mockClient,
  query: mockPool.query,
  testUtils: {
    setMockResults: (key, results) => {
      mockQueryResults[key] = { rows: results };
    },
    getMockCalls: () => mockQueryCalls,
    clearMockCalls: () => {
      mockQueryCalls = [];
    },
    clearMockResults: () => {
      mockQueryResults = {};
    },
  },
}));

// Mock Redis
jest.mock('../src/config/redis', () => ({
  getRedis: () => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    publish: jest.fn(),
    subscribe: jest.fn(),
  }),
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

// Mock Agora token service
jest.mock('../src/services/agora/agoraTokenService', () => ({
  generateVideoCallTokens: jest.fn((channelName, uid, isHost) => ({
    token: `mock_token_${channelName}_${uid}`,
    uid: String(uid),
  })),
  generateMainRoomTokens: jest.fn((channelName, uid, isPublisher) => ({
    token: `mock_room_token_${channelName}_${uid}`,
    uid: String(uid),
    role: isPublisher ? 'publisher' : 'subscriber',
  })),
}));

// Global test utilities
global.testUtils = {
  mockQueryResults,
  mockQueryCalls,
  transactionStack,
  mockClient,
  mockPool,

  // Database helpers
  setMockResult: (sql, rows) => {
    const key = sql.substring(0, 50);
    mockQueryResults[key] = { rows };
  },

  getMockCalls: () => mockQueryCalls,
  clearMocks: () => {
    mockQueryCalls.length = 0;
    mockQueryResults = {};
    transactionStack = [];
    jest.clearAllMocks();
  },

  // Transaction helpers
  getTransactionDepth: () => transactionStack.length,
  expectTransaction: () => {
    expect(transactionStack.length).toBeGreaterThan(0);
  },

  // Common test data
  createTestUser: (overrides = {}) => ({
    id: '123456789',
    pnp_user_id: 'uuid-user-1',
    username: 'testuser',
    first_name: 'Test',
    is_active: true,
    telegram_chat_id: 123456789,
    prime_member: true,
    created_at: new Date(),
    ...overrides,
  }),

  createTestCall: (overrides = {}) => ({
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
    ...overrides,
  }),

  createTestRoom: (overrides = {}) => ({
    id: 1,
    name: 'Main Room 1',
    description: 'Community hangout',
    channel_name: 'main_room_1',
    bot_user_id: null,
    max_participants: 50,
    current_participants: 15,
    enforce_camera: false,
    auto_approve_publisher: true,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }),

  createTestParticipant: (overrides = {}) => ({
    id: 'participant-uuid',
    user_id: '123456789',
    user_name: 'Test User',
    is_publisher: false,
    is_moderator: false,
    joined_at: new Date(),
    left_at: null,
    total_duration_seconds: null,
    ...overrides,
  }),
};

// Suppress console output in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error visible for debugging
  error: console.error,
};

// Increase timeout for database tests
jest.setTimeout(10000);
