const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const logger = require('../../utils/logger');

// Controllers
const webhookController = require('./controllers/webhookController');
const subscriptionController = require('./controllers/subscriptionController');

// Middleware
const { asyncHandler } = require('./middleware/errorHandler');

const app = express();

// CRITICAL: Apply body parsing FIRST for ALL routes
// This must be before any route registration
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging (before other middleware for accurate request tracking)
app.use(morgan('combined', { stream: logger.stream }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../../../public')));

// Function to conditionally apply middleware (skip for Telegram webhook)
const conditionalMiddleware = (middleware) => {
  return (req, res, next) => {
    // Skip middleware for Telegram webhook to prevent connection issues
    if (req.path === '/pnp/webhook/telegram') {
      // Telegram Webhook
      app.post('/pnp/webhook/telegram', webhookController.handleTelegramWebhook);
      return next();
    }
    return middleware(req, res, next);
  };
};

// Security middleware (conditionally applied, skips Telegram webhook)
app.use(conditionalMiddleware(helmet()));
app.use(conditionalMiddleware(cors()));
app.use(conditionalMiddleware(compression()));

// Rate limiting for API
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Stricter rate limiting for webhooks to prevent abuse
const webhookLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // Limit each IP to 50 webhook requests per 5 minutes
  message: 'Too many webhook requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// Health check with dependency checks
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dependencies: {},
  };

  try {
    // Check Redis connection
    const { getRedis } = require('../../config/redis');
    const redis = getRedis();
    await redis.ping();
    health.dependencies.redis = 'ok';
  } catch (error) {
    health.dependencies.redis = 'error';
    health.status = 'degraded';
    logger.error('Redis health check failed:', error);
  }

  try {
    // Check Firestore connection
    const { getFirestore } = require('../../config/firebase');
    const db = getFirestore();
    // Simple health check: verify we can access Firestore
    await db.collection('_health_check').limit(1).get();
    health.dependencies.firestore = 'ok';
  } catch (error) {
    health.dependencies.firestore = 'error';
    health.status = 'degraded';
    logger.error('Firestore health check failed:', error);
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// API routes
app.post('/pnp/api/webhooks/epayco', webhookLimiter, webhookController.handleEpaycoWebhook);
app.post('/pnp/api/webhooks/daimo', webhookLimiter, webhookController.handleDaimoWebhook);
app.get('/api/payment-response', webhookController.handlePaymentResponse);

// Stats endpoint
app.get('/api/stats', asyncHandler(async (req, res) => {
  const UserService = require('../services/userService');
  const stats = await UserService.getStatistics();
  res.json(stats);
}));

// Subscription API routes
app.get('/api/subscription/plans', asyncHandler(subscriptionController.getPlans));
app.post('/api/subscription/create-plan', asyncHandler(subscriptionController.createEpaycoPlan));
app.post('/api/subscription/create-checkout', asyncHandler(subscriptionController.createCheckout));
app.post('/api/subscription/epayco/confirmation', webhookLimiter, asyncHandler(subscriptionController.handleEpaycoConfirmation));
app.get('/api/subscription/payment-response', asyncHandler(subscriptionController.handlePaymentResponse));
app.get('/api/subscription/subscriber/:identifier', asyncHandler(subscriptionController.getSubscriber));
app.get('/api/subscription/stats', asyncHandler(subscriptionController.getStatistics));

// Export app WITHOUT 404/error handlers
// These will be added in bot.js AFTER the webhook callback
module.exports = app;
