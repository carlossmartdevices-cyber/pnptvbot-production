const { query } = require('../config/postgres');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

const COLLECTION = 'users';

/**
 * User Model - Handles all user data operations
 */
class UserModel {
  /**
   * Create or update user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created/updated user
   */
  static async createOrUpdate(userData) {
    try {
      const userId = userData.userId.toString();
      const timestamp = new Date();
      const data = {
        ...userData,
        first_name: userData.first_name ?? '',
        last_name: userData.last_name ?? '',
        onboardingComplete: typeof userData.onboardingComplete === 'boolean' ? userData.onboardingComplete : false,
        updatedAt: timestamp,
      };
      // Upsert user in PostgreSQL
      await query(`INSERT INTO users (id, username, first_name, last_name, email, role, privacy, profile_views, favorites, blocked, badges, subscription_status, plan_id, plan_expiry, language, created_at, updated_at, onboarding_complete)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (id) DO UPDATE SET username = $2, first_name = $3, last_name = $4, email = $5, role = $6, privacy = $7, profile_views = $8, favorites = $9, blocked = $10, badges = $11, subscription_status = $12, plan_id = $13, plan_expiry = $14, language = $15, updated_at = $17, onboarding_complete = $18`,
        [userId, data.username, data.first_name, data.last_name, data.email, data.role || 'user', JSON.stringify(data.privacy), data.profileViews || 0, data.favorites || [], data.blocked || [], data.badges || [], data.subscriptionStatus || 'free', data.planId, data.planExpiry, data.language || 'en', data.createdAt || timestamp, timestamp, data.onboardingComplete]
      );
      await cache.del(`user:${userId}`);
      logger.info('User created/updated', { userId, role: data.role });
      return data;
    } catch (error) {
      logger.error('Error creating/updating user:', error);
      throw error;
    }
  }

  /**
   * Get user by ID (with optimized caching)
   * @param {number|string} userId - Telegram user ID
   * @returns {Promise<Object|null>} User data or null
   */
  static async getById(userId) {
    try {
      const cacheKey = `user:${userId}`;
      return await cache.getOrSet(
        cacheKey,
        async () => {
          const result = await query('SELECT * FROM users WHERE id = $1', [userId.toString()]);
          if (result.rows.length === 0) {
            return null;
          }
          const userData = this.convertRowToCamelCase(result.rows[0]);
          // Ensure onboardingComplete is boolean
          userData.onboardingComplete = Boolean(userData.onboardingComplete);
          logger.debug(`Fetched user from PostgreSQL: ${userId}`);
          return userData;
        },
        600,
      );
    } catch (error) {
      logger.error('Error getting user:', error);
      return null;
    }
  }

  /**
   * Convert camelCase to snake_case
   * @param {string} str - String in camelCase
   * @returns {string} String in snake_case
   */
  static toSnakeCase(str) {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  /**
   * Convert snake_case to camelCase
   * @param {string} str - String in snake_case
   * @returns {string} String in camelCase
   */
  static toCamelCase(str) {
    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
  }

  /**
   * Convert database row from snake_case to camelCase
   * @param {Object} row - Database row with snake_case keys
   * @returns {Object} Object with camelCase keys
   */
  static convertRowToCamelCase(row) {
    if (!row) return row;
    const converted = {};
    for (const key in row) {
      if (row.hasOwnProperty(key)) {
        const camelKey = this.toCamelCase(key);
        converted[camelKey] = row[key];
      }
    }
    return converted;
  }

  /**
   * Update user profile
   * @param {number|string} userId - User ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<boolean>} Success status
   */
  static async updateProfile(userId, updates) {
    try {
      // Convert camelCase keys to snake_case for PostgreSQL
      const snakeCaseUpdates = {};
      Object.keys(updates).forEach((key) => {
        const snakeKey = this.toSnakeCase(key);
        snakeCaseUpdates[snakeKey] = updates[key];
      });

      const fields = Object.keys(snakeCaseUpdates);
      const values = Object.values(snakeCaseUpdates);
      const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
      values.push(new Date());
      await query(`UPDATE users SET ${setClause}, updated_at = $${fields.length + 1} WHERE id = $${fields.length + 2}`, [...values, userId.toString()]);
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
      await query(
        'UPDATE users SET subscription_status = $1, plan_id = $2, plan_expiry = $3, updated_at = $4 WHERE id = $5',
        [subscription.status, subscription.planId, subscription.expiry, new Date(), userId.toString()]
      );
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
   * Get nearby users (with optimized caching)
   * @param {Object} location - { lat, lng }
   * @param {number} radiusKm - Search radius in kilometers
   * @returns {Promise<Array>} Nearby users
   */
  static async getNearby(location, radiusKm = 10) {
    try {
      const lat = Math.round(location.lat * 100) / 100;
      const lng = Math.round(location.lng * 100) / 100;
      const cacheKey = `nearby:${lat},${lng}:${radiusKm}`;
      return await cache.getOrSet(
        cacheKey,
        async () => {
          const result = await query('SELECT * FROM users WHERE location IS NOT NULL AND subscription_status IN ($1, $2)', ['active', 'free']);
          const users = [];
          for (const userData of result.rows) {
            if (userData.location) {
              const distance = this.calculateDistance(
                location.lat,
                location.lng,
                userData.location.lat,
                userData.location.lng,
              );
              if (distance <= radiusKm) {
                users.push({ ...userData, distance });
              }
            }
          }
          users.sort((a, b) => a.distance - b.distance);
          logger.info(`Found ${users.length} nearby users within ${radiusKm}km`);
          return users;
        },
        300,
      );
    } catch (error) {
      logger.error('Error getting nearby users:', error);
      return [];
    }
  }

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
   * Get expired subscriptions
   * @returns {Promise<Array>} Users with expired subscriptions
   */
  static async getExpiredSubscriptions() {
    try {
      const now = new Date();
      const result = await query(
        'SELECT * FROM users WHERE subscription_status = $1 AND plan_expiry <= $2',
        ['active', now]
      );
      return result.rows.map(row => this.convertRowToCamelCase(row));
    } catch (error) {
      logger.error('Error getting expired subscriptions:', error);
      return [];
    }
  }

  /**
   * Get subscriptions expiring between two dates
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Users with subscriptions expiring in date range
   */
  static async getSubscriptionsExpiringBetween(startDate, endDate) {
    try {
      const result = await query(
        'SELECT * FROM users WHERE subscription_status = $1 AND plan_expiry >= $2 AND plan_expiry <= $3',
        ['active', startDate, endDate]
      );
      return result.rows.map(row => this.convertRowToCamelCase(row));
    } catch (error) {
      logger.error('Error getting subscriptions expiring between dates:', error);
      return [];
    }
  }

  /**
   * Get all users (with pagination)
   * @param {number} limit - Results per page
   * @param {string} startAfter - Last document ID
   * @returns {Promise<Object>} { users, lastDoc }
   */
  static async getAll(limit = 50, startAfter = null) {
    try {
      let sql = 'SELECT * FROM users ORDER BY created_at DESC LIMIT $1';
      let params = [limit];
      if (startAfter) {
        sql = 'SELECT * FROM users WHERE id > $2 ORDER BY created_at DESC LIMIT $1';
        params = [limit, startAfter];
      }
      const result = await query(sql, params);
      const users = result.rows;
      const lastDoc = users.length > 0 ? users[users.length - 1].id : null;
      return { users, lastDoc };
    } catch (error) {
      logger.error('Error getting all users:', error);
      return { users: [], lastDoc: null };
    }
  }

  /**
   * Get users by subscription status
   * @param {string} status - Subscription status
   * @returns {Promise<Array>} Users
   */
  static async getBySubscriptionStatus(status) {
    try {
      const result = await query(
        'SELECT * FROM users WHERE subscription_status = $1',
        [status]
      );
      return result.rows.map(row => this.convertRowToCamelCase(row));
    } catch (error) {
      logger.error('Error getting users by subscription status:', error);
      return [];
    }
  }

  /**
   * Update user role
   * @param {number|string} userId - User ID
  * @param {string} role - New role (superadmin, admin, moderator, user, influencer)
   * @param {number|string} assignedBy - Admin userId who assigned the role
   * @returns {Promise<boolean>} Success status
   */
  static async updateRole(userId, role, assignedBy) {
    try {
      // Only superadmin can assign influencer role
      if (role === 'influencer' && assignedBy) {
        const assignerResult = await query('SELECT role FROM users WHERE id = $1', [assignedBy.toString()]);
        if (assignerResult.rows.length === 0 || assignerResult.rows[0].role !== 'superadmin') {
          logger.warn('Only superadmin can assign influencer role');
          return false;
        }
      }

      await query(
        'UPDATE users SET role = $1, assigned_by = $2, role_assigned_at = $3, updated_at = $4 WHERE id = $5',
        [role, assignedBy ? assignedBy.toString() : null, new Date(), new Date(), userId.toString()]
      );

      // Invalidate cache
      await cache.del(`user:${userId}`);

      logger.info('User role updated', { userId, role, assignedBy });
      return true;
    } catch (error) {
      logger.error('Error updating user role:', error);
      return false;
    }
  }

  /**
   * Get users by role
   * @param {string} role - Role name
   * @returns {Promise<Array>} Users with specified role
   */
  static async getByRole(role) {
    try {
      const result = await query(
        'SELECT * FROM users WHERE role = $1',
        [role]
      );
      logger.info(`Found ${result.rows.length} users with role: ${role}`);
      return result.rows.map(row => this.convertRowToCamelCase(row));
    } catch (error) {
      logger.error('Error getting users by role:', error);
      return [];
    }
  }

  /**
   * Get all admin users (superadmin, admin, moderator)
   * @returns {Promise<Array>} Admin users
   */
  static async getAllAdmins() {
    try {
      const result = await query(
        'SELECT * FROM users WHERE role IN ($1, $2, $3)',
        ['superadmin', 'admin', 'moderator']
      );
      logger.info(`Found ${result.rows.length} admin users`);
      return result.rows.map(row => this.convertRowToCamelCase(row));
    } catch (error) {
      logger.error('Error getting admin users:', error);
      return [];
    }
  }

  /**
   * Get all active users (for broadcasts)
   * Returns users who have interacted with the bot
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} Active users with id and chatId
   */
  static async getAllActive(options = {}) {
    try {
      const {
        subscriptionFilter = null,
        minActivity = null,
        limit = null
      } = options;

      let sql = 'SELECT id, username, first_name FROM users WHERE id IS NOT NULL';
      const params = [];
      let paramIndex = 1;

      if (subscriptionFilter) {
        sql += ` AND subscription_status = $${paramIndex}`;
        params.push(subscriptionFilter);
        paramIndex++;
      }

      if (minActivity) {
        sql += ` AND last_active >= $${paramIndex}`;
        params.push(minActivity);
        paramIndex++;
      }

      sql += ' ORDER BY last_active DESC NULLS LAST';

      if (limit) {
        sql += ` LIMIT $${paramIndex}`;
        params.push(limit);
      }

      const result = await query(sql, params);
      logger.info(`Found ${result.rows.length} active users for broadcast`);

      return result.rows.map(row => ({
        id: row.id,
        chatId: row.id,
        username: row.username,
        firstName: row.first_name
      }));
    } catch (error) {
      logger.error('Error getting active users:', error);
      return [];
    }
  }

  /**
   * Delete user
   * @param {number|string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(userId) {
    try {
      await query(
        'DELETE FROM users WHERE id = $1',
        [userId.toString()]
      );

      // Invalidate cache
      await cache.del(`user:${userId}`);

      logger.info('User deleted', { userId });
      return true;
    } catch (error) {
      logger.error('Error deleting user:', error);
      return false;
    }
  }

  /**
   * Get statistics for dashboard
   * @returns {Promise<Object>} User statistics
   */
  static async getStatistics() {
    try {
      const cacheKey = 'stats:users';

      return await cache.getOrSet(
        cacheKey,
        async () => {
          // Get total users
          const totalResult = await query('SELECT COUNT(*) as count FROM users');
          const total = parseInt(totalResult.rows[0].count);

          // Get premium users
          const premiumResult = await query(
            "SELECT COUNT(*) as count FROM users WHERE subscription_status = 'active'"
          );
          const premium = parseInt(premiumResult.rows[0].count);

          const free = total - premium;
          const conversionRate = total > 0 ? (premium / total) * 100 : 0;

          const stats = {
            total,
            premium,
            free,
            conversionRate,
          };
          return stats;
        }
      );
    } catch (error) {
      logger.error('Error getting user statistics:', error);
      return { total: 0, premium: 0, free: 0, conversionRate: 0 };
    }
  }

  /**
   * Invalidate user cache
   * @param {number|string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async invalidateCache(userId) {
    try {
      await cache.del(`user:${userId}`);
      await cache.delPattern('nearby:*');
      await cache.del('stats:users');
      logger.info('User cache invalidated', { userId });
      return true;
    } catch (error) {
      logger.error('Error invalidating user cache:', error);
      return false;
    }
  }

  /**
   * Update user privacy settings
   * @param {number|string} userId - User ID
   * @param {Object} privacy - Privacy settings
   * @returns {Promise<boolean>} Success status
   */
  static async updatePrivacy(userId, privacy) {
    try {
      await query(
        'UPDATE users SET privacy = $1, updated_at = $2 WHERE id = $3',
        [JSON.stringify(privacy), new Date(), userId.toString()]
      );

      await cache.del(`user:${userId}`);

      logger.info('User privacy updated', { userId, privacy });
      return true;
    } catch (error) {
      logger.error('Error updating user privacy:', error);
      return false;
    }
  }

  /**
   * Increment profile views
   * @param {number|string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async incrementProfileViews(userId) {
    try {
      await query(
        'UPDATE users SET profile_views = profile_views + 1, updated_at = $1 WHERE id = $2',
        [new Date(), userId.toString()]
      );

      await cache.del(`user:${userId}`);

      logger.info('Profile views incremented', { userId });
      return true;
    } catch (error) {
      logger.error('Error incrementing profile views:', error);
      return false;
    }
  }

  /**
   * Add user to favorites
   * @param {number|string} userId - User ID
   * @param {number|string} targetUserId - Target user ID to favorite
   * @returns {Promise<boolean>} Success status
   */
  static async addToFavorites(userId, targetUserId) {
    try {
      // Use PostgreSQL array functions to add without duplicates
      await query(
        `UPDATE users
         SET favorites = array_append(favorites, $1), updated_at = $2
         WHERE id = $3 AND NOT ($1 = ANY(favorites))`,
        [targetUserId.toString(), new Date(), userId.toString()]
      );

      await cache.del(`user:${userId}`);
      logger.info('User added to favorites', { userId, targetUserId });
      return true;
    } catch (error) {
      logger.error('Error adding to favorites:', error);
      return false;
    }
  }

  /**
   * Remove user from favorites
   * @param {number|string} userId - User ID
   * @param {number|string} targetUserId - Target user ID to remove from favorites
   * @returns {Promise<boolean>} Success status
   */
  static async removeFromFavorites(userId, targetUserId) {
    try {
      await query(
        `UPDATE users
         SET favorites = array_remove(favorites, $1), updated_at = $2
         WHERE id = $3`,
        [targetUserId.toString(), new Date(), userId.toString()]
      );

      await cache.del(`user:${userId}`);
      logger.info('User removed from favorites', { userId, targetUserId });
      return true;
    } catch (error) {
      logger.error('Error removing from favorites:', error);
      return false;
    }
  }

  /**
   * Block user
   * @param {number|string} userId - User ID
   * @param {number|string} targetUserId - Target user ID to block
   * @returns {Promise<boolean>} Success status
   */
  static async blockUser(userId, targetUserId) {
    try {
      // Add to blocked and remove from favorites in one query
      await query(
        `UPDATE users
         SET blocked = array_append(blocked, $1),
             favorites = array_remove(favorites, $1),
             updated_at = $2
         WHERE id = $3 AND NOT ($1 = ANY(blocked))`,
        [targetUserId.toString(), new Date(), userId.toString()]
      );

      await cache.del(`user:${userId}`);
      logger.info('User blocked', { userId, targetUserId });
      return true;
    } catch (error) {
      logger.error('Error blocking user:', error);
      return false;
    }
  }

  /**
   * Unblock user
   * @param {number|string} userId - User ID
   * @param {number|string} targetUserId - Target user ID to unblock
   * @returns {Promise<boolean>} Success status
   */
  static async unblockUser(userId, targetUserId) {
    try {
      await query(
        `UPDATE users
         SET blocked = array_remove(blocked, $1), updated_at = $2
         WHERE id = $3`,
        [targetUserId.toString(), new Date(), userId.toString()]
      );

      await cache.del(`user:${userId}`);
      logger.info('User unblocked', { userId, targetUserId });
      return true;
    } catch (error) {
      logger.error('Error unblocking user:', error);
      return false;
    }
  }

  /**
   * Check if user is blocked
   * @param {number|string} userId - User ID
   * @param {number|string} targetUserId - Target user ID to check
   * @returns {Promise<boolean>} Blocked status
   */
  static async isBlocked(userId, targetUserId) {
    try {
      const user = await this.getById(userId);
      if (!user) return false;

      const blocked = user.blocked || [];
      return blocked.includes(targetUserId.toString());
    } catch (error) {
      logger.error('Error checking blocked status:', error);
      return false;
    }
  }

  /**
   * Get user favorites
   * @param {number|string} userId - User ID
   * @returns {Promise<Array>} Favorite users
   */
  static async getFavorites(userId) {
    try {
      const user = await this.getById(userId);
      if (!user || !user.favorites || user.favorites.length === 0) {
        return [];
      }

      // Get all favorite users in one query
      const result = await query(
        'SELECT * FROM users WHERE id = ANY($1::text[])',
        [user.favorites]
      );

      logger.info(`Retrieved ${result.rows.length} favorites for user ${userId}`);
      return result.rows;
    } catch (error) {
      logger.error('Error getting favorites:', error);
      return [];
    }
  }

  /**
   * Add badge to user
   * @param {number|string} userId - User ID
   * @param {string} badge - Badge name (verified, premium, vip, moderator, etc.)
   * @returns {Promise<boolean>} Success status
   */
  static async addBadge(userId, badge) {
    try {
      const result = await query('SELECT badges FROM users WHERE id = $1', [userId.toString()]);
      if (result.rows.length === 0) return false;
      const badges = result.rows[0].badges || [];
      // Only add if not already present (by name)
      if (!badges.some(b => b.name === badge.name)) {
        badges.push(badge);
        await query('UPDATE users SET badges = $1, updated_at = $2 WHERE id = $3', [JSON.stringify(badges), new Date(), userId.toString()]);
        await cache.del(`user:${userId}`);
        logger.info('Badge added to user', { userId, badge });
      }
      return true;
    } catch (error) {
      logger.error('Error adding badge:', error);
      return false;
    }
  }

  /**
   * Remove badge from user
   * @param {number|string} userId - User ID
   * @param {string} badgeName - Badge name to remove
   * @returns {Promise<boolean>} Success status
   */
  static async removeBadge(userId, badgeName) {
    try {
      // Get current badges
      const result = await query('SELECT badges FROM users WHERE id = $1', [userId.toString()]);
      if (result.rows.length === 0) return false;

      const badges = result.rows[0].badges || [];
      // Filter out the badge by name
      const updatedBadges = badges.filter(b => b.name !== badgeName);

      await query(
        'UPDATE users SET badges = $1, updated_at = $2 WHERE id = $3',
        [JSON.stringify(updatedBadges), new Date(), userId.toString()]
      );

      await cache.del(`user:${userId}`);
      logger.info('Badge removed from user', { userId, badgeName });
      return true;
    } catch (error) {
      logger.error('Error removing badge:', error);
      return false;
    }
  }

  /**
   * Get churned users (users who had premium but now are free)
   * Churned users are those with subscriptionStatus = 'free' who have payment history
   * @returns {Promise<Array>} Churned users
   */
  static async getChurnedUsers() {
    try {
      // Get free users who have successful payment history
      const result = await query(
        `SELECT DISTINCT u.*
         FROM users u
         INNER JOIN payments p ON u.id = p.user_id
         WHERE u.subscription_status = 'free'
         AND p.status = 'success'`
      );

      logger.info(`Found ${result.rows.length} churned users`);
      return result.rows;
    } catch (error) {
      logger.error('Error getting churned users:', error);
      return [];
    }
  }

  /**
   * Search users by username (partial match, case insensitive)
   * @param {string} username - Username to search (with or without @)
   * @returns {Promise<Array>} Matching users
   */
  static async searchByUsername(username) {
    try {
      // Remove @ if present
      const cleanUsername = username.replace(/^@/, '');

      // Search with ILIKE for case-insensitive partial match
      const result = await query(
        'SELECT * FROM users WHERE username ILIKE $1 ORDER BY username LIMIT 10',
        [`%${cleanUsername}%`]
      );

      logger.info(`Found ${result.rows.length} users matching username: ${cleanUsername}`);
      return result.rows;
    } catch (error) {
      logger.error('Error searching users by username:', error);
      return [];
    }
  }

  /**
   * Search users by ID, username, or first name
   * @param {string} query - Search query
   * @returns {Promise<Array>} Matching users
   */
  static async search(searchQuery) {
    try {
      const cleanQuery = searchQuery.trim().replace(/^@/, '');

      // Try to parse as ID first
      if (!Number.isNaN(parseInt(cleanQuery, 10))) {
        const user = await this.getById(cleanQuery);
        if (user) {
          return [user];
        }
      }

      // Search by username, name, or email
      const result = await query(
        `SELECT * FROM users
         WHERE username ILIKE $1
         OR first_name ILIKE $1
         OR last_name ILIKE $1
         OR email ILIKE $1
         OR CONCAT(first_name, ' ', last_name) ILIKE $1
         ORDER BY
           CASE
             WHEN email ILIKE $2 THEN 1
             WHEN username ILIKE $2 THEN 2
             WHEN first_name ILIKE $2 THEN 3
             ELSE 4
           END,
           username
         LIMIT 10`,
        [`%${cleanQuery}%`, `${cleanQuery}%`]
      );

      logger.info(`Found ${result.rows.length} users matching query: ${cleanQuery}`);
      return result.rows.map(row => this.convertRowToCamelCase(row));
    } catch (error) {
      logger.error('Error searching users:', error);
      return [];
    }
  }
}

module.exports = UserModel;
