/**
 * Telegram Simulator
 * Simulates Telegram WebApp behavior for E2E testing
 * Handles initData creation with valid signatures
 */

const crypto = require('crypto');

class TelegramSimulator {
  /**
   * Create valid Telegram initData with signature
   * @param {Object} user - User object from Telegram
   * @param {Object} options - Additional options (auth_date, etc)
   * @returns {string} URL-encoded initData
   */
  static createInitData(user, options = {}) {
    const authDate = options.auth_date || Math.floor(Date.now() / 1000);

    // Create data string (must be sorted by key for signature)
    const params = {
      user: JSON.stringify(user),
      auth_date: authDate,
    };

    // Sort and create data check string
    const dataCheckString = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('\n');

    // Get bot token from env
    const botToken = process.env.TELEGRAM_BOT_TOKEN || 'test-token-123';

    // Create secret key (SHA256 of bot token)
    const secretKey = crypto
      .createHash('sha256')
      .update(botToken)
      .digest();

    // Create signature (HMAC-SHA256)
    const hash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Return URL-encoded format (like Telegram does)
    return `user=${encodeURIComponent(params.user)}&auth_date=${authDate}&hash=${hash}`;
  }

  /**
   * Create invalid initData (for testing error cases)
   * @returns {string} Invalid initData
   */
  static createInvalidInitData() {
    return 'user=%7B%22id%22%3A123456789%7D&auth_date=1234567890&hash=invalid_signature_12345678';
  }

  /**
   * Decode and verify initData
   * @param {string} initData - Encoded initData
   * @returns {Object} Decoded data
   */
  static decodeInitData(initData) {
    const params = new URLSearchParams(initData);
    return {
      user: JSON.parse(params.get('user')),
      auth_date: parseInt(params.get('auth_date')),
      hash: params.get('hash')
    };
  }

  /**
   * Verify initData signature (what backend does)
   * @param {string} initData - Encoded initData
   * @returns {boolean} Is valid
   */
  static verifyInitData(initData) {
    const params = new URLSearchParams(initData);
    const receivedHash = params.get('hash');

    if (!receivedHash) return false;

    // Remove hash from params
    const checkParams = {};
    params.forEach((value, key) => {
      if (key !== 'hash') {
        checkParams[key] = value;
      }
    });

    // Recreate data check string
    const dataCheckString = Object.keys(checkParams)
      .sort()
      .map(key => `${key}=${checkParams[key]}`)
      .join('\n');

    // Create signature
    const botToken = process.env.TELEGRAM_BOT_TOKEN || 'test-token-123';
    const secretKey = crypto
      .createHash('sha256')
      .update(botToken)
      .digest();

    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return expectedHash === receivedHash;
  }

  /**
   * Create multiple test users
   * @param {number} count - Number of users to create
   * @returns {Array} Array of user objects
   */
  static createTestUsers(count = 5) {
    const users = [];
    for (let i = 0; i < count; i++) {
      users.push({
        id: 100000000 + i,
        is_bot: false,
        first_name: `TestUser${i}`,
        username: `testuser${i}`,
        language_code: 'en'
      });
    }
    return users;
  }

  /**
   * Create test user with location
   * @param {Object} userData - User data
   * @param {number} userData.id - Telegram user ID
   * @param {number} latitude - GPS latitude
   * @param {number} longitude - GPS longitude
   * @returns {Object} User with location
   */
  static createUserWithLocation(userData = {}, latitude = 40.7505, longitude = -73.9706) {
    return {
      id: userData.id || Math.floor(Math.random() * 100000000),
      first_name: userData.first_name || 'Test',
      username: userData.username || 'testuser',
      location: {
        latitude,
        longitude,
        accuracy: 10
      }
    };
  }
}

module.exports = TelegramSimulator;
