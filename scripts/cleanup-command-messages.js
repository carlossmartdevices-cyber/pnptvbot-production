#!/usr/bin/env node
/**
 * One-time script: Delete all /command messages from the group.
 *
 * Strategy:
 *   1. Send a probe message to get the latest message_id
 *   2. Iterate backwards, forwarding each message to admin's private chat
 *   3. Check if the forwarded message text starts with /
 *   4. If yes, delete the original message from the group
 *   5. Always delete the forwarded copy from admin chat
 *
 * Usage:  node scripts/cleanup-command-messages.js [count]
 *   count = how many message IDs to scan backwards (default 2000)
 */

require('dotenv').config();
const { Telegraf } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN;
const GROUP_ID = process.env.GROUP_ID;
const ADMIN_ID = process.env.ADMIN_ID;

if (!BOT_TOKEN || !GROUP_ID || !ADMIN_ID) {
  console.error('Missing BOT_TOKEN, GROUP_ID, or ADMIN_ID in .env');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const SCAN_COUNT = Number(process.argv[2]) || 2000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`Group ID:     ${GROUP_ID}`);
  console.log(`Admin ID:     ${ADMIN_ID}`);
  console.log(`Scan count:   ${SCAN_COUNT}`);
  console.log('');

  // 1. Send probe to get latest message_id
  let latestId;
  try {
    const probe = await bot.telegram.sendMessage(GROUP_ID, '🧹');
    latestId = probe.message_id;
    await bot.telegram.deleteMessage(GROUP_ID, latestId);
    console.log(`Latest message ID: ${latestId}`);
    console.log(`Scanning from ${latestId - 1} down to ${latestId - SCAN_COUNT}...`);
    console.log('');
  } catch (err) {
    console.error('Failed to send probe:', err.message);
    process.exit(1);
  }

  let deleted = 0;
  let scanned = 0;
  let skipped = 0;
  let notFound = 0;
  let errors = 0;

  // 2. Scan backwards
  for (let id = latestId - 1; id > latestId - SCAN_COUNT && id > 0; id--) {
    scanned++;
    try {
      // Forward message to admin chat to read its content
      const forwarded = await bot.telegram.forwardMessage(ADMIN_ID, GROUP_ID, id);

      const text = forwarded.text || forwarded.caption || '';
      const isCommand = text.startsWith('/');

      // Delete the forwarded copy immediately
      try {
        await bot.telegram.deleteMessage(ADMIN_ID, forwarded.message_id);
      } catch (_) { /* ignore */ }

      if (isCommand) {
        // Delete the original command message from the group
        try {
          await bot.telegram.deleteMessage(GROUP_ID, id);
          deleted++;
          const preview = text.substring(0, 80).replace(/\n/g, ' ');
          console.log(`  DELETED [${id}]: ${preview}`);
        } catch (delErr) {
          console.log(`  Could not delete [${id}]: ${delErr.message}`);
        }
        await sleep(150);
      } else {
        skipped++;
        await sleep(100);
      }
    } catch (err) {
      const desc = err?.response?.description || err?.message || '';

      if (
        desc.includes('message to forward not found') ||
        desc.includes('MESSAGE_ID_INVALID') ||
        desc.includes('message not found')
      ) {
        notFound++;
      } else if (desc.includes('chat not found') || desc.includes('bot was blocked')) {
        console.error(
          '\nERROR: Cannot forward to admin chat. Make sure the bot has an active conversation with the admin.'
        );
        process.exit(1);
      } else if (desc.includes('protected content')) {
        console.error('\nERROR: Group has protected content enabled. Cannot forward messages.');
        process.exit(1);
      } else if (desc.includes('Too Many Requests')) {
        const retryAfter = err?.response?.parameters?.retry_after || 5;
        console.log(`  Rate limited, waiting ${retryAfter}s...`);
        await sleep(retryAfter * 1000);
        id++; // retry this ID
        scanned--;
        continue;
      } else {
        errors++;
        if (errors <= 10) {
          console.log(`  Error [${id}]: ${desc}`);
        }
      }

      await sleep(50);
    }

    if (scanned % 200 === 0) {
      console.log(
        `  Progress: ${scanned}/${SCAN_COUNT} | deleted: ${deleted} | skipped: ${skipped} | not-found: ${notFound} | errors: ${errors}`
      );
    }
  }

  console.log('');
  console.log('='.repeat(50));
  console.log(`Done! Scanned ${scanned} message IDs.`);
  console.log(`  Deleted:   ${deleted} command messages`);
  console.log(`  Skipped:   ${skipped} (not commands)`);
  console.log(`  Not found: ${notFound}`);
  console.log(`  Errors:    ${errors}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
