const logger = require('../utils/logger');
const { query } = require('../utils/db');

/**
 * PASO 5️⃣: BOT ACTIVA LA MEMBRESÍA
 *
 * MeruLinkService - Gestiona links de pago de Meru
 * Previene duplicados marcando links como "used" después de activación
 *
 * Flujo:
 * - 5.1: Si pago confirmado, activar membresía
 * - 5.2: Marcar código como usado en BD
 *
 * Referencia: MERU_PAYMENT_FLOW_DETAILED.md - PASO 5️⃣
 */
class MeruLinkService {
  /**
   * PASO 5.2️⃣: Marcar código como usado en la BD
   *
   * Cambios en BD:
   * status: 'active' → 'used'
   * used_by: NULL → ID del usuario
   * used_by_username: NULL → Username del usuario
   * used_at: NULL → Timestamp actual
   *
   * Previene reutilización porque solo se procesan links con status='active'
   *
   * @param {string} meruCode - Código del link (ej: "LSJUek")
   * @param {string} userId - ID del usuario (ej: "123456789")
   * @param {string} username - Username del usuario (ej: "@juanperu")
   * @returns {Promise<{success: boolean, message: string, link: Object}>}
   */
  async invalidateLinkAfterActivation(meruCode, userId, username) {
    try {
      logger.info(`🔵 PASO 5.2️⃣: Marcando link como usado - código: ${meruCode}`);

      const result = await query(
        `UPDATE meru_payment_links
         SET status = 'used',
             used_by = $2,
             used_by_username = $3,
             used_at = NOW()
         WHERE code = $1 AND status = 'active'
         RETURNING id, code, meru_link`,
        [meruCode, userId, username]
      );

      if (result.rows.length === 0) {
        logger.warn('❌ Link no encontrado o ya usado', { code: meruCode, userId });
        return {
          success: false,
          message: 'Link not found or already used',
        };
      }

      const link = result.rows[0];
      logger.info('✅ Link marcado como usado', {
        code: meruCode,
        linkId: link.id,
        userId,
        username,
        previenePrevention: 'Ahora status="used", no se puede reutilizar',
      });

      return {
        success: true,
        message: 'Link invalidated and marked as used',
        link,
      };
    } catch (error) {
      logger.error('❌ Error marcando link como usado:', error);
      return {
        success: false,
        message: `Error: ${error.message}`,
      };
    }
  }

  /**
   * Get all active/available Meru links for randomizer
   * Excludes used, expired, or invalid links
   * @param {string} product - Product type (default: 'lifetime-pass')
   * @returns {Promise<Array>}
   */
  async getAvailableLinks(product = 'lifetime-pass') {
    try {
      const result = await query(
        `SELECT id, code, meru_link, product, status, created_at
         FROM meru_payment_links
         WHERE status = 'active' AND product = $1
         ORDER BY created_at ASC`,
        [product]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error fetching available Meru links:', error);
      return [];
    }
  }

  /**
   * Get a random available link for new users
   * @param {string} product - Product type (default: 'lifetime-pass')
   * @returns {Promise<{code: string, meru_link: string} | null>}
   */
  async getRandomAvailableLink(product = 'lifetime-pass') {
    try {
      const result = await query(
        `SELECT code, meru_link FROM meru_payment_links
         WHERE status = 'active' AND product = $1
         ORDER BY RANDOM()
         LIMIT 1`,
        [product]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting random Meru link:', error);
      return null;
    }
  }

  /**
   * Get link statistics
   * @returns {Promise<Object>}
   */
  async getLinkStatistics() {
    try {
      const result = await query(
        `SELECT
           COUNT(*) as total,
           COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
           COUNT(CASE WHEN status = 'used' THEN 1 END) as used,
           COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired,
           COUNT(CASE WHEN status = 'invalid' THEN 1 END) as invalid
         FROM meru_payment_links`
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Error fetching Meru link statistics:', error);
      return {
        total: 0,
        active: 0,
        used: 0,
        expired: 0,
        invalid: 0,
      };
    }
  }

  /**
   * Mark a link as expired (e.g., if Meru confirms it's expired)
   * @param {string} meruCode - The code to expire
   * @param {string} reason - Reason for expiration
   * @returns {Promise<boolean>}
   */
  async expireLink(meruCode, reason = 'Payment link expired') {
    try {
      const result = await query(
        `UPDATE meru_payment_links
         SET status = 'expired',
             invalidated_at = NOW(),
             invalidation_reason = $2
         WHERE code = $1
         RETURNING code`,
        [meruCode, reason]
      );

      if (result.rows.length > 0) {
        logger.info('Meru link marked as expired', { code: meruCode, reason });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error expiring Meru link:', error);
      return false;
    }
  }

  /**
   * Invalidate a link manually (admin action)
   * @param {string} meruCode - The code to invalidate
   * @param {string} reason - Reason for invalidation
   * @returns {Promise<boolean>}
   */
  async invalidateLink(meruCode, reason = 'Manually invalidated') {
    try {
      const result = await query(
        `UPDATE meru_payment_links
         SET status = 'invalid',
             invalidated_at = NOW(),
             invalidation_reason = $2
         WHERE code = $1
         RETURNING code`,
        [meruCode, reason]
      );

      if (result.rows.length > 0) {
        logger.info('Meru link invalidated', { code: meruCode, reason });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error invalidating Meru link:', error);
      return false;
    }
  }

  /**
   * Add a new Meru link to the system
   * @param {string} meruCode - The code from the link
   * @param {string} meruLink - Full Meru payment link
   * @param {string} product - Product type
   * @returns {Promise<boolean>}
   */
  async addLink(meruCode, meruLink, product = 'lifetime-pass') {
    try {
      await query(
        `INSERT INTO meru_payment_links (code, meru_link, product, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (code) DO UPDATE SET status = 'active'`,
        [meruCode, meruLink, product]
      );

      logger.info('Meru link added to system', { code: meruCode, product });
      return true;
    } catch (error) {
      logger.error('Error adding Meru link:', error);
      return false;
    }
  }
}

module.exports = new MeruLinkService();
