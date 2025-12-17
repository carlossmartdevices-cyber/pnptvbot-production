const { initializeFirebase, getFirestore } = require('./firebase');
const logger = require('../utils/logger');

/**
 * Initialize Database (uses Firestore)
 * This function initializes the Firestore connection
 * @returns {admin.firestore.Firestore} Firestore instance
 */
const initializeDatabase = () => {
  try {
    const db = initializeFirebase();
    logger.info('Firestore database initialized successfully');
    return db;
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
};

/**
 * Get Firestore instance
 * Creates connection if not already created
 * @returns {admin.firestore.Firestore}
 */
const getDatabase = () => {
  return getFirestore();
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
