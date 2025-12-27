#!/usr/bin/env node

/**
 * Reactivate all completed payments from ePayco and Daimo
 * This script finds all completed payments and activates user subscriptions
 *
 * Usage:
 *   node scripts/reactivate-completed-payments.js [--provider epayco|daimo|all] [--dry-run] [--send-notifications]
 *
 * Examples:
 *   node scripts/reactivate-completed-payments.js                          # All providers
 *   node scripts/reactivate-completed-payments.js --provider epayco        # ePayco only
 *   node scripts/reactivate-completed-payments.js --provider daimo         # Daimo only
 *   node scripts/reactivate-completed-payments.js --dry-run                # Preview changes
 *   node scripts/reactivate-completed-payments.js --send-notifications     # Send confirmations to users
 */

require('dotenv').config();
const PaymentModel = require('../src/models/paymentModel');
const UserModel = require('../src/models/userModel');
const PlanModel = require('../src/models/planModel');
const logger = require('../src/utils/logger');
const PaymentService = require('../src/bot/services/paymentService');
const { Telegraf } = require('telegraf');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const sendNotifications = args.includes('--send-notifications');
const providerArg = args.find(arg => arg.startsWith('--provider='));
const provider = providerArg ? providerArg.split('=')[1] : 'all';

const VALID_PROVIDERS = ['epayco', 'daimo', 'paypal'];
const PROVIDERS_TO_PROCESS = provider === 'all'
  ? ['epayco', 'daimo']
  : [provider];

// Validate provider argument
if (!PROVIDERS_TO_PROCESS.every(p => VALID_PROVIDERS.includes(p))) {
  console.error('❌ Invalid provider. Use: epayco, daimo, all');
  process.exit(1);
}

/**
 * Calculate subscription expiry date based on plan duration
 */
function calculateExpiryDate(planDuration) {
  if (!planDuration) return null;

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + parseInt(planDuration));
  return expiryDate;
}

/**
 * Format currency for display
 */
function formatCurrency(amount) {
  return `$${parseFloat(amount || 0).toFixed(2)} USD`;
}

/**
 * Reactivate a single payment
 */
async function reactivatePayment(payment, bot) {
  try {
    const { id: paymentId, user_id: userId, plan_id: planId, provider, amount, created_at } = payment;

    // Get plan details
    const plan = await PlanModel.getById(planId);
    if (!plan) {
      logger.warn(`Plan not found for payment ${paymentId}`, { planId });
      return { success: false, error: 'Plan not found', paymentId };
    }

    // Calculate expiry date
    const expiryDate = calculateExpiryDate(plan.duration_days);

    // Get user details
    const user = await UserModel.getById(userId);
    if (!user) {
      logger.warn(`User not found for payment ${paymentId}`, { userId });
      return { success: false, error: 'User not found', paymentId };
    }

    // Prepare subscription update
    const updateData = {
      status: 'active',
      planId,
      expiry: expiryDate,
    };

    if (dryRun) {
      console.log(`\n📋 [DRY-RUN] Would reactivate payment:`);
      console.log(`   Payment ID: ${paymentId}`);
      console.log(`   User ID: ${userId} (@${user.username || 'N/A'})`);
      console.log(`   Plan: ${plan.display_name || plan.name}`);
      console.log(`   Amount: ${formatCurrency(amount)}`);
      console.log(`   Provider: ${provider.toUpperCase()}`);
      console.log(`   Expiry: ${expiryDate ? expiryDate.toISOString().split('T')[0] : 'Lifetime'}`);
      return { success: true, paymentId, dryRun: true };
    }

    // Update user subscription
    await UserModel.updateSubscription(userId, updateData);

    logger.info('Payment reactivated', {
      paymentId,
      userId,
      planId,
      provider,
      expiryDate,
    });

    // Send payment confirmation notification if requested
    if (sendNotifications && bot) {
      try {
        await PaymentService.sendPaymentConfirmationNotification({
          userId,
          plan,
          transactionId: payment.reference || paymentId,
          amount: parseFloat(amount),
          expiryDate,
          language: user.language || 'es',
        });
        console.log(`   ✅ Notification sent to user ${userId}`);
      } catch (notifError) {
        logger.error('Error sending notification:', {
          userId,
          error: notifError.message,
        });
        console.log(`   ⚠️  Notification failed for user ${userId}`);
      }
    }

    return {
      success: true,
      paymentId,
      userId,
      plan: plan.display_name || plan.name,
      amount: parseFloat(amount),
      expiryDate,
    };
  } catch (error) {
    logger.error('Error reactivating payment:', {
      paymentId: payment.id,
      error: error.message,
    });
    return {
      success: false,
      error: error.message,
      paymentId: payment.id,
    };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔄 Reactivating Completed Payments');
  console.log(`📦 Providers: ${PROVIDERS_TO_PROCESS.map(p => p.toUpperCase()).join(', ')}`);
  console.log(`${dryRun ? '🔍 DRY-RUN MODE' : '⚙️  LIVE MODE'}`);
  console.log(`${sendNotifications ? '📨 Will send notifications' : '🤫 No notifications'}`);
  console.log('─'.repeat(60));

  let bot = null;
  if (sendNotifications) {
    try {
      bot = new Telegraf(process.env.BOT_TOKEN);
    } catch (error) {
      logger.error('Failed to initialize bot for notifications:', error);
      console.warn('⚠️  Bot initialization failed, notifications will be skipped');
    }
  }

  let totalPayments = 0;
  let successCount = 0;
  let failureCount = 0;
  const results = [];

  try {
    // Process each provider
    for (const prov of PROVIDERS_TO_PROCESS) {
      console.log(`\n📍 Processing ${prov.toUpperCase()} payments...`);

      try {
        // Query all completed payments for this provider
        const payments = await PaymentModel.getAll({
          status: 'completed',
          provider: prov,
          limit: 1000,
        });

        if (!payments || payments.length === 0) {
          console.log(`   No completed ${prov.toUpperCase()} payments found`);
          continue;
        }

        console.log(`   Found ${payments.length} completed payments`);

        // Process each payment
        for (const payment of payments) {
          totalPayments++;
          const result = await reactivatePayment(payment, bot);

          if (result.success) {
            successCount++;
            results.push({
              status: 'success',
              ...result,
            });
          } else {
            failureCount++;
            results.push({
              status: 'failed',
              ...result,
            });
            console.log(`   ❌ Failed: ${result.error}`);
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        logger.error(`Error processing ${prov} payments:`, error);
        console.error(`   ❌ Error: ${error.message}`);
      }
    }

    // Summary
    console.log('\n' + '─'.repeat(60));
    console.log('📊 Summary:');
    console.log(`   Total processed: ${totalPayments}`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failureCount}`);

    if (dryRun) {
      console.log('\n🔍 DRY-RUN COMPLETE - No changes were made');
    } else {
      console.log('\n✅ Reactivation complete!');
    }

    // Show any failures
    const failures = results.filter(r => r.status === 'failed');
    if (failures.length > 0) {
      console.log('\n⚠️  Failed Payments:');
      failures.forEach(failure => {
        console.log(`   - ${failure.paymentId}: ${failure.error}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    logger.error('Fatal error in reactivation script:', error);
    process.exit(1);
  }
}

// Run the script
main();
