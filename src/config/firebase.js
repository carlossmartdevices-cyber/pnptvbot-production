const admin = require('firebase-admin');
const logger = require('../utils/logger');

let db = null;

/**
 * Initialize Firebase Admin SDK
 * @returns {admin.firestore.Firestore} Firestore instance
 */
const initializeFirebase = () => {
  try {
    if (db) {
      return db;
    }

    // Initialize with environment variables
    const serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });

    db = admin.firestore();

    // Configure Firestore settings
    db.settings({
      ignoreUndefinedProperties: true,
      timestampsInSnapshots: true,
    });

    logger.info('Firebase initialized successfully');
    return db;
  } catch (error) {
    logger.error('Failed to initialize Firebase:', error);
    throw error;
  }
};

/**
 * Get Firestore instance
 * @returns {admin.firestore.Firestore}
 */
const getFirestore = () => {
  if (!db) {
    return initializeFirebase();
  }
  return db;
};

/**
 * Get Firebase Admin instance
 * @returns {admin.app.App}
 */
const getAdmin = () => admin;

/**
 * Create Firestore indexes (to be run during deployment)
 */
const createIndexes = async () => {
  const indexes = [
    {
      collectionGroup: 'users',
      fields: [
        { fieldPath: 'subscriptionStatus', order: 'ASCENDING' },
        { fieldPath: 'planExpiry', order: 'ASCENDING' },
      ],
    },
    {
      collectionGroup: 'users',
      fields: [
        { fieldPath: 'location.lat', order: 'ASCENDING' },
        { fieldPath: 'location.lng', order: 'ASCENDING' },
      ],
    },
    {
      collectionGroup: 'users',
      fields: [
        { fieldPath: 'interests', mode: 'ARRAY_CONTAINS' },
        { fieldPath: 'subscriptionStatus', order: 'ASCENDING' },
      ],
    },
    {
      collectionGroup: 'payments',
      fields: [
        { fieldPath: 'userId', order: 'ASCENDING' },
        { fieldPath: 'createdAt', order: 'DESCENDING' },
      ],
    },
    {
      collectionGroup: 'liveStreams',
      fields: [
        { fieldPath: 'status', order: 'ASCENDING' },
        { fieldPath: 'createdAt', order: 'DESCENDING' },
      ],
    },
  ];

  logger.info('Firestore indexes configuration:', JSON.stringify(indexes, null, 2));
  logger.info('Run: firebase deploy --only firestore:indexes');
};

module.exports = {
  initializeFirebase,
  getFirestore,
  getAdmin,
  createIndexes,
};
