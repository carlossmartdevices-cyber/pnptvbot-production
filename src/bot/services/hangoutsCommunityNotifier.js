const https = require('https');
const logger = require('../../utils/logger');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(payload));
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
        },
        timeout: 8000,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          const ok = res.statusCode >= 200 && res.statusCode < 300;
          if (!ok) {
            reject(new Error(`Telegram API error (${res.statusCode}): ${body.slice(0, 200)}`));
            return;
          }
          resolve(body);
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Telegram API request timed out'));
    });
    req.write(data);
    req.end();
  });
}

function resolveCommunityChat() {
  const chatId =
    process.env.GROUP_ID ||
    process.env.FREE_GROUP_ID ||
    '-1003291737499';

  const threadIdRaw = process.env.NOTIFICATIONS_TOPIC_ID || '10682';
  const threadId = threadIdRaw ? Number(threadIdRaw) : null;
  return { chatId, threadId: Number.isFinite(threadId) ? threadId : null };
}

function resolveHangoutsWebAppUrl() {
  const raw = process.env.HANGOUTS_WEB_APP_URL || 'https://pnptv.app/hangouts/';
  try {
    const u = new URL(raw);
    return u.toString();
  } catch {
    return 'https://pnptv.app/hangouts/';
  }
}

async function notifyPublicHangoutCreated({ id, title, creatorName, maxParticipants }) {
  try {
    const token = process.env.BOT_TOKEN;
    if (!token) return;

    const { chatId, threadId } = resolveCommunityChat();
    const base = resolveHangoutsWebAppUrl();
    const joinUrl = `${base}${base.includes('?') ? '&' : '?'}join=${encodeURIComponent(String(id))}`;

    const safeTitle = escapeHtml(title || 'Public Hangout');
    const safeCreator = escapeHtml(creatorName || 'Unknown');

    const text =
      `🎥 <b>New public Hangout</b>\n` +
      `📝 <b>${safeTitle}</b>\n` +
      `👤 Host: <b>${safeCreator}</b>\n` +
      `👥 Max: <b>${escapeHtml(maxParticipants || 0)}</b>\n` +
      `\n` +
      `Tap <b>Join</b> to enter.`;

    const reply_markup = {
      inline_keyboard: [
        [
          {
            text: '🎥 Join',
            web_app: { url: joinUrl },
          },
        ],
        [
          {
            text: '📱 Open Hangouts',
            web_app: { url: base },
          },
        ],
      ],
    };

    const payload = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup,
    };
    if (threadId) payload.message_thread_id = threadId;

    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    await postJson(apiUrl, payload);
  } catch (error) {
    logger.warn('Failed to notify community about public hangout', { error: error.message });
  }
}

module.exports = {
  notifyPublicHangoutCreated,
};
