const logger = require('../../../utils/logger');
const ChatCleanupService = require('../../services/chatCleanupService');

/**
 * Group Behavior Rules Configuration
 * These rules OVERRIDE all previous group behavior settings
 */

// Configuration constants
const GROUP_CHAT_ID = process.env.GROUP_ID;
const NOTIFICATIONS_TOPIC_ID = 3135;
const GROUP_DELETE_DELAY = 3 * 60 * 1000; // 3 minutes in milliseconds

// Personal information keywords to detect (questions that should go to private)
const PERSONAL_INFO_KEYWORDS = [
  // English
  'my email', 'my phone', 'my address', 'my password', 'my account',
  'my subscription', 'my payment', 'my card', 'credit card', 'debit card',
  'my profile', 'my location', 'my ip', 'my data', 'my information',
  'bank account', 'social security', 'ssn', 'my id', 'identification',
  'billing', 'invoice', 'receipt', 'transaction', 'purchase history',
  'login', 'credentials', 'username', 'my name', 'full name',
  // Spanish
  'mi email', 'mi correo', 'mi teléfono', 'mi dirección', 'mi contraseña',
  'mi cuenta', 'mi suscripción', 'mi pago', 'mi tarjeta', 'tarjeta de crédito',
  'mi perfil', 'mi ubicación', 'mis datos', 'mi información',
  'cuenta bancaria', 'seguro social', 'mi id', 'identificación',
  'factura', 'recibo', 'transacción', 'historial de compras',
  'iniciar sesión', 'credenciales', 'nombre de usuario', 'mi nombre'
];

/**
 * Check if a message contains personal information requests
 * @param {string} text - Message text
 * @returns {boolean} True if personal info detected
 */
function containsPersonalInfoRequest(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return PERSONAL_INFO_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

/**
 * Send message to topic 3135 and schedule deletion after 3 minutes
 * @param {Object} ctx - Telegraf context
 * @param {string} text - Message text
 * @param {Object} extra - Extra options (parse_mode, reply_markup, etc.)
 * @returns {Object} Sent message
 */
async function sendToNotificationsTopic(ctx, text, extra = {}) {
  const chatId = ctx.chat?.id?.toString();

  // Only apply to configured group
  if (!GROUP_CHAT_ID || chatId !== GROUP_CHAT_ID.toString()) {
    return ctx.reply(text, extra);
  }

  try {
    const sentMessage = await ctx.telegram.sendMessage(
      chatId,
      text,
      {
        message_thread_id: NOTIFICATIONS_TOPIC_ID,
        ...extra
      }
    );

    // Schedule deletion after 3 minutes
    ChatCleanupService.scheduleBotMessage(
      ctx.telegram,
      sentMessage,
      GROUP_DELETE_DELAY,
      false
    );

    return sentMessage;
  } catch (error) {
    logger.error('Error sending to notifications topic:', error);
    // Fallback to normal reply
    return ctx.reply(text, extra);
  }
}

/**
 * Group Behavior Middleware
 * Overrides all previous group behavior rules
 */
function groupBehaviorMiddleware() {
  return async (ctx, next) => {
    // Group behavior middleware has been disabled
    return next();
  };
}

/**
 * Cristina AI Group Filter Middleware
 * Allows Cristina to reply in group unless it's about personal information
 */
function cristinaGroupFilterMiddleware() {
  return async (ctx, next) => {
    // Cristina group filter middleware has been disabled
    return next();
  };
}

/**
 * Group Menu Button Redirect Middleware
 * When buttons are clicked in group, redirect user to private bot chat
 */
function groupMenuRedirectMiddleware() {
  return async (ctx, next) => {
    // Group menu redirect middleware has been disabled
    return next();
  };
}

/**
 * Delete user commands in group after 3 minutes
 */
function groupCommandDeleteMiddleware() {
  return async (ctx, next) => {
    // Group command delete middleware has been disabled
    return next();
  };
}

module.exports = {
  groupBehaviorMiddleware,
  cristinaGroupFilterMiddleware,
  groupMenuRedirectMiddleware,
  groupCommandDeleteMiddleware,
  sendToNotificationsTopic,
  containsPersonalInfoRequest,
  GROUP_DELETE_DELAY,
  NOTIFICATIONS_TOPIC_ID
};
