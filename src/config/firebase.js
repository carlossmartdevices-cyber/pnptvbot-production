

const admin = require('firebase-admin');
const logger = require('../utils/logger');

let db = null;

function initializeFirebase() {
  if (db) return db;
  try {
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
    db.settings({ ignoreUndefinedProperties: true });
    logger.info('Firebase initialized successfully');
    return db;
  } catch (error) {
    logger.error('Failed to initialize Firebase:', error);
    throw error;
  }
}

function getFirestore() {
  if (!db) {
    return initializeFirebase();
  }
  return db;
}


function getAdmin() {
  return admin;
}

async function createIndexes() {
  // Placeholder for creating necessary Firestore indexes in production.
  // For tests this is a no-op.
  return true;
}

class PaymentModel {
  static async createPayment({ userId, planId, provider, sku, amount, status = 'pending', invoiceId = null }) {
    const db = getFirestore();
    const docRef = db.collection('payments').doc();
    await docRef.set({
      userId,
      planId,
      provider,
      sku,
      amount,
      status,
      invoiceId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return docRef.id;
  }

  static async updatePayment(paymentId, updates) {
    const db = getFirestore();
    await db.collection('payments').doc(paymentId).update({
      ...updates,
      updatedAt: new Date(),
    });
  }

  static async getPaymentById(paymentId) {
    const db = getFirestore();
    const doc = await db.collection('payments').doc(paymentId).get();
    return doc.exists ? doc.data() : null;
  }

  static async getPaymentsByUser(userId) {
    const db = getFirestore();
    const snapshot = await db.collection('payments').where('userId', '==', userId).get();
    return snapshot.docs.map(doc => doc.data());
  }

  static async getRevenue(startDate, endDate) {
    const db = getFirestore();
    const snapshot = await db.collection('payments')
      .where('status', '==', 'completed')
      .where('createdAt', '>=', startDate)
      .where('createdAt', '<=', endDate)
      .get();
    const payments = snapshot.docs.map(doc => doc.data());
    const total = payments.reduce((sum, p) => sum + p.amount, 0);
    return { total, count: payments.length, average: total / payments.length };
  }
}


module.exports = {
  initializeFirebase,
  getFirestore,
  getAdmin,
  createIndexes,
  PaymentModel,
};
