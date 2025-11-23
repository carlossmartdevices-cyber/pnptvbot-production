// Manual test script for support group notification
// Usage: node scripts/test-support-group-notification.js

require('dotenv').config();
const PaymentService = require('../src/bot/services/paymentService');

(async () => {
  const testData = {
    userId: '123456789', // Replace with a real/test Telegram user ID
    customerName: 'Test User',
    customerEmail: 'testuser@example.com',
    plan: { name: 'Lifetime', display_name: 'Lifetime Pass' },
    amount: 99.99,
    currency: 'USD',
    transactionId: 'TESTTX123456',
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
  };

  try {
    const result = await PaymentService.sendSupportGroupNotification(testData);
    console.log('Support group notification sent:', result);
  } catch (err) {
    console.error('Error sending support group notification:', err);
  }
})();
