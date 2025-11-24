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
const paymentController = require('./controllers/paymentController');
const materializousController = require('./controllers/materializousController');
// const zoomController = require('./controllers/zoomController'); // Temporarily disabled

// Middleware
const { asyncHandler } = require('./middleware/errorHandler');

const app = express();

// CRITICAL: Trust proxy configuration MUST come first
// This is needed for rate limiting behind nginx/reverse proxy
// Only trust the first proxy (nginx on localhost)
app.set('trust proxy', 1);

// CRITICAL: Apply body parsing AFTER trust proxy
// This must be before any route registration
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging (before other middleware for accurate request tracking)
app.use(morgan('combined', { stream: logger.stream }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../../../public')));

// Landing page routes (ONLY for pnptv.app)
// These routes are handled by Nginx for pnptv.app domain only
// Routes commented out for easybots.store - use Nginx to serve

// Rate limiting for page routes
const pageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

// Payment checkout page with language support
app.get('/payment/:paymentId', pageLimiter, (req, res) => {
  // Get language from query parameter (e.g., ?lang=en)
  const lang = req.query.lang || 'es'; // Default to Spanish

  let fileName;
  if (lang === 'en') {
    fileName = 'payment-checkout-en.html';
  } else {
    fileName = 'payment-checkout-es.html';
  }

  res.sendFile(path.join(__dirname, '../../../public', fileName));
});

// Function to conditionally apply middleware (skip for Telegram webhook)
const conditionalMiddleware = (middleware) => (req, res, next) => {
  // Skip middleware for Telegram webhook to prevent connection issues
  if (req.path === '/pnp/webhook/telegram' || req.path === '/webhook/telegram') {
    return next();
  }
  return middleware(req, res, next);
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
  // Validate configuration is correct for trust proxy
  validate: { trustProxy: false },
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
  // Validate configuration is correct for trust proxy
  validate: { trustProxy: false },
});

// Health check rate limiter (more permissive for monitoring)
const healthLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Allow frequent health checks for monitoring
  message: 'Too many health check requests.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

// Health check with dependency checks
app.get('/health', healthLimiter, async (req, res) => {
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
    // Check PostgreSQL connection
    const { testConnection } = require('../../config/postgres');
    const isConnected = await testConnection();
    health.dependencies.postgres = isConnected ? 'ok' : 'error';
    if (!isConnected) {
      health.status = 'degraded';
    }
  } catch (error) {
    health.dependencies.postgres = 'error';
    health.status = 'degraded';
    logger.error('PostgreSQL health check failed:', error);
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// API routes
app.post('/api/webhooks/epayco', webhookLimiter, webhookController.handleEpaycoWebhook);
app.post('/api/webhooks/daimo', webhookLimiter, webhookController.handleDaimoWebhook);
app.get('/api/payment-response', webhookController.handlePaymentResponse);

// Farcaster Quick Auth API routes
app.post('/api/farcaster/verify', asyncHandler(webhookController.verifyFarcasterAuth));
app.post('/api/farcaster/payment', asyncHandler(webhookController.createFarcasterPayment));
app.post('/api/farcaster/link', asyncHandler(webhookController.linkFarcasterAccount));
app.get('/api/farcaster/profile/:fid', asyncHandler(webhookController.getFarcasterProfile));

// Payment API routes
app.get('/api/payment/:paymentId', asyncHandler(paymentController.getPaymentInfo));

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
app.post(
  '/api/subscription/epayco/confirmation',
  webhookLimiter,
  asyncHandler(subscriptionController.handleEpaycoConfirmation)
);
app.get('/api/subscription/payment-response', asyncHandler(subscriptionController.handlePaymentResponse));
app.get('/api/subscription/subscriber/:identifier', asyncHandler(subscriptionController.getSubscriber));
app.get('/api/subscription/stats', asyncHandler(subscriptionController.getStatistics));

// Zoom API routes - TEMPORARILY DISABLED
// app.get('/api/zoom/room/:roomCode', asyncHandler(zoomController.getRoomInfo));
// app.post('/api/zoom/join', asyncHandler(zoomController.joinMeeting));
// app.post('/api/zoom/host/join', asyncHandler(zoomController.joinAsHost));
// app.post('/api/zoom/end/:roomCode', asyncHandler(zoomController.endMeeting));
// app.get('/api/zoom/participants/:roomCode', asyncHandler(zoomController.getParticipants));
// app.post('/api/zoom/participant/:participantId/action', asyncHandler(zoomController.controlParticipant));
// app.post('/api/zoom/recording/:roomCode', asyncHandler(zoomController.toggleRecording));
// app.get('/api/zoom/stats/:roomCode', asyncHandler(zoomController.getRoomStats));

// Zoom web pages - TEMPORARILY DISABLED
// app.get('/zoom/join/:roomCode', (req, res) => {
//   res.sendFile(path.join(__dirname, '../../../public/zoom/join.html'));
// });

// app.get('/zoom/host/:roomCode', (req, res) => {
//   res.sendFile(path.join(__dirname, '../../../public/zoom/host.html'));
// });

// Materialious rate limiter (prevent abuse of video API)
const materializousLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  message: 'Too many video API requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

// Materialious API routes
app.get('/materialious', pageLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/materialious/index.html'));
});

app.get('/api/materialious/search', materializousLimiter, asyncHandler(materializousController.searchVideos));
app.get('/api/materialious/trending', materializousLimiter, asyncHandler(materializousController.getTrendingVideos));
app.get('/api/materialious/popular', materializousLimiter, asyncHandler(materializousController.getPopularVideos));
app.get('/api/materialious/video/:videoId', materializousLimiter, asyncHandler(materializousController.getVideoDetails));
app.get('/api/materialious/channel/:channelId', materializousLimiter, asyncHandler(materializousController.getChannelInfo));
app.get('/api/materialious/channel/:channelId/videos', materializousLimiter, asyncHandler(materializousController.getChannelVideos));
app.get('/api/materialious/playlist/:playlistId', materializousLimiter, asyncHandler(materializousController.getPlaylistInfo));
app.get('/api/materialious/subtitles/:videoId', materializousLimiter, asyncHandler(materializousController.getSubtitles));
app.get('/api/materialious/instance/status', limiter, asyncHandler(materializousController.getInstanceStatus));
app.post('/api/materialious/instance/configure', asyncHandler(materializousController.setCustomInstance));

// Export app WITHOUT 404/error handlers
// These will be added in bot.js AFTER the webhook callback
module.exports = app;
