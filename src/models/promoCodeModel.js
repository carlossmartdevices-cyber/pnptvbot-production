const { query } = require('../config/postgres');
const logger = require('../utils/logger');

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

      await query(
        `INSERT INTO promo_codes (code, discount, discount_type, max_uses, current_uses,
         valid_until, min_amount, applicable_plans, active, created_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          data.code,
          data.discount,
          data.discountType,
          data.maxUses,
          data.currentUses,
          data.validUntil,
          data.minAmount,
          data.applicablePlans,
          data.active,
          data.createdAt,
          data.createdBy,
        ]
      );

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
      const result = await query(
        'SELECT * FROM promo_codes WHERE code = $1',
        [code.toUpperCase()]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        code: row.code,
        discount: parseFloat(row.discount),
        discountType: row.discount_type,
        maxUses: row.max_uses,
        currentUses: row.current_uses,
        validUntil: row.valid_until,
        minAmount: parseFloat(row.min_amount),
        applicablePlans: row.applicable_plans || [],
        active: row.active,
        createdAt: row.created_at,
        createdBy: row.created_by,
        deactivatedAt: row.deactivated_at,
      };
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
        const validUntil = new Date(promoCode.validUntil);
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
      const upperCode = code.toUpperCase();

      // Increment usage count
      await query(
        'UPDATE promo_codes SET current_uses = current_uses + 1 WHERE code = $1',
        [upperCode]
      );

      // Record usage
      await query(
        `INSERT INTO promo_code_usage (code, user_id, payment_id, discount_amount, used_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [upperCode, userId.toString(), paymentId, discountAmount, new Date()]
      );

      logger.info('Promo code applied', {
        code: upperCode,
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
      await query(
        'UPDATE promo_codes SET active = $1, deactivated_at = $2 WHERE code = $3',
        [false, new Date(), code.toUpperCase()]
      );

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
      let sql = 'SELECT * FROM promo_codes';
      const params = [];

      if (activeOnly) {
        sql += ' WHERE active = $1';
        params.push(true);
      }

      sql += ' ORDER BY created_at DESC';

      const result = await query(sql, params);

      const codes = result.rows.map(row => ({
        code: row.code,
        discount: parseFloat(row.discount),
        discountType: row.discount_type,
        maxUses: row.max_uses,
        currentUses: row.current_uses,
        validUntil: row.valid_until,
        minAmount: parseFloat(row.min_amount),
        applicablePlans: row.applicable_plans || [],
        active: row.active,
        createdAt: row.created_at,
        createdBy: row.created_by,
        deactivatedAt: row.deactivated_at,
      }));

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
      const result = await query(
        `SELECT COUNT(*) as total_uses,
                COUNT(DISTINCT user_id) as unique_users,
                SUM(discount_amount) as total_discount
         FROM promo_code_usage
         WHERE code = $1`,
        [code.toUpperCase()]
      );

      const row = result.rows[0];

      return {
        totalUses: parseInt(row.total_uses),
        uniqueUsers: parseInt(row.unique_users),
        totalDiscount: parseFloat(row.total_discount) || 0,
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
