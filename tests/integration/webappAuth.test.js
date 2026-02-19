/**
 * Web App Authentication Integration Tests
 * Tests all auth methods: email/password, Telegram OAuth, X/Twitter OAuth
 */

jest.mock('../../src/utils/logger');
jest.mock('axios');
jest.mock('../../src/services/emailService');
jest.mock('nodemailer');

const axios = require('axios');
const { query } = require('../../src/config/postgres');
const emailService = require('../../src/services/emailService');
const logger = require('../../src/utils/logger');

// Mock database responses
jest.mock('../../src/config/postgres', () => ({
  query: jest.fn(),
}));

const webAppController = require('../../src/bot/api/controllers/webAppController');
const { generateJWT, verifyJWT } = require('../../src/bot/api/middleware/jwtAuth');

// ────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ────────────────────────────────────────────────────────────────────────────

const createMockReq = (overrides = {}) => ({
  body: {},
  query: {},
  session: {
    user: null,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
    save: jest.fn((cb) => cb()),
    destroy: jest.fn((cb) => cb()),
  },
  get: jest.fn((header) => {
    const headers = {
      host: 'localhost:3001',
      protocol: 'http',
    };
    return headers[header.toLowerCase()];
  }),
  protocol: 'http',
  ...overrides,
});

const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    redirectUrl: null,
  };
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((data) => {
    res.body = data;
    return res;
  });
  res.redirect = jest.fn((url) => {
    res.redirectUrl = url;
    return res;
  });
  res.clearCookie = jest.fn();
  return res;
};

const mockUserRow = {
  id: 'test-user-id-123',
  pnptv_id: 'pnptv-123',
  first_name: 'John',
  last_name: 'Doe',
  username: 'johndoe',
  email: 'john@example.com',
  telegram: null,
  twitter: null,
  photo_file_id: null,
  bio: null,
  language: 'en',
  subscription_status: 'free',
  accepted_terms: false,
  password_hash: null,
  role: 'user',
};

// ────────────────────────────────────────────────────────────────────────────
// Email Registration Tests
// ────────────────────────────────────────────────────────────────────────────

describe('Email Registration (/api/webapp/auth/register)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
    process.env.BOT_TOKEN = '8571930103:AAHIxAeI2CEqgF3arK4D4dZNHFYxgNa_nt0';
  });

  test('should register new user with valid email and password', async () => {
    const req = createMockReq({
      body: {
        email: 'newuser@example.com',
        password: 'securePassword123',
        firstName: 'Jane',
        lastName: 'Smith',
      },
    });
    const res = createMockRes();

    // Mock: no existing user
    query.mockResolvedValueOnce({ rows: [] });
    // Mock: insert new user
    query.mockResolvedValueOnce({
      rows: [
        {
          ...mockUserRow,
          id: 'new-user-id',
          pnptv_id: 'pnptv-new',
          email: 'newuser@example.com',
          first_name: 'Jane',
          last_name: 'Smith',
          username: 'jane_smith',
        },
      ],
    });

    await webAppController.emailRegister(req, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.status).not.toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalled();
    const response = res.json.mock.calls[0][0];
    expect(response.authenticated).toBe(true);
    expect(response.user.email).toBe('newuser@example.com');
  });

  test('should reject duplicate email registration', async () => {
    const req = createMockReq({
      body: {
        email: 'existing@example.com',
        password: 'securePassword123',
        firstName: 'John',
      },
    });
    const res = createMockRes();

    // Mock: user already exists
    query.mockResolvedValueOnce({ rows: [mockUserRow] });

    await webAppController.emailRegister(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('already exists'),
      })
    );
  });

  test('should reject short password', async () => {
    const req = createMockReq({
      body: {
        email: 'test@example.com',
        password: 'short',
        firstName: 'John',
      },
    });
    const res = createMockRes();

    await webAppController.emailRegister(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('at least 8 characters'),
      })
    );
  });

  test('should reject invalid email format', async () => {
    const req = createMockReq({
      body: {
        email: 'not-an-email',
        password: 'securePassword123',
        firstName: 'John',
      },
    });
    const res = createMockRes();

    await webAppController.emailRegister(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Invalid email'),
      })
    );
  });

  test('should reject missing required fields', async () => {
    const req = createMockReq({
      body: {
        email: 'test@example.com',
        // missing password and firstName
      },
    });
    const res = createMockRes();

    await webAppController.emailRegister(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('should normalize email to lowercase', async () => {
    const req = createMockReq({
      body: {
        email: 'TeSt@ExAmPlE.com',
        password: 'securePassword123',
        firstName: 'John',
      },
    });
    const res = createMockRes();

    query.mockResolvedValueOnce({ rows: [] });
    query.mockResolvedValueOnce({
      rows: [{ ...mockUserRow, email: 'test@example.com' }],
    });

    await webAppController.emailRegister(req, res);

    // First query call checks for duplicate with lowercase email
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id FROM users WHERE email'),
      ['test@example.com']
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Email Login Tests
// ────────────────────────────────────────────────────────────────────────────

describe('Email Login (/api/webapp/auth/login)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
  });

  test('should login user with correct password', async () => {
    const req = createMockReq({
      body: {
        email: 'john@example.com',
        password: 'correctPassword123',
        rememberMe: false,
      },
    });
    const res = createMockRes();

    // Create a password hash for testing (using the actual hash function)
    const crypto = require('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await new Promise((resolve, reject) => {
      crypto.scrypt('correctPassword123', salt, 64, (err, key) => {
        if (err) reject(err);
        else resolve(key.toString('hex'));
      });
    });
    const passwordHash = `${salt}:${hash}`;

    const userWithPassword = { ...mockUserRow, password_hash: passwordHash };
    query.mockResolvedValueOnce({ rows: [userWithPassword] });

    await webAppController.emailLogin(req, res);

    expect(req.session.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
    const response = res.json.mock.calls[0][0];
    expect(response.authenticated).toBe(true);
    expect(response.token).toBeDefined();
    expect(response.user.email).toBe('john@example.com');
  });

  test('should reject incorrect password', async () => {
    const req = createMockReq({
      body: {
        email: 'john@example.com',
        password: 'wrongPassword',
      },
    });
    const res = createMockRes();

    const crypto = require('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await new Promise((resolve, reject) => {
      crypto.scrypt('correctPassword123', salt, 64, (err, key) => {
        if (err) reject(err);
        else resolve(key.toString('hex'));
      });
    });
    const passwordHash = `${salt}:${hash}`;

    const userWithPassword = { ...mockUserRow, password_hash: passwordHash };
    query.mockResolvedValueOnce({ rows: [userWithPassword] });

    await webAppController.emailLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Incorrect password'),
      })
    );
  });

  test('should reject non-existent email', async () => {
    const req = createMockReq({
      body: {
        email: 'nonexistent@example.com',
        password: 'somePassword',
      },
    });
    const res = createMockRes();

    query.mockResolvedValueOnce({ rows: [] });

    await webAppController.emailLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('No account found'),
      })
    );
  });

  test('should reject user without password hash (OAuth-only account)', async () => {
    const req = createMockReq({
      body: {
        email: 'telegram-only@example.com',
        password: 'anyPassword',
      },
    });
    const res = createMockRes();

    const oauthUser = { ...mockUserRow, password_hash: null, email: 'telegram-only@example.com' };
    query.mockResolvedValueOnce({ rows: [oauthUser] });

    await webAppController.emailLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Telegram or X to sign in'),
      })
    );
  });

  test('should reject missing email or password', async () => {
    const req = createMockReq({
      body: {
        email: 'test@example.com',
        // missing password
      },
    });
    const res = createMockRes();

    await webAppController.emailLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('should include JWT token in login response', async () => {
    const req = createMockReq({
      body: {
        email: 'john@example.com',
        password: 'correctPassword123',
      },
    });
    const res = createMockRes();

    const crypto = require('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await new Promise((resolve, reject) => {
      crypto.scrypt('correctPassword123', salt, 64, (err, key) => {
        if (err) reject(err);
        else resolve(key.toString('hex'));
      });
    });
    const passwordHash = `${salt}:${hash}`;

    const userWithPassword = {
      ...mockUserRow,
      password_hash: passwordHash,
      role: 'admin',
    };
    query.mockResolvedValueOnce({ rows: [userWithPassword] });

    await webAppController.emailLogin(req, res);

    const response = res.json.mock.calls[0][0];
    expect(response.token).toBeDefined();

    // Verify JWT is valid
    const decoded = verifyJWT(response.token);
    expect(decoded).not.toBeNull();
    expect(decoded.role).toBe('admin');
  });

  test('should normalize email to lowercase on login', async () => {
    const req = createMockReq({
      body: {
        email: 'JoHn@ExAmPlE.cOm',
        password: 'somePassword',
      },
    });
    const res = createMockRes();

    query.mockResolvedValueOnce({ rows: [] });

    await webAppController.emailLogin(req, res);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id, pnptv_id'),
      expect.arrayContaining(['john@example.com'])
    );
  });

  test('should set remember-me cookie duration', async () => {
    const req = createMockReq({
      body: {
        email: 'john@example.com',
        password: 'correctPassword123',
        rememberMe: true,
      },
    });
    const res = createMockRes();

    const crypto = require('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await new Promise((resolve, reject) => {
      crypto.scrypt('correctPassword123', salt, 64, (err, key) => {
        if (err) reject(err);
        else resolve(key.toString('hex'));
      });
    });
    const passwordHash = `${salt}:${hash}`;

    const userWithPassword = { ...mockUserRow, password_hash: passwordHash };
    query.mockResolvedValueOnce({ rows: [userWithPassword] });

    await webAppController.emailLogin(req, res);

    // rememberMe should set longer cookie duration (30 days)
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(req.session.cookie.maxAge).toBe(thirtyDaysMs);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Auth Status Tests
// ────────────────────────────────────────────────────────────────────────────

describe('Auth Status (/api/webapp/auth/status)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return authenticated user data', () => {
    const req = createMockReq({
      session: {
        user: {
          id: 'test-id',
          pnptvId: 'pnptv-123',
          username: 'johndoe',
          firstName: 'John',
          lastName: 'Doe',
          photoUrl: 'https://example.com/photo.jpg',
          subscriptionStatus: 'free',
          acceptedTerms: false,
          language: 'en',
          role: 'user',
        },
      },
    });
    const res = createMockRes();

    webAppController.authStatus(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticated: true,
        user: expect.objectContaining({
          id: 'test-id',
          username: 'johndoe',
          role: 'user',
        }),
      })
    );
  });

  test('should return not authenticated when no session', () => {
    const req = createMockReq({
      session: {
        user: null,
      },
    });
    const res = createMockRes();

    webAppController.authStatus(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticated: false,
      })
    );
  });

  test('should include admin role in response', () => {
    const req = createMockReq({
      session: {
        user: {
          id: 'admin-id',
          pnptvId: 'pnptv-admin',
          username: 'admin',
          role: 'admin',
        },
      },
    });
    const res = createMockRes();

    webAppController.authStatus(req, res);

    const call = res.json.mock.calls[0][0];
    expect(call.user.role).toBe('admin');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Logout Tests
// ────────────────────────────────────────────────────────────────────────────

describe('Logout (/api/webapp/auth/logout)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should destroy session and clear cookie', (done) => {
    const req = createMockReq({
      session: {
        destroy: jest.fn((cb) => cb()),
      },
    });
    const res = createMockRes();

    webAppController.logout(req, res);

    expect(req.session.destroy).toHaveBeenCalled();
    expect(res.clearCookie).toHaveBeenCalledWith('connect.sid');
    expect(res.json).toHaveBeenCalledWith({ success: true });
    done();
  });

  test('should return error if session destruction fails', (done) => {
    const error = new Error('Session destroy failed');
    const req = createMockReq({
      session: {
        destroy: jest.fn((cb) => cb(error)),
      },
    });
    const res = createMockRes();

    webAppController.logout(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Logout failed'),
      })
    );
    done();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Telegram Auth Tests
// ────────────────────────────────────────────────────────────────────────────

describe('Telegram Callback (/api/webapp/auth/telegram/callback)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BOT_TOKEN = '8571930103:AAHIxAeI2CEqgF3arK4D4dZNHFYxgNa_nt0';
    process.env.NODE_ENV = 'production';
    process.env.SKIP_TELEGRAM_HASH_VERIFICATION = 'false';
  });

  test('should reject callback without hash', async () => {
    const req = createMockReq({
      query: {
        id: '123456789',
        first_name: 'John',
        // missing hash
      },
    });
    const res = createMockRes();

    await webAppController.telegramCallback(req, res);

    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('error'));
  });

  test('should reject callback without id', async () => {
    const req = createMockReq({
      query: {
        first_name: 'John',
        hash: 'somehash',
      },
    });
    const res = createMockRes();

    await webAppController.telegramCallback(req, res);

    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('error'));
  });

  test('should allow hash verification bypass in development', async () => {
    process.env.NODE_ENV = 'development';
    process.env.SKIP_TELEGRAM_HASH_VERIFICATION = 'true';

    const req = createMockReq({
      query: {
        id: '123456789',
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        hash: 'invalid-hash-will-be-ignored',
        auth_date: Math.floor(Date.now() / 1000),
      },
    });
    const res = createMockRes();

    // Mock: no existing user
    query.mockResolvedValueOnce({ rows: [] });
    // Mock: insert new user
    query.mockResolvedValueOnce({
      rows: [
        {
          ...mockUserRow,
          telegram: '123456789',
          username: 'johndoe',
        },
      ],
    });

    await webAppController.telegramCallback(req, res);

    // Should redirect to prime-hub, not error
    expect(res.redirect).toHaveBeenCalledWith('/prime-hub/');
  });

  test('should create new user on first Telegram login', async () => {
    process.env.NODE_ENV = 'development';
    process.env.SKIP_TELEGRAM_HASH_VERIFICATION = 'true';

    const req = createMockReq({
      query: {
        id: '987654321',
        first_name: 'Jane',
        last_name: 'Smith',
        username: 'janesmith',
        hash: 'somehash',
        auth_date: Math.floor(Date.now() / 1000),
      },
    });
    const res = createMockRes();

    // Mock: no existing user with this telegram id
    query.mockResolvedValueOnce({ rows: [] });
    // Mock: insert new user
    query.mockResolvedValueOnce({
      rows: [
        {
          ...mockUserRow,
          id: 'new-tg-user',
          telegram: '987654321',
          username: 'janesmith',
          first_name: 'Jane',
          last_name: 'Smith',
        },
      ],
    });

    await webAppController.telegramCallback(req, res);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      expect.arrayContaining(['987654321'])
    );
    expect(res.redirect).toHaveBeenCalledWith('/prime-hub/');
  });

  test('should login existing Telegram user', async () => {
    process.env.NODE_ENV = 'development';
    process.env.SKIP_TELEGRAM_HASH_VERIFICATION = 'true';

    const req = createMockReq({
      query: {
        id: '123456789',
        first_name: 'John',
        hash: 'somehash',
        auth_date: Math.floor(Date.now() / 1000),
      },
    });
    const res = createMockRes();

    const existingUser = { ...mockUserRow, telegram: '123456789' };
    query.mockResolvedValueOnce({ rows: [existingUser] });

    await webAppController.telegramCallback(req, res);

    expect(req.session.save).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/prime-hub/');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Forgot Password Tests
// ────────────────────────────────────────────────────────────────────────────

describe('Forgot Password (/api/webapp/auth/forgot-password)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    emailService.send.mockResolvedValue({ success: true });
  });

  test('should send password reset email to existing user', async () => {
    const req = createMockReq({
      body: {
        email: 'john@example.com',
      },
    });
    const res = createMockRes();

    const user = {
      id: 'user-123',
      email: 'john@example.com',
      first_name: 'John',
    };

    query.mockResolvedValueOnce({ rows: [user] });
    // Mock: password_reset_tokens table creation
    query.mockResolvedValueOnce({ rows: [] });
    // Mock: invalidate old tokens
    query.mockResolvedValueOnce({ rows: [] });
    // Mock: insert new token
    query.mockResolvedValueOnce({ rows: [] });

    await webAppController.forgotPassword(req, res);

    expect(emailService.send).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  test('should return success even for non-existent email (security)', async () => {
    const req = createMockReq({
      body: {
        email: 'nonexistent@example.com',
      },
    });
    const res = createMockRes();

    query.mockResolvedValueOnce({ rows: [] });

    await webAppController.forgotPassword(req, res);

    // Should always return 200 success to prevent email enumeration
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(emailService.send).not.toHaveBeenCalled();
  });

  test('should reject empty email', async () => {
    const req = createMockReq({
      body: {
        email: '',
      },
    });
    const res = createMockRes();

    await webAppController.forgotPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('should normalize email to lowercase', async () => {
    const req = createMockReq({
      body: {
        email: 'JoHn@ExAmPlE.cOm',
      },
    });
    const res = createMockRes();

    query.mockResolvedValueOnce({ rows: [] });

    await webAppController.forgotPassword(req, res);

    // First query should use lowercase email
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id, first_name, email FROM users WHERE email'),
      ['john@example.com']
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Reset Password Tests
// ────────────────────────────────────────────────────────────────────────────

describe('Reset Password (/api/webapp/auth/reset-password)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should reset password with valid token', async () => {
    const token = 'valid-reset-token-123';
    const req = createMockReq({
      body: {
        token,
        password: 'newPassword123',
      },
    });
    const res = createMockRes();

    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 'token-id',
          user_id: 'user-123',
          expires_at: futureDate,
          email: 'john@example.com',
          first_name: 'John',
        },
      ],
    });
    // Mock: update password
    query.mockResolvedValueOnce({ rows: [] });
    // Mock: mark token as used
    query.mockResolvedValueOnce({ rows: [] });

    await webAppController.resetPassword(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
      })
    );
  });

  test('should reject invalid token', async () => {
    const req = createMockReq({
      body: {
        token: 'invalid-token',
        password: 'newPassword123',
      },
    });
    const res = createMockRes();

    query.mockResolvedValueOnce({ rows: [] });

    await webAppController.resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Invalid or expired'),
      })
    );
  });

  test('should reject expired token', async () => {
    const token = 'expired-token';
    const req = createMockReq({
      body: {
        token,
        password: 'newPassword123',
      },
    });
    const res = createMockRes();

    const pastDate = new Date(Date.now() - 60 * 60 * 1000);
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 'token-id',
          user_id: 'user-123',
          expires_at: pastDate,
          email: 'john@example.com',
          first_name: 'John',
        },
      ],
    });

    await webAppController.resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('expired'),
      })
    );
  });

  test('should reject short password', async () => {
    const req = createMockReq({
      body: {
        token: 'valid-token',
        password: 'short',
      },
    });
    const res = createMockRes();

    await webAppController.resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('at least 8 characters'),
      })
    );
  });

  test('should reject missing token or password', async () => {
    const req = createMockReq({
      body: {
        token: 'valid-token',
        // missing password
      },
    });
    const res = createMockRes();

    await webAppController.resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// X/Twitter OAuth Tests
// ────────────────────────────────────────────────────────────────────────────

describe('X OAuth (/api/webapp/auth/x/start and /callback)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TWITTER_CLIENT_ID = 'test-client-id';
    process.env.TWITTER_REDIRECT_URI = 'http://localhost:3001/api/webapp/auth/x/callback';
    process.env.WEBAPP_X_CLIENT_ID = 'test-webapp-client-id';
    process.env.WEBAPP_X_CLIENT_SECRET = 'test-webapp-client-secret';
    process.env.WEBAPP_X_REDIRECT_URI = 'http://localhost:3001/api/webapp/auth/x/callback';
  });

  test('should start X OAuth flow with PKCE', async () => {
    const req = createMockReq();
    const res = createMockRes();

    await webAppController.xLoginStart(req, res);

    expect(res.json).toHaveBeenCalled();
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.url).toContain('twitter.com/i/oauth2/authorize');
    expect(response.url).toContain('code_challenge');
  });

  test('should reject X OAuth start without client ID', async () => {
    delete process.env.TWITTER_CLIENT_ID;
    delete process.env.TWITTER_REDIRECT_URI;

    const req = createMockReq();
    const res = createMockRes();

    await webAppController.xLoginStart(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('not configured'),
      })
    );
  });

  test('should handle X callback with code', async () => {
    const req = createMockReq({
      query: {
        code: 'mock-oauth-code',
        state: 'mock-state',
      },
      session: {
        xOAuth: {
          state: 'mock-state',
          codeVerifier: 'mock-code-verifier',
        },
        user: null,
        save: jest.fn((cb) => cb()),
      },
    });
    const res = createMockRes();

    // Mock axios for token exchange
    axios.post.mockResolvedValueOnce({
      data: {
        access_token: 'mock-access-token',
      },
    });

    // Mock axios for user profile fetch
    axios.get.mockResolvedValueOnce({
      data: {
        data: {
          username: 'testuser',
          name: 'Test User',
        },
      },
    });

    // Mock: no existing user with this twitter handle
    query.mockResolvedValueOnce({ rows: [] });
    // Mock: insert new user
    query.mockResolvedValueOnce({
      rows: [
        {
          ...mockUserRow,
          id: 'twitter-user-id',
          twitter: 'testuser',
          username: 'testuser',
        },
      ],
    });

    await webAppController.xLoginCallback(req, res);

    expect(res.redirect).toHaveBeenCalledWith('/prime-hub/');
  });

  test('should reject X callback with state mismatch', async () => {
    const req = createMockReq({
      query: {
        code: 'mock-oauth-code',
        state: 'wrong-state',
      },
      session: {
        xOAuth: {
          state: 'correct-state',
          codeVerifier: 'mock-code-verifier',
        },
      },
    });
    const res = createMockRes();

    await webAppController.xLoginCallback(req, res);

    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('error'));
  });

  test('should link X to existing Telegram session', async () => {
    const req = createMockReq({
      query: {
        code: 'mock-oauth-code',
        state: 'mock-state',
      },
      session: {
        user: {
          id: 'existing-user-id',
        },
        xOAuth: {
          state: 'mock-state',
          codeVerifier: 'mock-code-verifier',
        },
        save: jest.fn((cb) => cb()),
      },
    });
    const res = createMockRes();

    axios.post.mockResolvedValueOnce({
      data: {
        access_token: 'mock-access-token',
      },
    });

    axios.get.mockResolvedValueOnce({
      data: {
        data: {
          username: 'newxhandle',
          name: 'X User',
        },
      },
    });

    // Mock: no existing user with this twitter handle
    query.mockResolvedValueOnce({ rows: [] });
    // Mock: update existing user with twitter handle
    query.mockResolvedValueOnce({ rows: [] });
    // Mock: fetch updated user
    query.mockResolvedValueOnce({
      rows: [
        {
          ...mockUserRow,
          id: 'existing-user-id',
          twitter: 'newxhandle',
        },
      ],
    });

    await webAppController.xLoginCallback(req, res);

    // Should link to existing user
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users SET twitter'),
      ['newxhandle', 'existing-user-id']
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Session Management Tests
// ────────────────────────────────────────────────────────────────────────────

describe('Session Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
  });

  test('should persist session after registration', async () => {
    const req = createMockReq({
      body: {
        email: 'test@example.com',
        password: 'securePassword123',
        firstName: 'Test',
      },
    });
    const res = createMockRes();

    query.mockResolvedValueOnce({ rows: [] });
    query.mockResolvedValueOnce({
      rows: [{ ...mockUserRow, email: 'test@example.com' }],
    });

    await webAppController.emailRegister(req, res);

    expect(req.session.save).toHaveBeenCalled();
    expect(req.session.user).toBeDefined();
  });

  test('should have session user fields populated correctly', async () => {
    const req = createMockReq({
      body: {
        email: 'john@example.com',
        password: 'correctPassword123',
      },
    });
    const res = createMockRes();

    const crypto = require('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await new Promise((resolve, reject) => {
      crypto.scrypt('correctPassword123', salt, 64, (err, key) => {
        if (err) reject(err);
        else resolve(key.toString('hex'));
      });
    });
    const passwordHash = `${salt}:${hash}`;

    const userWithPassword = {
      ...mockUserRow,
      password_hash: passwordHash,
      role: 'user',
    };
    query.mockResolvedValueOnce({ rows: [userWithPassword] });

    await webAppController.emailLogin(req, res);

    const session = req.session.user;
    expect(session.id).toBeDefined();
    expect(session.pnptvId).toBeDefined();
    expect(session.firstName).toBeDefined();
    expect(session.role).toBe('user');
  });

  test('should maintain role information across session', () => {
    const req = createMockReq({
      session: {
        user: {
          id: 'admin-user',
          pnptvId: 'pnptv-admin',
          role: 'admin',
        },
      },
    });
    const res = createMockRes();

    webAppController.authStatus(req, res);

    const response = res.json.mock.calls[0][0];
    expect(response.user.role).toBe('admin');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Error Handling Tests
// ────────────────────────────────────────────────────────────────────────────

describe('Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle database errors gracefully on registration', async () => {
    const req = createMockReq({
      body: {
        email: 'test@example.com',
        password: 'securePassword123',
        firstName: 'Test',
      },
    });
    const res = createMockRes();

    query.mockRejectedValueOnce(new Error('Database connection failed'));

    await webAppController.emailRegister(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Registration failed'),
      })
    );
  });

  test('should handle database errors gracefully on login', async () => {
    const req = createMockReq({
      body: {
        email: 'test@example.com',
        password: 'securePassword123',
      },
    });
    const res = createMockRes();

    query.mockRejectedValueOnce(new Error('Database connection failed'));

    await webAppController.emailLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Login failed'),
      })
    );
  });

  test('should handle email service errors on forgot password', async () => {
    const req = createMockReq({
      body: {
        email: 'john@example.com',
      },
    });
    const res = createMockRes();

    const user = {
      id: 'user-123',
      email: 'john@example.com',
      first_name: 'John',
    };

    query.mockResolvedValueOnce({ rows: [user] });
    query.mockResolvedValueOnce({ rows: [] });
    query.mockResolvedValueOnce({ rows: [] });
    query.mockResolvedValueOnce({ rows: [] });

    emailService.send.mockRejectedValueOnce(new Error('SMTP error'));

    await webAppController.forgotPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('should handle axios errors on X OAuth callback', async () => {
    const req = createMockReq({
      query: {
        code: 'mock-oauth-code',
        state: 'mock-state',
      },
      session: {
        xOAuth: {
          state: 'mock-state',
          codeVerifier: 'mock-code-verifier',
        },
      },
    });
    const res = createMockRes();

    process.env.WEBAPP_X_CLIENT_ID = 'test-webapp-client-id';
    process.env.WEBAPP_X_CLIENT_SECRET = 'test-webapp-client-secret';
    process.env.WEBAPP_X_REDIRECT_URI = 'http://localhost:3001/api/webapp/auth/x/callback';

    axios.post.mockRejectedValueOnce(new Error('Twitter API error'));

    await webAppController.xLoginCallback(req, res);

    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('error'));
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Password Hashing Tests
// ────────────────────────────────────────────────────────────────────────────

describe('Password Hashing and Verification', () => {
  test('should hash password correctly', async () => {
    const password = 'testPassword123';
    const crypto = require('crypto');

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await new Promise((resolve, reject) => {
      crypto.scrypt(password, salt, 64, (err, key) => {
        if (err) reject(err);
        else resolve(key.toString('hex'));
      });
    });
    const passwordHash = `${salt}:${hash}`;

    expect(passwordHash).toContain(':');
    const [hashSalt, hashValue] = passwordHash.split(':');
    expect(hashSalt).toHaveLength(32); // 16 bytes in hex = 32 chars
    expect(hashValue).toHaveLength(128); // 64 bytes in hex = 128 chars
  });

  test('should correctly verify matching password', async () => {
    const password = 'testPassword123';
    const crypto = require('crypto');

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await new Promise((resolve, reject) => {
      crypto.scrypt(password, salt, 64, (err, key) => {
        if (err) reject(err);
        else resolve(key.toString('hex'));
      });
    });
    const passwordHash = `${salt}:${hash}`;

    // Verify
    const [storedSalt, storedHash] = passwordHash.split(':');
    const hashBuf = Buffer.from(storedHash, 'hex');
    const derivedBuf = await new Promise((resolve, reject) => {
      crypto.scrypt(password, storedSalt, 64, (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });

    const matches = crypto.timingSafeEqual(hashBuf, derivedBuf);
    expect(matches).toBe(true);
  });

  test('should reject incorrect password', async () => {
    const correctPassword = 'testPassword123';
    const wrongPassword = 'wrongPassword456';
    const crypto = require('crypto');

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await new Promise((resolve, reject) => {
      crypto.scrypt(correctPassword, salt, 64, (err, key) => {
        if (err) reject(err);
        else resolve(key.toString('hex'));
      });
    });
    const passwordHash = `${salt}:${hash}`;

    // Try to verify with wrong password
    const [storedSalt, storedHash] = passwordHash.split(':');
    const hashBuf = Buffer.from(storedHash, 'hex');
    const derivedBuf = await new Promise((resolve, reject) => {
      crypto.scrypt(wrongPassword, storedSalt, 64, (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });

    // timingSafeEqual returns false for mismatched buffers of same length
    const matches = crypto.timingSafeEqual(hashBuf, derivedBuf);
    expect(matches).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// JWT Tests
// ────────────────────────────────────────────────────────────────────────────

describe('JWT Token Generation and Verification', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
  });

  test('should generate valid JWT token', () => {
    const payload = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'user',
    };

    const token = generateJWT(payload);

    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  test('should verify valid JWT token', () => {
    const payload = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'user',
    };

    const token = generateJWT(payload);
    const decoded = verifyJWT(token);

    expect(decoded).not.toBeNull();
    expect(decoded.id).toBe('user-123');
    expect(decoded.email).toBe('test@example.com');
    expect(decoded.role).toBe('user');
  });

  test('should reject tampered JWT token', () => {
    const payload = {
      id: 'user-123',
      email: 'test@example.com',
    };

    const token = generateJWT(payload);
    // Tamper with token
    const parts = token.split('.');
    const tamperedToken = parts[0] + '.hacked.' + parts[2];

    const decoded = verifyJWT(tamperedToken);
    expect(decoded).toBeNull();
  });

  test('should include iat (issued at) claim in JWT', () => {
    const payload = {
      id: 'user-123',
      email: 'test@example.com',
    };

    const token = generateJWT(payload);
    const decoded = verifyJWT(token);

    expect(decoded.iat).toBeDefined();
    expect(typeof decoded.iat).toBe('number');
  });
});
