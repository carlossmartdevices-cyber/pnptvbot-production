#!/usr/bin/env node
/**
 * Find Payment by ePayco Reference
 * Search for payment records by ePayco reference (Ref.Payco)
 * 
 * Usage:
 *   node scripts/find-payment-by-reference.js <epayco_reference>
 * 
 * Example:
 *   node scripts/find-payment-by-reference.js 320358448
 */

require('dotenv').config();
const { query } = require('../src/config/postgres');
const logger = require('../src/utils/logger');

async function findPaymentByReference(reference) {
  try {
    console.log('\n🔍 Searching for payment by reference...');
    console.log(`ePayco Reference: ${reference}`);
    console.log('');

    // Search by reference field
    const result = await query(
      `SELECT 
        id,
        user_id,
        plan_id,
        provider,
        amount,
        currency,
        status,
        reference,
        payment_id,
        completed_at,
        created_at
      FROM payments 
      WHERE reference = $1 OR payment_id = $1
      ORDER BY created_at DESC`,
      [reference]
    );

    if (result.rows.length === 0) {
      console.log('❌ No payment found with this reference');
      console.log('');
      console.log('💡 Tip: If this is an old payment, you may need to add the reference manually using:');
      console.log(`   node scripts/add-payment-reference.js <payment_id> ${reference}`);
      process.exit(0);
    }

    console.log(`✅ Found ${result.rows.length} payment(s):\n`);

    result.rows.forEach((payment, index) => {
      console.log(`Payment ${index + 1}:`);
      console.log(`  Payment ID: ${payment.id}`);
      console.log(`  User ID: ${payment.user_id}`);
      console.log(`  Plan ID: ${payment.plan_id || '(not set)'}`);
      console.log(`  Provider: ${payment.provider}`);
      console.log(`  Amount: ${payment.amount} ${payment.currency || 'USD'}`);
      console.log(`  Status: ${payment.status}`);
      console.log(`  Reference: ${payment.reference || '(not set)'}`);
      console.log(`  Payment ID: ${payment.payment_id || '(not set)'}`);
      console.log(`  Completed At: ${payment.completed_at || 'Not completed'}`);
      console.log(`  Created At: ${payment.created_at}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('Error searching for payment:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 1) {
  console.log('Usage: node scripts/find-payment-by-reference.js <epayco_reference>');
  console.log('');
  console.log('Example:');
  console.log('  node scripts/find-payment-by-reference.js 320358448');
  process.exit(1);
}

const reference = args[0];

findPaymentByReference(reference);
