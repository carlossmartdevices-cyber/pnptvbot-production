const PaymentModel = require('../../models/paymentModel');
const InvoiceService = require('../../bot/services/invoiceservice');
const EmailService = require('../../bot/services/emailservice');
const PlanModel = require('../../models/planModel');
const UserModel = require('../../models/userModel');
const SubscriberModel = require('../../models/subscriberModel');
const DaimoConfig = require('../../config/daimo');
const logger = require('../../utils/logger');
const crypto = require('crypto');
const { Telegraf } = require('telegraf');

class PaymentService {
    /**
     * Send payment confirmation notification to user via Telegram bot
     * Includes purchase details and unique invite link to PRIME channel
     * @param {Object} params - Notification parameters
     * @param {string} params.userId - Telegram user ID
     * @param {Object} params.plan - Plan object
     * @param {string} params.transactionId - Transaction/reference ID
     * @param {number} params.amount - Payment amount
     * @param {Date} params.expiryDate - Subscription expiry date
     * @param {string} params.language - User language ('es' or 'en')
     * @returns {Promise<boolean>} Success status
     */
    static async sendPaymentConfirmationNotification({
      userId, plan, transactionId, amount, expiryDate, language = 'es',
    }) {
      try {
        const bot = new Telegraf(process.env.BOT_TOKEN);
        const groupId = process.env.GROUP_ID || '-1003159260496'; // PRIME channel ID

        // Create unique invite link for PRIME channel
        let inviteLink = '';
        try {
          const response = await bot.telegram.createChatInviteLink(groupId, {
            member_limit: 1, // Single use
            name: `Subscription ${transactionId}`,
          });
          inviteLink = response.invite_link;
          logger.info('Unique PRIME channel invite link created', {
            userId,
            transactionId,
            inviteLink,
          });
        } catch (linkError) {
          logger.error('Error creating invite link, using fallback', {
            error: linkError.message,
            userId,
          });
          // Fallback: try to create a regular link
          try {
            const fallbackResponse = await bot.telegram.createChatInviteLink(groupId);
            inviteLink = fallbackResponse.invite_link;
          } catch (fallbackError) {
            logger.error('Fallback invite link also failed', {
              error: fallbackError.message,
            });
            inviteLink = 'https://t.me/PNPTV_PRIME'; // Ultimate fallback
          }
        }

        // Format expiry date
        const expiryDateStr = expiryDate
          ? expiryDate.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
          : (language === 'es' ? 'Sin vencimiento (Lifetime)' : 'No expiration (Lifetime)');

        // Build message in user's language
        const messageEs = [
          '🎉 *¡Pago Confirmado!*',
          '',
          '✅ Tu suscripción ha sido activada exitosamente.',
          '',
          '📋 *Detalles de la Compra:*',
          `💎 Plan: ${plan.display_name || plan.name}`,
          `💵 Monto: $${amount.toFixed(2)} USD`,
          `📅 Válido hasta: ${expiryDateStr}`,
          `🔖 ID de Transacción: ${transactionId}`,
          '',
          '🌟 *¡Bienvenido a PRIME!*',
          '',
          '👉 Accede al canal exclusivo aquí:',
          `[🔗 Ingresar a PRIME](${inviteLink})`,
          '',
          '💎 Disfruta de todo el contenido premium y beneficios exclusivos.',
          '',
          '¡Gracias por tu suscripción! 🙏',
        ].join('\n');

        const messageEn = [
          '🎉 *Payment Confirmed!*',
          '',
          '✅ Your subscription has been activated successfully.',
          '',
          '📋 *Purchase Details:*',
          `💎 Plan: ${plan.display_name || plan.name}`,
          `💵 Amount: $${amount.toFixed(2)} USD`,
          `📅 Valid until: ${expiryDateStr}`,
          `🔖 Transaction ID: ${transactionId}`,
          '',
          '🌟 *Welcome to PRIME!*',
          '',
          '👉 Access the exclusive channel here:',
          `[🔗 Join PRIME](${inviteLink})`,
          '',
          '💎 Enjoy all premium content and exclusive benefits.',
          '',
          'Thank you for your subscription! 🙏',
        ].join('\n');

        const message = language === 'es' ? messageEs : messageEn;

        // Send notification
        await bot.telegram.sendMessage(userId, message, {
          parse_mode: 'Markdown',
          disable_web_page_preview: false,
        });

        logger.info('Payment confirmation notification sent', {
          userId,
          planId: plan.id,
          transactionId,
          language,
        });

        return true;
      } catch (error) {
        logger.error('Error sending payment confirmation notification:', {
          userId,
          error: error.message,
          stack: error.stack,
        });
        return false;
      }
    }

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

            // Send payment confirmation notification via bot (with PRIME channel link)
            const user = await UserModel.getById(userId);
            const userLanguage = user?.language || 'es';
            try {
              await this.sendPaymentConfirmationNotification({
                userId,
                plan,
                transactionId: x_ref_payco,
                amount: parseFloat(x_amount),
                expiryDate,
                language: userLanguage,
              });
            } catch (notifError) {
              logger.error('Error sending payment confirmation notification (non-critical):', {
                error: notifError.message,
                userId,
              });
            }
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

        // Send both emails after successful payment
        if (x_customer_email && userId && planId) {
          const plan = await PlanModel.getById(planId);
          const user = await UserModel.getById(userId);

          if (plan) {
            // Get user language (from user record or default to Spanish)
            const userLanguage = user?.language || 'es';
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + (plan.duration || 30));

            // 1. Send invoice email from easybots.store
            try {
              const invoiceEmailResult = await EmailService.sendInvoiceEmail({
                to: x_customer_email,
                customerName: x_customer_name || user?.first_name || 'Valued Customer',
                invoiceNumber: x_ref_payco,
                amount: parseFloat(x_amount),
                planName: plan.display_name || plan.name,
                invoicePdf: null, // PDF generation can be added later if needed
              });

              if (invoiceEmailResult.success) {
                logger.info('Invoice email sent successfully', {
                  to: x_customer_email,
                  refPayco: x_ref_payco,
                });
              }
            } catch (emailError) {
              logger.error('Error sending invoice email (non-critical):', {
                error: emailError.message,
                refPayco: x_ref_payco,
              });
            }

            // 2. Send welcome email from pnptv.app
            try {
              const welcomeEmailResult = await EmailService.sendWelcomeEmail({
                to: x_customer_email,
                customerName: x_customer_name || user?.first_name || 'Valued Customer',
                planName: plan.display_name || plan.name,
                duration: plan.duration,
                expiryDate,
                language: userLanguage,
              });

              if (welcomeEmailResult.success) {
                logger.info('Welcome email sent successfully', {
                  to: x_customer_email,
                  planId,
                  language: userLanguage,
                });
              }
            } catch (emailError) {
              logger.error('Error sending welcome email (non-critical):', {
                error: emailError.message,
                refPayco: x_ref_payco,
              });
            }
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
   * Create ePayco payment link
   */
  static async processDaimoWebhook(webhookData) {
    const DaimoService = require('./daimoService');

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

      const userId = metadata?.userId;
      const planId = metadata?.planId;
      const paymentId = metadata?.paymentId;
      const chatId = metadata?.chatId;

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
      if (status === 'payment_completed') {
        // Payment successful
        if (paymentId) {
          await PaymentModel.updateStatus(paymentId, 'completed', {
            transaction_id: source?.txHash || id,
            daimo_event_id: id,
            payer_address: source?.payerAddress,
            chain_id: source?.chainId,
          });
        }

        // Activate user subscription
        const plan = await PlanModel.getById(planId);
        const user = await UserModel.getById(userId);

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

          // Send payment confirmation notification via bot (with PRIME channel link)
          const userLanguage = user?.language || 'es';
          const DaimoService = require('./daimoService');
          const amountUSD = DaimoService.convertUSDCToUSD(source?.amountUnits || '0');
          try {
            await this.sendPaymentConfirmationNotification({
              userId,
              plan,
              transactionId: source?.txHash || id,
              amount: amountUSD,
              expiryDate,
              language: userLanguage,
            });
          } catch (notifError) {
            logger.error('Error sending payment confirmation notification (non-critical):', {
              error: notifError.message,
              userId,
            });
          }

          // Get customer email from user record or subscriber record
          let customerEmail = user?.email;
          if (!customerEmail) {
            // Try to get from subscriber by telegram ID
            try {
              const subscriber = await SubscriberModel.getByTelegramId(userId);
              customerEmail = subscriber?.email;
            } catch (e) {
              logger.warn('Could not find subscriber email', { userId });
            }
          }

          // Send both emails if we have an email
          if (customerEmail) {
            const userLanguage = user?.language || 'es';
            const amountUSD = DaimoService.convertUSDCToUSD(source?.amountUnits || '0');

            // 1. Send invoice email from easybots.store
            try {
              const invoiceEmailResult = await EmailService.sendInvoiceEmail({
                to: customerEmail,
                customerName: user?.first_name || user?.username || 'Valued Customer',
                invoiceNumber: source?.txHash || id,
                amount: amountUSD,
                planName: plan.display_name || plan.name,
                invoicePdf: null,
              });

              if (invoiceEmailResult.success) {
                logger.info('Invoice email sent successfully (Daimo)', {
                  to: customerEmail,
                  txHash: source?.txHash,
                });
              }
            } catch (emailError) {
              logger.error('Error sending invoice email (non-critical):', {
                error: emailError.message,
                eventId: id,
              });
            }

            // 2. Send welcome email from pnptv.app
            try {
              const welcomeEmailResult = await EmailService.sendWelcomeEmail({
                to: customerEmail,
                customerName: user?.first_name || user?.username || 'Valued Customer',
                planName: plan.display_name || plan.name,
                duration: plan.duration,
                expiryDate,
                language: userLanguage,
              });

              if (welcomeEmailResult.success) {
                logger.info('Welcome email sent successfully (Daimo)', {
                  to: customerEmail,
                  planId,
                  language: userLanguage,
                });
              }
            } catch (emailError) {
              logger.error('Error sending welcome email (non-critical):', {
                error: emailError.message,
                eventId: id,
              });
            }
          } else {
            logger.warn('No email address found for user, skipping email notifications', {
              userId,
              eventId: id,
            });
          }
        }

        return { success: true };
      } else if (status === 'payment_bounced' || status === 'payment_failed') {
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
      } else if (status === 'payment_started' || status === 'payment_unpaid') {
        // Payment pending/started
        if (paymentId) {
          await PaymentModel.updateStatus(paymentId, 'pending', {
            transaction_id: source?.txHash || id,
            daimo_event_id: id,
          });
        }

        logger.info('Daimo payment pending', {
          paymentId,
          eventId: id,
          status,
        });

        return { success: true };
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

       // Generate Daimo payment link
       if (provider === 'daimo') {
         const DaimoService = require('./daimoService');

         if (!DaimoService.isConfigured()) {
           logger.error('Daimo not configured');
           throw new Error('Configuración de pago incompleta. Contacta soporte.');
         }

         try {
           const paymentUrl = DaimoService.generatePaymentLink({
             userId,
             chatId,
             planId,
             amount: plan.price,
             paymentId: payment.id,
           });

           logger.info('Daimo payment URL generated', {
             paymentId: payment.id,
             planId: plan.id,
             userId,
             amountUSD: plan.price,
             chain: 'Optimism',
             token: 'USDC',
           });

           return {
             success: true,
             paymentUrl,
             paymentId: payment.id,
             paymentRef: `DAIMO-${payment.id.substring(0, 8).toUpperCase()}`,
           };
         } catch (error) {
           logger.error('Error generating Daimo payment link:', {
             error: error.message,
             userId,
             planId,
           });
           throw new Error('No se pudo generar el link de pago. Contacta soporte.');
         }
       }

       // For other providers
       logger.error('Unknown payment provider', { provider });
       throw new Error('Proveedor de pago no soportado.');
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
