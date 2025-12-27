#!/usr/bin/env node

/**
 * Analyze payment and subscription status
 * Shows which users have completed payments but inactive subscriptions
 *
 * Usage:
 *   node scripts/analyze-payments-status.js [--provider epayco|daimo|all]
 */

require('dotenv').config();
const PaymentModel = require('../src/models/paymentModel');
const UserModel = require('../src/models/userModel');
const logger = require('../src/utils/logger');

const args = process.argv.slice(2);
const providerArg = args.find(arg => arg.startsWith('--provider='));
const provider = providerArg ? providerArg.split('=')[1] : 'all';

const VALID_PROVIDERS = ['epayco', 'daimo', 'paypal'];
const PROVIDERS_TO_CHECK = provider === 'all'
  ? ['epayco', 'daimo']
  : [provider];

if (!PROVIDERS_TO_CHECK.every(p => VALID_PROVIDERS.includes(p))) {
  console.error('❌ Invalid provider. Use: epayco, daimo, all');
  process.exit(1);
}

async function analyzePayments() {
  console.log('📊 Payment & Subscription Analysis');
  console.log(`📦 Providers: ${PROVIDERS_TO_CHECK.map(p => p.toUpperCase()).join(', ')}`);
  console.log('─'.repeat(80));

  const stats = {
    totalCompleted: 0,
    activeSubscriptions: 0,
    inactiveSubscriptions: 0,
    byProvider: {},
  };

  const needsReactivation = [];

  try {
    for (const prov of PROVIDERS_TO_CHECK) {
      console.log(`\n📍 ${prov.toUpperCase()} Payments:`);

      // Get all completed payments for this provider
      const payments = await PaymentModel.getAll({
        status: 'completed',
        provider: prov,
        limit: 10000,
      });

      if (!payments || payments.length === 0) {
        console.log(`   No completed payments found`);
        stats.byProvider[prov] = {
          total: 0,
          active: 0,
          inactive: 0,
        };
        continue;
      }

      let activeCount = 0;
      let inactiveCount = 0;

      // Check each payment
      for (const payment of payments) {
        const { user_id: userId, plan_id: planId, amount, created_at } = payment;

        const user = await UserModel.getById(userId);

        if (!user) {
          inactiveCount++;
          needsReactivation.push({
            paymentId: payment.id,
            userId,
            provider: prov,
            amount,
            createdAt: created_at,
            reason: 'User not found',
          });
          continue;
        }

        const isActive = user.subscription_status === 'active';
        const hasCorrectPlan = user.plan_id === planId;

        if (isActive && hasCorrectPlan) {
          activeCount++;
        } else {
          inactiveCount++;
          needsReactivation.push({
            paymentId: payment.id,
            userId,
            userHandle: `@${user.username || 'unknown'}`,
            provider: prov,
            amount,
            createdAt: created_at,
            currentStatus: user.subscription_status,
            currentPlan: user.plan_id,
            expectedPlan: planId,
            reason: !isActive ? 'Subscription inactive' : 'Wrong plan',
          });
        }
      }

      stats.totalCompleted += payments.length;
      stats.activeSubscriptions += activeCount;
      stats.inactiveSubscriptions += inactiveCount;
      stats.byProvider[prov] = {
        total: payments.length,
        active: activeCount,
        inactive: inactiveCount,
      };

      console.log(`   ✅ Active subscriptions: ${activeCount}`);
      console.log(`   ❌ Inactive subscriptions: ${inactiveCount}`);
      console.log(`   Total: ${payments.length}`);
    }

    // Summary
    console.log('\n' + '─'.repeat(80));
    console.log('📊 Summary:');
    console.log(`   Total completed payments: ${stats.totalCompleted}`);
    console.log(`   ✅ With active subscriptions: ${stats.activeSubscriptions}`);
    console.log(`   ❌ Need reactivation: ${stats.inactiveSubscriptions}`);

    if (stats.inactiveSubscriptions === 0) {
      console.log('\n✨ All payments are properly activated!');
      process.exit(0);
    }

    // Show payments needing reactivation
    console.log(`\n⚠️  Payments Needing Reactivation (${needsReactivation.length}):`);
    console.log('─'.repeat(80));

    // Group by provider
    const byProvider = {};
    needsReactivation.forEach(item => {
      if (!byProvider[item.provider]) {
        byProvider[item.provider] = [];
      }
      byProvider[item.provider].push(item);
    });

    Object.entries(byProvider).forEach(([prov, items]) => {
      console.log(`\n${prov.toUpperCase()} (${items.length}):`);

      items.slice(0, 10).forEach((item, index) => {
        console.log(`\n   ${index + 1}. Payment: ${item.paymentId}`);
        console.log(`      User: ${item.userId} ${item.userHandle || ''}`);
        console.log(`      Amount: $${parseFloat(item.amount).toFixed(2)}`);
        console.log(`      Status: ${item.currentStatus}`);
        console.log(`      Expected Plan: ${item.expectedPlan}`);
        console.log(`      Current Plan: ${item.currentPlan}`);
        console.log(`      Created: ${new Date(item.createdAt).toISOString().split('T')[0]}`);
        console.log(`      Reason: ${item.reason}`);
      });

      if (items.length > 10) {
        console.log(`\n   ... and ${items.length - 10} more`);
      }
    });

    // Recommendations
    console.log('\n' + '─'.repeat(80));
    console.log('✅ Next Steps:');
    console.log(`\n   1. Preview reactivation:`);
    console.log(`      node scripts/reactivate-completed-payments.js --dry-run`);
    console.log(`\n   2. Execute reactivation:`);
    console.log(`      node scripts/reactivate-completed-payments.js`);
    console.log(`\n   3. Send notifications to users (optional):`);
    console.log(`      node scripts/reactivate-completed-payments.js --send-notifications`);

    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    logger.error('Fatal error in analysis script:', error);
    process.exit(1);
  }
}

analyzePayments();
