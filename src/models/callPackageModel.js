const { query } = require('../config/postgres');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Call Package Model - Manages call packages (bulk pricing)
 * Migrated from Firestore to PostgreSQL
 * Tables: call_packages_catalog, user_call_packages
 */
class CallPackageModel {
  /**
   * Get all available packages from catalog
   * @returns {Promise<Array>} Available packages
   */
  static async getAvailablePackages() {
    try {
      const result = await query(
        `SELECT
          id,
          display_name as name,
          calls,
          price_cents as price,
          price_per_call_cents as "pricePerCall",
          savings_cents as savings,
          savings_percent as "savingsPercent",
          popular,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM call_packages_catalog
        ORDER BY calls ASC`,
        []
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting available packages:', error);
      // Return fallback hardcoded packages if database fails
      return [
        {
          id: 'single_call',
          name: 'Single Call',
          calls: 1,
          price: 100,
          pricePerCall: 100,
          savings: 0,
          savingsPercent: 0,
          popular: false,
        },
        {
          id: '3_call_package',
          name: '3-Call Package',
          calls: 3,
          price: 270,
          pricePerCall: 90,
          savings: 30,
          savingsPercent: 10,
          popular: false,
        },
        {
          id: '5_call_package',
          name: '5-Call Package',
          calls: 5,
          price: 425,
          pricePerCall: 85,
          savings: 75,
          savingsPercent: 15,
          popular: true,
        },
        {
          id: '10_call_package',
          name: '10-Call Package',
          calls: 10,
          price: 800,
          pricePerCall: 80,
          savings: 200,
          savingsPercent: 20,
          popular: false,
        },
      ];
    }
  }

  /**
   * Get package by ID from catalog
   * @param {string} packageId - Package ID
   * @returns {Promise<Object|null>} Package data
   */
  static async getById(packageId) {
    try {
      const result = await query(
        `SELECT
          id,
          display_name as name,
          calls,
          price_cents as price,
          price_per_call_cents as "pricePerCall",
          savings_cents as savings,
          savings_percent as "savingsPercent",
          popular,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM call_packages_catalog
        WHERE id = $1`,
        [packageId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting package by ID:', error);
      return null;
    }
  }

  /**
   * Purchase a package
   * @param {Object} purchaseData - { userId, packageId, paymentId }
   * @returns {Promise<Object>} Purchased package
   */
  static async purchase(purchaseData) {
    try {
      const packageId = uuidv4();
      const pkg = await this.getById(purchaseData.packageId);

      if (!pkg) {
        throw new Error('Package not found');
      }

      const purchasedAt = new Date();
      const expiresAt = this.calculateExpiryDate(pkg.calls);
      const timestamp = new Date();

      const result = await query(
        `INSERT INTO user_call_packages (
          id,
          user_id,
          package_id,
          package_name,
          total_calls,
          remaining_calls,
          used_calls,
          price_cents,
          payment_id,
          purchased_at,
          expires_at,
          active,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING
          id,
          user_id as "userId",
          package_id as "packageId",
          package_name as "packageName",
          total_calls as "totalCalls",
          remaining_calls as "remainingCalls",
          used_calls as "usedCalls",
          price_cents as price,
          payment_id as "paymentId",
          purchased_at as "purchasedAt",
          expires_at as "expiresAt",
          active,
          last_used_at as "lastUsedAt",
          last_used_call_id as "lastUsedCallId",
          created_at as "createdAt",
          updated_at as "updatedAt"`,
        [
          packageId,
          purchaseData.userId.toString(),
          purchaseData.packageId,
          pkg.name,
          pkg.calls,
          pkg.calls,
          0,
          pkg.price,
          purchaseData.paymentId,
          purchasedAt,
          expiresAt,
          true,
          timestamp,
          timestamp
        ]
      );

      logger.info('Call package purchased', {
        packageId,
        userId: purchaseData.userId,
        package: purchaseData.packageId,
        calls: pkg.calls,
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Error purchasing call package:', error);
      throw error;
    }
  }

  /**
   * Calculate package expiry date
   * @param {number} calls - Number of calls in package
   * @returns {Date} Expiry date
   */
  static calculateExpiryDate(calls) {
    const now = new Date();
    const daysToAdd = calls * 60; // 60 days per call (generous expiry)
    now.setDate(now.getDate() + daysToAdd);
    return now;
  }

  /**
   * Get user's active packages
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Active packages
   */
  static async getUserPackages(userId) {
    try {
      const result = await query(
        `SELECT
          id,
          user_id as "userId",
          package_id as "packageId",
          package_name as "packageName",
          total_calls as "totalCalls",
          remaining_calls as "remainingCalls",
          used_calls as "usedCalls",
          price_cents as price,
          payment_id as "paymentId",
          purchased_at as "purchasedAt",
          expires_at as "expiresAt",
          active,
          last_used_at as "lastUsedAt",
          last_used_call_id as "lastUsedCallId",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM user_call_packages
        WHERE user_id = $1
          AND active = true
          AND remaining_calls > 0
          AND expires_at > NOW()
        ORDER BY purchased_at DESC`,
        [userId.toString()]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting user packages:', error);
      return [];
    }
  }

  /**
   * Use a call from package (atomic operation)
   * @param {string} packageId - Package ID
   * @param {string} callId - Call ID that used the package
   * @returns {Promise<boolean>} Success status
   */
  static async useCall(packageId, callId) {
    try {
      const timestamp = new Date();

      // Atomic update with RETURNING to verify the operation
      const result = await query(
        `UPDATE user_call_packages
        SET
          remaining_calls = remaining_calls - 1,
          used_calls = used_calls + 1,
          last_used_at = $2,
          last_used_call_id = $3,
          updated_at = $4
        WHERE id = $1
          AND remaining_calls > 0
          AND active = true
          AND expires_at > NOW()
        RETURNING
          id,
          remaining_calls as "remainingCalls",
          used_calls as "usedCalls"`,
        [packageId, timestamp, callId, timestamp]
      );

      if (result.rows.length === 0) {
        throw new Error('Package not found or no remaining calls available');
      }

      logger.info('Call used from package', {
        packageId,
        callId,
        remainingCalls: result.rows[0].remainingCalls,
      });

      return true;
    } catch (error) {
      logger.error('Error using call from package:', error);
      return false;
    }
  }

  /**
   * Refund a call to package (atomic operation)
   * @param {string} packageId - Package ID
   * @returns {Promise<boolean>} Success status
   */
  static async refundCall(packageId) {
    try {
      const timestamp = new Date();

      // Atomic update with RETURNING to verify the operation
      const result = await query(
        `UPDATE user_call_packages
        SET
          remaining_calls = remaining_calls + 1,
          used_calls = GREATEST(0, used_calls - 1),
          updated_at = $2
        WHERE id = $1
          AND active = true
        RETURNING
          id,
          remaining_calls as "remainingCalls",
          used_calls as "usedCalls"`,
        [packageId, timestamp]
      );

      if (result.rows.length === 0) {
        throw new Error('Package not found');
      }

      logger.info('Call refunded to package', {
        packageId,
        remainingCalls: result.rows[0].remainingCalls,
      });

      return true;
    } catch (error) {
      logger.error('Error refunding call to package:', error);
      return false;
    }
  }

  /**
   * Get package statistics (aggregate across all users)
   * @returns {Promise<Object>} Package statistics
   */
  static async getStatistics() {
    try {
      // Get overall statistics
      const overallResult = await query(
        `SELECT
          COUNT(*) as total_packages,
          COUNT(CASE WHEN active = true AND remaining_calls > 0 AND expires_at > NOW() THEN 1 END) as active_packages,
          COALESCE(SUM(price_cents), 0) as total_revenue,
          COALESCE(SUM(total_calls), 0) as total_calls,
          COALESCE(SUM(used_calls), 0) as used_calls
        FROM user_call_packages`,
        []
      );

      // Get statistics by package type
      const byTypeResult = await query(
        `SELECT
          package_id,
          COUNT(*) as count,
          COALESCE(SUM(price_cents), 0) as revenue
        FROM user_call_packages
        GROUP BY package_id`,
        []
      );

      const stats = overallResult.rows[0];
      const byPackageType = {};

      byTypeResult.rows.forEach(row => {
        byPackageType[row.package_id] = {
          count: parseInt(row.count, 10),
          revenue: parseInt(row.revenue, 10),
        };
      });

      return {
        totalPackages: parseInt(stats.total_packages, 10),
        activePackages: parseInt(stats.active_packages, 10),
        totalRevenue: parseInt(stats.total_revenue, 10),
        totalCalls: parseInt(stats.total_calls, 10),
        usedCalls: parseInt(stats.used_calls, 10),
        byPackageType,
      };
    } catch (error) {
      logger.error('Error getting package statistics:', error);
      return {
        totalPackages: 0,
        activePackages: 0,
        totalRevenue: 0,
        totalCalls: 0,
        usedCalls: 0,
        byPackageType: {},
      };
    }
  }

  /**
   * Deactivate expired packages (utility method for cleanup)
   * @returns {Promise<number>} Number of packages deactivated
   */
  static async deactivateExpiredPackages() {
    try {
      const result = await query(
        `UPDATE user_call_packages
        SET active = false, updated_at = NOW()
        WHERE active = true
          AND expires_at <= NOW()
        RETURNING id`,
        []
      );

      const count = result.rows.length;

      if (count > 0) {
        logger.info('Expired packages deactivated', { count });
      }

      return count;
    } catch (error) {
      logger.error('Error deactivating expired packages:', error);
      return 0;
    }
  }
}

module.exports = CallPackageModel;
