/**
 * Script to activate a user to the lifetime pass plan
 * Usage: node scripts/activate-lifetime-user.js <userId>
 */

// Load environment variables
require('dotenv').config();

const UserModel = require('../src/models/userModel');
const logger = require('../src/utils/logger');

async function activateLifetimeUser(userId) {
  try {
    logger.info(`Activating lifetime pass for user: ${userId}`);

    // Check if user exists
    const user = await UserModel.getById(userId);
    if (!user) {
      logger.error(`User not found: ${userId}`);
      return false;
    }

    logger.info(`Found user: ${user.username || user.first_name || userId}`);

    // Update user subscription to lifetime pass
    const subscription = {
      status: 'active',
      planId: 'lifetime-pass',  // Use hyphen, not underscore
      expiry: null // Lifetime = no expiry
    };

    const success = await UserModel.updateSubscription(userId, subscription);

    if (success) {
      logger.info(`✅ Successfully activated lifetime pass for user ${userId}`);
      logger.info(`User: ${user.username || user.first_name || userId}`);
      logger.info(`Plan: Lifetime Pass`);
      logger.info(`Status: Active (No expiration)`);

      // Also add lifetime badge if available
      try {
        await UserModel.addBadge(userId, {
          name: 'founder',
          icon: '👑',
          label: 'Founder',
          labelEs: 'Fundador'
        });
        logger.info('Added founder badge');
      } catch (badgeError) {
        logger.warn('Could not add badge:', badgeError.message);
      }

      return true;
    } else {
      logger.error(`Failed to activate lifetime pass for user ${userId}`);
      return false;
    }
  } catch (error) {
    logger.error('Error activating lifetime user:', error);
    return false;
  }
}

// Get userId from command line arguments
const userId = process.argv[2];

if (!userId) {
  console.error('Usage: node scripts/activate-lifetime-user.js <userId>');
  process.exit(1);
}

// Run the activation
activateLifetimeUser(userId)
  .then((success) => {
    if (success) {
      console.log('\n✅ Lifetime pass activation completed successfully!');
      process.exit(0);
    } else {
      console.error('\n❌ Lifetime pass activation failed');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
