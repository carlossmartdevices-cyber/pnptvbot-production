const { v4: uuidv4 } = require('uuid');
// Removed Firebase/Firestore dependency
const logger = require('../utils/logger');
const { query } = require('../config/postgres');

const COLLECTION = 'privateCalls';
const AVAILABILITY_COLLECTION = 'callAvailability';

/**
 * Call Model - Manages 1:1 private calls
 */
class CallModel {
  // TODO: Implement using PostgreSQL
  /**
   * Create a new call booking
   * @param {Object} callData - { userId, userName, paymentId, scheduledDate, scheduledTime, duration, performer }
   * @returns {Promise<Object>} Created call
   */
  static async create(callData) {
    // TODO: Implement using PostgreSQL
    throw new Error('Not implemented: create call booking');
  }

  /**
   * Get call by ID
   * @param {string} callId - Call ID
   * @returns {Promise<Object|null>} Call data
   */
  static async getById(callId) {
    // TODO: Implement using PostgreSQL
    throw new Error('Not implemented: get call by ID');
  }

  /**
   * Get user's calls
   * @param {string} userId - User ID
   * @param {number} limit - Number of records
   * @returns {Promise<Array>} User calls
   */
  static async getByUser(userId, limit = 20) {
    // TODO: Implement using PostgreSQL
    throw new Error('Not implemented: get calls by user');
  }

  /**
   * Get calls by status
   * @param {string} status - Call status
   * @param {number} limit - Number of records
   * @returns {Promise<Array>} Calls
   */
  static async getByStatus(status, limit = 100) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(COLLECTION)
        .where('status', '==', status)
        .orderBy('scheduledDate', 'asc')
        .limit(limit)
        .get();

      const calls = [];
      snapshot.forEach((doc) => {
        calls.push({ id: doc.id, ...doc.data() });
      });

      return calls;
    } catch (error) {
      logger.error('Error getting calls by status:', error);
      return [];
    }
  }

  /**
   * Update call status
   * @param {string} callId - Call ID
   * @param {string} status - New status
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<boolean>} Success status
   */
  static async updateStatus(callId, status, metadata = {}) {
    try {
      const db = getFirestore();
      const callRef = db.collection(COLLECTION).doc(callId);

      await callRef.update({
        status,
        ...metadata,
        updatedAt: new Date(),
      });

      logger.info('Call status updated', { callId, status });
      return true;
    } catch (error) {
      logger.error('Error updating call status:', error);
      return false;
    }
  }

  /**
   * Set admin availability
   * @param {Object} availabilityData - { adminId, available, message, validUntil }
   * @returns {Promise<Object>} Availability record
   */
    static async setAvailability(availabilityData) {
      // TODO: Implement using PostgreSQL
      throw new Error('Not implemented: set availability');
    }

  /**
   * Get current availability
   * @returns {Promise<Object|null>} Current availability
   */
    static async getAvailability() {
      // TODO: Implement using PostgreSQL
      throw new Error('Not implemented: get availability');
    }

  /**
   * Get upcoming calls
   * @param {Date} fromDate - Start date
   * @returns {Promise<Array>} Upcoming calls
   */
  static async getUpcoming(fromDate = new Date()) {
    try {
      const result = await query(
        `SELECT c.*,
                u1.username as caller_username,
                u2.username as receiver_username
         FROM calls c
         LEFT JOIN users u1 ON c.caller_id = u1.id
         LEFT JOIN users u2 ON c.receiver_id = u2.id
         WHERE c.scheduled_at >= $1
           AND c.status = 'pending'
         ORDER BY c.scheduled_at ASC
         LIMIT 100`,
        [fromDate]
      );

      return result.rows.map(call => ({
        id: call.id,
        callerId: call.caller_id,
        callerUsername: call.caller_username,
        receiverId: call.receiver_id,
        receiverUsername: call.receiver_username,
        status: call.status,
        callType: call.call_type,
        duration: call.duration,
        scheduledAt: call.scheduled_at,
        startedAt: call.started_at,
        endedAt: call.ended_at,
        callerRating: call.caller_rating,
        receiverRating: call.receiver_rating,
        callerFeedback: call.caller_feedback,
        receiverFeedback: call.receiver_feedback,
        createdAt: call.created_at,
        updatedAt: call.updated_at,
      }));
    } catch (error) {
      logger.error('Error getting upcoming calls:', error);
      return []; // Return empty array instead of throwing
    }
  }

  /**
   * Get call statistics
   * @returns {Promise<Object>} Call statistics
   */
    static async getStatistics() {
      // TODO: Implement using PostgreSQL
      throw new Error('Not implemented: get call statistics');
    }
}

module.exports = CallModel;
