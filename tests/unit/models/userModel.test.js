// Mock dependencies
jest.mock('../../../src/config/redis');
jest.mock('../../../src/config/postgres', () => ({
  query: jest.fn(),
}));

const UserModel = require('../../../src/models/userModel');
const { cache } = require('../../../src/config/redis');
const { query } = require('../../../src/config/postgres');

describe('UserModel', () => {
  const now = new Date();
  const baseRows = [
    {
      id: '123456789',
      username: 'John',
      first_name: 'John',
      last_name: 'Doe',
      subscription_status: 'active',
      plan_id: 'basic',
      plan_expiry: new Date('2024-01-01'),
      location_lat: 40.7128,
      location_lng: -74.0060,
      location_name: null,
      location_geohash: null,
      privacy: '{}',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: '2',
      username: 'User2',
      first_name: 'User2',
      last_name: 'Test',
      subscription_status: 'active',
      plan_id: 'premium',
      plan_expiry: new Date('2024-01-02'),
      location_lat: 40.72,
      location_lng: -74.01,
      location_name: null,
      location_geohash: null,
      privacy: '{}',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rows: baseRows });
    cache.get = jest.fn().mockResolvedValue(null);
    cache.set = jest.fn().mockResolvedValue(true);
    cache.del = jest.fn().mockResolvedValue(true);
    cache.delPattern = jest.fn().mockResolvedValue(0);
    cache.getOrSet = jest.fn().mockImplementation(async (_k, fn) => fn());
  });

  describe('createOrUpdate', () => {
    it('should create new user', async () => {
      const userData = {
        userId: 123456789,
        firstName: 'John',
        lastName: 'Doe',
        language: 'en',
      };

      const result = await UserModel.createOrUpdate(userData);

      expect(result).toBeDefined();
      expect(result.userId).toBe(String(userData.userId));
      expect(result.subscriptionStatus).toBe('active');
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(cache.del).toHaveBeenCalledWith('user:123456789');
    });

    it('should handle errors', async () => {
      query.mockRejectedValueOnce(new Error('Database error'));

      await expect(UserModel.createOrUpdate({ userId: 123 })).rejects.toThrow();
    });
  });

  describe('getById', () => {
    it('should get user by ID from database', async () => {
      const result = await UserModel.getById(123456789);

      expect(result).toBeDefined();
      expect(result.id).toBe('123456789');
      expect(result.firstName).toBe('John');
    });

    it('should return cached user', async () => {
      const cachedUser = { id: '123456789', firstName: 'John' };
      cache.get.mockResolvedValueOnce(cachedUser);
      cache.getOrSet.mockResolvedValueOnce(undefined);

      const result = await UserModel.getById(123456789);

      expect(result).toEqual(cachedUser);
    });

    it('should return null for non-existent user', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await UserModel.getById(999999);

      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const updates = {
        firstName: 'Updated Name',
        bio: 'New bio',
      };

      const result = await UserModel.updateProfile(123456789, updates);

      expect(result).toBe(true);
      expect(cache.del).toHaveBeenCalledWith('user:123456789');
    });
  });

  describe('updateSubscription', () => {
    it('should update user subscription', async () => {
      const subscription = {
        status: 'active',
        planId: 'premium',
        expiry: new Date('2024-12-31'),
      };

      const result = await UserModel.updateSubscription(123456789, subscription);

      expect(result).toBe(true);
      expect(cache.del).toHaveBeenCalledWith('user:123456789');
      expect(cache.delPattern).toHaveBeenCalledWith('nearby:*');
    });
  });

  describe('getNearby', () => {
    it('should get nearby users', async () => {
      const result = await UserModel.getNearby({ lat: 40.7128, lng: -74.0060 }, 10);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance correctly', () => {
      const distance = UserModel.calculateDistance(40.7128, -74.0060, 34.0522, -118.2437);

      expect(distance).toBeGreaterThan(3900);
      expect(distance).toBeLessThan(4000);
    });

    it('should return 0 for same location', () => {
      const distance = UserModel.calculateDistance(40.7128, -74.0060, 40.7128, -74.0060);

      expect(distance).toBe(0);
    });
  });

  describe('getExpiredSubscriptions', () => {
    it('should get expired subscriptions', async () => {
      const result = await UserModel.getExpiredSubscriptions();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].planExpiry).toBeDefined();
    });

    it('should handle errors', async () => {
      query.mockRejectedValueOnce(new Error('Query error'));

      const result = await UserModel.getExpiredSubscriptions();

      expect(result).toEqual([]);
    });
  });

  describe('getAll', () => {
    it('should get all users with pagination', async () => {
      const result = await UserModel.getAll(50);

      expect(result.users).toBeDefined();
      expect(Array.isArray(result.users)).toBe(true);
      expect(result.lastDoc).toBeDefined();
    });

    it('should handle errors', async () => {
      query.mockRejectedValueOnce(new Error('Query error'));

      const result = await UserModel.getAll();

      expect(result.users).toEqual([]);
      expect(result.lastDoc).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete user', async () => {
      const result = await UserModel.delete(123456789);

      expect(result).toBe(true);
      expect(cache.del).toHaveBeenCalledWith('user:123456789');
    });

    it('should handle errors', async () => {
      query.mockRejectedValueOnce(new Error('Delete failed'));

      const result = await UserModel.delete(123456789);

      expect(result).toBe(false);
    });
  });
});
