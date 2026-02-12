const express = require('express');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { getRedis } = require('../config/redis');
const { config } = require('../bot/config/botConfig');
const paymentService = require('../bot/services/paymentService');
const logger = require('../utils/logger');
const { telegramAuth, checkTermsAccepted } = require('./middleware/telegramAuth');
const { handleTelegramAuth, handleAcceptTerms, checkAuthStatus } = require('./handlers/telegramAuthHandler');
const {
  healthCheck, authStatus, runAuthTests,
  getAuthActivity, getSystemMetrics
} = require('./handlers/monitoringHandler');

const app = express();
const port = config.port;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware for Telegram auth with Redis store
const redisClient = getRedis();
app.use(session({
  store: new RedisStore({ client: redisClient, prefix: 'sess:' }),
  secret: config.sessionSecret || 'pnptv-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 }
}));

// Serve static auth pages
app.use('/auth', express.static(__dirname + '/../../public/auth'));

// Serve monitoring dashboard
app.use('/monitoring', express.static(__dirname + '/../../public/monitoring'));

// Serve public static files (HTML pages, CSS, etc.)
app.use(express.static(__dirname + '/../../public'));

// Clean URL routes for legal pages (without .html extension)
app.get('/terms', (req, res) => {
  res.sendFile('terms.html', { root: __dirname + '/../../public' });
});

app.get('/privacy', (req, res) => {
  res.sendFile('privacy.html', { root: __dirname + '/../../public' });
});

app.get('/age-verification', (req, res) => {
  res.sendFile('age-verification.html', { root: __dirname + '/../../public' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ePayco webhook handler
app.post('/webhook/epayco', async (req, res) => {
  try {
    logger.info('ePayco webhook received:', req.body);

    const { x_extra1: userId, x_extra2: planId, x_ref_payco: transactionId, x_response } = req.body;

    // Check if payment was successful
    if (x_response === 'Aceptada') {
      await paymentService.handlePaymentSuccess(
        parseInt(userId),
        planId,
        'epayco',
        transactionId
      );

      logger.info(`ePayco payment successful: user ${userId}, plan ${planId}`);
      res.status(200).send('OK');
    } else {
      logger.warn(`ePayco payment failed: ${x_response}`);
      res.status(200).send('FAILED');
    }
  } catch (error) {
    logger.error('Error processing ePayco webhook:', error);
    res.status(500).send('ERROR');
  }
});

// Daimo Pay webhook handler
app.post('/webhook/daimo', async (req, res) => {
  try {
    logger.info('Daimo Pay webhook received:', req.body);

    const { userId, planId, transactionId, status } = req.body;

    // Verify webhook signature (implement based on Daimo Pay's documentation)
    // const signature = req.headers['x-daimo-signature'];
    // if (!verifySignature(signature, req.body)) {
    //   return res.status(401).send('UNAUTHORIZED');
    // }

    if (status === 'completed') {
      await paymentService.handlePaymentSuccess(
        parseInt(userId),
        planId,
        'daimo',
        transactionId
      );

      logger.info(`Daimo payment successful: user ${userId}, plan ${planId}`);
      res.status(200).json({ success: true });
    } else {
      logger.warn(`Daimo payment failed: ${status}`);
      res.status(200).json({ success: false });
    }
  } catch (error) {
    logger.error('Error processing Daimo webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handler
app.use((error, req, res, _next) => {
  logger.error('Express error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Telegram Authentication API endpoints
app.post('/api/telegram-auth', handleTelegramAuth);
app.post('/api/accept-terms', handleAcceptTerms);
app.get('/api/auth-status', checkAuthStatus);

// Manual age verification endpoint (for web page)
app.post('/api/verify-age-manual', async (req, res) => {
  try {
    const { user_id, method, lang } = req.body;

    logger.info(`Manual age verification: user ${user_id}, method: ${method}, lang: ${lang}`);

    // If we have a user_id, update their verification status in the database
    if (user_id) {
      const User = require('../models/userModel');
      const user = await User.findOne({ where: { telegram_id: user_id } });

      if (user) {
        user.age_verified = true;
        user.age_verification_method = method || 'manual_web';
        user.age_verification_date = new Date();
        await user.save();
        logger.info(`Age verification updated for user ${user_id}`);
      }
    }

    res.json({ success: true, message: 'Age verification recorded' });
  } catch (error) {
    logger.error('Error processing manual age verification:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Monitoring and Health Check endpoints
app.get('/api/health', healthCheck);
app.get('/api/monitor/auth-status', authStatus);
app.get('/api/monitor/run-tests', runAuthTests);
app.get('/api/monitor/auth-activity', getAuthActivity);
app.get('/api/monitor/system-metrics', getSystemMetrics);

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

// --- PNPtv Hybrid Feature Endpoints ---

// Middleware to protect feature endpoints
const featureAuthMiddleware = [
  telegramAuth,
  checkTermsAccepted,
];

// Hangouts URL Endpoint
app.get('/api/features/hangout/url', ...featureAuthMiddleware, (req, res) => {
  try {
    const hangoutUrl = process.env.HANGOUTS_WEB_URL;
    if (!hangoutUrl) {
      throw new Error('HANGOUTS_WEB_URL is not configured');
    }
    // Here you could add logic to generate a specific room or token
    res.json({ success: true, url: hangoutUrl });
  } catch (error) {
    logger.error('Error getting Hangout URL:', error);
    res.status(500).json({ success: false, error: 'Could not retrieve Hangout URL.' });
  }
});

// Videorama URL Endpoint
app.get('/api/features/videorama/url', ...featureAuthMiddleware, (req, res) => {
  try {
    const videoramaUrl = process.env.VIDEORAMA_WEB_URL; // Assuming this env var exists
    if (!videoramaUrl) {
      throw new Error('VIDEORAMA_WEB_URL is not configured');
    }
    res.json({ success: true, url: videoramaUrl });
  } catch (error) {
    logger.error('Error getting Videorama URL:', error);
    res.status(500).json({ success: false, error: 'Could not retrieve Videorama URL.' });
  }
});

// Nearby URL Endpoint
app.get('/api/features/nearby/url', ...featureAuthMiddleware, (req, res) => {
  try {
    const nearbyUrl = process.env.NEARBY_WEB_URL; // Assuming this env var exists
    if (!nearbyUrl) {
      throw new Error('NEARBY_WEB_URL is not configured');
    }
    res.json({ success: true, url: nearbyUrl });
  } catch (error) {
    logger.error('Error getting Nearby URL:', error);
    res.status(500).json({ success: false, error: 'Could not retrieve Nearby URL.' });
  }
});

// Start server
function startServer() {
  app.listen(port, () => {
    logger.info(`✅ API server running on port ${port}`);
    logger.info(`Webhook URLs:`);
    logger.info(`  - ePayco: http://your-domain.com/webhook/epayco`);
    logger.info(`  - Daimo: http://your-domain.com/webhook/daimo`);
  });
}

module.exports = {
  app,
  startServer,
};
