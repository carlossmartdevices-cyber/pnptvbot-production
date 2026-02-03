#!/usr/bin/env node

/**
 * Send onboarding reminders to users with incomplete onboarding
 * Run this script as a scheduled task or manually
 */

require('dotenv').config({ allowEmptyValues: true });
const { Telegraf } = require('telegraf');
const OnboardingReminderService = require('../src/bot/services/onboardingReminderService');
const logger = require('../src/utils/logger');

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  logger.error('BOT_TOKEN environment variable is not set');
  process.exit(1);
}

async function sendOnboardingReminders() {
  try {
    // Initialize bot
    const bot = new Telegraf(BOT_TOKEN);

    // Initialize the onboarding reminder service with bot instance
    OnboardingReminderService.initialize(bot);

    logger.info('Starting onboarding reminder campaign...');
    logger.info(`Timestamp: ${new Date().toISOString()}`);

    // Send reminders to users with incomplete onboarding
    const sentCount = await OnboardingReminderService.sendIncompleteOnboardingReminders();

    logger.info('✅ Onboarding reminder campaign completed!');
    logger.info(`Total reminders sent: ${sentCount}`);
    logger.info(`Timestamp: ${new Date().toISOString()}`);

    process.exit(0);
  } catch (error) {
    logger.error('Error sending onboarding reminders:', error);
    process.exit(1);
  }
}

sendOnboardingReminders();
