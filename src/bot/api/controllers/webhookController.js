const PaymentService = require('../../services/paymentService');
const logger = require('../../../utils/logger');

/**
 * Handle ePayco webhook
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
const handleEpaycoWebhook = async (req, res) => {
  try {
    logger.info('ePayco webhook received:', req.body);

    const result = await PaymentService.processEpaycoWebhook(req.body);

    if (result.success) {
      res.status(200).send('OK');
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Error handling ePayco webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Handle Daimo webhook
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
const handleDaimoWebhook = async (req, res) => {
  try {
    logger.info('Daimo webhook received:', req.body);

    const result = await PaymentService.processDaimoWebhook(req.body);

    if (result.success) {
      res.status(200).send('OK');
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Error handling Daimo webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Handle payment response page
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
const handlePaymentResponse = async (req, res) => {
  try {
    const { ref, status } = req.query;

    if (status === 'success' || status === 'approved') {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payment Successful</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 400px;
            }
            .success-icon {
              font-size: 60px;
              margin-bottom: 20px;
            }
            h1 {
              color: #667eea;
              margin-bottom: 10px;
            }
            p {
              color: #666;
              margin-bottom: 30px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background: #667eea;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              transition: background 0.3s;
            }
            .button:hover {
              background: #764ba2;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>Payment Successful!</h1>
            <p>Your PRIME subscription has been activated. Return to the Telegram bot to enjoy premium features!</p>
            <a href="https://t.me/${process.env.BOT_USERNAME || 'pnptv_bot'}" class="button">Open Telegram Bot</a>
          </div>
        </body>
        </html>
      `);
    } else {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payment Failed</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 400px;
            }
            .error-icon {
              font-size: 60px;
              margin-bottom: 20px;
            }
            h1 {
              color: #f5576c;
              margin-bottom: 10px;
            }
            p {
              color: #666;
              margin-bottom: 30px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background: #f5576c;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              transition: background 0.3s;
              margin: 5px;
            }
            .button:hover {
              background: #f093fb;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">❌</div>
            <h1>Payment Failed</h1>
            <p>Your payment could not be processed. Please try again or contact support.</p>
            <a href="https://t.me/${process.env.BOT_USERNAME || 'pnptv_bot'}" class="button">Return to Bot</a>
          </div>
        </body>
        </html>
      `);
    }
  } catch (error) {
    logger.error('Error handling payment response:', error);
    res.status(500).send('Error processing payment response');
  }
};

module.exports = {
  handleEpaycoWebhook,
  handleDaimoWebhook,
  handlePaymentResponse,
};
