// Mock dependencies
jest.mock('../../../src/config/firebase');
jest.mock('../../../src/config/redis');

const UserModel = require('../../../src/models/userModel');
const { getFirestore } = require('../../../src/config/firebase');
const { cache } = require('../../../src/config/redis');

describe('UserModel', () => {
  let mockDb;
  let mockCollection;
  let mockDoc;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDoc = {
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      exists: false,
      id: 'test-user-id',
      data: jest.fn(),
    };

    mockCollection = {
      doc: jest.fn().mockReturnValue(mockDoc),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      startAfter: jest.fn().mockReturnThis(),
      get: jest.fn(),
    };

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
    };

    getFirestore.mockReturnValue(mockDb);

    // Mock cache
    cache.get = jest.fn().mockResolvedValue(null);
    cache.set = jest.fn().mockResolvedValue(true);
    cache.del = jest.fn().mockResolvedValue(true);
    cache.delPattern = jest.fn().mockResolvedValue(0);
  });

  describe('createOrUpdate', () => {
    it('should create new user', async () => {
      mockDoc.get.mockResolvedValue({ exists: false });
      mockDoc.set.mockResolvedValue();

      const userData = {
        userId: 123456789,
        firstName: 'John',
        lastName: 'Doe',
        language: 'en',
      };

      const result = await UserModel.createOrUpdate(userData);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userData.userId);
      expect(result.subscriptionStatus).toBe('free');
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(mockDoc.set).toHaveBeenCalled();
      expect(cache.del).toHaveBeenCalledWith('user:123456789');
    });

    it('should update existing user', async () => {
      mockDoc.get.mockResolvedValue({ exists: true });
      mockDoc.set.mockResolvedValue();

      const userData = {
        userId: 123456789,
        firstName: 'John Updated',
      };

      const result = await UserModel.createOrUpdate(userData);

      expect(result).toBeDefined();
      expect(result.firstName).toBe('John Updated');
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(mockDoc.set).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      mockDoc.get.mockRejectedValue(new Error('Database error'));

      await expect(UserModel.createOrUpdate({ userId: 123 })).rejects.toThrow();
    });
  });

  describe('getById', () => {
    it('should get user by ID from database', async () => {
      const userData = {
        userId: 123456789,
        firstName: 'John',
        subscriptionStatus: 'active',
      };

      mockDoc.get.mockResolvedValue({
        exists: true,
        id: '123456789',
        data: () => userData,
      });

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
      cache.get.mockResolvedValue(cachedUser);

      const result = await UserModel.getById(123456789);

      expect(result).toEqual(cachedUser);
      expect(mockCollection.doc).not.toHaveBeenCalled();
    });

    it('should return null for non-existent user', async () => {
      mockDoc.get.mockResolvedValue({ exists: false });

      const result = await UserModel.getById(999999);

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockDoc.get.mockRejectedValue(new Error('Database error'));

      const result = await UserModel.getById(123456789);

      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      mockDoc.update.mockResolvedValue();

      const updates = {
        firstName: 'Updated Name',
        bio: 'New bio',
      };

      const result = await UserModel.updateProfile(123456789, updates);

      expect(result).toBe(true);
      expect(mockDoc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          ...updates,
          updatedAt: expect.any(Date),
        })
      );
      expect(cache.del).toHaveBeenCalledWith('user:123456789');
    });

    it('should handle errors', async () => {
      mockDoc.update.mockRejectedValue(new Error('Update failed'));

      const result = await UserModel.updateProfile(123456789, { firstName: 'Test' });

      expect(result).toBe(false);
    });
  });

  describe('updateSubscription', () => {
    it('should update user subscription', async () => {
      mockDoc.update.mockResolvedValue();

      const subscription = {
        status: 'active',
        planId: 'premium',
        expiry: new Date('2024-12-31'),
      };

      const result = await UserModel.updateSubscription(123456789, subscription);

      expect(result).toBe(true);
      expect(mockDoc.update).toHaveBeenCalled();
      expect(cache.del).toHaveBeenCalledWith('user:123456789');
      expect(cache.delPattern).toHaveBeenCalledWith('nearby:*');
    });

    it('should handle errors', async () => {
      mockDoc.update.mockRejectedValue(new Error('Update failed'));

      const subscription = { status: 'active', planId: 'basic' };
      const result = await UserModel.updateSubscription(123456789, subscription);

      expect(result).toBe(false);
    });
  });

  describe('getNearby', () => {
    it('should get nearby users', async () => {
      const users = [
        {
          id: '1',
          data: () => ({
            userId: 1,
            firstName: 'User1',
            location: { lat: 40.7128, lng: -74.0060 },
          }),
        },
        {
          id: '2',
          data: () => ({
            userId: 2,
            firstName: 'User2',
            location: { lat: 40.7200, lng: -74.0100 },
          }),
        },
      ];

      mockCollection.get.mockResolvedValue({
        forEach: (callback) => users.forEach(callback),
      });

      const result = await UserModel.getNearby({ lat: 40.7128, lng: -74.0060 }, 10);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return cached nearby users', async () => {
      const cachedUsers = [{ id: '1', firstName: 'User1' }];
      cache.get.mockResolvedValue(cachedUsers);

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
          data: () => ({ userId: 1, planExpiry: new Date('2024-01-01') }),
        },
      ];

      mockCollection.get.mockResolvedValue({
        forEach: (callback) => expiredUsers.forEach(callback),
      });

      const result = await UserModel.getExpiredSubscriptions();

      expect(Array.isArray(result)).toBe(true);
      expect(mockCollection.where).toHaveBeenCalledWith('subscriptionStatus', '==', 'active');
    });

    it('should handle errors', async () => {
      mockCollection.get.mockRejectedValue(new Error('Query error'));

      const result = await UserModel.getExpiredSubscriptions();

      expect(result).toEqual([]);
    });
  });

  describe('getAll', () => {
    it('should get all users with pagination', async () => {
      const users = [
        {
          id: '1',
          data: () => ({ userId: 1, firstName: 'User1' }),
        },
        {
          id: '2',
          data: () => ({ userId: 2, firstName: 'User2' }),
        },
      ];

      mockCollection.get.mockResolvedValue({
        forEach: (callback) => users.forEach(callback),
      });

      const result = await UserModel.getAll(50);

      expect(result.users).toBeDefined();
      expect(Array.isArray(result.users)).toBe(true);
      expect(result.lastDoc).toBeDefined();
    });

    it('should handle errors', async () => {
      mockCollection.get.mockRejectedValue(new Error('Query error'));

      const result = await UserModel.getAll();

      expect(result.users).toEqual([]);
      expect(result.lastDoc).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete user', async () => {
      mockDoc.delete.mockResolvedValue();

      const result = await UserModel.delete(123456789);

      expect(result).toBe(true);
      expect(mockDoc.delete).toHaveBeenCalled();
      expect(cache.del).toHaveBeenCalledWith('user:123456789');
    });

    it('should handle errors', async () => {
      mockDoc.delete.mockRejectedValue(new Error('Delete failed'));

      const result = await UserModel.delete(123456789);

      expect(result).toBe(false);
    });
  });
});
