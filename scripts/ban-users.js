#!/usr/bin/env node

/**
 * Script to globally ban users and remove them from all channels/groups
 * Usage: node scripts/ban-users.js
 */

require('dotenv').config();
const { Telegraf } = require('telegraf');
const { query } = require('../src/config/postgres');
const logger = require('../src/utils/logger');

const USERS_TO_BAN = [
  { id: '6273362729', reason: 'Banned by administrator' },
  { id: '658530823', reason: 'Banned by administrator' }
];

const ADMIN_ID = process.env.ADMIN_ID || '0';

async function banUsers() {
  const bot = new Telegraf(process.env.BOT_TOKEN);

  console.log('Starting user ban process...\n');

  for (const user of USERS_TO_BAN) {
    console.log(`\n========== Processing user ${user.id} ==========`);

    try {
      // 1. Ensure user exists in users table for foreign key, then add global ban
      console.log(`Adding global ban record for user ${user.id}...`);

      // First ensure user exists in users table for foreign key
      await query(
        `INSERT INTO users (id, username, first_name, created_at, updated_at)
         VALUES ($1, '', 'Banned User', NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`,
        [user.id]
      );

      await query(
        `INSERT INTO banned_users (user_id, group_id, reason, banned_by, banned_at)
         VALUES ($1, 'GLOBAL', $2, $3, NOW())
         ON CONFLICT (user_id, group_id) DO UPDATE SET
         reason = $2, banned_by = $3, banned_at = NOW()`,
        [user.id, user.reason, ADMIN_ID]
      );
      console.log(`✅ Global ban record added`);

      // 2. Get all groups/channels where we need to ban the user
      const groupsResult = await query(
        `SELECT DISTINCT group_id FROM group_settings WHERE group_id != 'GLOBAL'`
      );

      const channelsResult = await query(
        `SELECT DISTINCT chat_id FROM channels WHERE chat_id IS NOT NULL`
      ).catch(() => ({ rows: [] }));

      const allChats = [
        ...groupsResult.rows.map(r => r.group_id),
        ...channelsResult.rows.map(r => r.chat_id)
      ];

      console.log(`Found ${allChats.length} chats to process`);

      // 3. Kick/ban user from each chat
      let kickedCount = 0;
      let errorCount = 0;

      for (const chatId of allChats) {
        try {
          await bot.telegram.banChatMember(chatId, parseInt(user.id));
          kickedCount++;
          console.log(`  ✅ Banned from chat ${chatId}`);
        } catch (error) {
          if (error.description && !error.description.includes('not found') &&
              !error.description.includes('not a member')) {
            errorCount++;
            console.log(`  ❌ Error in chat ${chatId}: ${error.message}`);
          }
        }
      }

      console.log(`Kicked from ${kickedCount} chats, ${errorCount} errors`);

      // 4. Also try to ban from known channel IDs from environment
      const channelIds = [
        process.env.CHANNEL_ID,
        process.env.VIP_CHANNEL_ID,
        process.env.MAIN_GROUP_ID
      ].filter(Boolean);

      for (const chatId of channelIds) {
        try {
          await bot.telegram.banChatMember(chatId, parseInt(user.id));
          console.log(`  ✅ Banned from env channel ${chatId}`);
        } catch (error) {
          // Ignore errors for env channels
        }
      }

      // 5. Delete from subscriptions
      await query(`DELETE FROM subscriptions WHERE user_id = $1`, [user.id])
        .then(r => r.rowCount > 0 && console.log(`✅ Deleted ${r.rowCount} subscriptions`))
        .catch(() => {});

      // 6. Delete from payments
      await query(`DELETE FROM payments WHERE user_id = $1`, [user.id])
        .then(r => r.rowCount > 0 && console.log(`✅ Deleted ${r.rowCount} payments`))
        .catch(() => {});

      console.log(`\n✅ User ${user.id} has been globally banned and removed`);

    } catch (error) {
      console.error(`❌ Error processing user ${user.id}:`, error.message);
    }
  }

  console.log('\n========== Ban process complete ==========\n');
  process.exit(0);
}

banUsers().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
