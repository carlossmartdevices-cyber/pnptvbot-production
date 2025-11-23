const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { query } = require('../config/postgres');

/**
 * Call Model - Manages 1:1 private calls
 */
class CallModel {
  /**
   * Create a new call booking
   * @param {Object} callData - { callerId, callerUsername, receiverId, receiverUsername, userName, paymentId, scheduledDate, scheduledTime, scheduledAt, duration, performer, callType }
   * @returns {Promise<Object>} Created call
   */
  static async create(callData) {
    try {
      const id = uuidv4();
      const now = new Date();

      const result = await query(
        `INSERT INTO private_calls (
          id, caller_id, caller_username, receiver_id, receiver_username,
          user_name, payment_id, scheduled_date, scheduled_time, scheduled_at,
          duration, performer, status, call_type, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`,
        [
          id,
          callData.callerId || callData.userId,
          callData.callerUsername || null,
          callData.receiverId || null,
          callData.receiverUsername || null,
          callData.userName || null,
          callData.paymentId || null,
          callData.scheduledDate || null,
          callData.scheduledTime || null,
          callData.scheduledAt || null,
          callData.duration || 30,
          callData.performer || null,
          'pending',
          callData.callType || 'private',
          now,
          now
        ]
      );

      const call = result.rows[0];
      logger.info('Call booking created', { callId: id });

      return {
        id: call.id,
        callerId: call.caller_id,
        callerUsername: call.caller_username,
        receiverId: call.receiver_id,
        receiverUsername: call.receiver_username,
        userName: call.user_name,
        paymentId: call.payment_id,
        scheduledDate: call.scheduled_date,
        scheduledTime: call.scheduled_time,
        scheduledAt: call.scheduled_at,
        duration: call.duration,
        performer: call.performer,
        status: call.status,
        callType: call.call_type,
        startedAt: call.started_at,
        endedAt: call.ended_at,
        callerRating: call.caller_rating,
        receiverRating: call.receiver_rating,
        callerFeedback: call.caller_feedback,
        receiverFeedback: call.receiver_feedback,
        createdAt: call.created_at,
        updatedAt: call.updated_at,
      };
    } catch (error) {
      logger.error('Error creating call booking:', error);
      throw error;
    }
  }

  /**
   * Get call by ID
   * @param {string} callId - Call ID
   * @returns {Promise<Object|null>} Call data
   */
  static async getById(callId) {
    try {
      const result = await query(
        `SELECT * FROM private_calls WHERE id = $1`,
        [callId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const call = result.rows[0];
      return {
        id: call.id,
        callerId: call.caller_id,
        callerUsername: call.caller_username,
        receiverId: call.receiver_id,
        receiverUsername: call.receiver_username,
        userName: call.user_name,
        paymentId: call.payment_id,
        scheduledDate: call.scheduled_date,
        scheduledTime: call.scheduled_time,
        scheduledAt: call.scheduled_at,
        duration: call.duration,
        performer: call.performer,
        status: call.status,
        callType: call.call_type,
        startedAt: call.started_at,
        endedAt: call.ended_at,
        callerRating: call.caller_rating,
        receiverRating: call.receiver_rating,
        callerFeedback: call.caller_feedback,
        receiverFeedback: call.receiver_feedback,
        createdAt: call.created_at,
        updatedAt: call.updated_at,
      };
    } catch (error) {
      logger.error('Error getting call by ID:', error);
      return null;
    }
  }

  /**
   * Get user's calls
   * @param {string} userId - User ID
   * @param {number} limit - Number of records
   * @returns {Promise<Array>} User calls
   */
  static async getByUser(userId, limit = 20) {
    try {
      const result = await query(
        `SELECT * FROM private_calls
         WHERE caller_id = $1 OR receiver_id = $1
         ORDER BY scheduled_at DESC NULLS LAST, created_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows.map(call => ({
        id: call.id,
        callerId: call.caller_id,
        callerUsername: call.caller_username,
        receiverId: call.receiver_id,
        receiverUsername: call.receiver_username,
        userName: call.user_name,
        paymentId: call.payment_id,
        scheduledDate: call.scheduled_date,
        scheduledTime: call.scheduled_time,
        scheduledAt: call.scheduled_at,
        duration: call.duration,
        performer: call.performer,
        status: call.status,
        callType: call.call_type,
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
      logger.error('Error getting calls by user:', error);
      return [];
    }
  }

  /**
   * Get calls by status
   * @param {string} status - Call status
   * @param {number} limit - Number of records
   * @returns {Promise<Array>} Calls
   */
  static async getByStatus(status, limit = 100) {
    try {
      const result = await query(
        `SELECT * FROM private_calls
         WHERE status = $1
         ORDER BY scheduled_at ASC NULLS LAST, created_at ASC
         LIMIT $2`,
        [status, limit]
      );

      return result.rows.map(call => ({
        id: call.id,
        callerId: call.caller_id,
        callerUsername: call.caller_username,
        receiverId: call.receiver_id,
        receiverUsername: call.receiver_username,
        userName: call.user_name,
        paymentId: call.payment_id,
        scheduledDate: call.scheduled_date,
        scheduledTime: call.scheduled_time,
        scheduledAt: call.scheduled_at,
        duration: call.duration,
        performer: call.performer,
        status: call.status,
        callType: call.call_type,
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
      logger.error('Error getting calls by status:', error);
      return [];
    }
  }

  /**
   * Update call status
   * @param {string} callId - Call ID
   * @param {string} status - New status
   * @param {Object} metadata - Additional metadata (startedAt, endedAt, callerRating, receiverRating, callerFeedback, receiverFeedback, etc.)
   * @returns {Promise<boolean>} Success status
   */
  static async updateStatus(callId, status, metadata = {}) {
    try {
      // Build dynamic UPDATE query based on metadata
      const updates = ['status = $1', 'updated_at = $2'];
      const values = [status, new Date()];
      let paramCounter = 3;

      // Map camelCase metadata keys to snake_case database columns
      const fieldMapping = {
        startedAt: 'started_at',
        endedAt: 'ended_at',
        callerRating: 'caller_rating',
        receiverRating: 'receiver_rating',
        callerFeedback: 'caller_feedback',
        receiverFeedback: 'receiver_feedback',
        duration: 'duration',
        callType: 'call_type',
        performer: 'performer',
        receiverId: 'receiver_id',
        receiverUsername: 'receiver_username',
        callerId: 'caller_id',
        callerUsername: 'caller_username',
        userName: 'user_name',
        paymentId: 'payment_id',
        scheduledDate: 'scheduled_date',
        scheduledTime: 'scheduled_time',
        scheduledAt: 'scheduled_at',
      };

      // Add metadata fields to update query
      Object.keys(metadata).forEach(key => {
        const dbField = fieldMapping[key] || key;
        updates.push(`${dbField} = $${paramCounter}`);
        values.push(metadata[key]);
        paramCounter++;
      });

      values.push(callId); // Add callId as the last parameter

      const updateQuery = `
        UPDATE private_calls
        SET ${updates.join(', ')}
        WHERE id = $${paramCounter}
      `;

      await query(updateQuery, values);

      logger.info('Call status updated', { callId, status, metadata });
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
    try {
      const now = new Date();

      // Use UPSERT (INSERT ... ON CONFLICT UPDATE) to handle both create and update
      const result = await query(
        `INSERT INTO call_availability (
          id, admin_id, available, message, valid_until, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (admin_id)
        DO UPDATE SET
          available = EXCLUDED.available,
          message = EXCLUDED.message,
          valid_until = EXCLUDED.valid_until,
          updated_at = EXCLUDED.updated_at
        RETURNING *`,
        [
          uuidv4(),
          availabilityData.adminId,
          availabilityData.available !== undefined ? availabilityData.available : true,
          availabilityData.message || null,
          availabilityData.validUntil || null,
          now,
          now
        ]
      );

      const availability = result.rows[0];
      logger.info('Admin availability set', { adminId: availabilityData.adminId });

      return {
        id: availability.id,
        adminId: availability.admin_id,
        available: availability.available,
        message: availability.message,
        validUntil: availability.valid_until,
        createdAt: availability.created_at,
        updatedAt: availability.updated_at,
      };
    } catch (error) {
      logger.error('Error setting admin availability:', error);
      throw error;
    }
  }

  /**
   * Get admin availability
   * @param {string} adminId - Admin ID (optional, if not provided returns latest)
   * @returns {Promise<Object|null>} Current availability
   */
  static async getAvailability(adminId = null) {
    try {
      let result;

      if (adminId) {
        result = await query(
          `SELECT * FROM call_availability
           WHERE admin_id = $1
           ORDER BY created_at DESC
           LIMIT 1`,
          [adminId]
        );
      } else {
        // Get the most recent availability record
        result = await query(
          `SELECT * FROM call_availability
           ORDER BY created_at DESC
           LIMIT 1`
        );
      }

      if (result.rows.length === 0) {
        return null;
      }

      const availability = result.rows[0];
      return {
        id: availability.id,
        adminId: availability.admin_id,
        available: availability.available,
        message: availability.message,
        validUntil: availability.valid_until,
        createdAt: availability.created_at,
        updatedAt: availability.updated_at,
      };
    } catch (error) {
      logger.error('Error getting admin availability:', error);
      return null;
    }
  }

  /**
   * Get upcoming calls
   * @param {Date} fromDate - Start date
   * @returns {Promise<Array>} Upcoming calls
   */
  static async getUpcoming(fromDate = new Date()) {
    try {
      const result = await query(
        `SELECT * FROM private_calls
         WHERE scheduled_at >= $1
           AND status = 'pending'
         ORDER BY scheduled_at ASC
         LIMIT 100`,
        [fromDate]
      );

      return result.rows.map(call => ({
        id: call.id,
        callerId: call.caller_id,
        callerUsername: call.caller_username,
        receiverId: call.receiver_id,
        receiverUsername: call.receiver_username,
        userName: call.user_name,
        paymentId: call.payment_id,
        scheduledDate: call.scheduled_date,
        scheduledTime: call.scheduled_time,
        scheduledAt: call.scheduled_at,
        duration: call.duration,
        performer: call.performer,
        status: call.status,
        callType: call.call_type,
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
    try {
      const result = await query(
        `SELECT
          COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
          COUNT(*) FILTER (WHERE status = 'active') as active_count,
          COUNT(*) as total_count,
          AVG(duration) FILTER (WHERE status = 'completed') as avg_duration,
          AVG(caller_rating) FILTER (WHERE caller_rating IS NOT NULL) as avg_caller_rating,
          AVG(receiver_rating) FILTER (WHERE receiver_rating IS NOT NULL) as avg_receiver_rating
         FROM private_calls`
      );

      const stats = result.rows[0];
      return {
        pending: parseInt(stats.pending_count) || 0,
        completed: parseInt(stats.completed_count) || 0,
        cancelled: parseInt(stats.cancelled_count) || 0,
        active: parseInt(stats.active_count) || 0,
        total: parseInt(stats.total_count) || 0,
        avgDuration: parseFloat(stats.avg_duration) || 0,
        avgCallerRating: parseFloat(stats.avg_caller_rating) || 0,
        avgReceiverRating: parseFloat(stats.avg_receiver_rating) || 0,
      };
    } catch (error) {
      logger.error('Error getting call statistics:', error);
      return {
        pending: 0,
        completed: 0,
        cancelled: 0,
        active: 0,
        total: 0,
        avgDuration: 0,
        avgCallerRating: 0,
        avgReceiverRating: 0,
      };
    }
  }
}

module.exports = CallModel;
