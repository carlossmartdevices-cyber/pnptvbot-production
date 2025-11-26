#!/usr/bin/env node

/**
 * Initialize moderation system database tables
 * Run this script once to set up the moderation system
 */

require('dotenv-safe').config({ allowEmptyValues: true });
const WarningService = require('../src/services/warningService');
const logger = require('../src/utils/logger');

async function initializeModerationTables() {
  try {
    logger.info('Initializing moderation system database tables...');

    await WarningService.initializeTables();

    logger.info('✅ Moderation system database tables initialized successfully!');
    logger.info('\nThe following tables have been created:');
    logger.info('  • warnings - Stores user warnings');
    logger.info('  • moderation_actions - Stores moderation actions (mute, kick, ban)');
    logger.info('\nYou can now use the moderation system commands:');
    logger.info('  • /rules - Display community rules');
    logger.info('  • /warn <user> [reason] - Warn a user');
    logger.info('  • /warnings <user> - View user warnings');
    logger.info('  • /clearwarnings <user> - Clear user warnings');
    logger.info('  • /mute <user> [duration] [reason] - Mute a user');
    logger.info('  • /unmute <user> - Unmute a user');
    logger.info('  • /kick <user> [reason] - Kick a user');
    logger.info('  • /ban <user> [reason] - Ban a user');
    logger.info('  • /unban <userId> - Unban a user');

    process.exit(0);
  } catch (error) {
    logger.error('Error initializing moderation tables:', error);
    process.exit(1);
  }
}

initializeModerationTables();
