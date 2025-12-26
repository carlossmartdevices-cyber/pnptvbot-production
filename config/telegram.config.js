module.exports = {
  token: process.env.TELEGRAM_BOT_TOKEN || 'tu-bot-token',
  webhook: {
    url: process.env.TELEGRAM_WEBHOOK_URL || 'https://tudominio.com/webhook',
    port: process.env.TELEGRAM_WEBHOOK_PORT || 443,
  },
  adminIds: process.env.TELEGRAM_ADMIN_IDS ? process.env.TELEGRAM_ADMIN_IDS.split(',') : [],
};
