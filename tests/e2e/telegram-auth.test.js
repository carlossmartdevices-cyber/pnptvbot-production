/**
 * E2E Test Suite 1: Telegram Authentication
 * Tests the complete Telegram auth flow with signature verification
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');
const TelegramSimulator = require('./helpers/telegram-simulator');

// Configure axios
const apiClient = axios.create({
  baseURL: process.env.API_BASE_URL || 'http://localhost:3001',
  validateStatus: () => true // Don't throw on any status
});

describe('Telegram Authentication E2E Tests', () => {
  let authToken;
  let userId;

  // Test 1.1: Valid Telegram signature verification
  test('1.1 Should verify valid Telegram initData signature', async () => {
    const telegramUser = {
      id: 111111111,
      is_bot: false,
      first_name: 'Santino',
      last_name: 'Furioso',
      username: 'SantinoFurioso',
      language_code: 'es'
    };

    // Create valid initData with correct signature
    const initData = TelegramSimulator.createInitData(telegramUser);

    // Send to backend
    const response = await apiClient.post('/api/auth/telegram', { initData });

    // Verify response
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('token');
    expect(response.data.user).toBeDefined();
    expect(response.data.user.id).toBe('111111111');
    expect(response.data.user.username).toBe('SantinoFurioso');

    // Store for later tests
    authToken = response.data.token;
    userId = response.data.user.id;
  });

  // Test 1.2: Reject invalid Telegram signature
  test('1.2 Should reject invalid Telegram signature', async () => {
    const invalidInitData = TelegramSimulator.createInvalidInitData();

    const response = await apiClient.post('/api/auth/telegram', {
      initData: invalidInitData
    });

    expect(response.status).toBe(401);
    expect(response.data.error).toBeDefined();
  });

  // Test 1.3: Reject expired auth_date
  test('1.3 Should reject expired auth_date (> 24 hours old)', async () => {
    const expiredInitData = TelegramSimulator.createInitData(
      { id: 222222222, first_name: 'Expired' },
      { auth_date: Math.floor(Date.now() / 1000) - 86400 } // 24h ago
    );

    const response = await apiClient.post('/api/auth/telegram', {
      initData: expiredInitData
    });

    expect(response.status).toBe(401);
    expect(response.data.error).toContain('expired');
  });

  // Test 1.4: Create/update user in database
  test('1.4 Should create new user in database on first auth', async () => {
    const newUserInitData = TelegramSimulator.createInitData({
      id: 333333333,
      first_name: 'NewUser',
      username: 'newuser',
      language_code: 'en'
    });

    const response = await apiClient.post('/api/auth/telegram', {
      initData: newUserInitData
    });

    expect(response.status).toBe(200);
    expect(response.data.user.id).toBe('333333333');

    // Verify user was created in DB by attempting to get user info
    const userResponse = await apiClient.get('/api/users/333333333', {
      headers: { 'Authorization': `Bearer ${response.data.token}` }
    });

    expect(userResponse.status).toBe(200);
    expect(userResponse.data.username).toBe('newuser');
  });

  // Test 1.5: JWT token validity
  test('1.5 JWT token should be valid for 7 days', async () => {
    const testUserInitData = TelegramSimulator.createInitData({
      id: 444444444,
      first_name: 'TokenTest',
      username: 'tokentest'
    });

    const response = await apiClient.post('/api/auth/telegram', {
      initData: testUserInitData
    });

    expect(response.status).toBe(200);

    const token = response.data.token;
    const decoded = jwt.decode(token);

    expect(decoded).toBeDefined();
    expect(decoded.exp).toBeDefined();

    // Check expiry is approximately 7 days
    const expiryMs = decoded.exp * 1000;
    const nowMs = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    const diff = expiryMs - nowMs;
    expect(diff).toBeGreaterThan(sevenDaysMs - 60000); // Allow 1 min drift
  });

  // Test 1.6: Subsequent auth for existing user updates last_login
  test('1.6 Existing user login should update last_login timestamp', async () => {
    const existingUserInitData = TelegramSimulator.createInitData({
      id: 111111111, // Same user from test 1.1
      first_name: 'Santino',
      username: 'SantinoFurioso'
    });

    // First login
    const response1 = await apiClient.post('/api/auth/telegram', {
      initData: existingUserInitData
    });

    expect(response1.status).toBe(200);
    const firstLoginTime = response1.data.user.last_login;

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 100));

    // Second login
    const response2 = await apiClient.post('/api/auth/telegram', {
      initData: existingUserInitData
    });

    expect(response2.status).toBe(200);
    const secondLoginTime = response2.data.user.last_login;

    // Last login should be updated
    expect(secondLoginTime).toBeGreaterThanOrEqual(firstLoginTime);
  });

  // Test 1.7: Invalid initData format should be rejected
  test('1.7 Should reject malformed initData', async () => {
    const response = await apiClient.post('/api/auth/telegram', {
      initData: 'invalid_format_missing_hash_and_user'
    });

    expect(response.status).toBe(400);
  });

  // Test 1.8: Missing initData should return error
  test('1.8 Should require initData in request', async () => {
    const response = await apiClient.post('/api/auth/telegram', {});

    expect(response.status).toBe(400);
    expect(response.data.error).toContain('required');
  });
});
