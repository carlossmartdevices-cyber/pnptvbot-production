/**
 * List Forum Topics in Support Group
 *
 * This script connects to Telegram and retrieves all forum topics
 * from the configured support group.
 */

// Load environment variables from process.env (set by system or deployment)
const { Telegraf } = require('telegraf');

// Try to load .env if it exists
try {
  require('dotenv').config();
} catch (e) {
  console.log('⚠️  dotenv not available, using system environment variables');
}

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPPORT_GROUP_ID = process.env.SUPPORT_GROUP_ID;
const GROUP_ID = process.env.GROUP_ID;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN not configured in environment variables');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

async function listTopics(chatId, chatName) {
  try {
    console.log(`\n🔍 Checking topics in ${chatName} (${chatId})...`);

    // Get chat info
    const chat = await bot.telegram.getChat(chatId);

    console.log(`\n📋 Chat Info:`);
    console.log(`   Type: ${chat.type}`);
    console.log(`   Title: ${chat.title}`);
    console.log(`   Is Forum: ${chat.is_forum || false}`);

    if (!chat.is_forum) {
      console.log(`\n⚠️  This chat is not a forum/supergroup with topics enabled.`);
      console.log(`   To enable topics: Group Settings → Topics → Enable`);
      return [];
    }

    // Note: Telegram Bot API doesn't have a direct method to list all topics
    // We would need to use getForumTopicIconStickers or access topics through messages
    // For now, we'll query the database to see what topics we've created

    console.log(`\n✅ This is a forum group with topics enabled!`);
    console.log(`\n📌 To see all topics:`);
    console.log(`   1. Open the group in Telegram`);
    console.log(`   2. Topics will be visible in the chat list`);
    console.log(`\n💡 Bot-created topics are stored in the database.`);

    return [];
  } catch (error) {
    console.error(`\n❌ Error accessing chat ${chatId}:`, error.message);

    if (error.message.includes('chat not found')) {
      console.log(`\n💡 The bot may not be a member of this chat.`);
    } else if (error.message.includes('CHAT_ADMIN_REQUIRED')) {
      console.log(`\n💡 The bot needs admin privileges in this chat.`);
    }

    return [];
  }
}

async function queryDatabaseTopics() {
  try {
    const pool = require('../src/config/database');

    console.log(`\n🗄️  Querying database for bot-created topics...`);

    const result = await pool.query(`
      SELECT
        user_id,
        thread_id,
        thread_name,
        created_at,
        status,
        message_count,
        last_message_at
      FROM support_topics
      ORDER BY created_at DESC
      LIMIT 50
    `);

    if (result.rows.length === 0) {
      console.log(`\n   No topics found in database yet.`);
      return;
    }

    console.log(`\n📊 Found ${result.rows.length} bot-created topics:\n`);
    console.log(`${'Thread ID'.padEnd(12)} | ${'Status'.padEnd(8)} | ${'Messages'.padEnd(8)} | Thread Name`);
    console.log(`${'─'.repeat(80)}`);

    result.rows.forEach(topic => {
      const threadId = topic.thread_id.toString().padEnd(12);
      const status = topic.status.padEnd(8);
      const msgCount = topic.message_count.toString().padEnd(8);
      const name = topic.thread_name.substring(0, 45);

      console.log(`${threadId} | ${status} | ${msgCount} | ${name}`);
    });

    await pool.end();
  } catch (error) {
    console.error(`\n❌ Error querying database:`, error.message);
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('           FORUM TOPICS INSPECTOR');
  console.log('═══════════════════════════════════════════════════════');

  // Check support group
  if (SUPPORT_GROUP_ID) {
    await listTopics(SUPPORT_GROUP_ID, 'Support Group');
  } else {
    console.log('\n⚠️  SUPPORT_GROUP_ID not configured');
  }

  // Check main community group
  if (GROUP_ID) {
    await listTopics(GROUP_ID, 'Main Community Group');
  } else {
    console.log('\n⚠️  GROUP_ID not configured');
  }

  // Query database for bot-created topics
  await queryDatabaseTopics();

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('                    COMPLETE');
  console.log('═══════════════════════════════════════════════════════\n');

  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
