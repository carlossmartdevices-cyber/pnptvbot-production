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
const multer = require('multer');
const { getRedis } = require('../../config/redis');
const { getPool } = require('../../config/postgres');
const logger = require('../../utils/logger');

// Controllers
const webhookController = require('./controllers/webhookController');
const subscriptionController = require('./controllers/subscriptionController');
const paymentController = require('./controllers/paymentController');
const invitationController = require('./controllers/invitationController');
const playlistController = require('./controllers/playlistController');
const podcastController = require('./controllers/podcastController');
const ageVerificationController = require('./controllers/ageVerificationController');
const healthController = require('./controllers/healthController');
const hangoutsController = require('./controllers/hangoutsController');
const xOAuthRoutes = require('./xOAuthRoutes');
const adminUserRoutes = require('./routes/adminUserRoutes');

// Middleware
const { asyncHandler } = require('./middleware/errorHandler');

// Authentication middleware and handlers
const { telegramAuth, checkTermsAccepted } = require('../../api/middleware/telegramAuth');
const { handleTelegramAuth, handleAcceptTerms, checkAuthStatus } = require('../../api/handlers/telegramAuthHandler');

/**
 * Page-level authentication middleware
 * Redirects to login page if user is not authenticated
 * Saves the original URL so user can be redirected back after login
 */
const requirePageAuth = (req, res, next) => {
  const user = req.session?.user;

  if (!user) {
    // Redirect unauthenticated users to home page to login
    logger.info(`Unauthenticated access to ${req.originalUrl}, redirecting to home`);
    return res.redirect('/');
  }

  // User is authenticated
  req.user = user;
  next();
};

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

// Function to conditionally apply middleware (skip for Telegram webhook)
const conditionalMiddleware = (middleware) => (req, res, next) => {
  // Skip middleware for Telegram webhook to prevent connection issues
  if (req.path === '/pnp/webhook/telegram') {
    return next();
  }
  return middleware(req, res, next);
};

// Security middleware - MUST be before any route registration
app.use(conditionalMiddleware(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://multimedia.epayco.co",
        "https://songbird.cardinalcommerce.com",
        "https://checkout.epayco.co",
        "https://secure.payco.co",
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https:", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https:", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:"],
      connectSrc: [
        "'self'",
        "https://multimedia.epayco.co",
        "https://songbird.cardinalcommerce.com",
        "https://centinelapi.cardinalcommerce.com",
        "https://checkout.epayco.co",
        "https://secure.epayco.co",
        "https://secure.payco.co",
        "https://api.secure.payco.co",
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com",
      ],
      frameSrc: [
        "'self'",
        "https://checkout.epayco.co",
        "https://secure.epayco.co",
        "https://secure.payco.co",
        "https://api.secure.payco.co",
        "https://songbird.cardinalcommerce.com",
        "https://centinelapi.cardinalcommerce.com",
      ],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'", "https://checkout.epayco.co", "https://secure.epayco.co", "https://secure.payco.co"],
      scriptSrcAttr: ["'unsafe-inline'"],
      upgradeInsecureRequests: [],
    },
  },
})));
app.use(conditionalMiddleware(cors()));
app.use(conditionalMiddleware(compression()));

// Logging (before other middleware for accurate request tracking)
app.use(morgan('combined', { stream: logger.stream }));

// ========== PAYMENT ROUTES (BEFORE static middleware) ==========
// These must be BEFORE serveStaticWithBlocking to ensure they're processed first
app.get('/payment/:paymentId', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../../../public/payment-checkout.html'));
});

// PNPtv Smart Checkout v2 (must be before /checkout/:paymentId)
app.get('/checkout/pnp', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  // Use the tokenized checkout flow currently integrated with /api/payment/tokenized-charge
  res.sendFile(path.join(__dirname, '../../../public/payment-checkout.html'));
});

app.get('/checkout/:paymentId', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../../../public/payment-checkout.html'));
});

app.get('/daimo-checkout/:paymentId', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../../../public/daimo-checkout.html'));
});

app.get('/api/pnp/checkout', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/payment-checkout.html'));
});
// ========== END PAYMENT ROUTES ==========

// Protected paths that require authentication (don't serve static files directly)
const PROTECTED_PATHS = ['/videorama', '/hangouts', '/live', '/pnplive'];

// Custom static file middleware with easybots.store blocking and protected path exclusion
const serveStaticWithBlocking = (staticPath) => {
  return (req, res, next) => {
    const host = req.get('host') || '';

    // Skip static serving for protected paths (let auth routes handle them)
    // But allow assets (/videorama/assets/, /hangouts/assets/, /live/assets/)
    const isProtectedPath = PROTECTED_PATHS.some(p =>
      req.path === p ||
      req.path === p + '/' ||
      (req.path.startsWith(p + '/') && !req.path.includes('/assets/'))
    );
    if (isProtectedPath) {
      return next();
    }

    // Block easybots.store from accessing PNPtv static files
    if (host.includes('easybots.store') || host.includes('easybots')) {
      // Define specific payment-related HTML files that should be allowed
      const allowedPaymentHtmls = [
        'payment-checkout.html',
        'pnp-live-checkout.html',
        'pnp-live-daimo-checkout.html',
        'recurring-checkout.html',
        'meet-greet-daimo-checkout.html',
        'daimo-checkout.html'
      ];

      // Check if the request path ends with one of the allowed payment HTML files
      const isAllowedPaymentHtml = allowedPaymentHtmls.some(fileName => req.path.endsWith('/' + fileName));

      const isPnptvStaticFile = req.path.endsWith('.html') ||
                                req.path.endsWith('.css') ||
                                req.path.endsWith('.js') ||
                                req.path.endsWith('.jpg') ||
                                req.path.endsWith('.png') ||
                                req.path.endsWith('.gif') ||
                                req.path.endsWith('.svg') ||
                                req.path.endsWith('.ico') ||
                                req.path.endsWith('.webp') ||
                                req.path.endsWith('.mp4') ||
                                req.path.endsWith('.webm');

      // Block if it's a general PNPtv static file AND not one of the specifically allowed payment HTMLs
      if (isPnptvStaticFile && req.path !== '/' && !isAllowedPaymentHtml) {
        return res.status(404).send('Not found');
      }
    }

    express.static(staticPath, { fallthrough: true })(req, res, next);
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
  res.redirect(302, '/auth/telegram-login-complete.html');
});

app.get('/auth/telegram-login', (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.status(404).send('Page not found.');
  }
  res.redirect(302, '/auth/telegram-login.html');
});

app.get('/auth/terms', (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.status(404).send('Page not found.');
  }
  res.redirect(302, '/auth/terms.html');
});

app.get('/auth/not-registered', (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.status(404).send('Page not found.');
  }
  res.redirect(302, '/auth/not-registered.html');
});

// Portal dashboard - shows after login with navigation buttons
app.get('/portal', pageLimiter, (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.status(404).send('Page not found.');
  }
  res.sendFile(path.join(__dirname, '../../../public/portal.html'));
});

// Nearby feature - map-based user discovery
app.get('/nearby', pageLimiter, (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.status(404).send('Page not found.');
  }
  res.sendFile(path.join(__dirname, '../../../public/nearby.html'));
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
// Home page - redirect to /login for PRIME Hub
app.get('/', (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    // Serve easybots-specific landing page (not PRIME Hub content)
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>EasyBots - AI and Automation Platform</title>
          <style>
              body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  text-align: center;
                  padding: 50px;
                  min-height: 100vh;
                  margin: 0;
              }
              
              .container {
                  max-width: 800px;
                  margin: 0 auto;
                  padding: 50px;
                  background: rgba(0, 0, 0, 0.3);
                  border-radius: 20px;
                  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
              }
              
              h1 {
                  font-size: 3rem;
                  margin-bottom: 1rem;
                  text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.5);
              }
              
              p {
                  font-size: 1.2rem;
                  line-height: 1.8;
                  margin-bottom: 2rem;
              }
              
              .logo {
                  font-size: 4rem;
                  margin-bottom: 2rem;
                  background: linear-gradient(90deg, #ffd700, #ff6b6b);
                  -webkit-background-clip: text;
                  -webkit-text-fill-color: transparent;
                  background-clip: text;
              }
              
              .contact {
                  margin-top: 3rem;
                  padding: 2rem;
                  background: rgba(255, 255, 255, 0.1);
                  border-radius: 10px;
              }
              
              .contact a {
                  color: #ffd700;
                  text-decoration: none;
                  font-weight: bold;
              }
              
              .contact a:hover {
                  text-decoration: underline;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="logo">🤖 EasyBots</div>
              <h1>Welcome to EasyBots</h1>
              <p>Your AI and Automation Platform</p>
              <p>We're currently under construction, building amazing AI-powered solutions for businesses and individuals.</p>
              
              <div class="contact">
                  <p>For inquiries, please contact us at:</p>
                  <p><a href="mailto:contact@easybots.store">contact@easybots.store</a></p>
                  <p>Follow us for updates on our progress!</p>
              </div>
          </div>
      </body>
      </html>
    `);
    return;
  }
  // Redirect to PRIME Hub login page
  res.redirect(302, '/login');
});

// PRIME Hub login page - shows 4 app icons
app.get('/login', pageLimiter, (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.status(404).send('Page not found.');
  }
  res.sendFile(path.join(__dirname, '../../../public/login.html'));
});

// PNPtv Haus page
app.get('/community-room', (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.status(404).send('Not found');
  }
  res.redirect(302, '/community-room.html');
});

// PNPtv Haus alias
app.get('/pnptv-haus', (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.status(404).send('Not found');
  }
  res.redirect(302, '/community-room.html');
});

// Community Features page
app.get('/community-features', (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.status(404).send('Not found');
  }
  res.redirect(302, '/community-features.html');
});

// How to Use page (Bilingual) - routes to pnptv.app
app.get('/how-to-use', (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.status(404).send('Not found');
  }
  res.redirect(302, '/how-to-use.html');
});



// Lifetime Pass landing page
app.get('/lifetime-pass', (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.status(404).send('Not found');
  }
  res.redirect(302, '/lifetime-pass.html');
});

// Lifetime Pass landing page ($100)
app.get('/lifetime100', pageLimiter, (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.status(404).send('Not found');
  }
  res.redirect(302, '/lifetime-pass.html');
});

// Terms and Conditions / Privacy Policy
app.get('/terms', pageLimiter, (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.sendFile(path.join(__dirname, '../../../public/easybots-terms.html'));
  }
  const lang = req.query.lang || 'en';
  const fileName = lang === 'es' ? 'policies_es.html' : 'terms.html';
  res.sendFile(path.join(__dirname, `../../../public/${fileName}`));
});

app.get('/privacy', pageLimiter, (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.sendFile(path.join(__dirname, '../../../public/easybots-terms.html'));
  }
  const lang = req.query.lang || 'en';
  const fileName = lang === 'es' ? 'policies_es.html' : 'privacy.html';
  res.sendFile(path.join(__dirname, `../../../public/${fileName}`));
});

app.get('/policies', pageLimiter, (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.sendFile(path.join(__dirname, '../../../public/easybots-terms.html'));
  }
  const lang = req.query.lang || 'en';
  const fileName = lang === 'es' ? 'policies_es.html' : 'terms.html';
  res.sendFile(path.join(__dirname, `../../../public/${fileName}`));
});

// Contact page (EasyBots only)
app.get('/contact', pageLimiter, (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.sendFile(path.join(__dirname, '../../../public/easybots-contact.html'));
  }
  return res.status(404).send('Not found');
});

// Age Verification page
app.get('/age-verification', pageLimiter, (req, res) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    return res.status(404).send('Not found');
  }
  res.sendFile(path.join(__dirname, '../../../public/age-verification.html'));
});



// Meet & Greet Checkout pages
app.get('/pnp/meet-greet/checkout/:bookingId', pageLimiter, (req, res) => {
  res.redirect(302, '/meet-greet-checkout.html');
});

app.get('/pnp/meet-greet/daimo-checkout/:bookingId', pageLimiter, (req, res) => {
  res.redirect(302, '/meet-greet-daimo-checkout.html');
});

// PNP Live Checkout pages
app.get('/pnp/live/checkout/:bookingId', pageLimiter, (req, res) => {
  res.redirect(302, '/pnp-live-checkout.html');
});

app.get('/pnp/live/daimo-checkout/:bookingId', pageLimiter, (req, res) => {
  res.redirect(302, '/pnp-live-daimo-checkout.html');
});

// (Security middleware moved to top of middleware chain, before route registration)

// Global middleware to block all PNPtv content for easybots.store
app.use((req, res, next) => {
  const host = req.get('host') || '';
  if (host.includes('easybots.store') || host.includes('easybots')) {
    // Allow only specific paths for easybots.store
    const allowedPaths = [
      '/health',
      '/api/',
      '/pnp/webhook/telegram',
      '/webhook/telegram',
      '/checkout/',
      '/daimo-checkout/',
      '/payment/',
      '/api/pnp/checkout', // NEW: Allow the API checkout page
      '/terms',
      '/privacy',
      '/policies',
      '/contact'
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

const ageVerificationUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max photo size
  fileFilter: (req, file, cb) => {
    const isImage = /^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(file.mimetype || '');
    if (isImage) {
      return cb(null, true);
    }
    return cb(new Error('Only image uploads are allowed'));
  }
});

const uploadAgeVerificationPhoto = (req, res, next) => {
  ageVerificationUpload.single('photo')(req, res, (err) => {
    if (!err) {
      return next();
    }

    let message = 'Invalid upload. Please try again with a clear photo.';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Photo is too large. Maximum size is 5MB.';
    } else if (err.message && err.message.toLowerCase().includes('image')) {
      message = 'Only image files are allowed. Please upload a JPG or PNG.';
    }

    logger.warn('Age verification upload rejected', {
      error: err.message,
      code: err.code
    });

    return res.status(400).json({
      success: false,
      error: 'INVALID_UPLOAD',
      message
    });
  });
};

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

// ==========================================
// Protected Webapp Routes (require Telegram login)
// ==========================================

// Videorama - protected
app.get('/videorama', requirePageAuth, (req, res) => {
  logger.info(`User ${req.user.id} accessing Videorama`);
  res.sendFile(path.join(__dirname, '../../../public/videorama-app/index.html'));
});

app.get('/videorama/*', requirePageAuth, (req, res) => {
  // Serve static assets or fallback to index.html for SPA routing
  const assetPath = path.join(__dirname, '../../../public/videorama-app', req.path.replace('/videorama', ''));
  if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
    return res.sendFile(assetPath);
  }
  res.sendFile(path.join(__dirname, '../../../public/videorama-app/index.html'));
});

// Hangouts - protected
app.get('/hangouts', requirePageAuth, (req, res) => {
  logger.info(`User ${req.user.id} accessing Hangouts`);
  res.sendFile(path.join(__dirname, '../../../public/hangouts/index.html'));
});

app.get('/hangouts/*', requirePageAuth, (req, res) => {
  const assetPath = path.join(__dirname, '../../../public/hangouts', req.path.replace('/hangouts', ''));
  if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
    return res.sendFile(assetPath);
  }
  res.sendFile(path.join(__dirname, '../../../public/hangouts/index.html'));
});

// Live - protected
app.get('/live', requirePageAuth, (req, res) => {
  logger.info(`User ${req.user.id} accessing Live`);
  res.sendFile(path.join(__dirname, '../../../public/live/index.html'));
});

app.get('/live/*', requirePageAuth, (req, res) => {
  const assetPath = path.join(__dirname, '../../../public/live', req.path.replace('/live', ''));
  if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
    return res.sendFile(assetPath);
  }
  res.sendFile(path.join(__dirname, '../../../public/live/index.html'));
});

// PNP Live portal - protected
app.get('/pnplive', requirePageAuth, (req, res) => {
  logger.info(`User ${req.user.id} accessing PNP Live portal`);
  res.sendFile(path.join(__dirname, '../../../public/live/index.html'));
});

// Age verification (AI camera)
app.post(
  '/api/verify-age',
  uploadAgeVerificationPhoto,
  asyncHandler(ageVerificationController.verifyAge)
);

// Telegram webhook is handled in bot.js, not here
// The webhook handler is registered via apiApp.post(webhookPath, ...) in bot.js

// Webhook endpoints
app.post('/api/webhooks/epayco', webhookLimiter, webhookController.handleEpaycoWebhook);
app.post('/api/webhook/epayco', webhookLimiter, webhookController.handleEpaycoWebhook); // singular alias
// New route for pnptv-bot ePayco payments via easybots.store domain
app.post('/checkout/pnp', webhookLimiter, webhookController.handleEpaycoWebhook);
app.post('/checkout/pnp/confirmation', webhookLimiter, webhookController.handleEpaycoWebhook);
app.post('/api/webhooks/daimo', webhookLimiter, webhookController.handleDaimoWebhook);
app.post('/api/webhooks/visa-cybersource', webhookLimiter, require('./controllers/visaCybersourceWebhookController').handleWebhook);
app.get('/api/webhooks/visa-cybersource/health', require('./controllers/visaCybersourceWebhookController').healthCheck);
app.get('/api/payment-response', webhookController.handlePaymentResponse);

// Payment API routes
app.get('/api/payment/:paymentId', asyncHandler(paymentController.getPaymentInfo));
app.get('/api/payment/:paymentId/status', asyncHandler(paymentController.getPaymentStatus));
app.post('/api/payment/tokenized-charge', asyncHandler(paymentController.processTokenizedCharge));
app.post('/api/payment/verify-2fa', asyncHandler(paymentController.verify2FA));
app.post('/api/payment/complete-3ds-2', asyncHandler(paymentController.complete3DS2Authentication));
app.get('/api/confirm-payment/:token', asyncHandler(paymentController.confirmPaymentToken));
// Payment recovery endpoints for stuck 3DS payments
app.post('/api/payment/:paymentId/check-status', asyncHandler(paymentController.checkPaymentStatusWithRecovery));
app.post('/api/payment/:paymentId/retry-webhook', asyncHandler(paymentController.retryPaymentWebhook));

// PNP Live API routes (formerly Meet & Greet, now consolidated)
const PNPLiveService = require('../services/pnpLiveService');
const ModelService = require('../services/modelService');
const PaymentService = require('../services/paymentService');
app.get('/api/pnp-live/booking/:bookingId', asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  const booking = await PNPLiveService.getBookingById(bookingId);
  if (!booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }

  const model = await ModelService.getModelById(booking.model_id);

  // Generate ePayco checkout config for frontend
  const invoice = `PNP-LIVE-${booking.id}`;
  const amount = String(booking.price_usd);
  const currencyCode = 'USD';
  const webhookDomain = process.env.BOT_WEBHOOK_DOMAIN || 'https://pnptv.app';
  const epaycoWebhookDomain = process.env.EPAYCO_WEBHOOK_DOMAIN || 'https://easybots.store';

  res.json({
    success: true,
    booking: {
      id: booking.id,
      userId: booking.user_id,
      modelId: booking.model_id,
      modelName: model?.name || 'Unknown',
      durationMinutes: booking.duration_minutes,
      priceUsd: booking.price_usd,
      bookingTime: booking.booking_time,
      status: booking.status,
      paymentStatus: booking.payment_status,
      paymentMethod: booking.payment_method,
      epaycoPublicKey: process.env.EPAYCO_PUBLIC_KEY,
      testMode: process.env.EPAYCO_TEST_MODE === 'true',
      epaycoSignature: PaymentService.generateEpaycoCheckoutSignature({ invoice, amount, currencyCode }),
      confirmationUrl: `${epaycoWebhookDomain}/api/webhook/epayco`,
      responseUrl: `${webhookDomain}/api/payment-response`,
    }
  });
}));

app.post('/api/pnp-live/booking/:bookingId/confirm', asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { transactionId } = req.body;

  const booking = await PNPLiveService.getBookingById(bookingId);
  if (!booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }

  await PNPLiveService.updateBookingStatus(bookingId, 'confirmed');
  await PNPLiveService.updatePaymentStatus(bookingId, 'paid', transactionId);

  res.json({ success: true, message: 'Booking confirmed' });
}));

// Group Invitation routes
app.get('/api/join-group/:token', asyncHandler(invitationController.verifyGroupInvitation));
app.get('/join-group/:token', asyncHandler(invitationController.redirectToGroup));

// Stats endpoint
app.get('/api/stats', asyncHandler(async (req, res) => {
  const UserService = require('../services/userService');
  const stats = await UserService.getStatistics();
  res.json(stats);
}));



// Playlist API routes
app.get('/api/playlists/user', asyncHandler(playlistController.getUserPlaylists));
app.get('/api/playlists/public', asyncHandler(playlistController.getPublicPlaylists));
app.post('/api/playlists', asyncHandler(playlistController.createPlaylist));
app.post('/api/playlists/:playlistId/videos', asyncHandler(playlistController.addToPlaylist));
app.delete('/api/playlists/:playlistId/videos/:videoId', asyncHandler(playlistController.removeFromPlaylist));
app.delete('/api/playlists/:playlistId', asyncHandler(playlistController.deletePlaylist));



// Podcasts uploads (local storage under /public/uploads/podcasts)
app.post(
  '/api/podcasts/upload',
  podcastController.upload.single('audio'),
  asyncHandler(podcastController.uploadAudio)
);

// Recurring Checkout page - serves recurring-checkout.html for /recurring-checkout/:userId/:planId
app.get('/recurring-checkout/:userId/:planId', pageLimiter, (req, res) => {
  res.redirect(302, '/recurring-checkout.html');
});

// Recurring Subscription API routes
const VisaCybersourceService = require('../services/visaCybersourceService');

// Tokenize card for recurring subscription
app.post('/api/recurring/tokenize', asyncHandler(async (req, res) => {
  const { userId, cardNumber, expMonth, expYear, cvc, cardHolderName, email } = req.body;

  if (!userId || !cardNumber || !expMonth || !expYear || !cvc) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const result = await VisaCybersourceService.tokenizeCard({
    userId,
    cardNumber,
    expMonth,
    expYear,
    cvc,
    cardHolderName,
    email,
  });

  res.json(result);
}));

// Create recurring subscription
app.post('/api/recurring/subscribe', asyncHandler(async (req, res) => {
  const { userId, planId, cardToken, email, trialDays } = req.body;

  if (!userId || !planId) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const result = await VisaCybersourceService.createRecurringSubscription({
    userId,
    planId,
    cardToken,
    email,
    trialDays: trialDays || 0,
  });

  res.json(result);
}));

// Get subscription details
app.get('/api/recurring/subscription/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const subscription = await VisaCybersourceService.getSubscriptionDetails(userId);
  res.json({ success: true, subscription });
}));

// Cancel subscription
app.post('/api/recurring/cancel', asyncHandler(async (req, res) => {
  const { userId, immediately } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, error: 'Missing userId' });
  }

  const result = await VisaCybersourceService.cancelRecurringSubscription(userId, immediately || false);
  res.json(result);
}));

// Reactivate subscription
app.post('/api/recurring/reactivate', asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, error: 'Missing userId' });
  }

  const result = await VisaCybersourceService.reactivateSubscription(userId);
  res.json(result);
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

// ==========================================
// Hangouts API
// ==========================================
app.get('/api/hangouts/public', asyncHandler(hangoutsController.listPublic));
app.post('/api/hangouts/create', asyncHandler(hangoutsController.create));
app.post('/api/hangouts/join/:callId', asyncHandler(hangoutsController.join));

// ==========================================
// Media Library API (for Videorama)
// ==========================================
const MediaPlayerModel = require('../../models/mediaPlayerModel');


// Get media library
app.get('/api/media/library', asyncHandler(async (req, res) => {
  const { type = 'all', category, limit = 50 } = req.query;

  try {
    let media;
    if (category) {
      media = await MediaPlayerModel.getMediaByCategory(category, parseInt(limit));
    } else {
      media = await MediaPlayerModel.getMediaLibrary(type, parseInt(limit));
    }

    res.json({
      success: true,
      data: media,
      count: media.length
    });
  } catch (error) {
    logger.error('Error fetching media library:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch media library',
      data: []
    });
  }
}));

// Get media categories
app.get('/api/media/categories', asyncHandler(async (req, res) => {
  try {
    const { getPool } = require('../../config/postgres');
    const result = await getPool().query(`
      SELECT DISTINCT category FROM media_library
      WHERE is_public = true AND category IS NOT NULL
      ORDER BY category
    `);

    const categories = result.rows.map(r => r.category);
    res.json({
      success: true,
      data: categories.length > 0 ? categories : ['music', 'videos', 'podcast', 'featured']
    });
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.json({
      success: true,
      data: ['music', 'videos', 'podcast', 'featured']
    });
  }
}));

// Get single media item
app.get('/api/media/:mediaId', asyncHandler(async (req, res) => {
  const { mediaId } = req.params;

  try {
    const media = await MediaPlayerModel.getMediaById(mediaId);

    if (!media) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    res.json({
      success: true,
      data: media
    });
  } catch (error) {
    logger.error('Error fetching media:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch media'
    });
  }
}));

// Get playlists
app.get('/api/media/playlists', asyncHandler(async (req, res) => {
  try {
    const { getPool } = require('../../config/postgres');
    const result = await getPool().query(`
      SELECT * FROM media_playlists
      WHERE is_public = true
      ORDER BY created_at DESC
      LIMIT 20
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching playlists:', error);
    res.json({
      success: true,
      data: []
    });
  }
}));



// ==========================================
// RADIO API ROUTES
// ==========================================

// Get radio now playing
app.get('/api/radio/now-playing', asyncHandler(async (req, res) => {
  try {
    const result = await getPool().query(
      'SELECT * FROM radio_now_playing WHERE id = 1'
    );

    const nowPlaying = result.rows[0];

    if (!nowPlaying) {
      return res.json({
        track: {
          title: 'PNPtv Radio',
          artist: 'Starting Soon',
          thumbnailUrl: null,
        },
        listenerCount: 0,
      });
    }

    res.json({
      track: {
        title: nowPlaying.title,
        artist: nowPlaying.artist,
        thumbnailUrl: nowPlaying.cover_url,
        duration: nowPlaying.duration,
        startedAt: nowPlaying.started_at,
      },
      listenerCount: Math.floor(Math.random() * 50) + 10, // Simulated listener count
    });
  } catch (error) {
    logger.error('Error fetching radio now playing:', error);
    res.json({
      track: {
        title: 'PNPtv Radio',
        artist: 'Starting Soon',
        thumbnailUrl: null,
      },
      listenerCount: 0,
    });
  }
}));

// Get radio history
app.get('/api/radio/history', asyncHandler(async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const result = await getPool().query(
      'SELECT * FROM radio_history ORDER BY played_at DESC LIMIT $1',
      [limit]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching radio history:', error);
    res.json({ success: true, data: [] });
  }
}));

// Get radio schedule
app.get('/api/radio/schedule', asyncHandler(async (req, res) => {
  try {
    const result = await getPool().query(
      'SELECT * FROM radio_schedule ORDER BY day_of_week, time_slot'
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching radio schedule:', error);
    res.json({ success: true, data: [] });
  }
}));

// Submit song request
app.post('/api/radio/request', asyncHandler(async (req, res) => {
  try {
    const { userId, songName, artist } = req.body;

    if (!userId || !songName) {
      return res.status(400).json({ error: 'User ID and song name are required' });
    }

    const result = await getPool().query(
      `INSERT INTO radio_requests (user_id, song_name, artist, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id`,
      [userId, songName, artist || null]
    );

    res.json({ success: true, requestId: result.rows[0].id });
  } catch (error) {
    logger.error('Error submitting song request:', error);
    res.status(500).json({ error: 'Failed to submit request' });
  }
}));

// ==========================================
// VIDEORAMA COLLECTIONS API
// ==========================================

// Get Videorama collections (curated playlists/featured content)
app.get('/api/videorama/collections', asyncHandler(async (req, res) => {
  try {
    // Get featured playlists as collections
    const playlistsResult = await getPool().query(`
      SELECT
        mp.id,
        mp.name as title,
        mp.description,
        mp.cover_url as thumbnail,
        mp.is_public,
        COUNT(pi.id) as item_count,
        'playlist' as type
      FROM media_playlists mp
      LEFT JOIN playlist_items pi ON mp.id = pi.playlist_id
      WHERE mp.is_public = true
      GROUP BY mp.id
      ORDER BY mp.total_likes DESC, mp.created_at DESC
      LIMIT 10
    `);

    // Get category-based collections
    const categoriesResult = await getPool().query(`
      SELECT
        category as id,
        category as title,
        COUNT(*) as item_count,
        'category' as type
      FROM media_library
      WHERE is_public = true AND category IS NOT NULL
      GROUP BY category
      ORDER BY COUNT(*) DESC
    `);

    const collections = [
      ...playlistsResult.rows.map(p => ({
        id: p.id,
        title: p.title,
        description: p.description,
        thumbnail: p.thumbnail,
        itemCount: parseInt(p.item_count) || 0,
        type: 'playlist',
      })),
      ...categoriesResult.rows.map(c => ({
        id: c.id,
        title: c.title.charAt(0).toUpperCase() + c.title.slice(1),
        description: `${c.item_count} items`,
        thumbnail: null,
        itemCount: parseInt(c.item_count) || 0,
        type: 'category',
      })),
    ];

    res.json({ success: true, collections });
  } catch (error) {
    logger.error('Error fetching videorama collections:', error);
    res.json({ success: true, collections: [] });
  }
}));

// Get collection items
app.get('/api/videorama/collections/:collectionId', asyncHandler(async (req, res) => {
  const { collectionId } = req.params;
  const { type } = req.query;

  try {
    let items = [];

    if (type === 'playlist') {
      const result = await getPool().query(`
        SELECT m.*
        FROM playlist_items pi
        JOIN media_library m ON pi.media_id = m.id
        WHERE pi.playlist_id = $1
        ORDER BY pi.position ASC
      `, [collectionId]);
      items = result.rows;
    } else if (type === 'category') {
      const result = await getPool().query(`
        SELECT * FROM media_library
        WHERE category = $1 AND is_public = true
        ORDER BY plays DESC, created_at DESC
        LIMIT 50
      `, [collectionId]);
      items = result.rows;
    }

    res.json({ success: true, items });
  } catch (error) {
    logger.error('Error fetching collection items:', error);
    res.json({ success: true, items: [] });
  }
}));

// Broadcast Queue API Routes
const broadcastQueueRoutes = require('./broadcastQueueRoutes');
app.use('/api/admin/queue', broadcastQueueRoutes);

// Admin User Management Routes
app.use('/api/admin/users', adminUserRoutes);

app.use('/api/admin/x/oauth', xOAuthRoutes);
app.use('/api/auth/x', xOAuthRoutes); // Alias for X Developer Portal redirect URI

// Health Check and Monitoring Endpoints
// Health check endpoints should be accessible but with reasonable rate limits
const healthLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 health checks per minute
  message: 'Too many health check requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/api/health', healthLimiter, asyncHandler(healthController.healthCheck));
app.get('/api/metrics', healthLimiter, asyncHandler(healthController.performanceMetrics));
app.post('/api/metrics/reset', healthLimiter, asyncHandler(healthController.resetMetrics));

// Export app WITHOUT 404/error handlers
// These will be added in bot.js AFTER the webhook callback
module.exports = app;
