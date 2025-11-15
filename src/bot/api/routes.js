const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const logger = require('../../utils/logger');

// Controllers
const webhookController = require('./controllers/webhookController');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(compression());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined', { stream: logger.stream }));

// Rate limiting for API
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.post('/api/webhooks/epayco', webhookController.handleEpaycoWebhook);
app.post('/api/webhooks/daimo', webhookController.handleDaimoWebhook);
app.get('/api/payment-response', webhookController.handlePaymentResponse);

// Stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const UserService = require('../services/userService');
    const stats = await UserService.getStatistics();
    res.json(stats);
  } catch (error) {
    logger.error('Error getting stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Express error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
