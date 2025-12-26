const { getFirestore } = require('../config/firebase');
const logger = require('./logger');

/**
 * Log admin actions to Firestore for audit trail
 * @param {Object} params - Log parameters
 * @param {number|string} params.adminId - Admin user ID
 * @param {string} params.action - Action performed
 * @param {number|string} params.targetUserId - Target user ID (optional)
 * @param {Object} params.metadata - Additional metadata (optional)
 * @returns {Promise<boolean>} Success status
 */
const logAdminAction = async ({ adminId, action, targetUserId = null, metadata = {} }) => {
  try {
    const db = getFirestore();
    const logEntry = {
      adminId: adminId.toString(),
      action,
      targetUserId: targetUserId ? targetUserId.toString() : null,
      metadata,
      timestamp: new Date(),
      environment: process.env.NODE_ENV || 'development',
    };

    await db.collection('admin_logs').add(logEntry);

    logger.info('Admin action logged', {
      adminId,
      action,
      targetUserId,
    });

    return true;
  } catch (error) {
    logger.error('Failed to log admin action:', error);
    return false;
  }
};

/**
 * Get admin action logs
 * @param {Object} options - Query options
 * @param {number|string} options.adminId - Filter by admin ID (optional)
 * @param {string} options.action - Filter by action type (optional)
 * @param {number} options.limit - Number of records to return
 * @param {Date} options.startDate - Start date for filtering (optional)
 * @param {Date} options.endDate - End date for filtering (optional)
 * @returns {Promise<Array>} Admin action logs
 */
const getAdminLogs = async ({ adminId, action, limit = 100, startDate, endDate } = {}) => {
  try {
    const db = getFirestore();
    let query = db.collection('admin_logs').orderBy('timestamp', 'desc');

    if (adminId) {
      query = query.where('adminId', '==', adminId.toString());
    }

    if (action) {
      query = query.where('action', '==', action);
    }

    if (startDate) {
      query = query.where('timestamp', '>=', startDate);
    }

    if (endDate) {
      query = query.where('timestamp', '<=', endDate);
    }

    query = query.limit(limit);

    const snapshot = await query.get();
    const logs = [];

    snapshot.forEach((doc) => {
      logs.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return logs;
  } catch (error) {
    logger.error('Failed to get admin logs:', error);
    return [];
  }
};

module.exports = {
  logAdminAction,
  getAdminLogs,
};
