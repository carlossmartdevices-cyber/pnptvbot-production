const { query } = require('../config/postgres');
const logger = require('../utils/logger');
const ACCESS_CONTROL_CONFIG = require('../config/accessControlConfig');

/**
 * Role Service
 * Manages user roles for access control
 */
class RoleService {
  /**
   * Get user's role
   * @param {string} userId - User ID
   * @returns {Promise<string>} Role name (USER, CONTRIBUTOR, PERFORMER, ADMIN)
   */
  static async getUserRole(userId) {
    try {
      const result = await query(
        'SELECT role FROM user_roles WHERE user_id = $1',
        [userId.toString()]
      );

      if (result.rows.length === 0) {
        return 'USER'; // Default role
      }

      return result.rows[0].role;
    } catch (error) {
      logger.error('Error getting user role:', error);
      return 'USER'; // Default on error
    }
  }

  /**
   * Get user's role level (numeric value for comparison)
   * @param {string} userId - User ID
   * @returns {Promise<number>} Role level
   */
  static async getUserRoleLevel(userId) {
    const role = await this.getUserRole(userId);
    return ACCESS_CONTROL_CONFIG.ROLES[role] || ACCESS_CONTROL_CONFIG.ROLES.USER;
  }

  /**
   * Set user's role
   * @param {string} userId - User ID
   * @param {string} role - Role name (USER, CONTRIBUTOR, PERFORMER, ADMIN)
   * @param {string} grantedBy - Admin who granted the role
   * @returns {Promise<boolean>} Success status
   */
  static async setUserRole(userId, role, grantedBy) {
    try {
      // Validate role
      if (!ACCESS_CONTROL_CONFIG.ROLES[role]) {
        logger.error('Invalid role:', role);
        return false;
      }

      // Upsert role
      await query(
        `INSERT INTO user_roles (user_id, role, granted_by, granted_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET role = $2, granted_by = $3, granted_at = NOW()`,
        [userId.toString(), role, grantedBy.toString()]
      );

      logger.info('User role updated', { userId, role, grantedBy });
      return true;
    } catch (error) {
      logger.error('Error setting user role:', error);
      return false;
    }
  }

  /**
   * Check if user has required role
   * @param {string} userId - User ID
   * @param {string} requiredRole - Required role name
   * @returns {Promise<boolean>} Has permission
   */
  static async hasRole(userId, requiredRole) {
    const userRoleLevel = await this.getUserRoleLevel(userId);
    const requiredLevel = ACCESS_CONTROL_CONFIG.ROLES[requiredRole] || 0;

    return userRoleLevel >= requiredLevel;
  }

  /**
   * Check if user has any of the required roles
   * @param {string} userId - User ID
   * @param {Array<string>} requiredRoles - Array of role names
   * @returns {Promise<boolean>} Has permission
   */
  static async hasAnyRole(userId, requiredRoles) {
    const userRoleLevel = await this.getUserRoleLevel(userId);

    for (const roleName of requiredRoles) {
      const requiredLevel = ACCESS_CONTROL_CONFIG.ROLES[roleName] || 0;
      if (userRoleLevel >= requiredLevel) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all users with a specific role
   * @param {string} role - Role name
   * @returns {Promise<Array>} Array of user IDs
   */
  static async getUsersByRole(role) {
    try {
      const result = await query(
        'SELECT user_id FROM user_roles WHERE role = $1',
        [role]
      );

      return result.rows.map(row => row.user_id);
    } catch (error) {
      logger.error('Error getting users by role:', error);
      return [];
    }
  }

  /**
   * Get all admins
   * @returns {Promise<Array>} Array of admin user IDs
   */
  static async getAdmins() {
    return await this.getUsersByRole('ADMIN');
  }

  /**
   * Check if user is admin
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Is admin
   */
  static async isAdmin(userId) {
    return await this.hasRole(userId, 'ADMIN');
  }

  /**
   * Remove role from user (reset to USER)
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async removeRole(userId) {
    try {
      await query(
        'DELETE FROM user_roles WHERE user_id = $1',
        [userId.toString()]
      );

      logger.info('User role removed', { userId });
      return true;
    } catch (error) {
      logger.error('Error removing user role:', error);
      return false;
    }
  }

  /**
   * Get role statistics
   * @returns {Promise<Object>} Role counts
   */
  static async getRoleStats() {
    try {
      const result = await query(
        'SELECT role, COUNT(*) as count FROM user_roles GROUP BY role'
      );

      const stats = {
        USER: 0,
        CONTRIBUTOR: 0,
        PERFORMER: 0,
        ADMIN: 0,
      };

      result.rows.forEach(row => {
        stats[row.role] = parseInt(row.count);
      });

      return stats;
    } catch (error) {
      logger.error('Error getting role stats:', error);
      return null;
    }
  }

  /**
   * Initialize database tables
   */
  static async initializeTables() {
    try {
      // Create user_roles table
      await query(`
        CREATE TABLE IF NOT EXISTS user_roles (
          user_id VARCHAR(255) PRIMARY KEY,
          role VARCHAR(50) NOT NULL,
          granted_by VARCHAR(255),
          granted_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create indexes
      await query('CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role)');
      await query('CREATE INDEX IF NOT EXISTS idx_user_roles_granted_at ON user_roles(granted_at)');

      logger.info('Role service tables initialized');
    } catch (error) {
      logger.error('Error initializing role tables:', error);
      throw error;
    }
  }
}

module.exports = RoleService;
