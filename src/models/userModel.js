const { query } = require('../config/postgres');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

const TABLE = 'users';

/**
 * User Model - Handles all user data operations with PostgreSQL
 */
class UserModel {
  /**
   * Map database row to user object
   */
  static mapRowToUser(row) {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.id,
      username: row.username,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      emailVerified: row.email_verified,
      bio: row.bio,
      photoFileId: row.photo_file_id,
      photoUpdatedAt: row.photo_updated_at,
      interests: row.interests || [],
      location: row.location_lat && row.location_lng ? {
        lat: parseFloat(row.location_lat),
        lng: parseFloat(row.location_lng),
        name: row.location_name,
        geohash: row.location_geohash,
      } : null,
      locationUpdatedAt: row.location_updated_at,
      subscriptionStatus: row.subscription_status,
      planId: row.plan_id,
      planExpiry: row.plan_expiry,
      tier: row.tier,
      role: row.role,
      assignedBy: row.assigned_by,
      roleAssignedAt: row.role_assigned_at,
      privacy: row.privacy || { showLocation: true, showInterests: true, showBio: true, allowMessages: true, showOnline: true },
      profileViews: row.profile_views || 0,
      xp: row.xp || 0,
      favorites: row.favorites || [],
      blocked: row.blocked || [],
      badges: row.badges || [],
      onboardingComplete: row.onboarding_complete,
      ageVerified: row.age_verified,
      ageVerifiedAt: row.age_verified_at,
      ageVerificationExpiresAt: row.age_verification_expires_at,
      ageVerificationIntervalHours: row.age_verification_interval_hours,
      termsAccepted: row.terms_accepted,
      privacyAccepted: row.privacy_accepted,
      lastActive: row.last_active,
      lastActivityInGroup: row.last_activity_in_group,
      groupActivityLog: row.group_activity_log,
      timezone: row.timezone,
      timezoneDetected: row.timezone_detected,
      timezoneUpdatedAt: row.timezone_updated_at,
      language: row.language,
      isActive: row.is_active,
      deactivatedAt: row.deactivated_at,
      deactivationReason: row.deactivation_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Create or update user
   */
  static async createOrUpdate(userData) {
    try {
      const userId = userData.userId.toString();
      const sql = `
        INSERT INTO ${TABLE} (
          id, username, first_name, last_name, email, bio, photo_file_id,
          interests, location_lat, location_lng, location_name, location_geohash,
          subscription_status, plan_id, plan_expiry, tier, role, privacy,
          profile_views, xp, favorites, blocked, badges, onboarding_complete,
          age_verified, terms_accepted, privacy_accepted, language, is_active,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          username = COALESCE(EXCLUDED.username, ${TABLE}.username),
          first_name = COALESCE(EXCLUDED.first_name, ${TABLE}.first_name),
          last_name = COALESCE(EXCLUDED.last_name, ${TABLE}.last_name),
          updated_at = NOW()
        RETURNING *
      `;

      const location = userData.location || {};
      const privacy = userData.privacy || { showLocation: true, showInterests: true, showBio: true, allowMessages: true, showOnline: true };

      const result = await query(sql, [
        userId,
        userData.username || null,
        userData.firstName || userData.first_name || 'User',
        userData.lastName || userData.last_name || null,
        userData.email || null,
        userData.bio || null,
        userData.photoFileId || null,
        userData.interests || [],
        location.lat || null,
        location.lng || null,
        location.name || null,
        location.geohash || null,
        userData.subscriptionStatus || 'free',
        userData.planId || null,
        userData.planExpiry || null,
        userData.tier || 'free',
        userData.role || 'user',
        JSON.stringify(privacy),
        userData.profileViews || 0,
        userData.xp || 0,
        userData.favorites || [],
        userData.blocked || [],
        userData.badges || [],
        userData.onboardingComplete || false,
        userData.ageVerified || false,
        userData.termsAccepted || false,
        userData.privacyAccepted || false,
        userData.language || 'en',
        userData.isActive !== false,
      ]);

      await cache.del(`user:${userId}`);
      logger.info('User created/updated', { userId, role: userData.role || 'user' });
      return this.mapRowToUser(result.rows[0]);
    } catch (error) {
      logger.error('Error creating/updating user:', error);
      throw error;
    }
  }

  /**
   * Get user by ID (with optimized caching)
   */
  static async getById(userId) {
    try {
      const cacheKey = `user:${userId}`;

      if (cache.getOrSet && typeof cache.getOrSet === 'function') {
        const maybeCached = await cache.getOrSet(
          cacheKey,
          async () => {
            const result = await query(`SELECT * FROM ${TABLE} WHERE id = $1`, [userId.toString()]);
            if (result.rows.length === 0) return null;
            const userData = this.mapRowToUser(result.rows[0]);
            logger.debug(`Fetched user from database: ${userId}`);
            return userData;
          },
          600,
        );
        if (maybeCached !== undefined) return maybeCached;
      }

      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      const result = await query(`SELECT * FROM ${TABLE} WHERE id = $1`, [userId.toString()]);
      if (result.rows.length === 0) return null;

      const userData = this.mapRowToUser(result.rows[0]);
      if (cache.set) await cache.set(cacheKey, userData, 600);
      return userData;
    } catch (error) {
      logger.error('Error getting user:', error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId, updates) {
    try {
      const setClauses = ['updated_at = NOW()'];
      const values = [userId.toString()];
      let paramIndex = 2;

      const fieldMap = {
        username: 'username',
        firstName: 'first_name',
        lastName: 'last_name',
        email: 'email',
        bio: 'bio',
        photoFileId: 'photo_file_id',
        interests: 'interests',
        onboardingComplete: 'onboarding_complete',
        ageVerified: 'age_verified',
        termsAccepted: 'terms_accepted',
        privacyAccepted: 'privacy_accepted',
        language: 'language',
      };

      for (const [key, col] of Object.entries(fieldMap)) {
        if (updates[key] !== undefined) {
          setClauses.push(`${col} = $${paramIndex++}`);
          values.push(updates[key]);
        }
      }

      if (updates.location) {
        setClauses.push(`location_lat = $${paramIndex++}`);
        values.push(updates.location.lat);
        setClauses.push(`location_lng = $${paramIndex++}`);
        values.push(updates.location.lng);
        setClauses.push(`location_name = $${paramIndex++}`);
        values.push(updates.location.name || null);
        setClauses.push(`location_geohash = $${paramIndex++}`);
        values.push(updates.location.geohash || null);
        setClauses.push(`location_updated_at = NOW()`);
      }

      await query(`UPDATE ${TABLE} SET ${setClauses.join(', ')} WHERE id = $1`, values);
      await cache.del(`user:${userId}`);
      logger.info('User profile updated', { userId });
      return true;
    } catch (error) {
      logger.error('Error updating user profile:', error);
      return false;
    }
  }

  /**
   * Update user subscription
   */
  static async updateSubscription(userId, subscription) {
    try {
      await query(
        `UPDATE ${TABLE} SET subscription_status = $2, plan_id = $3, plan_expiry = $4, updated_at = NOW() WHERE id = $1`,
        [userId.toString(), subscription.status, subscription.planId, subscription.expiry]
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
   */
  static async getNearby(location, radiusKm = 10) {
    try {
      const lat = Math.round(location.lat * 100) / 100;
      const lng = Math.round(location.lng * 100) / 100;
      const cacheKey = `nearby:${lat},${lng}:${radiusKm}`;

      const fetchNearby = async () => {
        const result = await query(
          `SELECT * FROM ${TABLE} WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL
           AND subscription_status IN ('active', 'free') AND is_active = true LIMIT 100`
        );

        const users = [];
        for (const row of result.rows) {
          const userData = this.mapRowToUser(row);
          if (userData.location) {
            const distance = this.calculateDistance(location.lat, location.lng, userData.location.lat, userData.location.lng);
            if (distance <= radiusKm) {
              users.push({ ...userData, distance });
            }
          }
        }
        users.sort((a, b) => a.distance - b.distance);
        logger.info(`Found ${users.length} nearby users within ${radiusKm}km`);
        return users;
      };

      if (cache.getOrSet && typeof cache.getOrSet === 'function') {
        const maybeCached = await cache.getOrSet(cacheKey, fetchNearby, 300);
        if (maybeCached !== undefined) return maybeCached;
      }

      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      const users = await fetchNearby();
      if (cache.set) await cache.set(cacheKey, users, 300);
      return users;
    } catch (error) {
      logger.error('Error getting nearby users:', error);
      return [];
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static toRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Get expired subscriptions
   */
  static async getExpiredSubscriptions() {
    try {
      const result = await query(
        `SELECT * FROM ${TABLE} WHERE subscription_status = 'active' AND plan_expiry <= NOW()`
      );
      return result.rows.map((row) => this.mapRowToUser(row));
    } catch (error) {
      logger.error('Error getting expired subscriptions:', error);
      return [];
    }
  }

  /**
   * Get all users (with pagination)
   */
  static async getAll(limit = 50, startAfter = null) {
    try {
      let sql = `SELECT * FROM ${TABLE} ORDER BY created_at DESC LIMIT $1`;
      const values = [limit];

      if (startAfter) {
        sql = `SELECT * FROM ${TABLE} WHERE created_at < (SELECT created_at FROM ${TABLE} WHERE id = $2) ORDER BY created_at DESC LIMIT $1`;
        values.push(startAfter);
      }

      const result = await query(sql, values);
      const users = result.rows.map((row) => this.mapRowToUser(row));
      const lastDoc = users.length > 0 ? users[users.length - 1].id : null;

      return { users, lastDoc };
    } catch (error) {
      logger.error('Error getting all users:', error);
      return { users: [], lastDoc: null };
    }
  }

  /**
   * Get users by subscription status
   */
  static async getBySubscriptionStatus(status) {
    try {
      const result = await query(`SELECT * FROM ${TABLE} WHERE subscription_status = $1`, [status]);
      return result.rows.map((row) => this.mapRowToUser(row));
    } catch (error) {
      logger.error('Error getting users by subscription status:', error);
      return [];
    }
  }

  /**
   * Update user role
   */
  static async updateRole(userId, role, assignedBy) {
    try {
      await query(
        `UPDATE ${TABLE} SET role = $2, assigned_by = $3, role_assigned_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [userId.toString(), role, assignedBy ? assignedBy.toString() : null]
      );
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
   */
  static async getByRole(role) {
    try {
      const result = await query(`SELECT * FROM ${TABLE} WHERE role = $1`, [role]);
      const users = result.rows.map((row) => this.mapRowToUser(row));
      logger.info(`Found ${users.length} users with role: ${role}`);
      return users;
    } catch (error) {
      logger.error('Error getting users by role:', error);
      return [];
    }
  }

  /**
   * Get all admin users
   */
  static async getAllAdmins() {
    try {
      const result = await query(`SELECT * FROM ${TABLE} WHERE role IN ('superadmin', 'admin', 'moderator')`);
      logger.info(`Found ${admins.length} admin users`);
      return admins;
    } catch (error) {
      logger.error('Error getting admin users:', error);
      return [];
    }
  }

  /**
   * Delete user
   */
  static async delete(userId) {
    try {
      await query(`DELETE FROM ${TABLE} WHERE id = $1`, [userId.toString()]);
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
   */
  static async getStatistics() {
    try {
      const cacheKey = 'stats:users';

      const fetchStats = async () => {
        const result = await query(`
          SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE subscription_status = 'active') as premium
          FROM ${TABLE}
        `);
        const row = result.rows[0];
        const total = parseInt(row.total) || 0;
        const premium = parseInt(row.premium) || 0;
        const free = total - premium;
        const conversionRate = total > 0 ? Math.round((premium / total) * 10000) / 100 : 0;

        const stats = { total, premium, free, conversionRate, timestamp: new Date().toISOString() };
        logger.info('User statistics calculated', stats);
        return stats;
      };

      if (cache.getOrSet && typeof cache.getOrSet === 'function') {
        return await cache.getOrSet(cacheKey, fetchStats, 60);
      }

      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      const stats = await fetchStats();
      if (cache.set) await cache.set(cacheKey, stats, 60);
      return stats;
    } catch (error) {
      logger.error('Error getting user statistics:', error);
      return { total: 0, premium: 0, free: 0, conversionRate: 0 };
    }
  }

  /**
   * Invalidate user cache
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
   */
  static async updatePrivacy(userId, privacy) {
    try {
      await query(`UPDATE ${TABLE} SET privacy = $2, updated_at = NOW() WHERE id = $1`, [userId.toString(), JSON.stringify(privacy)]);
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
   */
  static async incrementProfileViews(userId) {
    try {
      await query(`UPDATE ${TABLE} SET profile_views = profile_views + 1, updated_at = NOW() WHERE id = $1`, [userId.toString()]);
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
   */
  static async addToFavorites(userId, targetUserId) {
    try {
      await query(
        `UPDATE ${TABLE} SET favorites = array_append(favorites, $2), updated_at = NOW() WHERE id = $1 AND NOT ($2 = ANY(favorites))`,
        [userId.toString(), targetUserId.toString()]
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
   */
  static async removeFromFavorites(userId, targetUserId) {
    try {
      await query(
        `UPDATE ${TABLE} SET favorites = array_remove(favorites, $2), updated_at = NOW() WHERE id = $1`,
        [userId.toString(), targetUserId.toString()]
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
   */
  static async blockUser(userId, targetUserId) {
    try {
      await query(
        `UPDATE ${TABLE} SET
          blocked = array_append(blocked, $2),
          favorites = array_remove(favorites, $2),
          updated_at = NOW()
        WHERE id = $1 AND NOT ($2 = ANY(blocked))`,
        [userId.toString(), targetUserId.toString()]
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
   */
  static async unblockUser(userId, targetUserId) {
    try {
      await query(
        `UPDATE ${TABLE} SET blocked = array_remove(blocked, $2), updated_at = NOW() WHERE id = $1`,
        [userId.toString(), targetUserId.toString()]
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
   */
  static async getFavorites(userId) {
    try {
      const user = await this.getById(userId);
      if (!user || !user.favorites || user.favorites.length === 0) return [];

      const result = await query(`SELECT * FROM ${TABLE} WHERE id = ANY($1)`, [user.favorites]);
      const favorites = result.rows.map((row) => this.mapRowToUser(row));
      logger.info(`Retrieved ${favorites.length} favorites for user ${userId}`);
      return favorites;
    } catch (error) {
      logger.error('Error getting favorites:', error);
      return [];
    }
  }

  /**
   * Add badge to user
   */
  static async addBadge(userId, badge) {
    try {
      await query(
        `UPDATE ${TABLE} SET badges = array_append(badges, $2), updated_at = NOW() WHERE id = $1 AND NOT ($2 = ANY(badges))`,
        [userId.toString(), badge]
      );
      await cache.del(`user:${userId}`);
      logger.info('Badge added to user', { userId, badge });
      return true;
    } catch (error) {
      logger.error('Error adding badge:', error);
      return false;
    }
  }

  /**
   * Remove badge from user
   */
  static async removeBadge(userId, badge) {
    try {
      await query(`UPDATE ${TABLE} SET badges = array_remove(badges, $2), updated_at = NOW() WHERE id = $1`, [userId.toString(), badge]);
      await cache.del(`user:${userId}`);
      logger.info('Badge removed from user', { userId, badge });
      return true;
    } catch (error) {
      logger.error('Error removing badge:', error);
      return false;
    }
  }

  /**
   * Get churned users
   */
  static async getChurnedUsers() {
    try {
      const result = await query(`
        SELECT u.* FROM ${TABLE} u
        INNER JOIN payments p ON p.user_id = u.id AND p.status = 'success'
        WHERE u.subscription_status = 'free'
        GROUP BY u.id
      `);
      const churnedUsers = result.rows.map((row) => this.mapRowToUser(row));
      logger.info(`Found ${churnedUsers.length} churned users`);
      return churnedUsers;
    } catch (error) {
      logger.error('Error getting churned users:', error);
      return [];
    }
  }

  /**
   * Get users with incomplete onboarding
   */
  static async getIncompleteOnboarding() {
    try {
      const result = await query(
        `SELECT * FROM ${TABLE} WHERE onboarding_complete = false ORDER BY created_at ASC`
      );
      return result.rows.map((row) => this.mapRowToUser(row));
    } catch (error) {
      logger.error('Error getting incomplete onboarding users:', error);
      return [];
    }
  }

  /**
   * Get subscriptions expiring between two dates
   */
  static async getSubscriptionsExpiringBetween(startDate, endDate) {
    try {
      const result = await query(
        `SELECT * FROM ${TABLE} WHERE subscription_status = 'active' AND plan_expiry >= $1 AND plan_expiry <= $2 ORDER BY plan_expiry ASC`,
        [startDate.toISOString(), endDate.toISOString()]
      );
      return result.rows.map((row) => this.mapRowToUser(row));
    } catch (error) {
      logger.error('Error getting subscriptions expiring between dates:', error);
      return [];
    }
  }
}

module.exports = UserModel;
