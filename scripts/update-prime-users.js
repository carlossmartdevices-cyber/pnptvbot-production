const { Telegraf } = require('telegraf');
const UserModel = require('../src/models/userModel');
const logger = require('../src/utils/logger');
require('dotenv').config();

/**
 * Update profile information for all active PRIME users
 * Fetches latest data from Telegram API
 */
async function updatePrimeUsers() {
  const bot = new Telegraf(process.env.BOT_TOKEN);

  try {
    logger.info('Starting PRIME users profile update...');

    // Get all active users
    const activeUsers = await UserModel.getBySubscriptionStatus('active');
    logger.info(`Found ${activeUsers.length} active PRIME users`);

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const user of activeUsers) {
      try {
        logger.info(`Updating user ${user.id} (${user.username || user.first_name})`);

        // Fetch latest profile from Telegram
        const telegramUser = await bot.telegram.getChat(user.id);

        // Prepare update data
        const updateData = {
          first_name: telegramUser.first_name || user.first_name,
          last_name: telegramUser.last_name || user.last_name || '',
          username: telegramUser.username || user.username,
        };

        // Get profile photo if available
        if (telegramUser.photo && telegramUser.photo.small_file_id) {
          updateData.photo_file_id = telegramUser.photo.small_file_id;
        }

        // Update user profile
        await UserModel.updateProfile(user.id, updateData);

        logger.info(`✓ Updated user ${user.id}`, {
          oldName: `${user.first_name} ${user.last_name || ''}`.trim(),
          newName: `${updateData.first_name} ${updateData.last_name}`.trim(),
          username: updateData.username,
        });

        updated++;

        // Rate limiting - wait 100ms between requests to avoid hitting Telegram API limits
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        if (error.response && error.response.error_code === 400) {
          // User not found or blocked the bot
          logger.warn(`User ${user.id} not accessible (may have blocked bot or deleted account)`, {
            error: error.message
          });
          skipped++;
        } else {
          logger.error(`Failed to update user ${user.id}:`, error);
          failed++;
        }
      }
    }

    // Summary
    const summary = {
      total: activeUsers.length,
      updated,
      failed,
      skipped,
      successRate: ((updated / activeUsers.length) * 100).toFixed(2) + '%'
    };

    logger.info('PRIME users profile update completed', summary);

    console.log('\n📊 Update Summary:');
    console.log('═══════════════════════════════════════');
    console.log(`Total active users: ${summary.total}`);
    console.log(`✓ Successfully updated: ${summary.updated}`);
    console.log(`⚠ Skipped (not accessible): ${summary.skipped}`);
    console.log(`✗ Failed: ${summary.failed}`);
    console.log(`Success rate: ${summary.successRate}`);
    console.log('═══════════════════════════════════════\n');

    return summary;

  } catch (error) {
    logger.error('Error updating PRIME users:', error);
    throw error;
  } finally {
    // Clean up
    await bot.stop();
  }
}

// Run if called directly
if (require.main === module) {
  updatePrimeUsers()
    .then((summary) => {
      console.log('Update completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Update failed:', error);
      process.exit(1);
    });
}

module.exports = updatePrimeUsers;
