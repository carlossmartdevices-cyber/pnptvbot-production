
const { Firestore } = require('@google-cloud/firestore');
let firestoreInstance;
function getFirestore() {
  if (!firestoreInstance) {
    firestoreInstance = new Firestore();
  }
  return firestoreInstance;
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
  getFirestore,
  PaymentModel
};
