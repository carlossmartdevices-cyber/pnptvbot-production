require('dotenv').config({ allowEmptyValues: true });
const fs = require('fs');
const path = require('path');
const { Telegraf } = require('telegraf');
const db = require('../src/utils/db');

const SUPPORT_GROUP_ID = process.env.SUPPORT_GROUP_ID;
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!SUPPORT_GROUP_ID || !BOT_TOKEN) {
  console.error('Missing SUPPORT_GROUP_ID or BOT_TOKEN');
  process.exit(1);
}

const SENT_LOG_PATH = path.join(__dirname, 'support-quick-actions-sent.json');

const loadSent = () => {
  try {
    const raw = fs.readFileSync(SENT_LOG_PATH, 'utf8');
    const data = JSON.parse(raw);
    return new Set(Array.isArray(data) ? data : []);
  } catch (_) {
    return new Set();
  }
};

const parseThreadId = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const bot = new Telegraf(BOT_TOKEN);
  const sentLog = loadSent();
  const failedThreads = new Set();

  try {
    const result = await db.query('SELECT user_id, thread_id FROM support_topics ORDER BY created_at ASC');
    const topics = result.rows || [];

    for (const topic of topics) {
      const threadId = parseThreadId(topic.thread_id);
      if (!threadId) continue;

      if (!sentLog.has(threadId)) continue;

      try {
        await bot.telegram.getForumTopic(SUPPORT_GROUP_ID, threadId);
      } catch (error) {
        const err = error?.response?.description || error.message || 'Unknown error';
        if (/message thread not found/i.test(err)) {
          failedThreads.add(threadId);
        }
      }

      await sleep(200);
    }

    if (failedThreads.size === 0) {
      console.log('No invalid topics found.');
      process.exit(0);
    }

    const failedList = Array.from(failedThreads);
    const deleteResult = await db.query(
      'DELETE FROM support_topics WHERE thread_id = ANY($1::int[])',
      [failedList]
    );

    console.log(`Deleted ${deleteResult.rowCount} invalid support_topics rows.`);
    process.exit(0);
  } catch (error) {
    console.error('Cleanup failed:', error.message || error);
    process.exit(1);
  }
})();
