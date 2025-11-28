const logger = require('../../utils/logger');
const { t } = require('../../utils/i18n');

/**
 * Get user language from context safely
 * @param {Context} ctx - Telegraf context
 * @returns {string} Language code ('en' or 'es')
 */
const getLanguage = (ctx) => ctx.session?.language || 'en';

/**
 * Safe handler wrapper with error handling
 * Automatically handles errors and sends user-friendly messages
 * @param {Function} handlerFn - Handler function to wrap
 * @returns {Function} Wrapped handler
 */
const safeHandler = (handlerFn) => async (ctx) => {
  try {
    await handlerFn(ctx);
  } catch (error) {
    const lang = getLanguage(ctx);
    logger.error('Handler error:', {
      error: error.message,
      stack: error.stack,
      action: ctx.callbackQuery?.data,
      command: ctx.message?.text,
      userId: ctx.from?.id,
    });

    try {
      await ctx.reply(`❌ ${t('error', lang)}`);
    } catch (replyError) {
      logger.error('Failed to send error message:', replyError);
    }
  }
};

/**
 * Validate user text input
 * @param {string} text - User input text
 * @param {number} maxLength - Maximum allowed length
 * @returns {string|null} Validated and trimmed text, or null if invalid
 */
const validateUserInput = (text, maxLength = 500) => {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    return null;
  }

  return trimmed.substring(0, maxLength);
};

/**
 * Check if session temp state is expired
 * @param {Object} ctx - Telegraf context
 * @param {string} stateKey - State key to check
 * @param {number} _timeoutMinutes - Timeout in minutes (unused, default: 5)
 * @returns {boolean} True if expired or not set
 */
const isSessionExpired = (ctx, stateKey, _timeoutMinutes = 5) => {
  const tempState = ctx.session?.temp?.[stateKey];
  if (!tempState) return true;

  if (tempState.expiresAt && Date.now() > tempState.expiresAt) {
    // Clean up expired state
    delete ctx.session.temp[stateKey];
    return true;
  }

  return false;
};

/**
 * Set session temp state with expiration
 * @param {Object} ctx - Telegraf context
 * @param {string} stateKey - State key
 * @param {any} value - State value
 * @param {number} timeoutMinutes - Timeout in minutes (default: 5)
 */
const setSessionState = (ctx, stateKey, value, timeoutMinutes = 5) => {
  if (!ctx.session.temp) {
    ctx.session.temp = {};
  }

  ctx.session.temp[stateKey] = {
    value,
    createdAt: Date.now(),
    expiresAt: Date.now() + (timeoutMinutes * 60 * 1000),
  };
};

/**
 * Get session temp state value
 * @param {Object} ctx - Telegraf context
 * @param {string} stateKey - State key
 * @returns {any} State value or null if not set/expired
 */
const getSessionState = (ctx, stateKey) => {
  if (isSessionExpired(ctx, stateKey)) {
    return null;
  }

  return ctx.session?.temp?.[stateKey]?.value;
};

/**
 * Clear session temp state
 * @param {Object} ctx - Telegraf context
 * @param {string} stateKey - State key to clear (if not provided, clears all)
 */
const clearSessionState = (ctx, stateKey = null) => {
  if (!ctx.session?.temp) return;

  if (stateKey) {
    delete ctx.session.temp[stateKey];
  } else {
    ctx.session.temp = {};
  }
};

module.exports = {
  getLanguage,
  safeHandler,
  validateUserInput,
  isSessionExpired,
  setSessionState,
  getSessionState,
  clearSessionState,
};
