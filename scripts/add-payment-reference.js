#!/usr/bin/env node
/**
 * Add Payment Reference Script
 * Manually adds ePayco reference (x_ref_payco) to existing payment records
 * 
 * Usage:
 *   node scripts/add-payment-reference.js <payment_id> <epayco_reference>
 * 
 * Example:
 *   node scripts/add-payment-reference.js 1df99d7b-b9ef-4c18-9d44-3ecf1591551a 320358448
 */

require('dotenv').config();
const PaymentModel = require('../src/models/paymentModel');
const logger = require('../src/utils/logger');

async function addPaymentReference(paymentId, reference) {
  try {
    console.log('\n🔍 Adding payment reference...');
    console.log(`Payment ID: ${paymentId}`);
    console.log(`Reference: ${reference}`);
    console.log('');

    // Get payment
    const payment = await PaymentModel.getById(paymentId);
    
    if (!payment) {
      console.error(`❌ Payment not found: ${paymentId}`);
      process.exit(1);
    }

    console.log('Current payment details:');
    console.log(`  User ID: ${payment.user_id}`);
    console.log(`  Provider: ${payment.provider}`);
    console.log(`  Status: ${payment.status}`);
    console.log(`  Amount: $${payment.amount}`);
    console.log(`  Current Reference: ${payment.reference || '(empty)'}`);
    console.log('');

    // Update reference
    const success = await PaymentModel.updateStatus(paymentId, payment.status, {
      epaycoRef: reference,
    });

    if (success) {
      console.log('✅ Payment reference updated successfully!');
      
      // Verify update
      const updatedPayment = await PaymentModel.getById(paymentId);
      console.log(`New reference: ${updatedPayment.reference}`);
    } else {
      console.error('❌ Failed to update payment reference');
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error adding payment reference:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: node scripts/add-payment-reference.js <payment_id> <epayco_reference>');
  console.log('');
  console.log('Example:');
  console.log('  node scripts/add-payment-reference.js 1df99d7b-b9ef-4c18-9d44-3ecf1591551a 320358448');
  process.exit(1);
}

const [paymentId, reference] = args;

addPaymentReference(paymentId, reference);
