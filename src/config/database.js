const { initializeFirebase, getFirestore } = require('./firebase');
const logger = require('../utils/logger');

/**
 * Initialize Database (uses PostgreSQL)
 * This function is kept for backwards compatibility
 * @returns {null} Always returns null since we use PostgreSQL
 * @throws {Error} Always throws error since Firebase is disabled
 */
const initializeDatabase = () => {
  logger.error('❌ initializeDatabase() called but Firebase is DISABLED');
  logger.error('❌ This is a BUG - code should use PostgreSQL directly!');
  logger.error('❌ Please update the calling code to use postgres.js instead.');
  throw new Error('Firebase is disabled. Use PostgreSQL via postgres.js instead.');
};

/**
 * Get Database instance
 * This function is kept for backwards compatibility
 * @returns {null} Always returns null since we use PostgreSQL
 * @throws {Error} Always throws error since Firebase is disabled
 */
const getDatabase = () => {
  logger.error('❌ getDatabase() called but Firebase is DISABLED');
  logger.error('❌ This is a BUG - code should use PostgreSQL directly!');
  logger.error('❌ Please update the calling code to use postgres.js instead.');
  throw new Error('Firebase is disabled. Use PostgreSQL via postgres.js instead.');
};

/**
 * Test database connection
 * @returns {Promise<boolean>} true if connection successful
 */
const testConnection = async () => {
  try {
    const db = getFirestore();
    // Test Firestore connection by doing a simple query
    await db.collection('_test').doc('_test').get();
    logger.info('Firestore database connection successful');
    return true;
  } catch (error) {
    logger.error('Database connection failed:', error);
    return false;
  }
};

/**
 * Firestore doesn't require sync like relational databases
 * This is a no-op function for compatibility
 * @returns {Promise<void>}
 */
const syncDatabase = async () => {
  try {
    logger.info('Firestore does not require schema synchronization');
    return true;
  } catch (error) {
    logger.error('Failed to sync database:', error);
    throw error;
  }
};

/**
 * Close database connection
 * @returns {Promise<void>}
 */
const closeDatabase = async () => {
  try {
    const db = getFirestore();
    await db.terminate();
    logger.info('Firestore connection closed');
  } catch (error) {
    logger.error('Error closing database connection:', error);
  }
};

module.exports = {
  initializeDatabase,
  getDatabase,
  testConnection,
  syncDatabase,
  closeDatabase,
};
