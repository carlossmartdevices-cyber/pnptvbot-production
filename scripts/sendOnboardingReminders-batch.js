#!/usr/bin/env node

/**
 * Send onboarding reminders in batches
 * This script can be run as a scheduled cron job to gradually send reminders
 * Usage: node sendOnboardingReminders-batch.js [batchSize] [maxRetries]
 * Example: node sendOnboardingReminders-batch.js 100 3
 */

require('dotenv').config({ allowEmptyValues: true });
const { Telegraf } = require('telegraf');
const UserModel = require('../src/models/userModel');
const OnboardingReminderService = require('../src/bot/services/onboardingReminderService');
const logger = require('../src/utils/logger');

const BOT_TOKEN = process.env.BOT_TOKEN;
const BATCH_SIZE = parseInt(process.argv[2] || '100', 10);
const MAX_RETRIES = parseInt(process.argv[3] || '3', 10);

if (!BOT_TOKEN) {
  logger.error('BOT_TOKEN environment variable is not set');
  process.exit(1);
}

async function sendBatchReminders() {
  try {
    // Initialize bot
    const bot = new Telegraf(BOT_TOKEN);

    // Initialize the onboarding reminder service with bot instance
    OnboardingReminderService.initialize(bot);

    logger.info('Starting onboarding reminder batch campaign...');
    logger.info(`Configuration: batchSize=${BATCH_SIZE}, maxRetries=${MAX_RETRIES}`);
    logger.info(`Timestamp: ${new Date().toISOString()}`);

    // Get users with incomplete onboarding
    const allUsers = await UserModel.getIncompleteOnboarding();
    logger.info(`Total users with incomplete onboarding: ${allUsers.length}`);

    // Process in batches
    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < allUsers.length; i += BATCH_SIZE) {
      const batch = allUsers.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allUsers.length / BATCH_SIZE);

      logger.info(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} users)`);

      for (const user of batch) {
        let retries = 0;
        let sent = false;

        while (retries < MAX_RETRIES && !sent) {
          try {
            const success = await OnboardingReminderService.sendReminderToUser(user);
            if (success) {
              totalSent++;
              sent = true;
            } else {
              totalFailed++;
              sent = true; // Don't retry if user blocked bot or chat not found
            }
          } catch (error) {
            retries++;
            if (retries < MAX_RETRIES) {
              logger.warn(`Retry ${retries}/${MAX_RETRIES} for user ${user.id}`);
              await new Promise(resolve => setTimeout(resolve, 500));
            } else {
              logger.error(`Failed to send reminder to user ${user.id} after ${MAX_RETRIES} retries`);
              totalFailed++;
              sent = true;
            }
          }
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      logger.info(`Batch ${batchNumber}/${totalBatches} completed. Total sent: ${totalSent}, Total failed: ${totalFailed}`);
    }

    logger.info('✅ Onboarding reminder batch campaign completed!');
    logger.info(`Summary:`);
    logger.info(`  Total sent: ${totalSent}`);
    logger.info(`  Total failed: ${totalFailed}`);
    logger.info(`  Success rate: ${totalSent}/${allUsers.length} (${Math.round((totalSent / allUsers.length) * 100)}%)`);
    logger.info(`Timestamp: ${new Date().toISOString()}`);

    process.exit(0);
  } catch (error) {
    logger.error('Error sending onboarding reminders:', error);
    process.exit(1);
  }
}

sendBatchReminders();
