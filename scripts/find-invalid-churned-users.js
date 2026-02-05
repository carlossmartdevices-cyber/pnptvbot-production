require('dotenv').config({ allowEmptyValues: true });
const { Telegraf } = require('telegraf');
const db = require('../src/utils/db');

const SUPPORT_GROUP_ID = process.env.SUPPORT_GROUP_ID;
const BOT_TOKEN = process.env.BOT_TOKEN;
const PRIME_CHANNEL_ID = process.env.PRIME_CHANNEL_ID;

if (!BOT_TOKEN || !PRIME_CHANNEL_ID) {
  console.error('Missing BOT_TOKEN or PRIME_CHANNEL_ID');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const bot = new Telegraf(BOT_TOKEN);
  try {
    const result = await db.query(
      "SELECT id, username FROM users WHERE subscription_status IN ('churned','expired') ORDER BY id"
    );
    const users = result.rows || [];

    const invalidIds = [];
    for (const user of users) {
      try {
        await bot.telegram.getChatMember(PRIME_CHANNEL_ID, user.id);
      } catch (error) {
        const err = error?.response?.description || error.message || 'Unknown error';
        if (/invalid user_id specified/i.test(err)) {
          invalidIds.push({ id: user.id, username: user.username || null });
        }
      }
      await sleep(80);
    }

    if (invalidIds.length === 0) {
      console.log('No invalid user_ids found.');
      process.exit(0);
    }

    console.log('Invalid user_ids:', invalidIds);
    process.exit(0);
  } catch (error) {
    console.error('Failed:', error.message || error);
    process.exit(1);
  }
})();
