// Mock dependencies
jest.mock('../../../src/config/postgres');
jest.mock('../../../src/config/redis');

const UserModel = require('../../../src/models/userModel');
const { query } = require('../../../src/config/postgres');
const { cache } = require('../../../src/config/redis');

describe('UserModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock PostgreSQL query function
    query.mockResolvedValue({ rows: [], rowCount: 0 });

    // Mock cache with getOrSet method
    cache.get = jest.fn().mockResolvedValue(null);
    cache.set = jest.fn().mockResolvedValue(true);
    cache.del = jest.fn().mockResolvedValue(true);
    cache.delPattern = jest.fn().mockResolvedValue(0);
    cache.getOrSet = jest.fn(async (key, fn, ttl) => {
      const cached = await cache.get(key);
      if (cached !== null) {
        return cached;
      }
      const value = await fn();
      if (value !== null) {
        await cache.set(key, value, ttl);
      }
      return value;
    });
  });

  describe('createOrUpdate', () => {
    it('should create new user', async () => {
      query.mockResolvedValue({ rows: [], rowCount: 1 });

      const userData = {
        userId: 123456789,
        first_name: 'John',
        last_name: 'Doe',
        language: 'en',
      };

      const result = await UserModel.createOrUpdate(userData);

      expect(result).toBeDefined();
      expect(result.first_name).toBe('John');
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(query).toHaveBeenCalled();
      expect(cache.del).toHaveBeenCalledWith('user:123456789');
    });

    it('should update existing user', async () => {
      query.mockResolvedValue({ rows: [], rowCount: 1 });

      const userData = {
        userId: 123456789,
        first_name: 'John Updated',
      };

      const result = await UserModel.createOrUpdate(userData);

      expect(result).toBeDefined();
      expect(result.first_name).toBe('John Updated');
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(query).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      query.mockRejectedValue(new Error('Database error'));

      await expect(UserModel.createOrUpdate({ userId: 123 })).rejects.toThrow();
    });
  });

  describe('getById', () => {
    it('should get user by ID from database', async () => {
      const dbUser = {
        id: '123456789',
        first_name: 'John',
        subscription_status: 'active',
        onboarding_complete: true,
      };

      query.mockResolvedValue({ rows: [dbUser], rowCount: 1 });

      const result = await UserModel.getById(123456789);

      expect(result).toBeDefined();
      expect(result.id).toBe('123456789');
      expect(result.firstName).toBe('John');
      expect(cache.set).toHaveBeenCalledWith(
        'user:123456789',
        expect.any(Object),
        600
      );
    });

    it('should get user from cache', async () => {
      const cachedUser = { id: '123456789', firstName: 'John' };
      cache.getOrSet.mockResolvedValue(cachedUser);

      const result = await UserModel.getById(123456789);

      expect(result).toEqual(cachedUser);
    });

    it('should return null for non-existent user', async () => {
      query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await UserModel.getById(999999);

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      query.mockRejectedValue(new Error('Database error'));

      const result = await UserModel.getById(123456789);

      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      query.mockResolvedValue({ rows: [], rowCount: 1 });

      const updates = {
        firstName: 'Updated Name',
        bio: 'New bio',
      };

      const result = await UserModel.updateProfile(123456789, updates);

      expect(result).toBe(true);
      expect(query).toHaveBeenCalled();
      expect(cache.del).toHaveBeenCalledWith('user:123456789');
    });

    it('should handle errors', async () => {
      query.mockRejectedValue(new Error('Update failed'));

      const result = await UserModel.updateProfile(123456789, { firstName: 'Test' });

      expect(result).toBe(false);
    });
  });

  describe('updateSubscription', () => {
    it('should update user subscription', async () => {
      query.mockResolvedValue({ rows: [], rowCount: 1 });

      const subscription = {
        status: 'active',
        planId: 'premium',
        expiry: new Date('2024-12-31'),
      };

      const result = await UserModel.updateSubscription(123456789, subscription);

      expect(result).toBe(true);
      expect(query).toHaveBeenCalled();
      expect(cache.del).toHaveBeenCalledWith('user:123456789');
      expect(cache.delPattern).toHaveBeenCalledWith('nearby:*');
    });

    it('should handle errors', async () => {
      query.mockRejectedValue(new Error('Update failed'));

      const subscription = { status: 'active', planId: 'basic' };
      const result = await UserModel.updateSubscription(123456789, subscription);

      expect(result).toBe(false);
    });
  });

  describe('getNearby', () => {
    it('should get nearby users', async () => {
      const dbUsers = [
        {
          id: '1',
          first_name: 'User1',
          location: { lat: 40.7128, lng: -74.0060 },
        },
        {
          id: '2',
          first_name: 'User2',
          location: { lat: 40.7200, lng: -74.0100 },
        },
      ];

      query.mockResolvedValue({ rows: dbUsers, rowCount: dbUsers.length });

      const result = await UserModel.getNearby({ lat: 40.7128, lng: -74.0060 }, 10);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return cached nearby users', async () => {
      const cachedUsers = [{ id: '1', firstName: 'User1' }];
      cache.getOrSet.mockResolvedValue(cachedUsers);

      const result = await UserModel.getNearby({ lat: 40.7128, lng: -74.0060 }, 10);

      expect(result).toEqual(cachedUsers);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance correctly', () => {
      // New York to Los Angeles (approx 3935 km)
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
      const expiredUsers = [
        {
          id: '1',
          user_id: 1,
          plan_expiry: new Date('2024-01-01'),
        },
      ];

      query.mockResolvedValue({ rows: expiredUsers, rowCount: expiredUsers.length });

      const result = await UserModel.getExpiredSubscriptions();

      expect(Array.isArray(result)).toBe(true);
      expect(query).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      query.mockRejectedValue(new Error('Query error'));

      const result = await UserModel.getExpiredSubscriptions();

      expect(result).toEqual([]);
    });
  });

  describe('getAll', () => {
    it('should get all users with pagination', async () => {
      const users = [
        { id: '1', user_id: 1, first_name: 'User1' },
        { id: '2', user_id: 2, first_name: 'User2' },
      ];

      query.mockResolvedValue({ rows: users, rowCount: users.length });

      const result = await UserModel.getAll(50);

      expect(result.users).toBeDefined();
      expect(Array.isArray(result.users)).toBe(true);
      expect(query).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      query.mockRejectedValue(new Error('Query error'));

      const result = await UserModel.getAll();

      expect(result.users).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete user', async () => {
      query.mockResolvedValue({ rows: [], rowCount: 1 });

      const result = await UserModel.delete(123456789);

      expect(result).toBe(true);
      expect(query).toHaveBeenCalled();
      expect(cache.del).toHaveBeenCalledWith('user:123456789');
    });

    it('should handle errors', async () => {
      query.mockRejectedValue(new Error('Delete failed'));

      const result = await UserModel.delete(123456789);

      expect(result).toBe(false);
    });
  });
});
