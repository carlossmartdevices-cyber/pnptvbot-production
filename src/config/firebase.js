/**
 * Firebase stub - Firebase is not used in this project.
 * All data is stored in PostgreSQL.
 * This file is kept for backwards compatibility with any code that may still reference it.
 */
const logger = require('../utils/logger');

function initializeFirebase() {
  logger.info('Firebase is disabled - using PostgreSQL instead');
  return null;
}

function getFirestore() {
  logger.warn('getFirestore called but Firebase is disabled - use PostgreSQL instead');
  return null;
}

function getAdmin() {
  logger.warn('getAdmin called but Firebase is disabled');
  return null;
}

async function createIndexes() {
  // No-op - Firebase is not used
  return true;
}

// PaymentModel stub - the real implementation should be in models/paymentModel.js using PostgreSQL
class PaymentModel {
  static async createPayment() {
    throw new Error('Firebase PaymentModel is deprecated. Use PostgreSQL PaymentModel instead.');
  }

  static async updatePayment() {
    throw new Error('Firebase PaymentModel is deprecated. Use PostgreSQL PaymentModel instead.');
  }

  static async getPaymentById() {
    throw new Error('Firebase PaymentModel is deprecated. Use PostgreSQL PaymentModel instead.');
  }

  static async getPaymentsByUser() {
    throw new Error('Firebase PaymentModel is deprecated. Use PostgreSQL PaymentModel instead.');
  }

  static async getRevenue() {
    throw new Error('Firebase PaymentModel is deprecated. Use PostgreSQL PaymentModel instead.');
  }
}

module.exports = {
  initializeFirebase,
  getFirestore,
  getAdmin,
  createIndexes,
  PaymentModel,
};
