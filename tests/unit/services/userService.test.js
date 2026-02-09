// Mock dependencies
jest.mock('../../../src/models/userModel');
jest.mock('../../../src/utils/validation');

const UserService = require('../../../src/bot/services/userService');
const UserModel = require('../../../src/models/userModel');
const { sanitizeObject, validateSchema, schemas } = require('../../../src/utils/validation');

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateFromContext', () => {
    it('should get existing user', async () => {
      const existingUser = {
        id: '123456789',
        userId: 123456789,
        firstName: 'John',
      };

      UserModel.getById.mockResolvedValue(existingUser);

      const ctx = {
        from: {
          id: 123456789,
          first_name: 'John',
        },
      };

      const result = await UserService.getOrCreateFromContext(ctx);

      expect(result).toEqual(existingUser);
      expect(UserModel.getById).toHaveBeenCalledWith(123456789);
    });

    it('should create new user', async () => {
      const newUser = {
        userId: 123456789,
        firstName: 'New User',
        subscriptionStatus: 'free',
      };

      UserModel.getById.mockResolvedValue(null);
      UserModel.createOrUpdate.mockResolvedValue(newUser);

      const ctx = {
        from: {
          id: 123456789,
          first_name: 'New User',
          language_code: 'en',
        },
      };

      const result = await UserService.getOrCreateFromContext(ctx);

      expect(result).toEqual(newUser);
      expect(UserModel.createOrUpdate).toHaveBeenCalled();
    });

    it('should throw error when no user data in context', async () => {
      const ctx = {};

      await expect(UserService.getOrCreateFromContext(ctx)).rejects.toThrow('No user data in context');
    });
  });

  describe('updateProfile', () => {
    it('[dy5wWw] should update profile successfully', async () => {
      const updatedUser = {
        id: '123456789',
        firstName: 'Updated Name',
        bio: 'New bio',
      };

      sanitizeObject.mockReturnValue({ bio: 'New bio' });
      validateSchema.mockReturnValue({
        error: null,
        value: { userId: 123456789, bio: 'New bio' },
      });
      UserModel.updateProfile.mockResolvedValue(true);
      UserModel.getById.mockResolvedValue(updatedUser);

      const result = await UserService.updateProfile(123456789, { bio: 'New bio' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedUser);
    });

    it('should handle validation errors', async () => {
      sanitizeObject.mockReturnValue({});
      validateSchema.mockReturnValue({
        error: 'Validation failed',
        value: null,
      });

      const result = await UserService.updateProfile(123456789, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation failed');
    });

    it('should handle update failures', async () => {
      sanitizeObject.mockReturnValue({ bio: 'test' });
      validateSchema.mockReturnValue({
        error: null,
        value: { userId: 123456789, bio: 'test' },
      });
      UserModel.updateProfile.mockResolvedValue(false);

      const result = await UserService.updateProfile(123456789, { bio: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to update profile');
    });
  });

  describe('updateLocation', () => {
    it('should update location successfully', async () => {
      validateSchema.mockReturnValue({ error: null });
      UserModel.updateProfile.mockResolvedValue(true);

      const location = { lat: 40.7128, lng: -74.0060 };
      const result = await UserService.updateLocation(123456789, location);

      expect(result.success).toBe(true);
      expect(UserModel.updateProfile).toHaveBeenCalledWith(123456789, { location });
    });

    it('should handle validation errors', async () => {
      validateSchema.mockReturnValue({ error: 'Invalid coordinates' });

      const result = await UserService.updateLocation(123456789, { lat: 999, lng: 999 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid coordinates');
    });
  });

  describe('getNearbyUsers', () => {
    it('should get nearby users', async () => {
      const currentUser = {
        id: '123456789',
        location: { lat: 40.7128, lng: -74.0060 },
      };

      const nearbyUsers = [
        { id: '987654321', distance: 5, locationSharingEnabled: true },
        { id: '123456789', distance: 0, locationSharingEnabled: true },
      ];

      UserModel.getById.mockResolvedValue(currentUser);
      UserModel.getNearby.mockResolvedValue(nearbyUsers);

      const result = await UserService.getNearbyUsers(123456789, 10);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('987654321');
    });

    it('should return empty array when user has no location', async () => {
      UserModel.getById.mockResolvedValue({ id: '123456789' });

      const result = await UserService.getNearbyUsers(123456789);

      expect(result).toEqual([]);
    });

    it('should return empty array when user not found', async () => {
      UserModel.getById.mockResolvedValue(null);

      const result = await UserService.getNearbyUsers(123456789);

      expect(result).toEqual([]);
    });
  });

  describe('hasActiveSubscription', () => {
    it('should return true for active subscription', async () => {
      const user = {
        subscriptionStatus: 'active',
        planExpiry: new Date(Date.now() + 86400000), // tomorrow
      };

      UserModel.getById.mockResolvedValue(user);

      const result = await UserService.hasActiveSubscription(123456789);

      expect(result).toBe(true);
    });

    it('should return false for expired subscription', async () => {
      const user = {
        subscriptionStatus: 'active',
        planExpiry: new Date(Date.now() - 86400000), // yesterday
        planId: 'basic',
      };

      UserModel.getById.mockResolvedValue(user);
      UserModel.updateSubscription.mockResolvedValue(true);

      const result = await UserService.hasActiveSubscription(123456789);

      expect(result).toBe(false);
      expect(UserModel.updateSubscription).toHaveBeenCalled();
    });

    it('should return false when user not found', async () => {
      UserModel.getById.mockResolvedValue(null);

      const result = await UserService.hasActiveSubscription(123456789);

      expect(result).toBe(false);
    });

    it('should return false for non-active status', async () => {
      const user = {
        subscriptionStatus: 'free',
      };

      UserModel.getById.mockResolvedValue(user);

      const result = await UserService.hasActiveSubscription(123456789);

      expect(result).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('should return true for admin user', () => {
      process.env.ADMIN_USER_IDS = '123456789,987654321';

      const result = UserService.isAdmin(123456789);

      expect(result).toBe(true);
    });

    it('should return false for non-admin user', () => {
      process.env.ADMIN_USER_IDS = '987654321';

      const result = UserService.isAdmin(123456789);

      expect(result).toBe(false);
    });

    it('should return false when no admins configured', () => {
      delete process.env.ADMIN_USER_IDS;

      const result = UserService.isAdmin(123456789);

      expect(result).toBe(false);
    });
  });

  describe('getStatistics', () => {
    it('should return user statistics', async () => {
      const activeUsers = [{ id: '1' }, { id: '2' }];
      const freeUsers = [{ id: '3' }, { id: '4' }, { id: '5' }];

      UserModel.getBySubscriptionStatus
        .mockResolvedValueOnce(activeUsers)
        .mockResolvedValueOnce(freeUsers);

      const result = await UserService.getStatistics();

      expect(result.total).toBe(5);
      expect(result.active).toBe(2);
      expect(result.free).toBe(3);
      expect(result.conversionRate).toBe(40);
    });

    it('should handle errors', async () => {
      UserModel.getBySubscriptionStatus.mockRejectedValue(new Error('Query error'));

      const result = await UserService.getStatistics();

      expect(result.total).toBe(0);
      expect(result.active).toBe(0);
    });
  });

  describe('processExpiredSubscriptions', () => {
    it('should process expired subscriptions', async () => {
      const expiredUsers = [
        { id: '1', planId: 'basic', planExpiry: new Date() },
        { id: '2', planId: 'premium', planExpiry: new Date() },
      ];

      UserModel.getExpiredSubscriptions.mockResolvedValue(expiredUsers);
      UserModel.updateSubscription.mockResolvedValue(true);

      const result = await UserService.processExpiredSubscriptions();

      expect(result).toBe(2);
      expect(UserModel.updateSubscription).toHaveBeenCalledTimes(2);
    });

    it('should handle errors', async () => {
      UserModel.getExpiredSubscriptions.mockRejectedValue(new Error('Query error'));

      const result = await UserService.processExpiredSubscriptions();

      expect(result).toBe(0);
    });
  });
});
