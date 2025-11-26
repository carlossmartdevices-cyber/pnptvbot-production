const express = require('express');
const { config } = require('../bot/config/botConfig');
const paymentService = require('../bot/services/paymentService');
const logger = require('../utils/logger');

const app = express();
const port = config.port;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use((error, req, res, next) => {
  logger.error('Express error:', error);
  res.status(500).json({ error: 'Internal server error' });
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
