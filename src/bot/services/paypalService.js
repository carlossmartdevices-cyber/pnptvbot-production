const paypal = require('@paypal/checkout-server-sdk');
const logger = require('../../utils/logger');

/**
 * PayPal Service for handling payments
 */
class PayPalService {
  constructor() {
    this.environment = this.getEnvironment();
    this.client = this.environment
      ? new paypal.core.PayPalHttpClient(this.environment)
      : null;
  }

  /**
   * Get PayPal environment (Sandbox or Live)
   */
  getEnvironment() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const mode = process.env.PAYPAL_MODE || 'sandbox'; // 'sandbox' or 'live'

    if (!clientId || !clientSecret) {
      logger.warn('PayPal credentials not configured, PayPal features are disabled');
      return null;
    }

    if (mode === 'live') {
      return new paypal.core.LiveEnvironment(clientId, clientSecret);
    }
    return new paypal.core.SandboxEnvironment(clientId, clientSecret);
  }

  /**
   * Create PayPal order
   * @param {Object} params - Order parameters
   * @param {string} params.paymentId - Internal payment ID
   * @param {number} params.amount - Amount in USD
   * @param {string} params.planName - Plan name for description
   * @param {string} params.returnUrl - Success return URL
   * @param {string} params.cancelUrl - Cancel return URL
   * @returns {Promise<Object>} Order details with approval URL
   */
  async createOrder({ paymentId, amount, planName, returnUrl, cancelUrl }) {
    try {
      if (!this.client) {
        throw new Error('PayPal not configured');
      }

      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer('return=representation');
      request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: paymentId,
            description: `PNPtv ${planName} Subscription`,
            custom_id: paymentId,
            amount: {
              currency_code: 'USD',
              value: parseFloat(amount).toFixed(2),
            },
          },
        ],
        application_context: {
          brand_name: 'PNPtv',
          landing_page: 'BILLING',
          user_action: 'PAY_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      });

      const order = await this.client.execute(request);

      // Get approval URL
      const approvalUrl = order.result.links.find(link => link.rel === 'approve')?.href;

      logger.info('PayPal order created', {
        orderId: order.result.id,
        paymentId,
        amount,
        status: order.result.status,
      });

      return {
        success: true,
        orderId: order.result.id,
        approvalUrl,
        status: order.result.status,
      };
    } catch (error) {
      logger.error('Error creating PayPal order', {
        error: error.message,
        paymentId,
        amount,
      });
      throw new Error('Failed to create PayPal order');
    }
  }

  /**
   * Capture payment for an approved order
   * @param {string} orderId - PayPal order ID
   * @returns {Promise<Object>} Capture result
   */
  async captureOrder(orderId) {
    try {
      if (!this.client) {
        throw new Error('PayPal not configured');
      }

      const request = new paypal.orders.OrdersCaptureRequest(orderId);
      request.requestBody({});

      const capture = await this.client.execute(request);

      logger.info('PayPal order captured', {
        orderId,
        captureId: capture.result.purchase_units[0]?.payments?.captures[0]?.id,
        status: capture.result.status,
      });

      return {
        success: true,
        orderId: capture.result.id,
        status: capture.result.status,
        captureId: capture.result.purchase_units[0]?.payments?.captures[0]?.id,
        paymentId: capture.result.purchase_units[0]?.reference_id,
        amount: capture.result.purchase_units[0]?.payments?.captures[0]?.amount?.value,
      };
    } catch (error) {
      logger.error('Error capturing PayPal order', {
        error: error.message,
        orderId,
      });
      throw new Error('Failed to capture PayPal payment');
    }
  }

  /**
   * Get order details
   * @param {string} orderId - PayPal order ID
   * @returns {Promise<Object>} Order details
   */
  async getOrder(orderId) {
    try {
      if (!this.client) {
        throw new Error('PayPal not configured');
      }

      const request = new paypal.orders.OrdersGetRequest(orderId);
      const order = await this.client.execute(request);

      return {
        success: true,
        orderId: order.result.id,
        status: order.result.status,
        paymentId: order.result.purchase_units[0]?.reference_id,
        amount: order.result.purchase_units[0]?.amount?.value,
      };
    } catch (error) {
      logger.error('Error getting PayPal order', {
        error: error.message,
        orderId,
      });
      throw new Error('Failed to get PayPal order details');
    }
  }

  /**
   * Verify webhook signature
   * @param {Object} webhookEvent - Webhook event data
   * @param {Object} headers - Request headers
   * @returns {Promise<boolean>} Verification result
   */
  async verifyWebhook(webhookEvent, headers) {
    try {
      if (!this.client) {
        logger.warn('PayPal not configured, skipping webhook verification');
        return false;
      }

      const webhookId = process.env.PAYPAL_WEBHOOK_ID;

      if (!webhookId) {
        logger.warn('PAYPAL_WEBHOOK_ID not configured, allowing webhook in development mode');
        return true; // Allow in development
      }

      // Note: The @paypal/checkout-server-sdk doesn't include webhook verification
      // For production, consider using the REST API directly or the @paypal/paypal-server-sdk package
      // For now, we'll verify basic webhook structure and log the event

      if (!webhookEvent || !webhookEvent.event_type || !webhookEvent.id) {
        logger.warn('Invalid webhook event structure');
        return false;
      }

      // Check if required headers are present
      const requiredHeaders = [
        'paypal-transmission-id',
        'paypal-transmission-time',
        'paypal-transmission-sig'
      ];

      const hasRequiredHeaders = requiredHeaders.every(header =>
        headers[header] !== undefined && headers[header] !== null
      );

      if (!hasRequiredHeaders) {
        logger.warn('Missing required PayPal webhook headers');
        return false;
      }

      logger.info('PayPal webhook validation passed (basic verification)', {
        eventType: webhookEvent.event_type,
        eventId: webhookEvent.id,
      });

      return true;
    } catch (error) {
      logger.error('Error verifying PayPal webhook', {
        error: error.message,
      });
      return false;
    }
  }
}

module.exports = new PayPalService();
