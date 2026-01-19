const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { getRedis } = require('../../config/redis');
const logger = require('../../utils/logger');

// Controllers
const webhookController = require('./controllers/webhookController');
const subscriptionController = require('./controllers/subscriptionController');
const paymentController = require('./controllers/paymentController');
const invitationController = require('./controllers/invitationController');
const hangoutsController = require('./controllers/hangoutsController');
const playlistController = require('./controllers/playlistController');
const videoramaController = require('./controllers/videoramaController');
const podcastController = require('./controllers/podcastController');
const healthController = require('./controllers/healthController');

// Middleware
const { asyncHandler } = require('./middleware/errorHandler');

// Authentication middleware and handlers
const { telegramAuth, checkTermsAccepted } = require('../../api/middleware/telegramAuth');
const { handleTelegramAuth, handleAcceptTerms, checkAuthStatus } = require('../../api/handlers/telegramAuthHandler');

// Simple page limiter middleware stub (used by landing page routes).
// In production this may be replaced with a proper rate-limiter or cache-based limiter.
const pageLimiter = (req, res, next) => {
  // Allow all requests in test environment and default behavior; real limiter can be injected later.
  return next();
};

const app = express();

// Trust proxy - required for rate limiting behind reverse proxy (nginx, etc.)
// Setting to 1 trusts the first proxy (direct connection from nginx)
app.set('trust proxy', 1);

// CRITICAL: Apply body parsing FIRST for ALL routes
// This must be before any route registration
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware for Telegram auth with Redis store
const redisClient = getRedis();
app.use(session({
  store: new RedisStore({ client: redisClient, prefix: 'sess:' }),
  secret: process.env.SESSION_SECRET || 'pnptv-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 }
}));

// Logging (before other middleware for accurate request tracking)
app.use(morgan('combined', { stream: logger.stream }));

// Serve auth wrappers before static middleware to prevent conflicts
app.get(['/videorama-app', '/videorama-app/'], pageLimiter, (req, res) => {
  const authWrapperPath = path.join(__dirname, '../../../public/videorama-app/auth-wrapper.html');
  if (!fs.existsSync(authWrapperPath)) {
    return res.status(404).send('Videorama auth wrapper not found.');
  }
  // Set cache control headers to prevent browser caching issues
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  return res.sendFile(authWrapperPath);
});

app.get('/hangouts', pageLimiter, (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.status(404).send('Page not found.');
  }
  // Set cache control headers to prevent browser caching issues
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../../../public/hangouts/auth-wrapper.html'));
});

// Custom static file middleware with easybots.store blocking
const serveStaticWithBlocking = (path) => {
  return (req, res, next) => {
    const host = req.get('host') || '';
    // Only block PNPtv-specific static files (HTML, CSS, JS, images, etc.)
    // Don't block the root path - let the route handler serve easybots content
    const isPnptvStaticFile = req.path.endsWith('.html') || 
                              req.path.endsWith('.css') || 
                              req.path.endsWith('.js') || 
                              req.path.endsWith('.jpg') || 
                              req.path.endsWith('.png') || 
                              req.path.endsWith('.gif');
    
    if (host.includes('easybots.store') || host.includes('easybots')) {
      if (isPnptvStaticFile) {
        return res.status(404).send('Page not found.');
      }
      // Allow root path and other routes to be handled by route handlers
    }
    express.static(path)(req, res, next);
  };
};

// Serve static files from public directory with blocking
app.use(serveStaticWithBlocking(path.join(__dirname, '../../../public')));

// Serve static auth pages with blocking
app.use('/auth', serveStaticWithBlocking(path.join(__dirname, '../../../public/auth')));

// Explicit routes for auth pages without .html extension
app.get('/auth/telegram-login-complete', (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.status(404).send('Page not found.');
  }
  res.sendFile(path.join(__dirname, '../../../public/auth/telegram-login-complete.html'));
});

app.get('/auth/telegram-login', (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.status(404).send('Page not found.');
  }
  res.sendFile(path.join(__dirname, '../../../public/auth/telegram-login.html'));
});

app.get('/auth/terms', (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.status(404).send('Page not found.');
  }
  res.sendFile(path.join(__dirname, '../../../public/auth/terms.html'));
});

app.get('/auth/not-registered', (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.status(404).send('Page not found.');
  }
  res.sendFile(path.join(__dirname, '../../../public/auth/not-registered.html'));
});

// Add cache control headers for static assets to prevent browser caching issues
app.use((req, res, next) => {
  if (req.path.startsWith('/videorama-app/') &&
      (req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.endsWith('.html'))) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Landing page routes
// Home page - domain aware routing
app.get('/', (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    // Serve easybots-specific landing page (not PNPtv content)
    return res.sendFile(path.join(__dirname, '../../../public/easybots.html'));
  }
  // Route all traffic to pnptv.app - easybots.store references removed
  res.sendFile(path.join(__dirname, '../../../public/index.html'));
});

// PNPtv Haus page
app.get('/community-room', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/community-room.html'));
});

// PNPtv Haus alias
app.get('/pnptv-haus', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/community-room.html'));
});

// Community Features page
app.get('/community-features', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/community-features.html'));
});

// How to Use page (Bilingual) - routes to pnptv.app
app.get('/how-to-use', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/how-to-use.html'));
});

// Videorama (legacy) now redirects to the new React app
app.get('/videorama', (req, res) => {
  return res.redirect(301, '/videorama-app/');
});

// Legacy path redirect
app.get('/video-rooms', (req, res) => {
  return res.redirect(301, '/videorama-app/');
});

// Lifetime Pass landing page
app.get('/lifetime-pass', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/lifetime-pass.html'));
});

// Lifetime Pass landing page ($100)
app.get('/lifetime100', pageLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public', 'lifetime-pass.html'));
});

// Terms and Conditions / Privacy Policy
app.get('/terms', pageLimiter, (req, res) => {
  const lang = req.query.lang || 'en';
  const fileName = lang === 'es' ? 'policies_es.html' : 'policies_en.html';
  res.sendFile(path.join(__dirname, '../../../public', fileName));
});

app.get('/privacy', pageLimiter, (req, res) => {
  const lang = req.query.lang || 'en';
  const fileName = lang === 'es' ? 'policies_es.html' : 'policies_en.html';
  res.sendFile(path.join(__dirname, '../../../public', fileName));
});

app.get('/policies', pageLimiter, (req, res) => {
  const lang = req.query.lang || 'en';
  const fileName = lang === 'es' ? 'policies_es.html' : 'policies_en.html';
  res.sendFile(path.join(__dirname, '../../../public', fileName));
});

// Protected Videorama app - requires authentication
app.get('/videorama/app', telegramAuth, checkTermsAccepted, (req, res) => {
  const indexPath = path.join(__dirname, '../../../public/videorama-app/index.html');
  if (!fs.existsSync(indexPath)) {
    return res.status(404).send('Videorama app not built. Deploy `public/videorama-app/`.');
  }
  // Set cache control headers to prevent browser caching issues
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  return res.sendFile(indexPath);
});

// Music Collections and Playlists routes have been removed
// These functionalities are now integrated into the Videorama app

// Protected Hangouts app - requires authentication
app.get('/hangouts/app', telegramAuth, checkTermsAccepted, (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.status(404).send('Page not found.');
  }
  // Set cache control headers to prevent browser caching issues
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../../../public/hangouts', 'index.html'));
});

// ePayco Checkout page - serves payment-checkout.html for /checkout/:paymentId
app.get('/checkout/:paymentId', pageLimiter, (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.status(404).send('Page not found.');
  }
  res.sendFile(path.join(__dirname, '../../../public', 'payment-checkout.html'));
});

// Daimo Checkout page - serves daimo-checkout.html for /daimo-checkout/:paymentId
app.get('/daimo-checkout/:paymentId', pageLimiter, (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.status(404).send('Page not found.');
  }
  res.sendFile(path.join(__dirname, '../../../public', 'daimo-checkout.html'));
});

// Payment checkout page with language support
app.get('/payment/:paymentId', (req, res) => {
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
  if (req.path === '/pnp/webhook/telegram') {
    return next();
  }
  return middleware(req, res, next);
};

// Security middleware (conditionally applied, skips Telegram webhook)
app.use(conditionalMiddleware(helmet()));
app.use(conditionalMiddleware(cors()));
app.use(conditionalMiddleware(compression()));
// Security middleware
app.use(helmet());
app.use(cors());
app.use(compression());

// Global middleware to block all PNPtv content for easybots.store
app.use((req, res, next) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    // Allow only specific paths for easybots.store
    const allowedPaths = [
      '/health',
      '/api/',
      '/pnp/webhook/telegram',
      '/webhook/telegram'
    ];
    
    const isAllowed = allowedPaths.some(path => 
      req.path.startsWith(path) || req.path === path
    );
    
    if (!isAllowed) {
      return res.status(404).send('Page not found.');
    }
  }
  next();
});

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
    // Not all test Redis mocks implement ping, guard accordingly
    if (redis && typeof redis.ping === 'function') {
      await redis.ping();
    }
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
    if (!db) {
      health.dependencies.firestore = 'disabled';
    } else {
      // Simple health check: verify we can access Firestore
      await db.collection('_health_check').limit(1).get();
      health.dependencies.firestore = 'ok';
    }
  } catch (error) {
    health.dependencies.firestore = 'error';
    health.status = 'degraded';
    logger.error('Firestore health check failed:', error);
  }

  try {
    // Check PostgreSQL connection (optional in test env)
    const { testConnection } = require('../../config/postgres');
    const dbOk = await testConnection();
    health.dependencies.database = dbOk ? 'ok' : 'error';
    if (!dbOk) health.status = 'degraded';
  } catch (error) {
    health.dependencies.database = 'error';
    health.status = 'degraded';
    logger.error('Database health check failed:', error);
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// API routes
// Authentication API endpoints
app.post('/api/telegram-auth', handleTelegramAuth);
app.post('/api/accept-terms', handleAcceptTerms);
app.get('/api/auth-status', checkAuthStatus);

// Logout endpoint
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      logger.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    logger.info('User logged out successfully');
    res.json({ success: true });
  });
});

// Webhook endpoints
app.post('/api/webhooks/epayco', webhookLimiter, webhookController.handleEpaycoWebhook);
app.post('/api/webhooks/daimo', webhookLimiter, webhookController.handleDaimoWebhook);
app.get('/api/payment-response', webhookController.handlePaymentResponse);

// Payment API routes
app.get('/api/payment/:paymentId', asyncHandler(paymentController.getPaymentInfo));
app.get('/api/confirm-payment/:token', asyncHandler(paymentController.confirmPaymentToken));

// Group Invitation routes
app.get('/api/join-group/:token', asyncHandler(invitationController.verifyGroupInvitation));
app.get('/join-group/:token', asyncHandler(invitationController.redirectToGroup));

// Stats endpoint
app.get('/api/stats', asyncHandler(async (req, res) => {
  const UserService = require('../services/userService');
  const stats = await UserService.getStatistics();
  res.json(stats);
}));

// Hangouts API routes
app.post('/api/hangouts/create', asyncHandler(hangoutsController.createHangout));
app.get('/api/hangouts/public', asyncHandler(hangoutsController.getPublicHangouts));
app.get('/api/hangouts/my-rooms', asyncHandler(hangoutsController.getMyHangouts));
app.post('/api/hangouts/join/:roomId', asyncHandler(hangoutsController.joinHangout));
app.post('/api/hangouts/end/:roomId', asyncHandler(hangoutsController.endHangout));
app.get('/api/hangouts/:roomId', asyncHandler(hangoutsController.getHangoutDetails));
// Delete room endpoints
app.delete('/api/hangouts/video-call/:roomId', asyncHandler(hangoutsController.deleteVideoCallRoom));
app.delete('/api/hangouts/jitsi/:roomId', asyncHandler(hangoutsController.deleteJitsiRoom));
app.delete('/api/hangouts/main/:roomId', asyncHandler(hangoutsController.deleteMainRoom));

// Playlist API routes
app.get('/api/playlists/user', asyncHandler(playlistController.getUserPlaylists));
app.get('/api/playlists/public', asyncHandler(playlistController.getPublicPlaylists));
app.post('/api/playlists', asyncHandler(playlistController.createPlaylist));
app.post('/api/playlists/:playlistId/videos', asyncHandler(playlistController.addToPlaylist));
app.delete('/api/playlists/:playlistId/videos/:videoId', asyncHandler(playlistController.removeFromPlaylist));
app.delete('/api/playlists/:playlistId', asyncHandler(playlistController.deletePlaylist));

// Videorama uploads (local storage under /public/uploads/videorama)
app.post(
  '/api/videorama/upload',
  videoramaController.upload.single('video'),
  asyncHandler(videoramaController.uploadVideo)
);

// Podcasts uploads (local storage under /public/uploads/podcasts)
app.post(
  '/api/podcasts/upload',
  podcastController.upload.single('audio'),
  asyncHandler(podcastController.uploadAudio)
);

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

// Audio Management API
const audioStreamer = require('../../services/audioStreamer');

// List all available audio files
app.get('/api/audio/list', asyncHandler(async (req, res) => {
  const files = audioStreamer.listAudioFiles();
  res.json({
    success: true,
    files,
    current: audioStreamer.getCurrentTrack()
  });
}));

// Setup background audio from SoundCloud
app.post('/api/audio/setup-soundcloud', asyncHandler(async (req, res) => {
  const { soundcloudUrl, trackName = 'background-music' } = req.body;

  if (!soundcloudUrl) {
    return res.status(400).json({
      success: false,
      message: 'SoundCloud URL is required'
    });
  }

  try {
    const result = await audioStreamer.setupBackgroundAudio(soundcloudUrl, trackName);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to setup audio',
      error: error.message
    });
  }
}));

// Get current audio track
app.get('/api/audio/current', asyncHandler(async (req, res) => {
  const current = audioStreamer.getCurrentTrack();
  res.json({
    success: true,
    current
  });
}));

// Stop background audio
app.post('/api/audio/stop', asyncHandler(async (req, res) => {
  audioStreamer.stopBackgroundAudio();
  res.json({
    success: true,
    message: 'Background audio stopped'
  });
}));

// Delete audio file
app.delete('/api/audio/:filename', asyncHandler(async (req, res) => {
  const { filename } = req.params;

  try {
    const deleted = audioStreamer.deleteAudioFile(filename);
    res.json({
      success: deleted,
      message: deleted ? 'Audio file deleted' : 'Audio file not found'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete audio',
      error: error.message
    });
  }
}));

// Broadcast Queue API Routes
const broadcastQueueRoutes = require('./broadcastQueueRoutes');
app.use('/api/admin/queue', broadcastQueueRoutes);

// Health Check and Monitoring Endpoints
// Health check endpoints should be accessible but with reasonable rate limits
const healthLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 health checks per minute
  message: 'Too many health check requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/health', healthLimiter, asyncHandler(healthController.healthCheck));
app.get('/api/health', healthLimiter, asyncHandler(healthController.healthCheck));
app.get('/api/metrics', healthLimiter, asyncHandler(healthController.performanceMetrics));
app.post('/api/metrics/reset', healthLimiter, asyncHandler(healthController.resetMetrics));

// Export app WITHOUT 404/error handlers
// These will be added in bot.js AFTER the webhook callback
module.exports = app;
