const PaymentModel = require('../../models/paymentModel');
const InvoiceService = require('../../bot/services/invoiceservice');
const EmailService = require('../../bot/services/emailservice');
const PlanModel = require('../../models/planModel');
const UserModel = require('../../models/userModel');
const SubscriberModel = require('../../models/subscriberModel');
const logger = require('../../utils/logger');
const crypto = require('crypto');

class PaymentService {
    /**
     * Reintentar pago fallido (simulado)
     * @param {string} paymentId
     * @param {number} maxRetries
     */
    static async retryPayment(paymentId, maxRetries = 2) {
      let attempt = 0;
      let success = false;
      while (attempt < maxRetries && !success) {
        try {
          // Aquí iría la lógica real de reintento con el proveedor
          await PaymentModel.updateStatus(paymentId, 'pending', { retryAttempt: attempt + 1 });
          // Simulación: marcar como fallido si no es el último intento
          if (attempt < maxRetries - 1) {
            await PaymentModel.updateStatus(paymentId, 'failed', { retryAttempt: attempt + 1 });
          } else {
            await PaymentModel.updateStatus(paymentId, 'completed', { retryAttempt: attempt + 1 });
            success = true;
          }
        } catch (error) {
          logger.error('Error reintentando pago:', { paymentId, attempt, error: error.message });
        }
        attempt++;
      }
      return success;
    }

  /**
   * Process ePayco webhook confirmation
   * @param {Object} webhookData - ePayco webhook data
   * @returns {Object} { success: boolean, error?: string }
   */
  static async processEpaycoWebhook(webhookData) {
    try {
      const {
        x_ref_payco,
        x_transaction_id,
        x_transaction_state,
        x_amount,
        x_currency_code,
        x_signature,
        x_approval_code,
        x_extra1, // userId (telegram ID)
        x_extra2, // planId
        x_extra3, // paymentId
        x_customer_email,
        x_customer_name,
      } = webhookData;

      logger.info('Processing ePayco webhook', {
        refPayco: x_ref_payco,
        transactionId: x_transaction_id,
        state: x_transaction_state,
        amount: x_amount,
        paymentId: x_extra3,
      });

      // Verify signature if available
      if (x_signature && process.env.EPAYCO_PRIVATE_KEY) {
        const p_cust_id_cliente = process.env.EPAYCO_P_CUST_ID || '';
        const p_key = process.env.EPAYCO_PRIVATE_KEY;

        // ePayco signature format
        const signatureString = `${p_cust_id_cliente}^${p_key}^${x_ref_payco}^${x_transaction_id}^${x_amount}^${x_currency_code}`;
        const expectedSignature = crypto.createHash('sha256').update(signatureString).digest('hex');

        if (x_signature !== expectedSignature) {
          logger.error('Invalid ePayco signature', {
            received: x_signature,
            expected: expectedSignature,
            refPayco: x_ref_payco,
          });
          return { success: false, error: 'Invalid signature' };
        }

        logger.info('ePayco signature verified successfully');
      }

      const paymentId = x_extra3;
      const userId = x_extra1;
      const planId = x_extra2;

      // Check if payment exists
      const payment = paymentId ? await PaymentModel.getById(paymentId) : null;

      if (!payment && !userId) {
        logger.error('Payment not found and no user ID provided', { paymentId, refPayco: x_ref_payco });
        return { success: false, error: 'Payment not found' };
      }

      // Process based on transaction state
      if (x_transaction_state === 'Aceptada' || x_transaction_state === 'Aprobada') {
        // Payment successful
        if (payment) {
          await PaymentModel.updateStatus(paymentId, 'completed', {
            transaction_id: x_transaction_id,
            approval_code: x_approval_code,
            epayco_ref: x_ref_payco,
          });
        }

        // Activate user subscription
        if (userId && planId) {
          const plan = await PlanModel.getById(planId);
          if (plan) {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + (plan.duration || 30));

            await UserModel.updateSubscription(userId, {
              status: 'active',
              planId,
              expiry: expiryDate,
            });

            logger.info('User subscription activated via webhook', {
              userId,
              planId,
              expiryDate,
              refPayco: x_ref_payco,
            });
          }
        }

        // Create or update subscriber record
        if (x_customer_email) {
          const existingSubscriber = await SubscriberModel.getByEmail(x_customer_email);

          if (existingSubscriber) {
            await SubscriberModel.updateStatus(x_customer_email, 'active', {
              lastPaymentAt: new Date(),
              subscriptionId: x_ref_payco,
            });
          } else if (userId && planId) {
            await SubscriberModel.create({
              email: x_customer_email,
              name: x_customer_name || 'Unknown',
              telegramId: userId,
              plan: planId,
              subscriptionId: x_ref_payco,
              provider: 'epayco',
            });
          }
        }

        return { success: true };
      } else if (x_transaction_state === 'Rechazada' || x_transaction_state === 'Fallida') {
        // Payment failed
        if (payment) {
          await PaymentModel.updateStatus(paymentId, 'failed', {
            transaction_id: x_transaction_id,
            epayco_ref: x_ref_payco,
          });
        }

        logger.warn('Payment rejected by ePayco', {
          paymentId,
          refPayco: x_ref_payco,
          state: x_transaction_state,
        });

        return { success: true }; // Return success to acknowledge webhook
      } else if (x_transaction_state === 'Pendiente') {
        // Payment pending
        if (payment) {
          await PaymentModel.updateStatus(paymentId, 'pending', {
            transaction_id: x_transaction_id,
            epayco_ref: x_ref_payco,
          });
        }

        return { success: true };
      }

      return { success: true };
    } catch (error) {
      logger.error('Error processing ePayco webhook:', {
        error: error.message,
        stack: error.stack,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Process Daimo webhook confirmation
   * @param {Object} webhookData - Daimo webhook data
   * @returns {Object} { success: boolean, error?: string, alreadyProcessed?: boolean }
   */
  static async processDaimoWebhook(webhookData) {
    try {
      const {
        id,
        status,
        source,
        metadata,
      } = webhookData;

      logger.info('Processing Daimo webhook', {
        eventId: id,
        status,
        txHash: source?.txHash,
        userId: metadata?.userId,
        planId: metadata?.planId,
      });

      const userId = metadata?.userId;
      const planId = metadata?.planId;
      const paymentId = metadata?.paymentId;

      if (!userId || !planId) {
        logger.error('Missing user ID or plan ID in Daimo webhook', { eventId: id });
        return { success: false, error: 'Missing user ID or plan ID' };
      }

      // Check if already processed (idempotency)
      if (paymentId) {
        const payment = await PaymentModel.getById(paymentId);
        if (payment && payment.status === 'completed') {
          logger.info('Daimo payment already processed', { paymentId, eventId: id });
          return { success: true, alreadyProcessed: true };
        }
      }

      // Process based on status
      if (status === 'confirmed' || status === 'completed') {
        // Payment successful
        if (paymentId) {
          await PaymentModel.updateStatus(paymentId, 'completed', {
            transaction_id: source?.txHash || id,
            daimo_event_id: id,
          });
        }

        // Activate user subscription
        const plan = await PlanModel.getById(planId);
        if (plan) {
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + (plan.duration || 30));

          await UserModel.updateSubscription(userId, {
            status: 'active',
            planId,
            expiry: expiryDate,
          });

          logger.info('User subscription activated via Daimo webhook', {
            userId,
            planId,
            expiryDate,
            txHash: source?.txHash,
          });
        }

        return { success: true };
      } else if (status === 'failed') {
        // Payment failed
        if (paymentId) {
          await PaymentModel.updateStatus(paymentId, 'failed', {
            transaction_id: source?.txHash || id,
            daimo_event_id: id,
          });
        }

        logger.warn('Daimo payment failed', {
          paymentId,
          eventId: id,
          status,
        });

        return { success: true }; // Return success to acknowledge webhook
      }

      return { success: true };
    } catch (error) {
      logger.error('Error processing Daimo webhook:', {
        error: error.message,
        stack: error.stack,
      });
      return { success: false, error: error.message };
    }
  }
  static async createPayment({ userId, planId, provider, sku, chatId, language }) {
    try {
      const plan = await PlanModel.getById(planId);
      if (!plan || !plan.active) {
        logger.error('Plan inválido o inactivo', { planId });
        throw new Error('El plan seleccionado no existe o está inactivo.');
      }

       const payment = await PaymentModel.create({
         userId,
         planId,
         provider,
         sku,
         amount: plan.price,
         status: 'pending',
       });

       logger.info('Payment created', {
         paymentId: payment.id,
         userId,
         planId,
         provider,
         amount: plan.price
       });

       // Generate ePayco payment link
       if (provider === 'epayco') {
         const epaycoPublicKey = process.env.EPAYCO_PUBLIC_KEY;
         const epaycoTestMode = process.env.EPAYCO_TEST_MODE === 'true';
         const webhookDomain = process.env.BOT_WEBHOOK_DOMAIN;

         if (!epaycoPublicKey) {
           logger.error('ePayco public key not configured');
           throw new Error('Configuración de pago incompleta. Contacta soporte.');
         }

         if (!webhookDomain) {
           logger.error('BOT_WEBHOOK_DOMAIN not configured');
           throw new Error('Configuración de pago incompleta. Contacta soporte.');
         }

         // Use price in Colombian pesos for ePayco
         const priceInCOP = plan.price_in_cop || (parseFloat(plan.price) * 4000); // Fallback conversion

         // Validate price in COP
         if (!priceInCOP || priceInCOP <= 0) {
           logger.error('Invalid price in COP', { planId: plan.id, price_in_cop: plan.price_in_cop });
           throw new Error('Precio inválido para este plan. Contacta soporte.');
         }

         // Create payment reference
         const paymentRef = `PAY-${payment.id.substring(0, 8).toUpperCase()}`;

         // Determine language code (default to Spanish)
         const lang = language && language.toLowerCase().startsWith('en') ? 'en' : 'es';

         // Generate URL to landing page with language parameter
         // The landing page will handle the ePayco checkout with SDK
         const paymentUrl = `${webhookDomain}/payment/${payment.id}?lang=${lang}`;

         logger.info('ePayco payment URL generated (landing page)', {
           paymentId: payment.id,
           paymentRef,
           planId: plan.id,
           userId,
           amountUSD: plan.price,
           amountCOP: priceInCOP,
           testMode: epaycoTestMode,
           language: lang,
           paymentUrl,
         });

         return {
           success: true,
           paymentUrl,
           paymentId: payment.id,
           paymentRef
         };
       }

       // For other providers (like Daimo)
       const paymentUrl = `https://${provider}.com/pay?paymentId=${payment.id}`;
       return { success: true, paymentUrl, paymentId: payment.id };
    } catch (error) {
      logger.error('Error creando pago:', { error: error.message, planId, provider });
      throw new Error(
        error.message.includes('plan') || error.message.includes('inactivo')
          ? 'El plan seleccionado no existe o está inactivo.'
          : error.message.includes('Configuración')
          ? error.message
          : 'El proveedor de pago no está disponible, intente más tarde. Si el problema persiste, contacta soporte.'
      );
    }
  }

  static async completePayment(paymentId) {
    try {
      const payment = await PaymentModel.getById(paymentId);
      if (!payment) {
        logger.error('Pago no encontrado', { paymentId });
        throw new Error('No se encontró el pago. Verifica el ID o contacta soporte.');
      }

      // Get plan to obtain SKU (payment table doesn't store SKU, plan does)
      const planId = payment.plan_id || payment.planId;
      const plan = planId ? await PlanModel.getById(planId) : null;
      const planSku = plan?.sku || 'EASYBOTS-PNP-030';

      await PaymentModel.updateStatus(paymentId, 'completed');

      // Generar factura
      const invoice = await InvoiceService.generateInvoice({
        userId: payment.userId || payment.user_id,
        planSku,
        amount: payment.amount,
      });

      // Enviar factura por email
      const user = await UserModel.getById(payment.userId || payment.user_id);
      await EmailService.sendInvoiceEmail({
        to: user.email,
        subject: `Factura por suscripción (SKU: ${planSku})`,
        invoicePdf: invoice.pdf,
        invoiceNumber: invoice.id,
      });

      return { success: true };
    } catch (error) {
      logger.error('Error completando pago:', { error: error.message, paymentId });
      throw new Error('No se pudo completar el pago. Intenta más tarde o contacta soporte.');
    }
  }
}

module.exports = PaymentService;
