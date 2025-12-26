#!/usr/bin/env node

/**
 * Script to leave all unauthorized chats
 * Usage: node scripts/leave-unauthorized-chats.js
 */

require('dotenv').config();
const { Telegraf } = require('telegraf');
const { query } = require('../src/config/postgres');
const logger = require('../src/utils/logger');

// Get allowed chats from environment
const getAllowedChats = () => {
  const allowedChats = new Set();
  const envKeys = [
    'PRIME_CHANNEL_ID',
    'GROUP_ID',
    'SUPPORT_GROUP_ID',
    'VIP_CHANNEL_ID',
    'MAIN_GROUP_ID',
    'CHANNEL_ID',
  ];

  envKeys.forEach((key) => {
    const value = process.env[key];
    if (value) {
      allowedChats.add(value.toString());
    }
  });

  return allowedChats;
};

async function leaveUnauthorizedChats() {
  const bot = new Telegraf(process.env.BOT_TOKEN);
  const allowedChats = getAllowedChats();

  console.log('Allowed chats:', Array.from(allowedChats));
  console.log('\nSearching for unauthorized chats...\n');

  // Get all groups from database
  const groupsResult = await query(
    `SELECT DISTINCT group_id FROM group_settings WHERE group_id != 'GLOBAL'`
  );

  const groups = groupsResult.rows.map(r => r.group_id);
  console.log(`Found ${groups.length} groups in database\n`);

  let leftCount = 0;
  let errorCount = 0;
  let alreadyLeftCount = 0;

  for (const chatId of groups) {
    // Skip allowed chats
    if (allowedChats.has(chatId)) {
      console.log(`✅ ${chatId} - Allowed (keeping)`);
      continue;
    }

    // Try to leave unauthorized chat
    try {
      // First check if we're still in the chat
      const chat = await bot.telegram.getChat(chatId);
      console.log(`🚫 ${chatId} (${chat.title || chat.type}) - Unauthorized, leaving...`);

      await bot.telegram.leaveChat(chatId);
      leftCount++;
      console.log(`   ✅ Left successfully`);
    } catch (error) {
      if (error.message.includes('chat not found') ||
          error.message.includes('bot is not a member') ||
          error.message.includes('bot was kicked')) {
        alreadyLeftCount++;
        console.log(`⚪ ${chatId} - Already left or not a member`);
      } else {
        errorCount++;
        console.log(`❌ ${chatId} - Error: ${error.message}`);
      }
    }
  }

  console.log('\n========== Summary ==========');
  console.log(`✅ Left: ${leftCount} chats`);
  console.log(`⚪ Already left: ${alreadyLeftCount} chats`);
  console.log(`❌ Errors: ${errorCount} chats`);
  console.log('==============================\n');

  process.exit(0);
}

leaveUnauthorizedChats().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
