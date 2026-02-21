const pool = require('../../db/pool');
const logger = require('../utils/logger');

class ComingSoonService {
  /**
   * Sign up email to coming soon waitlist
   */
  static async signupWaitlist(email, featureType, options = {}) {
    const { userId, ipAddress, userAgent, source = 'web' } = options;

    try {
      // Validate email
      if (!email || !this.isValidEmail(email)) {
        throw new Error('Invalid email address');
      }

      // Validate feature type
      const validFeatures = ['live', 'hangouts'];
      if (!validFeatures.includes(featureType)) {
        throw new Error(`Invalid feature type: ${featureType}`);
      }

      // Normalize email to lowercase
      const normalizedEmail = email.toLowerCase().trim();

      // Check if already exists
      const existing = await pool.query(
        'SELECT id, status FROM coming_soon_waitlist WHERE LOWER(email) = LOWER($1) AND feature_type = $2',
        [normalizedEmail, featureType]
      );

      if (existing.rows.length > 0) {
        // If already subscribed and unsubscribed, reactivate
        if (existing.rows[0].status === 'unsubscribed') {
          await pool.query(
            'UPDATE coming_soon_waitlist SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['pending', existing.rows[0].id]
          );
          logger.info(`Reactivated waitlist entry: ${normalizedEmail} for ${featureType}`);
        }
        return { success: true, message: 'Email already on waitlist', id: existing.rows[0].id, isNew: false };
      }

      // Insert new entry
      const result = await pool.query(
        `INSERT INTO coming_soon_waitlist (email, feature_type, user_id, ip_address, user_agent, source)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, feature_type, created_at`,
        [normalizedEmail, featureType, userId || null, ipAddress || null, userAgent || null, source]
      );

      const entry = result.rows[0];

      // Log signup in audit
      await pool.query(
        'INSERT INTO coming_soon_waitlist_audit (waitlist_id, action, details) VALUES ($1, $2, $3)',
        [entry.id, 'signed_up', JSON.stringify({ source, ipAddress })]
      );

      logger.info(`New waitlist signup: ${normalizedEmail} for ${featureType}`);

      return {
        success: true,
        message: 'Successfully signed up for waitlist',
        id: entry.id,
        isNew: true,
      };
    } catch (error) {
      logger.error('Waitlist signup error:', { email, featureType, error: error.message });
      throw error;
    }
  }

  /**
   * Get waitlist count for a feature
   */
  static async getWaitlistCount(featureType) {
    try {
      const result = await pool.query(
        'SELECT COUNT(*) as count FROM coming_soon_waitlist WHERE feature_type = $1 AND status != $2',
        [featureType, 'unsubscribed']
      );
      return result.rows[0].count || 0;
    } catch (error) {
      logger.error('Error fetching waitlist count:', error.message);
      return 0;
    }
  }

  /**
   * Get all pending waitlist entries for a feature
   */
  static async getPendingEntries(featureType, limit = 100, offset = 0) {
    try {
      const result = await pool.query(
        `SELECT id, email, user_id, created_at, source
         FROM coming_soon_waitlist
         WHERE feature_type = $1 AND status = 'pending'
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [featureType, limit, offset]
      );
      return result.rows;
    } catch (error) {
      logger.error('Error fetching pending entries:', error.message);
      throw error;
    }
  }

  /**
   * Mark entries as notified
   */
  static async markAsNotified(entryIds) {
    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      throw new Error('Invalid entry IDs');
    }

    try {
      const placeholders = entryIds.map((_, i) => `$${i + 1}`).join(',');
      const result = await pool.query(
        `UPDATE coming_soon_waitlist
         SET status = 'notified', notified_at = CURRENT_TIMESTAMP
         WHERE id IN (${placeholders})
         RETURNING id`,
        entryIds
      );

      // Log notifications
      for (const id of entryIds) {
        await pool.query(
          'INSERT INTO coming_soon_waitlist_audit (waitlist_id, action) VALUES ($1, $2)',
          [id, 'notified']
        );
      }

      logger.info(`Marked ${result.rows.length} entries as notified`);
      return result.rows.length;
    } catch (error) {
      logger.error('Error marking as notified:', error.message);
      throw error;
    }
  }

  /**
   * Unsubscribe from waitlist
   */
  static async unsubscribe(email, featureType) {
    try {
      const result = await pool.query(
        `UPDATE coming_soon_waitlist
         SET status = 'unsubscribed', updated_at = CURRENT_TIMESTAMP
         WHERE LOWER(email) = LOWER($1) AND feature_type = $2
         RETURNING id`,
        [email, featureType]
      );

      if (result.rows.length > 0) {
        await pool.query(
          'INSERT INTO coming_soon_waitlist_audit (waitlist_id, action) VALUES ($1, $2)',
          [result.rows[0].id, 'unsubscribed']
        );
        logger.info(`Unsubscribed: ${email} from ${featureType}`);
      }

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error unsubscribing:', error.message);
      throw error;
    }
  }

  /**
   * Get waitlist statistics
   */
  static async getStats(featureType) {
    try {
      const result = await pool.query(
        `SELECT
          feature_type,
          COUNT(*) as total_signups,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'notified' THEN 1 END) as notified,
          COUNT(CASE WHEN status = 'unsubscribed' THEN 1 END) as unsubscribed,
          COUNT(DISTINCT DATE(created_at)) as signup_days,
          MAX(created_at) as latest_signup
         FROM coming_soon_waitlist
         WHERE feature_type = $1
         GROUP BY feature_type`,
        [featureType]
      );

      return result.rows[0] || {
        feature_type: featureType,
        total_signups: 0,
        pending: 0,
        notified: 0,
        unsubscribed: 0,
        signup_days: 0,
      };
    } catch (error) {
      logger.error('Error fetching stats:', error.message);
      throw error;
    }
  }

  /**
   * Validate email format
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get audit log for entry
   */
  static async getAuditLog(entryId, limit = 50) {
    try {
      const result = await pool.query(
        `SELECT action, details, created_at
         FROM coming_soon_waitlist_audit
         WHERE waitlist_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [entryId, limit]
      );
      return result.rows;
    } catch (error) {
      logger.error('Error fetching audit log:', error.message);
      throw error;
    }
  }

  /**
   * Export waitlist for email campaign
   */
  static async exportWaitlist(featureType, status = 'pending') {
    try {
      const result = await pool.query(
        `SELECT email, user_id, created_at, source
         FROM coming_soon_waitlist
         WHERE feature_type = $1 AND status = $2
         ORDER BY created_at DESC`,
        [featureType, status]
      );

      return result.rows.map(row => ({
        email: row.email,
        user_id: row.user_id,
        signup_date: row.created_at,
        source: row.source,
      }));
    } catch (error) {
      logger.error('Error exporting waitlist:', error.message);
      throw error;
    }
  }

  /**
   * Delete old unsubscribed entries (cleanup)
   */
  static async cleanupOldUnsubscribed(daysOld = 180) {
    try {
      const result = await pool.query(
        `DELETE FROM coming_soon_waitlist
         WHERE status = 'unsubscribed'
         AND updated_at < NOW() - INTERVAL '1 day' * $1
         RETURNING id`,
        [daysOld]
      );

      logger.info(`Cleaned up ${result.rows.length} old unsubscribed entries`);
      return result.rows.length;
    } catch (error) {
      logger.error('Error cleaning up old entries:', error.message);
      throw error;
    }
  }
}

module.exports = ComingSoonService;
