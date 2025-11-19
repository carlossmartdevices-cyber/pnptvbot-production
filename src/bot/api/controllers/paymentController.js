const PaymentModel = require('../../../models/paymentModel');
const PlanModel = require('../../../models/planModel');
const logger = require('../../../utils/logger');

/**
 * Payment Controller - Handles payment-related API endpoints
 */
class PaymentController {
  /**
   * Get payment information for checkout page
   * GET /api/payment/:paymentId
   */
  static async getPaymentInfo(req, res) {
    try {
      const { paymentId } = req.params;

      if (!paymentId) {
        return res.status(400).json({
          success: false,
          error: 'Payment ID is required',
        });
      }

      // Get payment from database
      const payment = await PaymentModel.getPaymentById(paymentId);

      if (!payment) {
        logger.warn('Payment not found', { paymentId });
        return res.status(404).json({
          success: false,
          error: 'Pago no encontrado. Por favor, genera un nuevo enlace desde el bot.',
        });
      }

      // Check if payment is still pending
      if (payment.status !== 'pending') {
        logger.warn('Payment already processed', { paymentId, status: payment.status });
        return res.status(400).json({
          success: false,
          error: payment.status === 'completed'
            ? 'Este pago ya fue completado.'
            : 'Este pago ya fue procesado.',
        });
      }

      // Get plan information
      const plan = await PlanModel.getById(payment.planId);

      if (!plan) {
        logger.error('Plan not found for payment', { paymentId, planId: payment.planId });
        return res.status(404).json({
          success: false,
          error: 'Plan no encontrado.',
        });
      }

      // Calculate price in COP
      const priceInCOP = plan.price_in_cop || (parseFloat(plan.price) * 4000);

      // Create payment reference
      const paymentRef = `PAY-${payment.id.substring(0, 8).toUpperCase()}`;

      // Prepare response data
      const webhookDomain = process.env.BOT_WEBHOOK_DOMAIN;
      const epaycoPublicKey = process.env.EPAYCO_PUBLIC_KEY;
      const epaycoTestMode = process.env.EPAYCO_TEST_MODE === 'true';

      const responseData = {
        success: true,
        payment: {
          paymentId: payment.id,
          paymentRef,
          userId: payment.userId,
          planId: payment.planId,
          status: payment.status,
          amountUSD: parseFloat(plan.price),
          amountCOP: priceInCOP,
          plan: {
            id: plan.id,
            sku: plan.sku || 'EASYBOTS-PNP-030',
            name: plan.display_name || plan.name,
            description: `Suscripción ${plan.display_name || plan.name} - PNPtv`,
            icon: plan.icon || '💎',
            duration: plan.duration || 30,
            features: plan.features || [],
          },
          epaycoPublicKey,
          testMode: epaycoTestMode,
          confirmationUrl: `${webhookDomain}/api/webhooks/epayco`,
          responseUrl: `${webhookDomain}/api/payment-response`,
        },
      };

      logger.info('Payment info retrieved', {
        paymentId,
        planId: plan.id,
        userId: payment.userId,
      });

      res.json(responseData);
    } catch (error) {
      logger.error('Error getting payment info:', {
        error: error.message,
        stack: error.stack,
        paymentId: req.params.paymentId,
      });

      res.status(500).json({
        success: false,
        error: 'Error al cargar la información del pago. Por favor, intenta nuevamente.',
      });
    }
  }
}

module.exports = PaymentController;
