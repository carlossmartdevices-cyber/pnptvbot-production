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

/**
 * Generate a unique room code for Zoom meetings
 * Format: ABC-1234 (3 letters + hyphen + 4 numbers)
 * @returns {string} Room code
 */
const generateRoomCode = () => {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excluding I and O to avoid confusion
  const numbers = '0123456789';

  let code = '';

  // Generate 3 random letters
  for (let i = 0; i < 3; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }

  code += '-';

  // Generate 4 random numbers
  for (let i = 0; i < 4; i++) {
    code += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }

  return code;
};

/**
 * Format duration in minutes to human-readable string
 * @param {number} minutes - Duration in minutes
 * @param {string} lang - Language code
 * @returns {string} Formatted duration
 */
const formatDuration = (minutes, lang = 'en') => {
  if (minutes < 60) {
    return lang === 'es' ? `${minutes} minutos` : `${minutes} minutes`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) {
    return lang === 'es' ? `${hours} hora${hours > 1 ? 's' : ''}` : `${hours} hour${hours > 1 ? 's' : ''}`;
  }

  return lang === 'es'
    ? `${hours} hora${hours > 1 ? 's' : ''} y ${mins} minutos`
    : `${hours} hour${hours > 1 ? 's' : ''} and ${mins} minutes`;
};

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength - 3) + '...';
};

module.exports = {
  getLanguage,
  safeHandler,
  validateUserInput,
  isSessionExpired,
  setSessionState,
  getSessionState,
  clearSessionState,
  generateRoomCode,
  formatDuration,
  truncateText,
};
