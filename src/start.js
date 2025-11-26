require('dotenv').config();
const { createBot } = require('./bot/core/bot');
const { startServer } = require('./api/server');
const logger = require('./utils/logger');

/**
 * Start both bot and API server
 */
async function start() {
  try {
    logger.info('🚀 Starting PNPtv Bot and API Server...');

    // Start API server for webhooks
    startServer();

    // Create and launch bot
    const bot = createBot();

    // Enable graceful stop
    process.once('SIGINT', () => {
      logger.info('SIGINT received, stopping...');
      bot.stop('SIGINT');
      process.exit(0);
    });

    process.once('SIGTERM', () => {
      logger.info('SIGTERM received, stopping...');
      bot.stop('SIGTERM');
      process.exit(0);
    });

    // Launch bot
    await bot.launch();

    logger.info('✅ PNPtv Bot is running!');
    logger.info(`Bot username: @${bot.botInfo.username}`);
    logger.info('✅ All systems operational!');
  } catch (error) {
    logger.error('Failed to start:', error);
    process.exit(1);
  }
}

// Start everything
start();
