const PaymentModel = require('../../models/paymentModel');
const InvoiceService = require('../../bot/services/invoiceservice');
const EmailService = require('../../bot/services/emailservice');
const PlanModel = require('../../models/planModel');
const UserModel = require('../../models/userModel');
const SubscriberModel = require('../../models/subscriberModel');
const DaimoConfig = require('../../config/daimo');
const logger = require('../../utils/logger');
const userService = require('./userService');

class PaymentService {
  constructor() {
    this.db = getFirestore();
    this.paymentsCollection = this.db.collection(Collections.PAYMENTS);
  }

  /**
   * Create ePayco payment link
   */
  async createEPaycoLink(userId, planId, planData) {
    try {
      const { publicKey, privateKey, testMode } = config.payments.epayco;

      const paymentData = {
        name: planData.name,
        description: `PNPtv ${planData.name} Subscription`,
        invoice: `PNPTV-${userId}-${Date.now()}`,
        currency: 'USD',
        amount: planData.price,
        tax_base: '0',
        tax: '0',
        country: 'CO',
        lang: 'en',
        external: 'false',
        extra1: userId.toString(),
        extra2: planId,
        extra3: 'subscription',
        confirmation: `${process.env.WEBHOOK_URL || 'https://your-domain.com'}/webhook/epayco`,
        response: `${process.env.BOT_URL || 'https://t.me/' + config.botUsername}`,
        test: testMode ? 'true' : 'false',
      };

      const response = await axios.post(
        'https://secure.epayco.co/checkout/create',
        paymentData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${privateKey}`,
          },
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

       // Handle Daimo payment link generation
       if (provider === 'daimo') {
         try {
           // Create Daimo payment intent
           const paymentIntent = DaimoConfig.createPaymentIntent({
             amount: plan.price,
             userId: userId,
             planId: planId,
             chatId: chatId,
             description: `${plan.display_name || plan.name} - PNPtv Subscription`,
           });

           // Add payment ID to metadata
           paymentIntent.metadata.paymentId = payment.id;

           // Generate Daimo payment link
           const paymentUrl = DaimoConfig.generatePaymentLink(paymentIntent);

           logger.info('Daimo payment URL generated', {
             paymentId: payment.id,
             planId: plan.id,
             userId,
             amountUSD: plan.price,
             paymentUrl,
           });

           return {
             success: true,
             paymentUrl,
             paymentId: payment.id,
           };
         } catch (error) {
           logger.error('Error generating Daimo payment link:', {
             error: error.message,
             stack: error.stack,
             paymentId: payment.id,
           });
           throw new Error('No se pudo generar el enlace de pago con Daimo. Por favor, intenta más tarde o contacta soporte.');
         }
       }

       // For other providers
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

      // Log payment intent
      await this.paymentsCollection.add({
        userId,
        planId,
        amount: planData.price,
        currency: 'USD',
        provider: 'epayco',
        status: 'pending',
        paymentUrl: response.data.url,
        createdAt: new Date(),
      });

      logger.info(`ePayco payment link created for user ${userId}`);
      return response.data.url;
    } catch (error) {
      logger.error('Error creating ePayco payment link:', error);
      throw new Error('Failed to create payment link. Please try again.');
    }
  }

  /**
   * Create Daimo Pay payment link
   */
  async createDaimoPayLink(userId, planId, planData) {
    try {
      const { apiKey } = config.payments.daimoPay;

      if (!apiKey) {
        throw new Error('Daimo Pay not configured');
      }

      // This is a placeholder - adjust according to Daimo Pay's actual API
      const paymentData = {
        amount: planData.price,
        currency: 'USDC',
        description: `PNPtv ${planData.name} Subscription`,
        metadata: {
          userId: userId.toString(),
          planId,
          type: 'subscription',
        },
        webhook_url: `${process.env.WEBHOOK_URL || 'https://your-domain.com'}/webhook/daimo`,
      };

      const response = await axios.post(
        'https://api.daimo.com/v1/payment_links',
        paymentData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
        }
      );

      // Log payment intent
      await this.paymentsCollection.add({
        userId,
        planId,
        amount: planData.price,
        currency: 'USDC',
        provider: 'daimo',
        status: 'pending',
        paymentUrl: response.data.payment_url,
        createdAt: new Date(),
      });

      logger.info(`Daimo Pay payment link created for user ${userId}`);
      return response.data.payment_url;
    } catch (error) {
      logger.error('Error creating Daimo Pay payment link:', error);
      throw new Error('Failed to create crypto payment link. Please try again.');
    }
  }

  /**
   * Handle successful payment
   */
  async handlePaymentSuccess(userId, planId, provider, transactionId) {
    try {
      // Get plan details
      const planDoc = await this.db.collection(Collections.PLANS).doc(planId).get();
      if (!planDoc.exists) {
        throw new Error('Plan not found');
      }

      const plan = planDoc.data();
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + (plan.durationDays || 30));

      // Update user subscription
      await userService.updateSubscription(userId, planId, expiryDate);

      // Update payment record
      const paymentQuery = await this.paymentsCollection
        .where('userId', '==', userId)
        .where('planId', '==', planId)
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!paymentQuery.empty) {
        await paymentQuery.docs[0].ref.update({
          status: 'completed',
          transactionId,
          completedAt: new Date(),
        });
      }

      logger.info(`Payment successful for user ${userId}, plan ${planId}`);
      return true;
    } catch (error) {
      logger.error('Error handling payment success:', error);
      throw error;
    }
  }

  /**
   * Get payment history for user
   */
  async getUserPayments(userId) {
    try {
      const snapshot = await this.paymentsCollection
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logger.error(`Error getting payments for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get revenue statistics
   */
  async getRevenueStats() {
    try {
      const payments = await this.paymentsCollection
        .where('status', '==', 'completed')
        .get();

      const stats = {
        totalRevenue: 0,
        paymentsByProvider: {},
        paymentsByPlan: {},
        totalTransactions: payments.size,
      };

      payments.docs.forEach(doc => {
        const payment = doc.data();
        stats.totalRevenue += payment.amount || 0;

        const provider = payment.provider || 'unknown';
        stats.paymentsByProvider[provider] =
          (stats.paymentsByProvider[provider] || 0) + (payment.amount || 0);

        const planId = payment.planId || 'unknown';
        stats.paymentsByPlan[planId] =
          (stats.paymentsByPlan[planId] || 0) + (payment.amount || 0);
      });

      return stats;
    } catch (error) {
      logger.error('Error getting revenue stats:', error);
      throw error;
    }
  }
}

module.exports = new PaymentService();
