// Removed Firebase/Firestore dependency
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const COLLECTION = 'callPackages';
const USER_PACKAGES_COLLECTION = 'userCallPackages';

/**
 * Call Package Model - Manages call packages (bulk pricing)
 */
class CallPackageModel {
  /**
   * Get all available packages
   * @returns {Promise<Array>} Available packages
   */
  static async getAvailablePackages() {
    // Predefined packages with bulk pricing
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

  /**
   * Get package by ID
   * @param {string} packageId - Package ID
   * @returns {Promise<Object|null>} Package data
   */
  static async getById(packageId) {
    const packages = await this.getAvailablePackages();
    return packages.find(p => p.id === packageId) || null;
  }

  /**
   * Purchase a package
   * @param {Object} purchaseData - { userId, packageId, paymentId }
   * @returns {Promise<Object>} Purchased package
   */
  static async purchase(purchaseData) {
    try {
      const db = getFirestore();
      const packageId = uuidv4();
      const packageRef = db.collection(USER_PACKAGES_COLLECTION).doc(packageId);

      const pkg = await this.getById(purchaseData.packageId);

      if (!pkg) {
        throw new Error('Package not found');
      }

      const data = {
        userId: purchaseData.userId.toString(),
        packageId: purchaseData.packageId,
        packageName: pkg.name,
        totalCalls: pkg.calls,
        remainingCalls: pkg.calls,
        usedCalls: 0,
        price: pkg.price,
        paymentId: purchaseData.paymentId,
        purchasedAt: new Date(),
        expiresAt: this.calculateExpiryDate(pkg.calls),
        active: true,
      };

      await packageRef.set(data);

      logger.info('Call package purchased', {
        packageId,
        userId: purchaseData.userId,
        package: purchaseData.packageId,
        calls: pkg.calls,
      });

      return { id: packageId, ...data };
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
      const db = getFirestore();
      const snapshot = await db.collection(USER_PACKAGES_COLLECTION)
        .where('userId', '==', userId.toString())
        .where('active', '==', true)
        .where('remainingCalls', '>', 0)
        .orderBy('purchasedAt', 'desc')
        .get();

      const packages = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Check if not expired
        const expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
        if (expiresAt > new Date()) {
          packages.push({ id: doc.id, ...data });
        }
      });

      return packages;
    } catch (error) {
      logger.error('Error getting user packages:', error);
      return [];
    }
  }

  /**
   * Use a call from package
   * @param {string} packageId - Package ID
   * @param {string} callId - Call ID that used the package
   * @returns {Promise<boolean>} Success status
   */
  static async useCall(packageId, callId) {
    try {
      const db = getFirestore();
      const packageRef = db.collection(USER_PACKAGES_COLLECTION).doc(packageId);

      const doc = await packageRef.get();
      if (!doc.exists) {
        throw new Error('Package not found');
      }

      const data = doc.data();

      if (data.remainingCalls <= 0) {
        throw new Error('No remaining calls in package');
      }

      await packageRef.update({
        remainingCalls: data.remainingCalls - 1,
        usedCalls: data.usedCalls + 1,
        lastUsedAt: new Date(),
        lastUsedCallId: callId,
      });

      logger.info('Call used from package', {
        packageId,
        callId,
        remainingCalls: data.remainingCalls - 1,
      });

      return true;
    } catch (error) {
      logger.error('Error using call from package:', error);
      return false;
    }
  }

  /**
   * Refund a call to package (e.g., when call is cancelled)
   * @param {string} packageId - Package ID
   * @returns {Promise<boolean>} Success status
   */
  static async refundCall(packageId) {
    try {
      const db = getFirestore();
      const packageRef = db.collection(USER_PACKAGES_COLLECTION).doc(packageId);

      const doc = await packageRef.get();
      if (!doc.exists) {
        throw new Error('Package not found');
      }

      const data = doc.data();

      await packageRef.update({
        remainingCalls: data.remainingCalls + 1,
        usedCalls: Math.max(0, data.usedCalls - 1),
      });

      logger.info('Call refunded to package', {
        packageId,
        remainingCalls: data.remainingCalls + 1,
      });

      return true;
    } catch (error) {
      logger.error('Error refunding call to package:', error);
      return false;
    }
  }

  /**
   * Get package statistics
   * @returns {Promise<Object>} Package statistics
   */
  static async getStatistics() {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(USER_PACKAGES_COLLECTION).get();

      const stats = {
        totalPackages: 0,
        activePackages: 0,
        totalRevenue: 0,
        totalCalls: 0,
        usedCalls: 0,
        byPackageType: {},
      };

      snapshot.forEach((doc) => {
        const pkg = doc.data();
        stats.totalPackages += 1;

        if (pkg.active && pkg.remainingCalls > 0) {
          stats.activePackages += 1;
        }

        stats.totalRevenue += pkg.price || 0;
        stats.totalCalls += pkg.totalCalls || 0;
        stats.usedCalls += pkg.usedCalls || 0;

        const pkgId = pkg.packageId || 'unknown';
        if (!stats.byPackageType[pkgId]) {
          stats.byPackageType[pkgId] = { count: 0, revenue: 0 };
        }
        stats.byPackageType[pkgId].count += 1;
        stats.byPackageType[pkgId].revenue += pkg.price || 0;
      });

      return stats;
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
}

module.exports = CallPackageModel;
