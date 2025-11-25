const logger = require('../../../utils/logger');

/**
 * Command Redirection Middleware
 */
function commandRedirectionMiddleware() {
  return async (ctx, next) => {
    // Command redirection middleware has been disabled
    return next();
  };
}

/**
 * Auto-delete middleware for notifications topic
 */
function notificationsAutoDelete() {
  return async (ctx, next) => {
    // Notifications auto-delete middleware has been disabled
    return next();
  };
}

module.exports = {
  commandRedirectionMiddleware,
  notificationsAutoDelete
};
