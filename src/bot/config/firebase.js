const admin = require('firebase-admin');
const logger = require('../../utils/logger');

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebase() {
  try {
    // Check if already initialized
    if (admin.apps.length > 0) {
      logger.info('Firebase already initialized');
      return admin.app();
    }

    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : null;

    if (!privateKey || !process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
      throw new Error('Missing Firebase credentials. Please check your .env file.');
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });

    logger.info('Firebase initialized successfully');
    return admin.app();
  } catch (error) {
    logger.error('Failed to initialize Firebase:', error);
    logger.warn('Firebase will not be available - bot will run in degraded mode');
    return null;
  }
}

/**
 * Get Firestore instance
 */
function getFirestore() {
  try {
    if (admin.apps.length === 0) {
      const app = initializeFirebase();
      if (!app) return null;
    }
    return admin.firestore();
  } catch (error) {
    logger.warn('Firestore not available:', error.message);
    return null;
  }
}

/**
 * Firestore collections
 */
const Collections = {
  USERS: 'users',
  PLANS: 'plans',
  BROADCASTS: 'broadcasts',
  ADMIN_LOGS: 'admin_logs',
  LIVE_STREAMS: 'live_streams',
  SUPPORT_TICKETS: 'support_tickets',
  PAYMENTS: 'payments',
};

module.exports = {
  initializeFirebase,
  getFirestore,
  Collections,
  admin,
};
