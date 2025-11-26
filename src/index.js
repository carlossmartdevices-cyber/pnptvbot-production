require('dotenv').config();
const { createBot } = require('./bot/core/bot');
const logger = require('./utils/logger');

/**
 * Main entry point for the bot
 */
async function main() {
  try {
    logger.info('Starting PNPtv Telegram Bot...');

    // Create and launch bot
    const bot = createBot();

    // Enable graceful stop
    process.once('SIGINT', () => {
      logger.info('SIGINT received, stopping bot...');
      bot.stop('SIGINT');
    });

    process.once('SIGTERM', () => {
      logger.info('SIGTERM received, stopping bot...');
      bot.stop('SIGTERM');
    });

    // Launch bot
    await bot.launch();

    logger.info('✅ PNPtv Bot is running!');
    logger.info(`Bot username: @${bot.botInfo.username}`);
  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Start the bot
main();
