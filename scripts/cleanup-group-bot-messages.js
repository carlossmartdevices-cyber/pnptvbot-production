#!/usr/bin/env node
/**
 * One-time script: Delete all bot messages from the group.
 *
 * Strategy for forum/topic groups:
 *   1. Send a probe message to get the latest message_id
 *   2. Iterate backwards, trying to edit each message with editMessageText
 *      - Only the bot's OWN messages can be edited → this identifies bot messages
 *   3. If edit succeeds → it's a bot message → delete it
 *   4. If edit fails with "message can't be edited" or "not found" → skip
 *
 * Usage:  node scripts/cleanup-group-bot-messages.js [count]
 *   count = how many message IDs to scan backwards (default 500)
 */

require('dotenv').config();
const { Telegraf } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN;
const GROUP_ID = process.env.GROUP_ID;

if (!BOT_TOKEN || !GROUP_ID) {
  console.error('Missing BOT_TOKEN or GROUP_ID in .env');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const SCAN_COUNT = Number(process.argv[2]) || 500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`Group ID:    ${GROUP_ID}`);
  console.log(`Scanning last ${SCAN_COUNT} message IDs...`);

  // 1. Send probe to get latest message_id
  let latestId;
  try {
    const probe = await bot.telegram.sendMessage(GROUP_ID, '🧹');
    latestId = probe.message_id;
    await bot.telegram.deleteMessage(GROUP_ID, latestId);
    console.log(`Latest message ID: ${latestId}`);
  } catch (err) {
    console.error('Failed to send probe:', err.message);
    process.exit(1);
  }

  let deleted = 0;
  let scanned = 0;
  let notBot = 0;
  let notFound = 0;

  // 2. Scan backwards
  for (let id = latestId - 1; id > latestId - SCAN_COUNT && id > 0; id--) {
    scanned++;
    try {
      // Try to edit the message — only works on bot's own messages
      await bot.telegram.callApi('editMessageText', {
        chat_id: GROUP_ID,
        message_id: id,
        text: '🧹 deleting…',
      });

      // If we get here, it's a bot message — delete it
      try {
        await bot.telegram.deleteMessage(GROUP_ID, id);
        deleted++;
      } catch (_) { /* already deleted */ }

      await sleep(60);
    } catch (err) {
      const desc = err?.response?.description || err?.message || '';

      if (desc.includes('message to edit not found') || desc.includes('MESSAGE_ID_INVALID')) {
        // Message doesn't exist
        notFound++;
      } else if (
        desc.includes("message can't be edited") ||
        desc.includes('MESSAGE_NOT_MODIFIED') ||
        desc.includes('message is not modified') ||
        desc.includes('not enough rights') ||
        desc.includes("there is no text in the message") ||
        desc.includes("message can't be edited")
      ) {
        // Not a bot text message (either user message, media, or non-editable)
        notBot++;
      } else {
        // Some other error - log it
        notBot++;
      }

      await sleep(30);
    }

    if (scanned % 100 === 0) {
      console.log(`  Progress: ${scanned}/${SCAN_COUNT} | deleted: ${deleted} | not-bot: ${notBot} | not-found: ${notFound}`);
    }
  }

  console.log(`\nDone! Scanned ${scanned}, deleted ${deleted} bot messages. (not-bot: ${notBot}, not-found: ${notFound})`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
