const { DataTypes, Model, Op } = require('sequelize');
const { getDatabase } = require('../config/database');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * User Model - PostgreSQL/Sequelize implementation
 */
class User extends Model {
  /**
   * Calculate distance between two coordinates (Haversine formula)
   * @param {number} lat1 - Latitude 1
   * @param {number} lon1 - Longitude 1
   * @param {number} lat2 - Latitude 2
   * @param {number} lon2 - Longitude 2
   * @returns {number} Distance in kilometers
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2))
      * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   * @param {number} deg - Degrees
   * @returns {number} Radians
   */
  static toRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Create or update user
   * @param {Object} userData - User data
   * @returns {Promise<User>} User instance
   */
  static async createOrUpdate(userData) {
    try {
      const userId = userData.userId.toString();

      const [user] = await this.upsert({
        id: userId,
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        language: userData.language || 'en',
        bio: userData.bio,
        photoFileId: userData.photoFileId,
        location: userData.location,
        interests: userData.interests,
        subscriptionStatus: userData.subscriptionStatus || 'free',
        planId: userData.planId,
        planExpiry: userData.planExpiry,
        onboardingComplete: userData.onboardingComplete || false,
      });

      // Invalidate cache
      await cache.del(`user:${userId}`);

      logger.info('User created/updated', { userId });
      return user.toJSON();
    } catch (error) {
      logger.error('Error creating/updating user:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   * @param {number|string} userId - User ID
   * @returns {Promise<Object|null>} User data or null
   */
  static async getById(userId) {
    try {
      const cacheKey = `user:${userId}`;
      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      const user = await this.findByPk(userId.toString());

      if (user) {
        const userData = user.toJSON();
        await cache.set(cacheKey, userData, 600); // Cache for 10 minutes
        return userData;
      }

      return null;
    } catch (error) {
      logger.error('Error getting user:', error);
      return null;
    }
  }

  /**
   * Update user profile
   * @param {number|string} userId - User ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<boolean>} Success status
   */
  static async updateProfile(userId, updates) {
    try {
      await this.update(updates, {
        where: { id: userId.toString() },
      });

      // Invalidate cache
      await cache.del(`user:${userId}`);

      logger.info('User profile updated', { userId, updates });
      return true;
    } catch (error) {
      logger.error('Error updating user profile:', error);
      return false;
    }
  }

  /**
   * Update user subscription
   * @param {number|string} userId - User ID
   * @param {Object} subscription - Subscription data
   * @returns {Promise<boolean>} Success status
   */
  static async updateSubscription(userId, subscription) {
    try {
      await this.update({
        subscriptionStatus: subscription.status,
        planId: subscription.planId,
        planExpiry: subscription.expiry,
      }, {
        where: { id: userId.toString() },
      });

      // Invalidate cache
      await cache.del(`user:${userId}`);
      await cache.delPattern('nearby:*');

      logger.info('User subscription updated', { userId, subscription });
      return true;
    } catch (error) {
      logger.error('Error updating subscription:', error);
      return false;
    }
  }

  /**
   * Get nearby users
   * @param {Object} location - { lat, lng }
   * @param {number} radiusKm - Search radius in kilometers
   * @returns {Promise<Array>} Nearby users
   */
  static async getNearby(location, radiusKm = 10) {
    try {
      const cacheKey = `nearby:${location.lat},${location.lng}:${radiusKm}`;
      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      // Get all users with location
      const users = await this.findAll({
        where: {
          location: {
            [Op.ne]: null,
          },
          subscriptionStatus: {
            [Op.in]: ['active', 'free'],
          },
        },
        limit: 100,
      });

      // Filter by distance
      const nearbyUsers = [];
      users.forEach((user) => {
        const userData = user.toJSON();
        if (userData.location && userData.location.lat && userData.location.lng) {
          const distance = this.calculateDistance(
            location.lat,
            location.lng,
            userData.location.lat,
            userData.location.lng,
          );
          if (distance <= radiusKm) {
            nearbyUsers.push({ ...userData, distance });
          }
        }
      });

      // Sort by distance
      nearbyUsers.sort((a, b) => a.distance - b.distance);

      await cache.set(cacheKey, nearbyUsers, 300); // Cache for 5 minutes

      return nearbyUsers;
    } catch (error) {
      logger.error('Error getting nearby users:', error);
      return [];
    }
  }

  /**
   * Get expired subscriptions
   * @returns {Promise<Array>} Users with expired subscriptions
   */
  static async getExpiredSubscriptions() {
    try {
      const users = await this.findAll({
        where: {
          subscriptionStatus: 'active',
          planExpiry: {
            [Op.lte]: new Date(),
          },
        },
      });

      return users.map((user) => user.toJSON());
    } catch (error) {
      logger.error('Error getting expired subscriptions:', error);
      return [];
    }
  }

  /**
   * Get all users with pagination
   * @param {number} limit - Results per page
   * @param {number} offset - Offset for pagination
   * @returns {Promise<Object>} { users, total, lastDoc }
   */
  static async getAll(limit = 50, offset = 0) {
    try {
      const { rows, count } = await this.findAndCountAll({
        limit,
        offset,
        order: [['createdAt', 'DESC']],
      });

      return {
        users: rows.map((user) => user.toJSON()),
        total: count,
        lastDoc: offset + limit < count ? offset + limit : null,
      };
    } catch (error) {
      logger.error('Error getting all users:', error);
      return { users: [], total: 0, lastDoc: null };
    }
  }

  /**
   * Get users by subscription status
   * @param {string} status - Subscription status
   * @returns {Promise<Array>} Users
   */
  static async getBySubscriptionStatus(status) {
    try {
      const users = await this.findAll({
        where: { subscriptionStatus: status },
      });

      return users.map((user) => user.toJSON());
    } catch (error) {
      logger.error('Error getting users by subscription status:', error);
      return [];
    }
  }

  /**
   * Delete user
   * @param {number|string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteUser(userId) {
    try {
      await this.destroy({
        where: { id: userId.toString() },
      });

      // Invalidate cache
      await cache.del(`user:${userId}`);

      logger.info('User deleted', { userId });
      return true;
    } catch (error) {
      logger.error('Error deleting user:', error);
      return false;
    }
  }
}

/**
 * Initialize User model
 * @param {Sequelize} sequelize - Sequelize instance
 * @returns {User} User model
 */
const initUserModel = (sequelize) => {
  User.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        allowNull: false,
      },
      username: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      firstName: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'first_name',
      },
      lastName: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'last_name',
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
      },
      language: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'en',
      },
      bio: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      photoFileId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'photo_file_id',
      },
      location: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      interests: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
      },
      subscriptionStatus: {
        type: DataTypes.ENUM('free', 'active', 'expired', 'deactivated'),
        allowNull: false,
        defaultValue: 'free',
        field: 'subscription_status',
      },
      planId: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'plan_id',
      },
      planExpiry: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'plan_expiry',
      },
      onboardingComplete: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'onboarding_complete',
      },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      timestamps: true,
      underscored: true,
    },
  );

  return User;
};

// Auto-initialize if database is available
try {
  const sequelize = getDatabase();
  initUserModel(sequelize);
} catch (error) {
  logger.warn('User model not initialized yet');
}

module.exports = User;
module.exports.initUserModel = initUserModel;
