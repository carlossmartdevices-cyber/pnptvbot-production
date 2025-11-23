#!/usr/bin/env node
/**
 * Batch Add Payment References
 * Add multiple payment references at once from a list
 * 
 * Usage:
 *   node scripts/batch-add-references.js
 * 
 * Then follow the interactive prompts, or edit the REFERENCES array below
 */

require('dotenv').config();
const PaymentModel = require('../src/models/paymentModel');
const { query } = require('../src/config/postgres');
const readline = require('readline');

// Edit this array to add references in batch
// Format: { payment_id: 'uuid', reference: 'epayco_ref' }
const REFERENCES_TO_ADD = [
  // Example:
  // { payment_id: '1df99d7b-b9ef-4c18-9d44-3ecf1591551a', reference: '320358448' },
  // { payment_id: 'another-payment-id', reference: '320357719' },
];

async function showRecentPayments() {
  console.log('\n📋 Recent Completed Payments (Last 20):\n');
  
  const result = await query(`
    SELECT 
      p.id,
      p.user_id,
      u.username,
      u.first_name,
      p.provider,
      p.amount,
      p.currency,
      p.reference,
      p.completed_at
    FROM payments p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.status = 'completed'
    ORDER BY p.completed_at DESC
    LIMIT 20
  `);

  result.rows.forEach((payment, index) => {
    console.log(`${index + 1}. Payment ID: ${payment.id}`);
    console.log(`   User: @${payment.username || 'no_username'} (${payment.user_id})`);
    console.log(`   Name: ${payment.first_name || 'Unknown'}`);
    console.log(`   Amount: ${payment.amount} ${payment.currency || 'USD'}`);
    console.log(`   Provider: ${payment.provider}`);
    console.log(`   Reference: ${payment.reference || '(not set)'}`);
    console.log(`   Completed: ${payment.completed_at ? new Date(payment.completed_at).toLocaleString() : 'N/A'}`);
    console.log('');
  });
}

async function addReferencesFromArray(references) {
  console.log(`\n📝 Adding ${references.length} payment reference(s)...\n`);
  
  let successCount = 0;
  let failCount = 0;

  for (const item of references) {
    try {
      const { payment_id, reference } = item;
      
      console.log(`Processing: ${payment_id} → ${reference}`);
      
      // Get payment
      const payment = await PaymentModel.getById(payment_id);
      
      if (!payment) {
        console.error(`  ❌ Payment not found: ${payment_id}`);
        failCount++;
        continue;
      }

      // Update reference
      const success = await PaymentModel.updateStatus(payment_id, payment.status, {
        epaycoRef: reference,
      });

      if (success) {
        console.log(`  ✅ Reference added successfully`);
        successCount++;
      } else {
        console.error(`  ❌ Failed to update reference`);
        failCount++;
      }
    } catch (error) {
      console.error(`  ❌ Error:`, error.message);
      failCount++;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`Results: ${successCount} successful, ${failCount} failed`);
  console.log('═'.repeat(60) + '\n');
}

async function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = (question) => {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  };

  console.log('\n🔧 BATCH ADD PAYMENT REFERENCES\n');
  console.log('This tool helps you add ePayco references to existing payments.');
  console.log('');

  const action = await askQuestion('Show recent payments? (yes/no): ');
  
  if (action.toLowerCase().startsWith('y')) {
    await showRecentPayments();
  }

  console.log('');
  console.log('To add references, you can either:');
  console.log('1. Edit REFERENCES_TO_ADD array in this script and run again');
  console.log('2. Use individual script: node scripts/add-payment-reference.js <payment_id> <reference>');
  console.log('');

  const addNow = await askQuestion('Add a reference now? (yes/no): ');
  
  if (addNow.toLowerCase().startsWith('y')) {
    const paymentId = await askQuestion('Payment ID: ');
    const reference = await askQuestion('ePayco Reference: ');
    
    if (paymentId && reference) {
      await addReferencesFromArray([{ payment_id: paymentId, reference }]);
    }
  }

  rl.close();
}

// Main execution
(async () => {
  try {
    if (REFERENCES_TO_ADD.length > 0) {
      await addReferencesFromArray(REFERENCES_TO_ADD);
    } else {
      await interactiveMode();
    }
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
