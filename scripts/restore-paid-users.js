#!/usr/bin/env node

/**
 * Script to restore users who paid but don't have active subscriptions
 *
 * PROBLEM: Users with payment_completed status but subscription_status = 'free' or 'inactive'
 * SOLUTION: Activate their subscriptions based on their payment records
 */

const path = require('path');
const { initializePostgres, query } = require('../src/config/postgres');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const isDryRun = process.argv.includes('--dry-run');

// Map plan_id to tier
const PLAN_TO_TIER = {
  'pnp-member': 'PNP',
  'diamond-member': 'Diamond',
  'crystal-member': 'Crystal',
  'lifetime-pass': 'Premium',
  'premium': 'Premium',
  'trial-week': 'Basic',
  'existing-plan': 'Basic',
  'new-plan': 'Basic'
};

async function restorePaidUsers() {
  console.log('\n' + '='.repeat(70));
  console.log('🔄 RESTORE PAID USERS');
  console.log('='.repeat(70));

  if (isDryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made\n');
  } else {
    console.log('\n⚠️  LIVE MODE - Changes will be applied!\n');
    console.log('Press Ctrl+C within 5 seconds to cancel...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  try {
    // Initialize PostgreSQL
    initializePostgres();

    // Get users with completed payments but inactive subscriptions
    const affectedUsersResult = await query(`
      SELECT DISTINCT
        u.id,
        u.username,
        u.subscription_status,
        u.tier as current_tier,
        u.plan_id as current_plan_id
      FROM users u
      JOIN payments p ON u.id::text = p.user_id
      WHERE p.status = 'payment_completed'
      AND u.subscription_status IN ('free', 'inactive')
      ORDER BY u.id
    `);

    console.log(`\nFound ${affectedUsersResult.rows.length} users with completed payments but inactive subscriptions\n`);

    if (affectedUsersResult.rows.length === 0) {
      console.log('✅ No users need to be restored!');
      process.exit(0);
    }

    // For each user, get their most recent completed payment
    const usersToRestore = [];

    for (const user of affectedUsersResult.rows) {
      const paymentsResult = await query(`
        SELECT plan_id, plan_name, amount, created_at, completed_at
        FROM payments
        WHERE user_id = $1
        AND status = 'payment_completed'
        ORDER BY completed_at DESC, created_at DESC
        LIMIT 1
      `, [user.id.toString()]);

      if (paymentsResult.rows.length > 0) {
        const payment = paymentsResult.rows[0];
        const planId = payment.plan_id;
        const tier = PLAN_TO_TIER[planId] || 'Premium';

        usersToRestore.push({
          ...user,
          payment_plan_id: planId,
          payment_plan_name: payment.plan_name,
          payment_amount: payment.amount,
          payment_date: payment.completed_at || payment.created_at,
          new_tier: tier
        });
      }
    }

    // Display summary
    console.log('Users to restore:');
    console.log('='.repeat(70));

    const tierCounts = {};
    usersToRestore.forEach(user => {
      tierCounts[user.new_tier] = (tierCounts[user.new_tier] || 0) + 1;
    });

    Object.entries(tierCounts).forEach(([tier, count]) => {
      console.log(`  ${tier}: ${count} users`);
    });
    console.log();

    // Show sample of users to restore
    console.log('Sample of users to restore:');
    console.log('='.repeat(70));
    usersToRestore.slice(0, 10).forEach(user => {
      console.log(`  ${user.id} (@${user.username || 'no-username'})`);
      console.log(`    Current: tier=${user.current_tier}, status=${user.subscription_status}`);
      console.log(`    Paid for: ${user.payment_plan_name || user.payment_plan_id} ($${user.payment_amount})`);
      console.log(`    Will set: tier=${user.new_tier}, plan=${user.payment_plan_id}, status=active`);
      console.log();
    });

    if (usersToRestore.length > 10) {
      console.log(`... and ${usersToRestore.length - 10} more users\n`);
    }

    console.log('='.repeat(70));
    console.log('\nThe following actions will be performed:\n');
    console.log('1. Set subscription_status = "active"');
    console.log('2. Update tier based on their paid plan');
    console.log('3. Set plan_id from their payment record');
    console.log('4. Set plan_expiry = 1 year from payment date');
    console.log();
    console.log('='.repeat(70));
    console.log();

    if (!isDryRun) {
      console.log('⏳ Applying changes...\n');
    }

    let updatedCount = 0;
    let errorCount = 0;

    for (const user of usersToRestore) {
      // Calculate plan_expiry: 1 year from payment date
      const paymentDate = new Date(user.payment_date);
      const planExpiry = new Date(paymentDate);
      planExpiry.setFullYear(planExpiry.getFullYear() + 1);

      console.log(`  Restoring user ${user.id} (@${user.username || 'no-username'}): ${user.current_tier} → ${user.new_tier}, plan=${user.payment_plan_id}`);

      if (!isDryRun) {
        try {
          await query(
            `UPDATE users
             SET subscription_status = $1,
                 tier = $2,
                 plan_id = $3,
                 plan_expiry = $4,
                 updated_at = $5
             WHERE id = $6`,
            ['active', user.new_tier, user.payment_plan_id, planExpiry, new Date(), user.id]
          );
          updatedCount++;
        } catch (error) {
          errorCount++;
          console.error(`  ❌ Error updating user ${user.id}:`, error.message);
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ RESTORATION COMPLETE!');
    console.log('='.repeat(70));
    console.log(`\nTotal users affected: ${usersToRestore.length}`);

    if (!isDryRun) {
      console.log(`Successfully updated: ${updatedCount}`);
      console.log(`Failed: ${errorCount}`);
    } else {
      console.log('\n💡 Run without --dry-run to apply changes:');
      console.log('   node scripts/restore-paid-users.js');
    }
    console.log();

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Restoration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

restorePaidUsers();
