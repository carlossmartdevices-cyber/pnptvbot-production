const { getFirestore } = require('../config/firebase');
const logger = require('../utils/logger');

const COLLECTION = 'promoCodes';
const USAGE_COLLECTION = 'promoCodeUsage';

/**
 * Promo Code Model - Manages discount/promo codes
 */
class PromoCodeModel {
  /**
   * Create a promo code
   * @param {Object} codeData - { code, discount, type, maxUses, validUntil, minAmount, applicablePlans }
   * @returns {Promise<Object>} Created promo code
   */
  static async create(codeData) {
    try {
      const db = getFirestore();
      const codeRef = db.collection(COLLECTION).doc(codeData.code.toUpperCase());

      const data = {
        code: codeData.code.toUpperCase(),
        discount: codeData.discount, // Percentage (10 = 10%) or fixed amount
        discountType: codeData.discountType || 'percentage', // 'percentage' or 'fixed'
        maxUses: codeData.maxUses || null, // null = unlimited
        currentUses: 0,
        validUntil: codeData.validUntil || null, // null = no expiry
        minAmount: codeData.minAmount || 0, // Minimum purchase amount
        applicablePlans: codeData.applicablePlans || [], // Empty = all plans
        active: true,
        createdAt: new Date(),
        createdBy: codeData.createdBy,
      };

      await codeRef.set(data);

      logger.info('Promo code created', {
        code: data.code,
        discount: data.discount,
        type: data.discountType,
      });

      return data;
    } catch (error) {
      logger.error('Error creating promo code:', error);
      throw error;
    }
  }

  /**
   * Get promo code by code
   * @param {string} code - Promo code
   * @returns {Promise<Object|null>} Promo code data
   */
  static async getByCode(code) {
    try {
      const db = getFirestore();
      const doc = await db.collection(COLLECTION).doc(code.toUpperCase()).get();

      if (!doc.exists) {
        return null;
      }

      return doc.data();
    } catch (error) {
      logger.error('Error getting promo code:', error);
      return null;
    }
  }

  /**
   * Validate promo code
   * @param {string} code - Promo code
   * @param {number} amount - Purchase amount
   * @param {string} planId - Plan ID
   * @returns {Promise<Object>} { valid, error, discount }
   */
  static async validate(code, amount, planId) {
    try {
      const promoCode = await this.getByCode(code);

      if (!promoCode) {
        return { valid: false, error: 'Promo code not found' };
      }

      // Check if active
      if (!promoCode.active) {
        return { valid: false, error: 'Promo code is inactive' };
      }

      // Check expiry
      if (promoCode.validUntil) {
        const validUntil = promoCode.validUntil.toDate ? promoCode.validUntil.toDate() : new Date(promoCode.validUntil);
        if (validUntil < new Date()) {
          return { valid: false, error: 'Promo code has expired' };
        }
      }

      // Check max uses
      if (promoCode.maxUses && promoCode.currentUses >= promoCode.maxUses) {
        return { valid: false, error: 'Promo code has reached maximum uses' };
      }

      // Check minimum amount
      if (amount < promoCode.minAmount) {
        return { valid: false, error: `Minimum purchase amount is $${promoCode.minAmount}` };
      }

      // Check applicable plans
      if (promoCode.applicablePlans.length > 0 && !promoCode.applicablePlans.includes(planId)) {
        return { valid: false, error: 'Promo code not applicable to this plan' };
      }

      // Calculate discount
      let discountAmount = 0;
      if (promoCode.discountType === 'percentage') {
        discountAmount = (amount * promoCode.discount) / 100;
      } else {
        discountAmount = promoCode.discount;
      }

      // Ensure discount doesn't exceed amount
      discountAmount = Math.min(discountAmount, amount);

      return {
        valid: true,
        discount: discountAmount,
        discountType: promoCode.discountType,
        discountValue: promoCode.discount,
        finalAmount: amount - discountAmount,
      };
    } catch (error) {
      logger.error('Error validating promo code:', error);
      return { valid: false, error: 'Error validating promo code' };
    }
  }

  /**
   * Apply promo code (increment usage)
   * @param {string} code - Promo code
   * @param {string} userId - User ID
   * @param {string} paymentId - Payment ID
   * @param {number} discountAmount - Discount amount applied
   * @returns {Promise<boolean>} Success status
   */
  static async apply(code, userId, paymentId, discountAmount) {
    try {
      const db = getFirestore();
      const codeRef = db.collection(COLLECTION).doc(code.toUpperCase());

      // Increment usage count
      await codeRef.update({
        currentUses: db.FieldValue.increment(1),
      });

      // Record usage
      const usageRef = db.collection(USAGE_COLLECTION).doc();
      await usageRef.set({
        code: code.toUpperCase(),
        userId: userId.toString(),
        paymentId,
        discountAmount,
        usedAt: new Date(),
      });

      logger.info('Promo code applied', {
        code: code.toUpperCase(),
        userId,
        discount: discountAmount,
      });

      return true;
    } catch (error) {
      logger.error('Error applying promo code:', error);
      return false;
    }
  }

  /**
   * Deactivate promo code
   * @param {string} code - Promo code
   * @returns {Promise<boolean>} Success status
   */
  static async deactivate(code) {
    try {
      const db = getFirestore();
      const codeRef = db.collection(COLLECTION).doc(code.toUpperCase());

      await codeRef.update({
        active: false,
        deactivatedAt: new Date(),
      });

      logger.info('Promo code deactivated', { code: code.toUpperCase() });
      return true;
    } catch (error) {
      logger.error('Error deactivating promo code:', error);
      return false;
    }
  }

  /**
   * Get all promo codes
   * @param {boolean} activeOnly - Only return active codes
   * @returns {Promise<Array>} Promo codes
   */
  static async getAll(activeOnly = false) {
    try {
      const db = getFirestore();
      let query = db.collection(COLLECTION);

      if (activeOnly) {
        query = query.where('active', '==', true);
      }

      const snapshot = await query.get();

      const codes = [];
      snapshot.forEach((doc) => {
        codes.push(doc.data());
      });

      return codes;
    } catch (error) {
      logger.error('Error getting promo codes:', error);
      return [];
    }
  }

  /**
   * Get promo code usage statistics
   * @param {string} code - Promo code
   * @returns {Promise<Object>} Usage stats
   */
  static async getUsageStats(code) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(USAGE_COLLECTION)
        .where('code', '==', code.toUpperCase())
        .get();

      let totalDiscount = 0;
      const users = new Set();

      snapshot.forEach((doc) => {
        const usage = doc.data();
        totalDiscount += usage.discountAmount || 0;
        users.add(usage.userId);
      });

      return {
        totalUses: snapshot.size,
        uniqueUsers: users.size,
        totalDiscount,
      };
    } catch (error) {
      logger.error('Error getting promo code usage stats:', error);
      return {
        totalUses: 0,
        uniqueUsers: 0,
        totalDiscount: 0,
      };
    }
  }
}

module.exports = PromoCodeModel;
