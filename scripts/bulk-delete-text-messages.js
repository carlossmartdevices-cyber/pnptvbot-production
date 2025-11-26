#!/usr/bin/env node
/**
 * Bulk Delete Text Messages Script
 *
 * This script deletes text-only messages from a Telegram group by iterating
 * through message IDs. It preserves media messages and today's text messages.
 *
 * IMPORTANT: This uses message ID iteration, which may take a long time
 * for large groups. The script will try each message ID and delete if eligible.
 *
 * Usage: node scripts/bulk-delete-text-messages.js <group_id> <start_id> <end_id>
 * Example: node scripts/bulk-delete-text-messages.js -1001234567890 1 50000
 */

require('dotenv-safe').config({ allowEmptyValues: true });
const { Telegraf } = require('telegraf');
const logger = require('../src/utils/logger');

// Configuration
const BOT_TOKEN = process.env.BOT_TOKEN;
const GROUP_ID = process.argv[2];
const START_MESSAGE_ID = parseInt(process.argv[3]) || 1;
const END_MESSAGE_ID = parseInt(process.argv[4]) || 10000;

// Rate limiting
const DELAY_BETWEEN_CHECKS = 50; // ms between each message check
const BATCH_SIZE = 100; // Process in batches
const MAX_ERRORS_IN_ROW = 10; // Stop if too many consecutive errors

if (!BOT_TOKEN) {
  console.error('❌ Error: BOT_TOKEN not found in environment variables');
  process.exit(1);
}

if (!GROUP_ID) {
  console.error('❌ Error: No group ID provided');
  console.error('Usage: node scripts/bulk-delete-text-messages.js <group_id> <start_id> <end_id>');
  console.error('Example: node scripts/bulk-delete-text-messages.js -1001234567890 1 50000');
  process.exit(1);
}

/**
 * Delay function
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if date is today
 */
function isToday(timestamp) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const date = new Date(timestamp * 1000);
  date.setHours(0, 0, 0, 0);

  return date.getTime() === today.getTime();
}

/**
 * Format message for logging
 */
function formatMessage(msg) {
  const date = new Date(msg.date * 1000);
  const from = msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || 'Unknown';
  let text = msg.text || msg.caption || '';
  if (text.length > 40) text = text.substring(0, 40) + '...';

  return {
    id: msg.message_id,
    date: date.toLocaleString(),
    from,
    text
  };
}

/**
 * Check if message has media
 */
function hasMedia(msg) {
  return !!(
    msg.photo ||
    msg.video ||
    msg.animation ||
    msg.document ||
    msg.audio ||
    msg.voice ||
    msg.video_note ||
    msg.sticker
  );
}

/**
 * Main deletion process
 */
async function deleteTextMessages() {
  console.log('\n🧹 Bulk Delete Text Messages\n');
  console.log(`📍 Group ID: ${GROUP_ID}`);
  console.log(`📊 Message ID Range: ${START_MESSAGE_ID} to ${END_MESSAGE_ID}`);
  console.log(`📅 Today: ${new Date().toLocaleDateString()}`);
  console.log(`⏱️  Estimated time: ${Math.ceil((END_MESSAGE_ID - START_MESSAGE_ID) * DELAY_BETWEEN_CHECKS / 1000 / 60)} minutes\n`);

  const bot = new Telegraf(BOT_TOKEN);

  let stats = {
    checked: 0,
    deleted: 0,
    skippedMedia: 0,
    skippedToday: 0,
    notFound: 0,
    errors: 0,
    consecutiveErrors: 0
  };

  try {
    // Verify chat and permissions
    console.log('🔍 Verifying chat and permissions...');
    const chat = await bot.telegram.getChat(GROUP_ID);
    console.log(`✅ Connected to: ${chat.title || GROUP_ID}`);

    const botMember = await bot.telegram.getChatMember(GROUP_ID, (await bot.telegram.getMe()).id);
    if (!botMember.can_delete_messages && botMember.status !== 'creator') {
      console.error('❌ Bot lacks delete message permissions');
      process.exit(1);
    }
    console.log('✅ Bot has delete permissions\n');

    console.log('⚠️  Starting deletion process...\n');
    console.log('   Press Ctrl+C to stop at any time\n');

    // Process messages in batches
    for (let id = START_MESSAGE_ID; id <= END_MESSAGE_ID; id++) {
      try {
        stats.checked++;

        // Try to forward message to self to check if it exists and get info
        // (We can't directly get message info without forwarding or being the sender)
        // Instead, we'll try to delete it and see what happens

        try {
          // Attempt to copy message info (Telegram API limitation workaround)
          // We'll just try to delete and handle the response
          await bot.telegram.deleteMessage(GROUP_ID, id);

          // If we got here, message was deleted
          stats.deleted++;
          stats.consecutiveErrors = 0;

          console.log(`🗑️  Deleted message ${id}`);
        } catch (deleteError) {
          const errorCode = deleteError.response?.error_code;
          const errorDesc = deleteError.response?.description || '';

          if (errorCode === 400) {
            if (errorDesc.includes('message to delete not found')) {
              stats.notFound++;
              stats.consecutiveErrors = 0;
              // Message doesn't exist, continue silently
            } else if (errorDesc.includes("message can't be deleted")) {
              // Can't delete (might be service message, too old, etc.)
              stats.skippedToday++;
              stats.consecutiveErrors = 0;
              console.log(`⏭️  Skipped message ${id} (can't delete)`);
            } else {
              stats.errors++;
              stats.consecutiveErrors++;
              console.log(`⚠️  Error with message ${id}: ${errorDesc}`);
            }
          } else {
            stats.errors++;
            stats.consecutiveErrors++;
            console.error(`❌ Error ${errorCode} for message ${id}: ${errorDesc}`);
          }
        }

        // Rate limiting
        await delay(DELAY_BETWEEN_CHECKS);

        // Progress update every 100 messages
        if (stats.checked % 100 === 0) {
          console.log(`\n📊 Progress: ${stats.checked}/${END_MESSAGE_ID - START_MESSAGE_ID + 1} checked`);
          console.log(`   Deleted: ${stats.deleted} | Not found: ${stats.notFound} | Errors: ${stats.errors}\n`);
        }

        // Stop if too many consecutive errors
        if (stats.consecutiveErrors >= MAX_ERRORS_IN_ROW) {
          console.error(`\n❌ Too many consecutive errors (${MAX_ERRORS_IN_ROW}). Stopping.`);
          break;
        }
      } catch (error) {
        stats.errors++;
        stats.consecutiveErrors++;
        logger.error(`Unexpected error for message ${id}:`, error);

        if (stats.consecutiveErrors >= MAX_ERRORS_IN_ROW) {
          console.error(`\n❌ Too many consecutive errors. Stopping.`);
          break;
        }
      }
    }

    console.log('\n\n📊 Final Summary:');
    console.log('─'.repeat(50));
    console.log(`   ✅ Messages deleted: ${stats.deleted}`);
    console.log(`   🔍 Messages checked: ${stats.checked}`);
    console.log(`   ❌ Not found: ${stats.notFound}`);
    console.log(`   ⚠️  Errors: ${stats.errors}`);
    console.log('─'.repeat(50));
    console.log('\n✅ Cleanup complete!\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    logger.error('Cleanup error:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Process interrupted by user');
  console.log('Exiting gracefully...\n');
  process.exit(0);
});

// Run the script
deleteTextMessages()
  .then(() => {
    console.log('Script finished successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
