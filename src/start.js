
require('dotenv').config();
const { startBot } = require('./bot/core/bot');
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

    // Start bot (handles its own lifecycle)
    await startBot();

    logger.info('✅ PNPtv Bot is running!');
    logger.info('✅ All systems operational!');
  } catch (error) {
    logger.error('Failed to start:', error);
    process.exit(1);
  }
}

// Start everything
start();
