const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * Support Topic Model
 * Manages user support topics in the support group
 * Each user has a dedicated forum topic for their support conversations
 */
class SupportTopicModel {
  /**
   * Initialize support topics table
   */
  static async initTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS support_topics (
        user_id VARCHAR(255) PRIMARY KEY,
        thread_id INTEGER NOT NULL,
        thread_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        message_count INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'open',
        assigned_to VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_support_topics_thread_id ON support_topics(thread_id);
      CREATE INDEX IF NOT EXISTS idx_support_topics_status ON support_topics(status);
    `;

    try {
      await pool.query(query);
      logger.info('Support topics table initialized');
    } catch (error) {
      logger.error('Error initializing support topics table:', error);
      throw error;
    }
  }

  /**
   * Get topic by user ID
   * @param {string} userId - Telegram user ID
   * @returns {Promise<Object|null>} Topic data or null
   */
  static async getByUserId(userId) {
    const query = 'SELECT * FROM support_topics WHERE user_id = $1';

    try {
      const result = await pool.query(query, [userId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting topic by user ID:', error);
      throw error;
    }
  }

  /**
   * Get topic by thread ID
   * @param {number} threadId - Forum topic ID
   * @returns {Promise<Object|null>} Topic data or null
   */
  static async getByThreadId(threadId) {
    const query = 'SELECT * FROM support_topics WHERE thread_id = $1';

    try {
      const result = await pool.query(query, [threadId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting topic by thread ID:', error);
      throw error;
    }
  }

  /**
   * Create new support topic entry
   * @param {Object} data - Topic data
   * @param {string} data.userId - Telegram user ID
   * @param {number} data.threadId - Forum topic ID
   * @param {string} data.threadName - Topic name
   * @returns {Promise<Object>} Created topic data
   */
  static async create({ userId, threadId, threadName }) {
    const query = `
      INSERT INTO support_topics (user_id, thread_id, thread_name, message_count)
      VALUES ($1, $2, $3, 1)
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [userId, threadId, threadName]);
      logger.info('Support topic created', { userId, threadId, threadName });
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating support topic:', error);
      throw error;
    }
  }

  /**
   * Update topic's last message timestamp and increment message count
   * @param {string} userId - Telegram user ID
   * @returns {Promise<Object>} Updated topic data
   */
  static async updateLastMessage(userId) {
    const query = `
      UPDATE support_topics
      SET last_message_at = CURRENT_TIMESTAMP,
          message_count = message_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [userId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error updating last message:', error);
      throw error;
    }
  }

  /**
   * Update topic status
   * @param {string} userId - Telegram user ID
   * @param {string} status - New status (open, resolved, closed)
   * @returns {Promise<Object>} Updated topic data
   */
  static async updateStatus(userId, status) {
    const query = `
      UPDATE support_topics
      SET status = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [userId, status]);
      logger.info('Support topic status updated', { userId, status });
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error updating topic status:', error);
      throw error;
    }
  }

  /**
   * Assign topic to support agent
   * @param {string} userId - Telegram user ID
   * @param {string} agentId - Support agent ID
   * @returns {Promise<Object>} Updated topic data
   */
  static async assignTo(userId, agentId) {
    const query = `
      UPDATE support_topics
      SET assigned_to = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [userId, agentId]);
      logger.info('Support topic assigned', { userId, agentId });
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error assigning topic:', error);
      throw error;
    }
  }

  /**
   * Get all open topics
   * @returns {Promise<Array>} Array of open topics
   */
  static async getOpenTopics() {
    const query = `
      SELECT * FROM support_topics
      WHERE status = 'open'
      ORDER BY last_message_at DESC
    `;

    try {
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error getting open topics:', error);
      throw error;
    }
  }

  /**
   * Get topics assigned to specific agent
   * @param {string} agentId - Support agent ID
   * @returns {Promise<Array>} Array of assigned topics
   */
  static async getAssignedTopics(agentId) {
    const query = `
      SELECT * FROM support_topics
      WHERE assigned_to = $1 AND status = 'open'
      ORDER BY last_message_at DESC
    `;

    try {
      const result = await pool.query(query, [agentId]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting assigned topics:', error);
      throw error;
    }
  }

  /**
   * Get topic statistics
   * @returns {Promise<Object>} Statistics object
   */
  static async getStatistics() {
    const query = `
      SELECT
        COUNT(*) as total_topics,
        COUNT(*) FILTER (WHERE status = 'open') as open_topics,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved_topics,
        COUNT(*) FILTER (WHERE status = 'closed') as closed_topics,
        SUM(message_count) as total_messages,
        AVG(message_count) as avg_messages_per_topic
      FROM support_topics
    `;

    try {
      const result = await pool.query(query);
      return result.rows[0];
    } catch (error) {
      logger.error('Error getting topic statistics:', error);
      throw error;
    }
  }

  /**
   * Delete topic (admin only)
   * @param {string} userId - Telegram user ID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(userId) {
    const query = 'DELETE FROM support_topics WHERE user_id = $1';

    try {
      await pool.query(query, [userId]);
      logger.info('Support topic deleted', { userId });
      return true;
    } catch (error) {
      logger.error('Error deleting topic:', error);
      throw error;
    }
  }
}

module.exports = SupportTopicModel;
