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
    throw error;
  }
}

/**
 * Get Firestore instance
 */
function getFirestore() {
  if (admin.apps.length === 0) {
    initializeFirebase();
  }
  return admin.firestore();
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
  ZOOM_ROOMS: 'zoom_rooms',
  SUPPORT_TICKETS: 'support_tickets',
  PAYMENTS: 'payments',
};

module.exports = {
  initializeFirebase,
  getFirestore,
  Collections,
  admin,
};
