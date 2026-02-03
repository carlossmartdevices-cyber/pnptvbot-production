/**
 * Location/Nearby Tests
 * Tests for nearby places, geocoding, and business dashboard
 */

const axios = require('axios');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

describe('Location Services Tests', () => {
  describe('Geocoding Configuration', () => {
    test('Geocoder provider is configured', () => {
      const provider = process.env.GEOCODER_PROVIDER;
      expect(['google', 'openstreetmap', undefined]).toContain(provider);
    });
  });

  describe('Location API Endpoints', () => {
    test('Health endpoint responds', async () => {
      const response = await axios.get(`${BASE_URL}/api/health`);
      expect(response.status).toBe(200);
    });
  });

  describe('User Location Model', () => {
    const UserModel = require('../../src/models/userModel');

    test('UserModel is importable', () => {
      expect(UserModel).toBeDefined();
    });

    test('UserModel has location-related methods', () => {
      expect(typeof UserModel.updateProfile).toBe('function');
      expect(typeof UserModel.getById).toBe('function');
    });
  });

  describe('Nearby Places Service', () => {
    test('Database schema supports location fields', async () => {
      const { query } = require('../../src/config/postgres');

      // Check users table has location columns
      const result = await query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'users'
        AND column_name IN ('location_lat', 'location_lng', 'location_name', 'location_geohash')
      `);

      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('Business Dashboard', () => {
    test('Admin nearby places handler exists', () => {
      // Check if the handler file exists and is importable
      let handlerExists = false;
      try {
        require('../../src/bot/handlers/admin/index');
        handlerExists = true;
      } catch (e) {
        handlerExists = false;
      }

      expect(handlerExists).toBe(true);
    });
  });
});

describe('Location Sharing', () => {
  test('Location sharing field exists in schema', async () => {
    const { query } = require('../../src/config/postgres');

    const result = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name = 'location_sharing_enabled'
    `);

    expect(result.rows.length).toBe(1);
  });

  test('Default location sharing is enabled', async () => {
    const { query } = require('../../src/config/postgres');

    const result = await query(`
      SELECT column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name = 'location_sharing_enabled'
    `);

    if (result.rows.length > 0) {
      expect(result.rows[0].column_default).toContain('true');
    }
  });
});
