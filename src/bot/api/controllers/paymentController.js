const DaimoConfig = require('../../../config/daimo');
const PaymentModel = require('../../../models/paymentModel');
const PlanModel = require('../../../models/planModel');
const ConfirmationTokenService = require('../../services/confirmationTokenService');
const PaymentService = require('../../services/paymentService');
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
      const payment = await PaymentModel.getById(paymentId);

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

      // Get plan information (handle both camelCase and snake_case from payment)
      const planId = payment.planId || payment.plan_id;
      const plan = await PlanModel.getById(planId);

      if (!plan) {
        logger.error('Plan not found for payment', { paymentId, planId: payment.planId });
        return res.status(404).json({
          success: false,
          error: 'Plan no encontrado.',
        });
      }

      // Use payment amount if available (for promos), otherwise use plan price
      const paymentAmount = payment.amount || parseFloat(plan.price);
      const isPromo = payment.metadata?.promoId ? true : false;

      // Calculate price in COP using the actual payment amount
      const priceInCOP = Math.round(paymentAmount * 4000);
      const amountCOPString = String(priceInCOP);
      const currencyCode = 'COP';

      // Create payment reference
      const actualPaymentId = payment.id || payment.paymentId;
      if (!actualPaymentId) {
        logger.error('Payment ID is missing from payment object', { payment });
        return res.status(500).json({
          success: false,
          error: 'Error de configuración del pago. Por favor, genera un nuevo enlace desde el bot.',
        });
      }
      const paymentRef = `PAY-${actualPaymentId.substring(0, 8).toUpperCase()}`;

      // Prepare response data
      const webhookDomain = process.env.BOT_WEBHOOK_DOMAIN || 'https://pnptv.app';
      const epaycoWebhookDomain = process.env.EPAYCO_WEBHOOK_DOMAIN || 'https://easybots.store';
      const provider = payment.provider || 'epayco';

      // Handle both camelCase and snake_case from payment
      const userId = payment.userId || payment.user_id;

      // Build response based on provider type
      const basePaymentData = {
        paymentId: payment.id,
        paymentRef,
        userId,
        planId,
        provider,
        status: payment.status,
        amountUSD: paymentAmount,
        amountCOP: priceInCOP,
        currencyCode,
        isPromo,
        originalPrice: isPromo ? parseFloat(plan.price) : null,
        discountAmount: isPromo ? (parseFloat(plan.price) - paymentAmount) : null,
        promoCode: payment.metadata?.promoCode || null,
        plan: {
          id: plan.id,
          sku: plan.sku || 'EASYBOTS-PNP-030',
          name: plan.display_name || plan.name,
          description: isPromo
            ? `Promo ${payment.metadata?.promoCode || ''} - ${plan.display_name || plan.name}`
            : `Suscripción ${plan.display_name || plan.name} - PNPtv`,
          icon: plan.icon || '💎',
          duration: plan.duration || 30,
          features: plan.features || [],
        },
      };

      // Add provider-specific data
      if (provider === 'epayco') {
        basePaymentData.epaycoPublicKey = process.env.EPAYCO_PUBLIC_KEY;
        basePaymentData.testMode = process.env.EPAYCO_TEST_MODE === 'true';
        // Confirmation URL: ePayco server sends webhook callbacks here
        basePaymentData.confirmationUrl = `${epaycoWebhookDomain}/api/webhook/epayco`;
        // Response URL: User's browser redirects here after payment
        basePaymentData.responseUrl = `${webhookDomain}/api/payment-response`;
        basePaymentData.epaycoSignature = PaymentService.generateEpaycoCheckoutSignature({
          invoice: paymentRef,
          amount: amountCOPString,
          currencyCode,
        });
        if (!basePaymentData.epaycoSignature) {
          logger.error('Missing ePayco signature for payment', {
            paymentId: payment.id,
            paymentRef,
          });
          return res.status(500).json({
            success: false,
            error: 'Error de configuración del pago. Por favor, genera un nuevo enlace desde el bot.',
          });
        }
      } else if (provider === 'daimo') {
        try {
          const existingLink = payment.daimoLink || payment.paymentUrl;
          const isExternalLink = existingLink
            && /^https?:\/\//i.test(existingLink)
            && !existingLink.includes('/daimo-checkout/');

          if (existingLink && existingLink.includes('/daimo-checkout/')) {
            logger.warn('Ignoring self-referential Daimo checkout link', {
              paymentId: payment.id,
              existingLink,
            });
          }

          if (isExternalLink) {
            basePaymentData.daimoPaymentLink = existingLink;
          } else {
            const daimoResult = await DaimoConfig.createDaimoPayment({
              amount: paymentAmount,
              userId,
              planId,
              chatId: '',
              paymentId: payment.id,
              description: `${plan.display_name || plan.name} Subscription`,
            });

            if (daimoResult.success) {
              basePaymentData.daimoPaymentLink = daimoResult.paymentUrl;
              // Save the Daimo payment id and URL to prevent duplicate creation on refresh
              await PaymentModel.updateStatus(payment.id, 'pending', {
                daimo_payment_id: daimoResult.daimoPaymentId,
                paymentUrl: daimoResult.paymentUrl,
              });
            } else {
              throw new Error(daimoResult.error || 'Daimo payment creation failed');
            }
          }
        } catch (error) {
          logger.error('Error creating Daimo payment link:', error);
          basePaymentData.daimoPaymentLink = null;
        }
      }

      const responseData = {
        success: true,
        payment: basePaymentData,
      };

      logger.info('Payment info retrieved', {
        paymentId,
        planId: plan.id,
        userId,
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

  /**
   * Verify and consume payment confirmation token
   * GET /api/confirm-payment/:token
   */
  static async confirmPaymentToken(req, res) {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Confirmation token is required',
        });
      }

      // Verify the token
      const tokenData = await ConfirmationTokenService.verifyToken(token);

      if (!tokenData) {
        logger.warn('Invalid or expired confirmation token used', { tokenPrefix: token.substring(0, 8) + '...' });
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired confirmation link. Please use a valid link from your payment receipt.',
        });
      }

      // Consume the token (mark as used)
      const consumed = await ConfirmationTokenService.consumeToken(token);

      if (!consumed) {
        logger.warn('Failed to consume confirmation token', { tokenPrefix: token.substring(0, 8) + '...' });
        return res.status(400).json({
          success: false,
          error: 'This confirmation link has already been used.',
        });
      }

      // Get payment and plan details for display
      const payment = await PaymentModel.getById(tokenData.payment_id);
      const plan = await PlanModel.getById(tokenData.plan_id);

      if (!payment || !plan) {
        logger.error('Payment or plan not found after token verification', {
          paymentId: tokenData.payment_id,
          planId: tokenData.plan_id,
        });
        return res.status(404).json({
          success: false,
          error: 'Payment or plan information not found.',
        });
      }

      logger.info('Payment confirmation token verified', {
        paymentId: tokenData.payment_id,
        userId: tokenData.user_id,
        provider: tokenData.provider,
      });

      res.json({
        success: true,
        message: 'Payment confirmed successfully',
        payment: {
          id: payment.id,
          status: payment.status,
          amount: payment.amount,
          provider: tokenData.provider,
        },
        plan: {
          id: plan.id,
          name: plan.display_name || plan.name,
          description: plan.description,
        },
      });
    } catch (error) {
      logger.error('Error confirming payment token:', {
        error: error.message,
        stack: error.stack,
        token: req.params.token?.substring(0, 8) + '...',
      });

      res.status(500).json({
        success: false,
        error: 'Error processing confirmation. Please try again or contact support.',
      });
    }
  }

  /**
   * Get payment status (for polling after ePayco checkout)
   * GET /api/payment/:paymentId/status
   */
  static async getPaymentStatus(req, res) {
    try {
      const { paymentId } = req.params;

      if (!paymentId) {
        return res.status(400).json({ success: false, error: 'Payment ID is required' });
      }

      const payment = await PaymentModel.getById(paymentId);

      if (!payment) {
        return res.status(404).json({ success: false, error: 'Payment not found' });
      }

      res.json({ success: true, status: payment.status });
    } catch (error) {
      logger.error('Error getting payment status:', {
        error: error.message,
        paymentId: req.params.paymentId,
      });
      res.status(500).json({ success: false, error: 'Error checking payment status' });
    }
  }

  /**
   * Process a tokenized charge (card form → token → customer → charge)
   * POST /api/payment/tokenized-charge
   */
  static async processTokenizedCharge(req, res) {
    try {
      const {
        paymentId,
        cardNumber,
        expYear,
        expMonth,
        cvc,
        name,
        lastName,
        email,
        docType,
        docNumber,
        city,
        address,
        phone,
        dues,
      } = req.body;

      // Validate required fields
      if (!paymentId || !cardNumber || !expYear || !expMonth || !cvc || !name || !email || !docType || !docNumber) {
        return res.status(400).json({
          success: false,
          error: 'Faltan campos requeridos. Completa todos los datos de la tarjeta y personales.',
        });
      }

      // Basic card number validation (13-19 digits)
      const cleanCard = cardNumber.replace(/\s+/g, '');
      if (!/^\d{13,19}$/.test(cleanCard)) {
        return res.status(400).json({
          success: false,
          error: 'Número de tarjeta inválido.',
        });
      }

      // Get client IP
      const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['x-real-ip']
        || req.connection?.remoteAddress
        || '127.0.0.1';

      const result = await PaymentService.processTokenizedCharge({
        paymentId,
        card: {
          number: cleanCard,
          exp_year: String(expYear),
          exp_month: String(expMonth).padStart(2, '0'),
          cvc: String(cvc),
        },
        customer: {
          name,
          last_name: lastName || name,
          email,
          doc_type: docType,
          doc_number: String(docNumber),
          city: city || 'Bogota',
          address: address || 'N/A',
          phone: phone || '0000000000',
          cell_phone: phone || '0000000000',
        },
        dues: String(dues || '1'),
        ip: clientIp,
      });

      if (result.success) {
        res.json(result);
      } else {
        res.status(result.status === 'rejected' ? 402 : 400).json(result);
      }
    } catch (error) {
      logger.error('Error in tokenized charge endpoint:', {
        error: error.message,
        stack: error.stack,
        paymentId: req.body?.paymentId,
      });

      res.status(500).json({
        success: false,
        error: 'Error interno al procesar el pago. Intenta nuevamente.',
      });
    }
  }
}

module.exports = PaymentController;
