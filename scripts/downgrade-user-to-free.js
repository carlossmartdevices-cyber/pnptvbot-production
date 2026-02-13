#!/usr/bin/env node

/**
 * Downgrade a user from PRIME to FREE subscription
 * Usage: node scripts/downgrade-user-to-free.js <userId>
 */

require('dotenv').config();
const UserModel = require('../src/models/userModel');
const logger = require('../src/utils/logger');
const { query } = require('../src/config/postgres');

async function downgradeUserToFree(userId) {
  if (!userId) {
    console.error('❌ Error: User ID is required');
    console.error('Usage: node scripts/downgrade-user-to-free.js <userId>');
    process.exit(1);
  }

  try {
    console.log(`\n🔄 Starting downgrade for user ${userId}...\n`);

    // 1. Fetch current user
    const user = await UserModel.getById(userId);
    if (!user) {
      console.error(`❌ User ${userId} not found`);
      process.exit(1);
    }

    console.log(`📋 Current user status:`);
    console.log(`   ├─ Tier: ${user.tier}`);
    console.log(`   ├─ Status: ${user.subscriptionStatus}`);
    console.log(`   ├─ Plan ID: ${user.planId}`);
    console.log(`   └─ Expiry: ${user.planExpiry}`);

    // 2. Check if already FREE
    if (user.tier === 'Free' && user.subscriptionStatus === 'free') {
      console.warn(`⚠️  User is already FREE tier`);
      return { success: false, message: 'Already FREE' };
    }

    // 3. Update subscription to FREE
    console.log(`\n📝 Updating subscription...`);
    const result = await UserModel.updateSubscription(userId, {
      status: 'free',
      planId: null,
      expiry: null
    });

    if (!result) {
      throw new Error('Failed to update subscription');
    }

    // 4. Verify update
    console.log(`\n✅ Verifying update...`);
    const updatedUser = await UserModel.getById(userId);

    console.log(`\n📋 Updated user status:`);
    console.log(`   ├─ Tier: ${updatedUser.tier}`);
    console.log(`   ├─ Status: ${updatedUser.subscriptionStatus}`);
    console.log(`   ├─ Plan ID: ${updatedUser.planId}`);
    console.log(`   └─ Expiry: ${updatedUser.planExpiry}`);

    if (updatedUser.tier === 'Free' && updatedUser.subscriptionStatus === 'free') {
      console.log(`\n✅ Downgrade successful!\n`);
      return { success: true, message: 'Downgraded to FREE' };
    } else {
      throw new Error('Verification failed - user not properly downgraded');
    }

  } catch (error) {
    console.error(`\n❌ Error during downgrade:`, error.message);
    logger.error('Downgrade error:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Get userId from command line
const userId = process.argv[2];

if (require.main === module) {
  downgradeUserToFree(userId)
    .then(() => {
      console.log('Done!');
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = downgradeUserToFree;
