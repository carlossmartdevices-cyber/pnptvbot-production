const Sentry = require('@sentry/node');
const { config } = require('../../config/botConfig');
const logger = require('../../../utils/logger');

/**
 * Initialize Sentry for error tracking
 */
function initializeSentry() {
  if (!config.sentry.enabled) {
    logger.info('Sentry is not enabled');
    return;
  }

  try {
    Sentry.init({
      dsn: config.sentry.dsn,
      environment: config.nodeEnv,
      tracesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,
    });

    logger.info('Sentry initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Sentry:', error);
  }
}

/**
 * Error handler middleware for Telegraf
 */
const sentryErrorHandler = () => {
  return async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      // Log to Sentry if enabled
      if (config.sentry.enabled) {
        Sentry.captureException(error, {
          user: {
            id: ctx.from?.id,
            username: ctx.from?.username,
          },
          extra: {
            chatId: ctx.chat?.id,
            chatType: ctx.chat?.type,
            messageText: ctx.message?.text,
            updateType: ctx.updateType,
          },
        });
      }

      // Log to console
      logger.error('Bot error:', {
        error: error.message,
        stack: error.stack,
        userId: ctx.from?.id,
        chatId: ctx.chat?.id,
      });

      // Send user-friendly error message
      try {
        await ctx.reply(
          '❌ An error occurred while processing your request. Please try again later.',
          { reply_to_message_id: ctx.message?.message_id }
        );
      } catch (replyError) {
        logger.error('Failed to send error message:', replyError);
      }

      // Re-throw the error
      throw error;
    }
  };
};

/**
 * Capture exception manually
 */
const captureException = (error, context = {}) => {
  if (config.sentry.enabled) {
    Sentry.captureException(error, context);
  }
  logger.error('Exception captured:', error);
};

module.exports = {
  initializeSentry,
  sentryErrorHandler,
  captureException,
};
