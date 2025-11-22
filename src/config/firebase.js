const logger = require('../utils/logger');

/**
 * Firebase Configuration Module
 * Note: This application uses PostgreSQL as primary storage (not Firebase/Firestore)
 * Firebase is optional for additional features, but not required for core functionality
 */

let firestoreInstance = null;

/**
 * Initialize Firebase/Firestore (optional)
 * Returns null by default since app uses PostgreSQL
 * @returns {Object|null} Always returns null - use PostgreSQL instead
 */
const initializeFirestore = () => {
  logger.info('Firebase is not used in this application. Using PostgreSQL for data storage.');
  return null;
};

/**
 * Get Firestore instance
 * @returns {Object|null} Always returns null - PostgreSQL is used instead
 */
const getFirestore = () => {
  return null;
};

/**
 * Check if Firestore is available
 * @returns {boolean} Always false - PostgreSQL is the primary storage
 */
const isFirestoreAvailable = () => {
  return false;
};

module.exports = {
  initializeFirestore,
  getFirestore,
  isFirestoreAvailable,
};
