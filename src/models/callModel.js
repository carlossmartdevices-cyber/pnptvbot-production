const { v4: uuidv4 } = require('uuid');
const { getFirestore } = require('../config/firebase');
const logger = require('../utils/logger');

const COLLECTION = 'privateCalls';
const AVAILABILITY_COLLECTION = 'callAvailability';

/**
 * Call Model - Manages 1:1 private calls
 */
class CallModel {
  /**
   * Create a new call booking
   * @param {Object} callData - { userId, userName, paymentId, scheduledDate, scheduledTime, duration, performer }
   * @returns {Promise<Object>} Created call
   */
  static async create(callData) {
    try {
      const db = getFirestore();
      const callId = uuidv4();
      const callRef = db.collection(COLLECTION).doc(callId);

      const data = {
        ...callData,
        status: 'pending', // pending, confirmed, completed, cancelled
        createdAt: new Date(),
        updatedAt: new Date(),
        meetingUrl: null,
        reminderSent: false,
        performer: callData.performer || 'Santino', // Default performer
      };

      await callRef.set(data);

      logger.info('Private call booking created', {
        callId,
        userId: callData.userId,
        performer: data.performer,
      });
      return { id: callId, ...data };
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
      const db = getFirestore();
      const doc = await db.collection(COLLECTION).doc(callId).get();

      if (!doc.exists) {
        return null;
      }

      return { id: doc.id, ...doc.data() };
    } catch (error) {
      logger.error('Error getting call:', error);
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
      const db = getFirestore();
      const snapshot = await db.collection(COLLECTION)
        .where('userId', '==', userId.toString())
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const calls = [];
      snapshot.forEach((doc) => {
        calls.push({ id: doc.id, ...doc.data() });
      });

      return calls;
    } catch (error) {
      logger.error('Error getting user calls:', error);
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
    try {
      const db = getFirestore();
      const availabilityRef = db.collection(AVAILABILITY_COLLECTION).doc('current');

      const data = {
        ...availabilityData,
        updatedAt: new Date(),
      };

      await availabilityRef.set(data, { merge: true });

      logger.info('Call availability updated', {
        adminId: availabilityData.adminId,
        available: availabilityData.available,
      });

      return data;
    } catch (error) {
      logger.error('Error setting availability:', error);
      throw error;
    }
  }

  /**
   * Get current availability
   * @returns {Promise<Object|null>} Current availability
   */
  static async getAvailability() {
    try {
      const db = getFirestore();
      const doc = await db.collection(AVAILABILITY_COLLECTION).doc('current').get();

      if (!doc.exists) {
        return { available: false, message: 'Not available' };
      }

      const data = doc.data();

      // Check if availability has expired
      if (data.validUntil && new Date(data.validUntil.toDate()) < new Date()) {
        return { available: false, message: 'Availability expired' };
      }

      return data;
    } catch (error) {
      logger.error('Error getting availability:', error);
      return { available: false, message: 'Error checking availability' };
    }
  }

  /**
   * Get upcoming calls
   * @param {Date} fromDate - Start date
   * @returns {Promise<Array>} Upcoming calls
   */
  static async getUpcoming(fromDate = new Date()) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(COLLECTION)
        .where('status', 'in', ['pending', 'confirmed'])
        .where('scheduledDate', '>=', fromDate)
        .orderBy('scheduledDate', 'asc')
        .limit(50)
        .get();

      const calls = [];
      snapshot.forEach((doc) => {
        calls.push({ id: doc.id, ...doc.data() });
      });

      return calls;
    } catch (error) {
      logger.error('Error getting upcoming calls:', error);
      return [];
    }
  }

  /**
   * Get call statistics
   * @returns {Promise<Object>} Call statistics
   */
  static async getStatistics() {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(COLLECTION).get();

      const stats = {
        total: 0,
        pending: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0,
        revenue: 0,
      };

      snapshot.forEach((doc) => {
        const call = doc.data();
        stats.total += 1;
        stats[call.status] = (stats[call.status] || 0) + 1;
        if (call.status === 'completed') {
          stats.revenue += call.amount || 100; // Default $100
        }
      });

      return stats;
    } catch (error) {
      logger.error('Error getting call statistics:', error);
      return {
        total: 0,
        pending: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0,
        revenue: 0,
      };
    }
  }
}

module.exports = CallModel;
