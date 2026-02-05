require('dotenv').config({ allowEmptyValues: true });
const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const db = require('../src/utils/db');

const SUPPORT_GROUP_ID = process.env.SUPPORT_GROUP_ID;
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!SUPPORT_GROUP_ID || !BOT_TOKEN) {
  console.error('Missing SUPPORT_GROUP_ID or BOT_TOKEN');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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

const saveSent = (set) => {
  const list = Array.from(set);
  fs.writeFileSync(SENT_LOG_PATH, JSON.stringify(list, null, 2));
};

const buildQuickActionsKeyboard = (userId) => ({
  inline_keyboard: [
    [
      { text: '✅ Activar 30 días', callback_data: `support_cmd:activate:${userId}:30` },
      { text: '♾️ Activar lifetime', callback_data: `support_cmd:activate:${userId}:lifetime` },
    ],
    [
      { text: '👤 Ver usuario', callback_data: `support_cmd:user:${userId}` },
      { text: '✅ Marcar resuelto', callback_data: `support_cmd:solved:${userId}` },
    ],
    [
      { text: '📄 Pedir comprobante', callback_data: `support_cmd:quick:${userId}:2` },
    ],
  ],
});

const parseRetryAfter = (errMsg) => {
  const match = String(errMsg || '').match(/retry after (\d+)/i);
  if (!match) return null;
  return parseInt(match[1], 10);
};

(async () => {
  const bot = new Telegraf(BOT_TOKEN);
  const sentLog = loadSent();

  try {
    const result = await db.query('SELECT user_id, thread_id, status FROM support_topics ORDER BY created_at ASC');
    const topics = result.rows || [];

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const topic of topics) {
      const userId = topic.user_id;
      const threadId = topic.thread_id;
      const status = topic.status;

      if (sentLog.has(threadId)) {
        skipped += 1;
        continue;
      }

      const message = `⚡ *Acciones rápidas*\n\nTicket: \`${threadId}\`\nUsuario: \`${userId}\`\nEstado: *${status || 'open'}*\n\n_Usa los botones para responder rápido._`;

      let attempts = 0;
      while (attempts < 2) {
        try {
          await bot.telegram.sendMessage(SUPPORT_GROUP_ID, message, {
            message_thread_id: threadId,
            parse_mode: 'Markdown',
            reply_markup: buildQuickActionsKeyboard(userId),
          });
          sent += 1;
          sentLog.add(threadId);
          saveSent(sentLog);
          break;
        } catch (error) {
          attempts += 1;
          const err = error?.response?.description || error.message || 'Unknown error';
          const retryAfter = parseRetryAfter(err);
          if (retryAfter && attempts < 2) {
            await sleep((retryAfter + 1) * 1000);
            continue;
          }
          failed += 1;
          console.error(`Failed thread ${threadId}: ${err}`);
          break;
        }
      }

      await sleep(450);
    }

    console.log(`Done. Sent: ${sent}, Failed: ${failed}, Skipped: ${skipped}, Total: ${topics.length}`);
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error.message || error);
    process.exit(1);
  }
})();
