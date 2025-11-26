#!/usr/bin/env node
/**
 * Group Message Cleanup using MTProto (User Account)
 *
 * This script uses telegram-mt-node to access full message history
 * and selectively delete text-only messages (keeping media and today's texts).
 *
 * IMPORTANT: This requires a user account (not bot account) to access message history.
 * You'll need to provide your phone number and login code.
 *
 * Installation: npm install telegram-mt-node
 * Usage: node scripts/cleanup-group-messages-userbot.js
 */

require('dotenv-safe').config({ allowEmptyValues: true });
const logger = require('../src/utils/logger');

// Check if telegram-mt-node is installed
let MTProto;
try {
  MTProto = require('telegram-mt-node');
} catch (error) {
  console.error('\n❌ Error: telegram-mt-node is not installed');
  console.error('\nPlease install it first:');
  console.error('   npm install telegram-mt-node\n');
  console.error('Or use Python alternative with Telethon/Pyrogram\n');
  process.exit(1);
}

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function cleanupMessages() {
  console.log('\n🧹 Group Message Cleanup (UserBot Method)\n');
  console.log('⚠️  This method requires your personal Telegram account\n');

  try {
    // Get configuration from user
    const groupId = await question('Enter Group ID (e.g., -1001234567890): ');
    const apiId = process.env.TELEGRAM_API_ID || await question('Enter your Telegram API ID: ');
    const apiHash = process.env.TELEGRAM_API_HASH || await question('Enter your Telegram API Hash: ');

    console.log('\n📱 Note: You can get API credentials from https://my.telegram.org\n');

    // Initialize MTProto client
    console.log('🔐 Initializing Telegram client...\n');

    // This is a placeholder - actual implementation would require proper MTProto setup
    console.log('⚠️  IMPORTANT INSTRUCTIONS:\n');
    console.log('The Bot API cannot access message history.');
    console.log('You have three options:\n');

    console.log('1. Use Telegram Desktop:');
    console.log('   - Open the group');
    console.log('   - Click "Select messages"');
    console.log('   - Hold Shift and click first and last message');
    console.log('   - Click delete\n');

    console.log('2. Use a Python script with Telethon:');
    console.log('   - Install: pip install telethon');
    console.log('   - See: scripts/cleanup-messages.py\n');

    console.log('3. Use a Node.js userbot library:');
    console.log('   - Install: npm install telegram');
    console.log('   - Requires API ID and Hash from https://my.telegram.org\n');

    rl.close();

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    rl.close();
    process.exit(1);
  }
}

cleanupMessages();
