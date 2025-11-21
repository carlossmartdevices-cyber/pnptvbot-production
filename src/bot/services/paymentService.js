const PaymentModel = require('../../models/paymentModel');
const InvoiceService = require('../../bot/services/invoiceservice');
const EmailService = require('../../bot/services/emailservice');
const PlanModel = require('../../models/planModel');
const UserModel = require('../../models/userModel');
const SubscriberModel = require('../../models/subscriberModel');
const DaimoConfig = require('../../config/daimo');
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
      if (x_signature && process.env.EPAYCO_P_KEY) {
        const p_cust_id_cliente = process.env.EPAYCO_P_CUST_ID || '';
              const { Telegraf } = require('telegraf');
              const bot = new Telegraf(process.env.BOT_TOKEN);
              const primeChannelEnv = process.env.PRIME_CHANNEL_ID || '';
              const primeChannels = primeChannelEnv.split(',').map(id => id.trim()).filter(id => id);
              const amountPaid = x_amount;
              const nextPaymentDate = expiryDate.toLocaleDateString('es-CO', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              });
              const planName = plan.display_name || plan.name || 'PRIME';

              // Generate one-time use invite links for PRIME channels
              const inviteLinks = [];
              for (const channelId of primeChannels) {
                try {
                  const invite = await bot.telegram.createChatInviteLink(channelId, {
                    member_limit: 1, // One-time use
                    expire_date: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // Expires in 7 days
                  });
                  inviteLinks.push({ channelId, link: invite.invite_link });
                } catch (inviteErr) {
                  logger.error('Error creating invite link:', { channelId, error: inviteErr.message });
                  // Fallback to static link
                  inviteLinks.push({ channelId, link: `https://t.me/PNPTV_PRIME` });
                }
              }

              // Compose welcome message (merged, supports multiple channels)
              const message = [
                `*¡Bienvenido a PRIME${x_customer_name ? ', ' + x_customer_name : ''}!*`,
                '',
                `Tu pago de *${amountPaid} ${x_currency_code || 'COP'}* por el plan *${planName}* fue recibido exitosamente.`,
                '',
                `*Detalles de tu suscripción:*`,
                `• Plan: ${planName}`,
                `• Fecha de inicio: ${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}`,
                `• Próximo pago: *${nextPaymentDate}*`,
                '',
                '🔐 *Accede al canal exclusivo PRIME:*',
                ...inviteLinks.map((inv, idx) => `👉 [Ingresar a PRIME Canal${inviteLinks.length > 1 ? ' ' + (idx + 1) : ''}](${inv.link})`),
                '',
                '⚠️ *Importante:* Estos enlaces son de un solo uso y expiran en 7 días.',
                '',
                '📅 *Te recordaremos:*',
                '• 3 días antes de tu próximo pago',
                '• 1 día antes de tu próximo pago',
                '',
                '💝 ¡Gracias por confiar en PNPtv! Disfruta todos los beneficios y novedades exclusivas.'
              ].join('\n');

              await bot.telegram.sendMessage(userId, message, {
                parse_mode: 'Markdown',
                disable_web_page_preview: false
              });
              let inviteLinkText = '';
              if (primeChannelId) {
                try {
                  const inviteLink = await bot.telegram.createChatInviteLink(primeChannelId.split(',')[0].trim(), {
                    member_limit: 1,
                    name: `Payment - ${userId}`,
                  });
                  inviteLinkText = `🔗 *Accede al canal PRIME:*\n${inviteLink.invite_link}\n\n⚠️ Este enlace es de un solo uso.`;
                } catch (linkErr) {
                  logger.warn('Could not create invite link:', linkErr.message);
                  inviteLinkText = `🔗 Contacta soporte para acceder al canal PRIME.`;
>>>>>>> f83c05f (chore: sync workspace changes)
                }
              }

              const message = [
<<<<<<< HEAD
                `🎉 *¡Bienvenido a PRIME, ${x_customer_name || ''}!*`,
                '',
                `✅ Tu pago de *${amountPaid} ${x_currency_code || 'COP'}* por el plan *${planName}* fue recibido exitosamente.`,
                '',
                `📋 *Detalles de tu suscripción:*`,
                `• Plan: ${planName}`,
                `• Fecha de inicio: ${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}`,
                `• Próximo pago: *${nextPaymentDate}*`,
                '',
                '🔐 *Accede al canal exclusivo PRIME:*',
                ...inviteLinks.map((inv, idx) => `👉 [Ingresar a PRIME Canal ${inviteLinks.length > 1 ? idx + 1 : ''}](${inv.link})`),
                '',
                '⚠️ *Importante:* Estos enlaces son de un solo uso y expiran en 7 días.',
                '',
                '📅 *Te recordaremos:*',
                '• 3 días antes de tu próximo pago',
                '• 1 día antes de tu próximo pago',
                '',
                '💝 ¡Gracias por confiar en PNPtv! Disfruta todos los beneficios y novedades exclusivas.'
=======
                `🎉 *¡Bienvenido a PRIME${x_customer_name ? ', ' + x_customer_name : ''}!*`,
                '',
                `✅ Tu pago de *${amountPaid} ${x_currency_code || 'COP'}* por el plan *${planName}* fue recibido exitosamente.`,
                '',
                `📅 Tu membresía está activa hasta: *${nextPayment}*`,
                '',
                inviteLinkText,
                '',
                '¡Gracias por confiar en PNPtv! Disfruta todos los beneficios.'
>>>>>>> f83c05f (chore: sync workspace changes)
              ].join('\n');

              await bot.telegram.sendMessage(userId, message, {
                parse_mode: 'Markdown',
                disable_web_page_preview: false
              });

              // Send payment confirmation email (PNPtv subscription details)
              try {
                const EmailService = require('../../../services/emailService');
                await EmailService.sendPaymentConfirmation({
                  email: x_customer_email,
                  name: x_customer_name || 'Usuario',
                  planName: planName,
                  amount: amountPaid,
                  currency: x_currency_code || 'COP',
                  nextPaymentDate: nextPaymentDate,
                  inviteLinks: inviteLinks.map(inv => inv.link),
                });
                logger.info('Payment confirmation email sent', { email: x_customer_email });
              } catch (emailErr) {
                logger.error('Error enviando email de confirmación:', emailErr);
              }

              // Generate invoice and send purchase confirmation (from easybots.store)
              try {
                const InvoiceService = require('./invoiceservice');
                const EmailService = require('../../../services/emailService');

                // Get plan SKU
                const planSku = plan.sku || `EASYBOTS-${plan.id.toUpperCase()}`;

                // Convert amount to USD if needed
                let amountUSD = parseFloat(amountPaid);
                let exchangeRate = 4200;
                if (x_currency_code === 'COP') {
                  exchangeRate = 1;
                  amountUSD = parseFloat(amountPaid) / 4200;
                }

                // Generate invoice PDF
                const invoice = await InvoiceService.generateInvoice({
                  customerName: x_customer_name || 'Cliente',
                  customerEmail: x_customer_email,
                  planSku,
                  planDescription: `Suscripción ${planName} - Servicios de IA y desarrollo de bots automatizados`,
                  amount: amountUSD,
                  currency: 'USD',
                  exchangeRate
                });

                // Send purchase invoice email
                await EmailService.sendPurchaseInvoice({
                  email: x_customer_email,
                  name: x_customer_name || 'Usuario',
                  invoiceBuffer: invoice.buffer,
                  invoiceFileName: invoice.fileName,
                  amount: amountUSD,
                  currency: 'USD'
                });

                logger.info('Purchase invoice generated and sent', {
                  email: x_customer_email,
                  invoiceId: invoice.id
                });
              } catch (invoiceErr) {
                logger.error('Error generando/enviando factura:', invoiceErr);
              }
            } catch (err) {
              logger.error('Error enviando mensaje de bienvenida PRIME:', err);
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

          // Send welcome message with invite links
          try {
            const { Telegraf } = require('telegraf');
            const bot = new Telegraf(process.env.BOT_TOKEN);
            const primeChannels = (process.env.PRIME_CHANNEL_ID || '').split(',').map(id => id.trim()).filter(id => id);
            const amountPaid = webhookData.amount?.value || '0';
            const currency = webhookData.amount?.currency || 'USDC';
            const nextPaymentDate = expiryDate.toLocaleDateString('es-CO', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
            const planName = plan.display_name || plan.name || 'PRIME';

            // Generate one-time use invite links
            const inviteLinks = [];
            for (const channelId of primeChannels) {
              try {
                const invite = await bot.telegram.createChatInviteLink(channelId, {
                  member_limit: 1,
                  expire_date: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
                });
                inviteLinks.push({ channelId, link: invite.invite_link });
              } catch (inviteErr) {
                logger.error('Error creating invite link:', { channelId, error: inviteErr.message });
                inviteLinks.push({ channelId, link: `https://t.me/PNPTV_PRIME` });
              }
            }

            const message = [
              `🎉 *¡Bienvenido a PRIME!*`,
              '',
              `✅ Tu pago de *${amountPaid} ${currency}* por el plan *${planName}* fue recibido exitosamente.`,
              '',
              `📋 *Detalles de tu suscripción:*`,
              `• Plan: ${planName}`,
              `• Fecha de inicio: ${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}`,
              `• Próximo pago: *${nextPaymentDate}*`,
              '',
              '🔐 *Accede al canal exclusivo PRIME:*',
              ...inviteLinks.map((inv, idx) => `👉 [Ingresar a PRIME Canal ${inviteLinks.length > 1 ? idx + 1 : ''}](${inv.link})`),
              '',
              '⚠️ *Importante:* Estos enlaces son de un solo uso y expiran en 7 días.',
              '',
              '📅 *Te recordaremos:*',
              '• 3 días antes de tu próximo pago',
              '• 1 día antes de tu próximo pago',
              '',
              '💝 ¡Gracias por confiar en PNPtv! Disfruta todos los beneficios y novedades exclusivas.'
            ].join('\n');

            await bot.telegram.sendMessage(userId, message, {
              parse_mode: 'Markdown',
              disable_web_page_preview: false
            });

            // Send emails if user email is available
            try {
              const user = await UserModel.getById(userId);
              if (user && user.email) {
                const EmailService = require('../../../services/emailService');

                // Send PNPtv subscription confirmation
                await EmailService.sendPaymentConfirmation({
                  email: user.email,
                  name: user.firstName || 'Usuario',
                  planName: planName,
                  amount: amountPaid,
                  currency: currency,
                  nextPaymentDate: nextPaymentDate,
                  inviteLinks: inviteLinks.map(inv => inv.link),
                });
                logger.info('Payment confirmation email sent (Daimo)', { email: user.email });

                // Generate invoice and send purchase confirmation (from easybots.store)
                try {
                  const InvoiceService = require('./invoiceservice');

                  // Get plan SKU
                  const planSku = plan.sku || `EASYBOTS-${plan.id.toUpperCase()}`;

                  // Daimo payments are in USD/USDC
                  const amountUSD = parseFloat(amountPaid);

                  // Generate invoice PDF
                  const invoice = await InvoiceService.generateInvoice({
                    customerName: user.firstName || user.name || 'Cliente',
                    customerEmail: user.email,
                    planSku,
                    planDescription: `Suscripción ${planName} - Servicios de IA y desarrollo de bots automatizados`,
                    amount: amountUSD,
                    currency: 'USD',
                    exchangeRate: 4200
                  });

                  // Send purchase invoice email
                  await EmailService.sendPurchaseInvoice({
                    email: user.email,
                    name: user.firstName || 'Usuario',
                    invoiceBuffer: invoice.buffer,
                    invoiceFileName: invoice.fileName,
                    amount: amountUSD,
                    currency: 'USD'
                  });

                  logger.info('Purchase invoice generated and sent (Daimo)', {
                    email: user.email,
                    invoiceId: invoice.id
                  });
                } catch (invoiceErr) {
                  logger.error('Error generating/sending invoice (Daimo):', invoiceErr);
                }
              }
            } catch (emailErr) {
              logger.error('Error sending payment confirmation email:', emailErr);
            }
          } catch (err) {
            logger.error('Error sending PRIME welcome message:', err);
          }
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
      const skuMap = {
        'week-trial-pass': 'EASYBOTS-PNP-007',
        'trial-week': 'EASYBOTS-PNP-007',
        'monthly-pass': 'EASYBOTS-PNP-030',
        'pnp-member': 'EASYBOTS-PNP-030',
        'new-plan': 'EASYBOTS-PNP-030',
        'existing-plan': 'EASYBOTS-PNP-030',
        'crystal-member': 'EASYBOTS-PNP-120',
        'crystal-pass': 'EASYBOTS-PNP-180',
        'diamond-pass': 'EASYBOTS-PNP-365',
        'diamond-member': 'EASYBOTS-PNP-365',
        'lifetime-pass': 'EASYBOTS-PNP-999',
      };
      const planSku = skuMap[planId] || 'EASYBOTS-PNP-030';

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
