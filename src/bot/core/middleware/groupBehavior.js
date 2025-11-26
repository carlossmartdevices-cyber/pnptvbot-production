const logger = require('../../../utils/logger');

/**
 * Group Behavior Middleware
 */
function groupBehaviorMiddleware() {
  return async (ctx, next) => {
    // Group behavior middleware has been disabled
    return next();
  };
}

/**
 * Cristina AI Group Filter Middleware
 */
function cristinaGroupFilterMiddleware() {
  return async (ctx, next) => {
    // Cristina group filter middleware has been disabled
    return next();
  };
}

/**
 * Group Menu Button Redirect Middleware
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
};
