#!/usr/bin/env node
/**
 * Script to sync payment statuses with ePayco
 * Queries ePayco API for pending payments and updates database
 *
 * Usage: node scripts/sync-epayco-payments.js [--dry-run]
 */

require('dotenv').config();
const { query } = require('../src/config/database');
const { getEpaycoClient } = require('../src/config/epayco');
const logger = require('../src/utils/logger');

const isDryRun = process.argv.includes('--dry-run');

/**
 * Query ePayco for transaction status
 * @param {string} refPayco - ePayco reference
 * @returns {Object|null} Transaction data
 */
async function queryEpaycoTransaction(refPayco) {
  try {
    const epayco = getEpaycoClient();
    const response = await epayco.charge.get(refPayco);

    if (response && response.success && response.data) {
      return response.data;
    }
    return null;
  } catch (error) {
    logger.error(`Error querying ePayco for ref ${refPayco}:`, error.message);
    return null;
  }
}

/**
 * Map ePayco status to our status
 * @param {string} epaycoStatus - ePayco transaction state
 * @returns {string} Our status
 */
function mapEpaycoStatus(epaycoStatus) {
  const statusMap = {
    'Aceptada': 'completed',
    'Aprobada': 'completed',
    'Rechazada': 'failed',
    'Fallida': 'failed',
    'Pendiente': 'pending',
    'Cancelada': 'cancelled',
    'Reversada': 'refunded',
  };
  return statusMap[epaycoStatus] || 'pending';
}

/**
 * Get all pending payments from database
 */
async function getPendingPayments() {
  const result = await query(`
    SELECT
      id,
      reference,
      user_id,
      plan_id,
      amount,
      provider,
      status,
      transaction_id,
      metadata,
      created_at
    FROM payments
    WHERE status = 'pending'
      AND provider = 'epayco'
      AND created_at > NOW() - INTERVAL '30 days'
    ORDER BY created_at DESC
  `);
  return result.rows;
}

/**
 * Update payment status in database
 */
async function updatePaymentStatus(paymentId, status, epaycoData) {
  if (isDryRun) {
    console.log(`[DRY RUN] Would update payment ${paymentId} to status: ${status}`);
    return;
  }

  const metadata = {
    epayco_sync: true,
    epayco_sync_at: new Date().toISOString(),
    epayco_ref: epaycoData?.x_ref_payco,
    epayco_transaction_id: epaycoData?.x_transaction_id,
    epayco_approval_code: epaycoData?.x_approval_code,
    epayco_franchise: epaycoData?.x_franchise,
    epayco_response: epaycoData?.x_response,
  };

  const updateQuery = `
    UPDATE payments
    SET
      status = $1,
      transaction_id = COALESCE($2, transaction_id),
      updated_at = NOW(),
      completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END,
      metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
    WHERE id = $4
    RETURNING id, status
  `;

  const result = await query(updateQuery, [
    status,
    epaycoData?.x_transaction_id || null,
    JSON.stringify(metadata),
    paymentId,
  ]);

  return result.rows[0];
}

/**
 * Activate user subscription if payment completed
 */
async function activateSubscription(userId, planId, paymentId) {
  if (isDryRun) {
    console.log(`[DRY RUN] Would activate subscription for user ${userId}, plan ${planId}`);
    return;
  }

  try {
    // Get plan details
    const planResult = await query('SELECT * FROM plans WHERE id = $1', [planId]);
    const plan = planResult.rows[0];

    if (!plan) {
      logger.warn(`Plan not found: ${planId}`);
      return;
    }

    const durationDays = plan.duration_days || plan.duration || 30;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + durationDays);

    // Update user subscription
    await query(`
      UPDATE users
      SET
        subscription_status = 'active',
        plan_id = $1,
        plan_expiry = $2,
        updated_at = NOW()
      WHERE id = $3
    `, [planId, expiryDate, userId]);

    logger.info('Subscription activated via sync', {
      userId,
      planId,
      paymentId,
      expiryDate,
    });
  } catch (error) {
    logger.error('Error activating subscription:', error);
  }
}

/**
 * Main sync function
 */
async function syncPayments() {
  console.log('='.repeat(60));
  console.log('ePayco Payment Sync Script');
  console.log('='.repeat(60));

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  try {
    // Get pending payments
    const pendingPayments = await getPendingPayments();
    console.log(`Found ${pendingPayments.length} pending ePayco payments to check\n`);

    if (pendingPayments.length === 0) {
      console.log('No pending payments to sync.');
      return;
    }

    let updated = 0;
    let completed = 0;
    let failed = 0;
    let unchanged = 0;
    let errors = 0;

    for (const payment of pendingPayments) {
      const refPayco = payment.reference || payment.metadata?.epayco_ref;

      if (!refPayco) {
        console.log(`  ⚠️  Payment ${payment.id} has no ePayco reference, skipping`);
        continue;
      }

      console.log(`\nChecking payment ${payment.id}...`);
      console.log(`  Reference: ${refPayco}`);
      console.log(`  User: ${payment.user_id}`);
      console.log(`  Amount: ${payment.amount} ${payment.currency || 'COP'}`);
      console.log(`  Created: ${payment.created_at}`);

      try {
        const epaycoData = await queryEpaycoTransaction(refPayco);

        if (epaycoData) {
          const newStatus = mapEpaycoStatus(epaycoData.x_transaction_state);

          console.log(`  ePayco Status: ${epaycoData.x_transaction_state} -> ${newStatus}`);

          if (newStatus !== 'pending') {
            await updatePaymentStatus(payment.id, newStatus, epaycoData);
            updated++;

            if (newStatus === 'completed') {
              completed++;
              await activateSubscription(payment.user_id, payment.plan_id, payment.id);
              console.log(`  ✅ Payment completed - subscription activated`);
            } else if (newStatus === 'failed') {
              failed++;
              console.log(`  ❌ Payment failed`);
            }
          } else {
            unchanged++;
            console.log(`  ⏳ Still pending`);
          }
        } else {
          console.log(`  ⚠️  No data from ePayco`);
          errors++;
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        errors++;
      }

      // Rate limiting - wait 500ms between API calls
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n' + '='.repeat(60));
    console.log('SYNC SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total checked: ${pendingPayments.length}`);
    console.log(`Updated: ${updated}`);
    console.log(`  - Completed: ${completed}`);
    console.log(`  - Failed: ${failed}`);
    console.log(`Unchanged: ${unchanged}`);
    console.log(`Errors: ${errors}`);

  } catch (error) {
    console.error('Error in sync:', error);
    process.exit(1);
  }
}

// Run sync
syncPayments()
  .then(() => {
    console.log('\nSync completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Sync failed:', error);
    process.exit(1);
  });
