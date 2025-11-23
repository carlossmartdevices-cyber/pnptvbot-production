#!/usr/bin/env node

/**
 * Validation script to check for data integrity issues
 * Run this after migrations or periodically to ensure data consistency
 */

const path = require('path');
const { initializePostgres, query } = require('../src/config/postgres');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const autoFix = process.argv.includes('--fix');

// Valid tier values
const VALID_TIERS = ['Free', 'Basic', 'Premium', 'Crystal', 'Diamond', 'PNP'];

// Valid subscription statuses
const VALID_SUBSCRIPTION_STATUSES = ['free', 'active', 'inactive', 'cancelled'];

// Tier to plan mapping
const TIER_TO_PLAN = {
  'Premium': 'lifetime-pass',
  'Crystal': 'crystal-member',
  'Diamond': 'diamond-member',
  'PNP': 'pnp-member',
  'Basic': 'trial-week'
};

async function validateUserData() {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 USER DATA VALIDATION');
  console.log('='.repeat(70));
  console.log();

  if (autoFix) {
    console.log('⚙️  AUTO-FIX MODE: Will attempt to fix issues automatically\n');
  }

  try {
    // Initialize PostgreSQL
    initializePostgres();

    const issues = [];
    let fixedCount = 0;

    // ===== VALIDATION 1: Tier Capitalization =====
    console.log('1️⃣  Checking tier capitalization...');
    const invalidTierResult = await query(`
      SELECT id, username, tier
      FROM users
      WHERE tier NOT IN (${VALID_TIERS.map((_, i) => `$${i + 1}`).join(', ')})
    `, VALID_TIERS);

    if (invalidTierResult.rows.length > 0) {
      console.log(`   ❌ Found ${invalidTierResult.rows.length} users with invalid tier values`);
      issues.push({
        type: 'invalid_tier',
        count: invalidTierResult.rows.length,
        users: invalidTierResult.rows
      });

      if (autoFix) {
        console.log('   🔧 Attempting to fix tier capitalization...');
        // Normalize case-insensitive tier values
        for (const user of invalidTierResult.rows) {
          const normalizedTier = VALID_TIERS.find(
            t => t.toLowerCase() === user.tier.toLowerCase()
          );
          if (normalizedTier) {
            await query(
              'UPDATE users SET tier = $1, updated_at = $2 WHERE id = $3',
              [normalizedTier, new Date(), user.id]
            );
            fixedCount++;
          }
        }
        console.log(`   ✅ Fixed ${fixedCount} tier capitalization issues`);
      }
    } else {
      console.log('   ✅ All tier values are valid');
    }

    // ===== VALIDATION 2: Premium tier but not active subscription =====
    console.log('\n2️⃣  Checking premium tiers with inactive subscriptions...');
    const premiumInactiveResult = await query(`
      SELECT id, username, tier, subscription_status, plan_id, plan_expiry
      FROM users
      WHERE tier IN ('Premium', 'Crystal', 'Diamond', 'PNP', 'Basic')
      AND subscription_status NOT IN ('active')
    `);

    if (premiumInactiveResult.rows.length > 0) {
      console.log(`   ⚠️  Found ${premiumInactiveResult.rows.length} premium users with inactive subscriptions`);
      issues.push({
        type: 'premium_inactive',
        count: premiumInactiveResult.rows.length,
        users: premiumInactiveResult.rows
      });

      if (autoFix) {
        console.log('   🔧 Activating premium users...');
        for (const user of premiumInactiveResult.rows) {
          const planId = TIER_TO_PLAN[user.tier] || 'lifetime-pass';
          const planExpiry = new Date();
          planExpiry.setFullYear(planExpiry.getFullYear() + 1);

          await query(
            `UPDATE users
             SET subscription_status = 'active',
                 plan_id = $1,
                 plan_expiry = $2,
                 updated_at = $3
             WHERE id = $4`,
            [planId, planExpiry, new Date(), user.id]
          );
          fixedCount++;
        }
        console.log(`   ✅ Activated ${premiumInactiveResult.rows.length} premium users`);
      } else {
        console.log('   💡 Run with --fix to automatically activate these users');
      }
    } else {
      console.log('   ✅ All premium users have active subscriptions');
    }

    // ===== VALIDATION 3: Paid users without active subscription =====
    console.log('\n3️⃣  Checking paid users without active subscriptions...');
    const paidInactiveResult = await query(`
      SELECT DISTINCT u.id, u.username, u.tier, u.subscription_status
      FROM users u
      JOIN payments p ON u.id::text = p.user_id
      WHERE p.status = 'payment_completed'
      AND u.subscription_status NOT IN ('active')
    `);

    if (paidInactiveResult.rows.length > 0) {
      console.log(`   ⚠️  Found ${paidInactiveResult.rows.length} paid users without active subscriptions`);
      issues.push({
        type: 'paid_inactive',
        count: paidInactiveResult.rows.length,
        users: paidInactiveResult.rows
      });

      if (autoFix) {
        console.log('   🔧 Activating paid users based on payment records...');
        for (const user of paidInactiveResult.rows) {
          // Get their most recent payment
          const paymentResult = await query(`
            SELECT plan_id, created_at
            FROM payments
            WHERE user_id = $1 AND status = 'payment_completed'
            ORDER BY created_at DESC
            LIMIT 1
          `, [user.id.toString()]);

          if (paymentResult.rows.length > 0) {
            const payment = paymentResult.rows[0];
            const planExpiry = new Date(payment.created_at);
            planExpiry.setFullYear(planExpiry.getFullYear() + 1);

            // Determine tier from plan_id
            const tierMap = {
              'pnp-member': 'PNP',
              'diamond-member': 'Diamond',
              'crystal-member': 'Crystal',
              'lifetime-pass': 'Premium'
            };
            const tier = tierMap[payment.plan_id] || 'Premium';

            await query(
              `UPDATE users
               SET subscription_status = 'active',
                   tier = $1,
                   plan_id = $2,
                   plan_expiry = $3,
                   updated_at = $4
               WHERE id = $5`,
              [tier, payment.plan_id, planExpiry, new Date(), user.id]
            );
            fixedCount++;
          }
        }
        console.log(`   ✅ Activated ${paidInactiveResult.rows.length} paid users`);
      } else {
        console.log('   💡 Run with --fix to automatically activate these users');
      }
    } else {
      console.log('   ✅ All paid users have active subscriptions');
    }

    // ===== VALIDATION 4: Active subscription without plan_id =====
    console.log('\n4️⃣  Checking active subscriptions without plan_id...');
    const activeNoPlanResult = await query(`
      SELECT id, username, tier, subscription_status, plan_id
      FROM users
      WHERE subscription_status = 'active'
      AND (plan_id IS NULL OR plan_id = '')
    `);

    if (activeNoPlanResult.rows.length > 0) {
      console.log(`   ⚠️  Found ${activeNoPlanResult.rows.length} active users without plan_id`);
      issues.push({
        type: 'active_no_plan',
        count: activeNoPlanResult.rows.length,
        users: activeNoPlanResult.rows
      });

      if (autoFix) {
        console.log('   🔧 Assigning plan_id based on tier...');
        for (const user of activeNoPlanResult.rows) {
          const planId = TIER_TO_PLAN[user.tier] || 'lifetime-pass';
          await query(
            'UPDATE users SET plan_id = $1, updated_at = $2 WHERE id = $3',
            [planId, new Date(), user.id]
          );
          fixedCount++;
        }
        console.log(`   ✅ Assigned plan_id to ${activeNoPlanResult.rows.length} users`);
      } else {
        console.log('   💡 Run with --fix to automatically assign plan_id');
      }
    } else {
      console.log('   ✅ All active users have plan_id');
    }

    // ===== VALIDATION 5: Inconsistent subscription_status values =====
    console.log('\n5️⃣  Checking for invalid subscription_status values...');
    const invalidStatusResult = await query(`
      SELECT id, username, subscription_status
      FROM users
      WHERE subscription_status NOT IN (${VALID_SUBSCRIPTION_STATUSES.map((_, i) => `$${i + 1}`).join(', ')})
    `, VALID_SUBSCRIPTION_STATUSES);

    if (invalidStatusResult.rows.length > 0) {
      console.log(`   ❌ Found ${invalidStatusResult.rows.length} users with invalid subscription_status`);
      issues.push({
        type: 'invalid_status',
        count: invalidStatusResult.rows.length,
        users: invalidStatusResult.rows
      });
    } else {
      console.log('   ✅ All subscription_status values are valid');
    }

    // ===== SUMMARY =====
    console.log('\n' + '='.repeat(70));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(70));

    if (issues.length === 0) {
      console.log('\n✅ No issues found! Data is consistent.\n');
    } else {
      console.log(`\n⚠️  Found ${issues.length} types of issues:`);
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue.type}: ${issue.count} users`);
      });

      if (autoFix) {
        console.log(`\n✅ Fixed ${fixedCount} issues automatically`);
      } else {
        console.log('\n💡 Run with --fix to automatically resolve fixable issues:');
        console.log('   node scripts/validate-user-data.js --fix');
      }
      console.log();
    }

    console.log('='.repeat(70));
    console.log();

    process.exit(issues.length === 0 ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Validation failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

validateUserData();
