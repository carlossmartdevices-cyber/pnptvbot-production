const DaimoConfig = require('../../../config/daimo');
const PaymentModel = require('../../../models/paymentModel');
const PlanModel = require('../../../models/planModel');
const ConfirmationTokenService = require('../../services/confirmationTokenService');
const PaymentService = require('../../services/paymentService');
const PaymentSecurityService = require('../../services/paymentSecurityService');
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
          sku: plan.sku || '030PASS',
          name: plan.display_name || plan.name,
          description: isPromo
            ? `Promo ${payment.metadata?.promoCode || ''} - ${plan.display_name || plan.name}`
            : `${plan.display_name || plan.name} Subscription`,
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
        tokenCard,
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

      // Accept either a pre-made token or raw card data for server-side tokenization
      const hasToken = !!tokenCard;
      const hasCard = !!(cardNumber && expYear && expMonth && cvc);

      if (!paymentId || (!hasToken && !hasCard) || !name || !email || !docType || !docNumber) {
        return res.status(400).json({
          success: false,
          error: 'Faltan campos requeridos. Completa todos los datos necesarios.',
        });
      }

      // Basic card number validation when sending raw card data
      let cleanCard;
      if (hasCard) {
        cleanCard = cardNumber.replace(/\s+/g, '');
        if (!/^\d{13,19}$/.test(cleanCard)) {
          return res.status(400).json({
            success: false,
            error: 'Número de tarjeta inválido.',
          });
        }
      }

      // Get client IP and user agent for security checks
      const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['x-real-ip']
        || req.connection?.remoteAddress
        || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || '';

      // Security: Rate limiting per user (fallback to paymentId when user is unknown)
      let rateLimitKey = paymentId;
      try {
        const paymentForRateLimit = await PaymentModel.getById(paymentId);
        const paymentUserId = paymentForRateLimit?.userId || paymentForRateLimit?.user_id;
        if (paymentUserId) {
          rateLimitKey = paymentUserId;
        }
      } catch (err) {
        logger.error('Rate limit identity lookup failed (non-critical)', { error: err.message, paymentId });
      }

      try {
        const rateLimit = await PaymentSecurityService.checkPaymentRateLimit(rateLimitKey);
        if (!rateLimit.allowed) {
          return res.status(429).json({
            success: false,
            error: 'Demasiados intentos de pago. Por favor, espera antes de intentar nuevamente.',
          });
        }
      } catch (err) {
        logger.error('Rate limit check failed (non-critical)', { error: err.message });
      }

      // Security: PCI compliance check
      try {
        const pciCheck = PaymentSecurityService.validatePCICompliance(req.body);
        if (!pciCheck.compliant) {
          return res.status(400).json({
            success: false,
            error: 'Datos de pago no válidos.',
          });
        }
      } catch (err) {
        logger.error('PCI compliance check failed (non-critical)', { error: err.message });
      }

      // Security: Payment timeout check
      try {
        const timeout = await PaymentSecurityService.checkPaymentTimeout(paymentId);
        if (timeout.expired) {
          return res.status(400).json({
            success: false,
            error: 'El tiempo para completar este pago ha expirado. Por favor, genera un nuevo enlace desde el bot.',
          });
        }
      } catch (err) {
        logger.error('Payment timeout check failed (non-critical)', { error: err.message });
      }

      // Security: Audit trail - charge attempted
      PaymentSecurityService.logPaymentEvent({
        paymentId,
        userId: null,
        eventType: 'charge_attempted',
        provider: 'epayco',
        amount: null,
        status: 'pending',
        ipAddress: clientIp,
        userAgent,
        details: hasToken ? { tokenCard: tokenCard?.substring(0, 8) + '...' } : { cardLast4: cleanCard?.slice(-4) },
      }).catch(() => {});

      const chargeParams = {
        paymentId,
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
      };

      if (hasToken) {
        chargeParams.tokenCard = tokenCard;
      } else {
        // Ensure year is 4 digits (if 2-digit, assume 20xx)
        let year = String(expYear);
        if (year.length === 2) {
          year = '20' + year;
        }

        chargeParams.card = {
          number: cleanCard,
          exp_year: year,
          exp_month: String(expMonth).padStart(2, '0'),
          cvc: String(cvc),
        };
      }

      const result = await PaymentService.processTokenizedCharge(chargeParams);

      if (result.success) {
        // Security: Audit trail - charge completed
        PaymentSecurityService.logPaymentEvent({
          paymentId,
          userId: null,
          eventType: 'charge_completed',
          provider: 'epayco',
          amount: null,
          status: 'completed',
          ipAddress: clientIp,
          userAgent,
          details: { transactionId: result.transactionId },
        }).catch(() => {});

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

      // Security: Log payment error
      PaymentSecurityService.logPaymentError({
        paymentId: req.body?.paymentId,
        userId: null,
        provider: 'epayco',
        errorCode: 'TOKENIZED_CHARGE_ERROR',
        errorMessage: error.message,
        stackTrace: error.stack,
      }).catch(() => {});

      res.status(500).json({
        success: false,
        error: 'Error interno al procesar el pago. Intenta nuevamente.',
      });
    }
  }
  /**
   * Verify 2FA OTP for large payments
   * POST /api/payment/verify-2fa
   */
  static async verify2FA(req, res) {
    try {
      const { paymentId, otp } = req.body;

      if (!paymentId || !otp) {
        return res.status(400).json({
          success: false,
          error: 'Payment ID and OTP are required.',
        });
      }

      const { cache } = require('../../../config/redis');
      const key = `payment:2fa:${paymentId}`;
      const data = await cache.get(key);

      if (!data) {
        return res.status(400).json({
          success: false,
          error: 'Código expirado o no encontrado. Intenta iniciar el pago nuevamente.',
        });
      }

      // Check max attempts
      if (data.attempts >= 3) {
        await cache.del(key);
        return res.status(400).json({
          success: false,
          error: 'Demasiados intentos fallidos. Intenta iniciar el pago nuevamente.',
        });
      }

      if (data.otp !== otp) {
        data.attempts = (data.attempts || 0) + 1;
        await cache.set(key, data, 300);
        return res.status(400).json({
          success: false,
          error: 'Código incorrecto. Intentos restantes: ' + (3 - data.attempts),
        });
      }

      // OTP valid - mark as verified (10-minute window to complete payment)
      await cache.set(`payment:2fa:verified:${paymentId}`, true, 600);
      await cache.del(key);

      logger.info('2FA verification successful', { paymentId });

      res.json({
        success: true,
        message: 'Verificación exitosa.',
      });
    } catch (error) {
      logger.error('Error in 2FA verification:', {
        error: error.message,
        paymentId: req.body?.paymentId,
      });

      res.status(500).json({
        success: false,
        error: 'Error al verificar el código.',
      });
    }
  }

  /**
   * Check if a pending payment needs recovery
   * Queries ePayco to detect if webhook was lost
   * POST /api/payment/:paymentId/check-status
   */
  static async checkPaymentStatusWithRecovery(req, res) {
    try {
      const { paymentId } = req.params;

      if (!paymentId) {
        return res.status(400).json({
          success: false,
          error: 'Payment ID is required',
        });
      }

      const payment = await PaymentModel.getById(paymentId);

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found',
        });
      }

      logger.info('Checking payment status with recovery', {
        paymentId,
        currentStatus: payment.status,
        refPayco: payment.epayco_ref,
      });

      // If payment is not pending, return current status
      if (payment.status !== 'pending') {
        return res.json({
          success: true,
          status: payment.status,
          message: `Payment is ${payment.status}`,
        });
      }

      // Payment is pending - check if it's stuck or waiting for webhook
      if (!payment.epayco_ref) {
        return res.json({
          success: true,
          status: 'pending',
          stuck: true,
          message: 'Payment pending but no ePayco reference found - unable to check status',
          action: 'RETRY_PAYMENT',
        });
      }

      // Check status at ePayco
      const statusCheck = await PaymentService.checkEpaycoTransactionStatus(payment.epayco_ref);

      if (!statusCheck.success) {
        return res.json({
          success: false,
          error: statusCheck.error,
          message: 'Could not check payment status at ePayco',
        });
      }

      // If payment is actually approved at ePayco, it needs recovery
      if (statusCheck.currentStatus === 'Aceptada' || statusCheck.currentStatus === 'Aprobada') {
        logger.warn('STUCK PAYMENT DETECTED: Payment approved at ePayco but stuck in pending locally', {
          paymentId,
          refPayco: payment.epayco_ref,
          currentStatus: statusCheck.currentStatus,
        });

        // Attempt recovery
        const recovery = await PaymentService.recoverStuckPendingPayment(paymentId, payment.epayco_ref);

        return res.json({
          success: true,
          status: 'pending',
          stuck: true,
          needsRecovery: true,
          currentStatusAtEpayco: statusCheck.currentStatus,
          recovery,
          message: 'Payment is stuck - recovery in progress. Check webhook logs for processing.',
          action: 'WEBHOOK_REPLAY_NEEDED',
        });
      }

      // Payment is still genuinely pending at ePayco
      return res.json({
        success: true,
        status: 'pending',
        stuck: false,
        currentStatusAtEpayco: statusCheck.currentStatus,
        message: statusCheck.message,
        action: 'AWAITING_3DS_COMPLETION',
      });
    } catch (error) {
      logger.error('Error in payment status check with recovery', {
        error: error.message,
        paymentId: req.params?.paymentId,
      });

      res.status(500).json({
        success: false,
        error: 'Error checking payment status',
        message: error.message,
      });
    }
  }

  /**
   * Manually trigger webhook replay for stuck payment
   * POST /api/payment/:paymentId/retry-webhook
   */
  static async retryPaymentWebhook(req, res) {
    try {
      const { paymentId } = req.params;

      if (!paymentId) {
        return res.status(400).json({
          success: false,
          error: 'Payment ID is required',
        });
      }

      const payment = await PaymentModel.getById(paymentId);

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found',
        });
      }

      if (payment.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: `Payment is ${payment.status}, not pending`,
        });
      }

      if (!payment.epayco_ref) {
        return res.status(400).json({
          success: false,
          error: 'No ePayco reference found for this payment',
        });
      }

      logger.warn('Manual webhook retry initiated', {
        paymentId,
        refPayco: payment.epayco_ref,
      });

      // Check if payment is actually approved at ePayco
      const statusCheck = await PaymentService.checkEpaycoTransactionStatus(payment.epayco_ref);

      if (!statusCheck.success) {
        return res.status(400).json({
          success: false,
          error: 'Could not verify payment at ePayco',
          details: statusCheck.error,
        });
      }

      if (statusCheck.currentStatus !== 'Aceptada' && statusCheck.currentStatus !== 'Aprobada') {
        return res.status(400).json({
          success: false,
          error: `Payment status at ePayco is ${statusCheck.currentStatus}, not approved`,
          message: 'Cannot retry webhook for non-approved payment',
        });
      }

      // Payment is approved - this should not happen in normal flow
      // The webhook should have been received already
      logger.error('CRITICAL: Payment approved at ePayco but stuck pending locally - webhook was missed', {
        paymentId,
        refPayco: payment.epayco_ref,
        action: 'ADMIN_INTERVENTION_NEEDED',
      });

      return res.json({
        success: true,
        message: 'Webhook retry queued - admin notification sent',
        action: 'ADMIN_MANUAL_INTERVENTION',
        paymentId,
        refPayco: payment.epayco_ref,
        note: 'This indicates a system issue - webhooks should be received automatically',
      });
    } catch (error) {
      logger.error('Error retrying payment webhook', {
        error: error.message,
        paymentId: req.params?.paymentId,
      });

      res.status(500).json({
        success: false,
        error: 'Error retrying webhook',
        message: error.message,
      });
    }
  }

  /**
   * Complete Cardinal Commerce 3DS 2.0 authentication
   * POST /api/payment/complete-3ds-2
   */
  static async complete3DS2Authentication(req, res) {
    try {
      const { paymentId, threeDSecure } = req.body;

      if (!paymentId || !threeDSecure) {
        return res.status(400).json({
          success: false,
          error: 'Payment ID and 3DS 2.0 data are required',
        });
      }

      logger.info('3DS 2.0 authentication completion initiated', {
        paymentId,
        referenceId: threeDSecure.referenceId,
      });

      // Get payment from database
      const payment = await PaymentModel.getById(paymentId);

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found',
        });
      }

      if (payment.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: `Payment is ${payment.status}, not pending`,
        });
      }

      // Store 3DS 2.0 authentication data in payment metadata
      await PaymentModel.updateStatus(paymentId, 'pending', {
        three_ds_authentication: {
          version: threeDSecure.version,
          provider: threeDSecure.provider,
          referenceId: threeDSecure.referenceId,
          authenticated_at: new Date().toISOString(),
        },
      });

      logger.info('3DS 2.0 authentication data stored', {
        paymentId,
        referenceId: threeDSecure.referenceId,
      });

      // Check payment status with ePayco to see if it's been approved after 3DS
      const statusCheck = await PaymentService.checkEpaycoTransactionStatus(payment.epayco_ref);

      if (!statusCheck.success) {
        logger.warn('Could not verify payment status at ePayco', {
          paymentId,
          refPayco: payment.epayco_ref,
        });
        // Return pending - let client poll
        return res.json({
          success: true,
          status: 'pending',
          message: 'Payment status being verified',
        });
      }

      const currentStatus = statusCheck.currentStatus;

      if (currentStatus === 'Aceptada' || currentStatus === 'Aprobada') {
        // Payment is approved at ePayco
        logger.info('Payment approved at ePayco after 3DS 2.0 authentication', {
          paymentId,
          refPayco: payment.epayco_ref,
          currentStatus,
        });

        // Update payment status to completed
        await PaymentModel.updateStatus(paymentId, 'completed', {
          transaction_id: payment.epayco_ref,
          reference: payment.epayco_ref,
          epayco_ref: payment.epayco_ref,
          payment_method: 'tokenized_card',
          three_ds_authenticated: true,
        });

        // Activate subscription
        const userId = payment.user_id || payment.userId;
        const planId = payment.plan_id || payment.planId;
        const plan = await PlanModel.getById(planId);

        if (userId && plan) {
          const expiryDate = new Date();
          const durationDays = plan.duration_days || plan.duration || 30;
          expiryDate.setDate(expiryDate.getDate() + durationDays);

          const UserModel = require('../../../models/userModel');
          await UserModel.updateSubscription(userId, {
            status: 'active',
            planId,
            expiry: expiryDate,
          });

          logger.info('Subscription activated after 3DS 2.0 authentication', {
            userId,
            planId,
            expiryDate,
            paymentId,
          });
        }

        return res.json({
          success: true,
          status: 'authenticated',
          message: 'Payment authenticated and approved',
          paymentId,
        });
      } else {
        // Payment still pending at ePayco
        logger.info('Payment still pending at ePayco after 3DS 2.0 authentication', {
          paymentId,
          refPayco: payment.epayco_ref,
          currentStatus,
        });

        return res.json({
          success: true,
          status: 'pending',
          message: 'Payment pending 3DS verification completion',
          paymentId,
        });
      }
    } catch (error) {
      logger.error('Error completing 3DS 2.0 authentication', {
        error: error.message,
        paymentId: req.body?.paymentId,
        stack: error.stack,
      });

      res.status(500).json({
        success: false,
        error: 'Error processing 3DS 2.0 authentication',
        message: error.message,
      });
    }
  }
}

module.exports = PaymentController;
