/**
 * General Application Configuration
 * Centralizes environment variables and app-wide settings
 */

module.exports = {
  // Group settings
  GROUP_INVITE_LINK: process.env.GROUP_INVITE_LINK || 'https://t.me/pnptvgroup',
  GROUP_ID: process.env.GROUP_ID,
  SUPPORT_GROUP_ID: process.env.SUPPORT_GROUP_ID,

  // Bot settings
  BOT_TOKEN: process.env.BOT_TOKEN,
  BOT_USERNAME: process.env.BOT_USERNAME,

  // Environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3000,

  // Feature flags
  ENABLE_MODERATION: process.env.ENABLE_MODERATION !== 'false',
  ENABLE_PREMIUM: process.env.ENABLE_PREMIUM !== 'false',
  ENABLE_LIVE_STREAMS: process.env.ENABLE_LIVE_STREAMS !== 'false',
};
