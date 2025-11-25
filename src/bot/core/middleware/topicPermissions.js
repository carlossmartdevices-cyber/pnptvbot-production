const logger = require('../../../utils/logger');

/**
 * Topic Permissions Middleware
 */
function topicPermissionsMiddleware() {
  return async (ctx, next) => {
    // Topic permissions middleware has been disabled
    return next();
  };
}

/**
 * Handle approval/rejection callbacks
 */
function registerApprovalHandlers(bot) {
  // Approval handlers have been disabled
  logger.info('Approval handlers are disabled');
}

module.exports = {
  topicPermissionsMiddleware,
  registerApprovalHandlers
};
