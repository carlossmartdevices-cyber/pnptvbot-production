const PaymentModel = require('../../models/paymentModel');
const InvoiceService = require('../../bot/services/invoiceservice');
const EmailService = require('../../bot/services/emailservice');
const PlanModel = require('../../models/planModel');
const UserModel = require('../../models/userModel');
const SubscriberModel = require('../../models/subscriberModel');
const DaimoConfig = require('../../config/daimo');
const FraudDetectionService = require('../../bot/services/fraudDetectionService');
const PaymentSecurityService = require('../../bot/services/paymentSecurityService');
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
     * Send notification to support group about new paid member
     * @param {Object} params - Notification parameters
     * @param {string} params.userId - Telegram user ID
     * @param {string} params.customerName - Customer name
     * @param {string} params.customerEmail - Customer email
     * @param {Object} params.plan - Plan object
     * @param {number} params.amount - Payment amount
     * @param {string} params.currency - Currency code
     * @param {string} params.transactionId - Transaction reference
     * @param {Date} params.expiryDate - Subscription expiry date
     * @returns {Promise<boolean>} Success status
     */
    static async sendSupportGroupNotification({
      userId, customerName, customerEmail, plan, amount, currency, transactionId, expiryDate,
    }) {
      try {
        const bot = new Telegraf(process.env.BOT_TOKEN);
        const supportGroupId = process.env.SUPPORT_GROUP_ID;

        if (!supportGroupId) {
          logger.warn('SUPPORT_GROUP_ID not configured, skipping notification');
          return false;
        }

        const planName = plan?.display_name || plan?.name || 'Unknown Plan';
        const formattedDate = expiryDate?.toLocaleDateString('es-CO', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }) || 'N/A';

        const message = [
          '🎉 *NUEVO PAGO RECIBIDO*',
          '',
          '👤 *Usuario:*',
          `• Telegram ID: \`${userId}\``,
          `• Nombre: ${customerName || 'No proporcionado'}`,
          `• Email: ${customerEmail || 'No proporcionado'}`,
          '',
          '💳 *Detalles del Pago:*',
          `• Plan: *${planName}*`,
          `• Monto: *${amount} ${currency}*`,
          `• Referencia: \`${transactionId}\``,
          '',
          '📅 *Suscripción:*',
          `• Vence: ${formattedDate}`,
          '',
          '⚠️ *Acción requerida:* Contactar al usuario para confirmar que todo funciona correctamente.',
          '',
          `👉 [Abrir chat con usuario](tg://user?id=${userId})`,
        ].join('\n');

        await bot.telegram.sendMessage(supportGroupId, message, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        });

        logger.info('Support group notification sent', {
          userId,
          transactionId,
          supportGroupId,
        });

        return true;
      } catch (error) {
        logger.error('Error sending support group notification:', {
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
        x_cod_response, // Response code: 1=Aceptada, 2=Rechazada, 3=Pendiente, 4=Fallida
        x_cod_transaction_state, // Transaction state code
        x_amount,
        x_currency_code,
        x_signature,
        x_approval_code,
        x_extra1, // userId (telegram ID)
        x_extra2, // paymentId
        x_customer_email,
        x_customer_name,
        x_response_reason_text, // Reason text for the response
        x_three_d_s, // 3DS validation status: Y=Validated, N=Not validated
        x_eci, // ECI flag indicating 3DS authentication
        x_cavv, // CAVV (Cardholder Authentication Verification Value)
      } = webhookData;

      logger.info('Processing ePayco webhook', {
        refPayco: x_ref_payco,
        transactionId: x_transaction_id,
        state: x_transaction_state,
        codResponse: x_cod_response,
        codTransactionState: x_cod_transaction_state,
        responseReason: x_response_reason_text,
        amount: x_amount,
        paymentId: x_extra2,
        threeDsStatus: x_three_d_s,
        eciFlag: x_eci,
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

      const paymentId = x_extra2;
      const userId = x_extra1;

      // Check if payment exists
      const payment = paymentId ? await PaymentModel.getById(paymentId) : null;

      if (!payment && !userId) {
        logger.error('Payment not found and no user ID provided', { paymentId, refPayco: x_ref_payco });
        return { success: false, error: 'Payment not found' };
      }

      // Get plan ID from payment record (no longer passed as extra)
      const planId = payment ? (payment.planId || payment.plan_id) : null;

      // Process based on response code (x_cod_response) - primary check per ePayco docs
      // x_cod_response: 1=Aceptada, 2=Rechazada, 3=Pendiente, 4=Fallida
      const responseCode = parseInt(x_cod_response, 10);
      const isApproved = responseCode === 1 || x_transaction_state === 'Aceptada' || x_transaction_state === 'Aprobada';
      const isRejected = responseCode === 2 || x_transaction_state === 'Rechazada';
      const isPending = responseCode === 3 || x_transaction_state === 'Pendiente' || x_transaction_state === 'Colgante';
      const isFailed = responseCode === 4 || x_transaction_state === 'Fallida';
      const isAbandoned = x_transaction_state === 'Abandonada' || x_transaction_state === 'Cancelada';

      // ========== SECURITY LAYER 1: Rate Limiting ==========
      if (isApproved && userId) {
        const rateLimit = await PaymentSecurityService.checkPaymentRateLimit(userId, 10);
        if (!rateLimit.allowed) {
          logger.warn('🚨 Payment rate limit exceeded', { userId, attempts: rateLimit.attempts });
          
          if (payment) {
            await PaymentModel.updateStatus(paymentId, 'rate_limited', {
              transaction_id: x_transaction_id,
              epayco_ref: x_ref_payco,
              cancel_reason: 'Rate limit exceeded',
              cancelled_at: new Date(),
            });
          }
          
          return { success: false, error: 'Rate limit exceeded' };
        }
      }

      // ========== SECURITY LAYER 2: Replay Attack Prevention ==========
      if (isApproved && x_ref_payco) {
        const replay = await PaymentSecurityService.checkReplayAttack(x_ref_payco, 'epayco');
        if (replay.isReplay) {
          logger.error('🚨 REPLAY ATTACK DETECTED', { transactionId: x_ref_payco });
          
          if (payment) {
            await PaymentModel.updateStatus(paymentId, 'duplicate_blocked', {
              transaction_id: x_transaction_id,
              epayco_ref: x_ref_payco,
              cancel_reason: 'Duplicate transaction detected',
              cancelled_at: new Date(),
            });
          }
          
          return { success: false, error: 'Duplicate transaction' };
        }
      }

      // ========== SECURITY LAYER 3: Amount Integrity Validation ==========
      if (isApproved && paymentId && x_amount) {
        const amountValid = await PaymentSecurityService.validatePaymentAmount(paymentId, parseFloat(x_amount));
        if (!amountValid.valid) {
          logger.error('🚨 Amount mismatch detected', {
            paymentId,
            expected: amountValid.actual,
            received: parseFloat(x_amount),
          });
          
          if (payment) {
            await PaymentModel.updateStatus(paymentId, 'amount_mismatch', {
              transaction_id: x_transaction_id,
              epayco_ref: x_ref_payco,
              cancel_reason: 'Payment amount verification failed',
              cancelled_at: new Date(),
            });
          }
          
          return { success: false, error: 'Amount mismatch' };
        }
      }

      // ========== SECURITY LAYER 4: PCI Compliance Check ==========
      if (isApproved) {
        const pciCompliant = PaymentSecurityService.validatePCICompliance({
          lastFour: x_approval_code?.slice(-4),
        });
        if (!pciCompliant.compliant) {
          logger.error('🚨 PCI COMPLIANCE VIOLATION', pciCompliant);
          return { success: false, error: 'PCI compliance check failed' };
        }
      }

      // ========== FRAUD DETECTION - RUN ALL CHECKS ==========
      // Comprehensive anti-fraud validation AFTER security layers
      if (isApproved && userId) {
        logger.info('🔒 Running comprehensive fraud detection', {
          userId,
          refPayco: x_ref_payco,
          amount: x_amount,
        });

        const fraudAnalysis = await FraudDetectionService.runAllFraudChecks({
          userId,
          amount: parseFloat(x_amount),
          email: x_customer_email,
          phone: null, // Can be extracted from ePayco if available
          cardLastFour: x_approval_code?.slice(-4), // Last 4 of approval code if available
          cardBrand: 'Unknown', // ePayco doesn't always provide brand
          ipAddress: null, // Extract from request headers if available
          userAgent: null, // Extract from request headers if available
          countryCode: null, // Extract from geolocation if available
          location: null,
        });

        logger.info('Fraud analysis results', {
          userId,
          riskScore: fraudAnalysis.riskScore,
          recommendation: fraudAnalysis.recommendation,
          flaggedChecks: fraudAnalysis.flaggedChecks.map((c) => c.name),
        });

        // BLOCK transaction if high fraud risk
        if (fraudAnalysis.isFraudulent) {
          logger.error('🚨 TRANSACTION BLOCKED - FRAUD DETECTED', {
            userId,
            refPayco: x_ref_payco,
            riskScore: fraudAnalysis.riskScore,
            reasons: fraudAnalysis.flaggedChecks.map((c) => c.name),
          });

          // Cancel the fraudulent transaction
          if (payment) {
            await PaymentModel.updateStatus(paymentId, 'fraud_blocked', {
              transaction_id: x_transaction_id,
              epayco_ref: x_ref_payco,
              epaycoRef: x_ref_payco, // Store in reference field
              cancel_reason: `Fraud detected: ${fraudAnalysis.flaggedChecks.map((c) => c.name).join(', ')}`,
              fraud_risk_score: fraudAnalysis.riskScore,
              cancelled_at: new Date(),
            });
          }

          // Notify user
          if (userId) {
            try {
              const user = await UserModel.getById(userId);
              const userLanguage = user?.language || 'es';
              const botModule = require('../bot');
              const bot = botModule.default || botModule;

              const messageText =
                userLanguage === 'en'
                  ? '🚨 *Fraud Alert*\n\nYour payment was blocked due to suspicious activity. This is a security measure to protect your account.\n\nIf this was legitimate, please contact support.'
                  : '🚨 *Alerta de Fraude*\n\nTu pago fue bloqueado por actividad sospechosa. Esta es una medida de seguridad para proteger tu cuenta.\n\nSi fue legítimo, por favor contacta a soporte.';

              if (bot && bot.telegram) {
                await bot.telegram.sendMessage(userId, messageText, { parse_mode: 'Markdown' });
              }
            } catch (notifError) {
              logger.error('Error sending fraud alert notification:', {
                error: notifError.message,
                userId,
              });
            }
          }

          return { success: false, error: 'Transaction blocked due to fraud detection' };
        }
      }
      // ========== END FRAUD DETECTION ==========

      // ========== 3DS VALIDATION REQUIREMENT ==========
      // All approved transactions MUST have 3DS validation
      if (isApproved) {
        // Check 3DS status
        const has3DS = x_three_d_s === 'Y' || x_eci || x_cavv;
        const is3DSValidated = x_three_d_s === 'Y';

        logger.info('3DS Validation Check for ePayco transaction', {
          refPayco: x_ref_payco,
          threeDsStatus: x_three_d_s,
          hasECI: !!x_eci,
          hasCAVV: !!x_cavv,
          is3DSValidated,
          requires3DS: true,
        });

        // REJECT transaction if 3DS is not validated
        if (!is3DSValidated) {
          logger.warn('ePayco transaction REJECTED - 3DS validation failed', {
            refPayco: x_ref_payco,
            reason: '3DS not validated',
            threeDsStatus: x_three_d_s,
            transactionId: x_transaction_id,
          });

          // Cancel the payment
          if (payment) {
            await PaymentModel.updateStatus(paymentId, 'cancelled', {
              transaction_id: x_transaction_id,
              epayco_ref: x_ref_payco,
              epaycoRef: x_ref_payco, // Store in reference field
              cancel_reason: '3DS validation required but not completed',
              cancelled_at: new Date(),
            });
          }

          // Notify user that payment was cancelled due to security reasons
          if (userId) {
            try {
              const user = await UserModel.getById(userId);
              const userLanguage = user?.language || 'es';
              const botModule = require('../bot');
              const bot = botModule.default || botModule;

              const messageText = userLanguage === 'en'
                ? '❌ *Payment Cancelled*\n\nYour payment was cancelled because 3DS (Two-Factor Security) validation was not completed. This is a mandatory security requirement.\n\nPlease try again with a card that supports 3DS validation.'
                : '❌ *Pago Cancelado*\n\nTu pago fue cancelado porque la validación 3DS (Seguridad de Dos Factores) no fue completada. Este es un requisito de seguridad obligatorio.\n\nIntenta de nuevo con una tarjeta que soporte validación 3DS.';

              if (bot && bot.telegram) {
                await bot.telegram.sendMessage(userId, messageText, { parse_mode: 'Markdown' });
              }
            } catch (notifError) {
              logger.error('Error sending 3DS rejection notification:', {
                error: notifError.message,
                userId,
              });
            }
          }

          return { success: false, error: '3DS validation required but not provided' };
        }

        logger.info('3DS validation PASSED for ePayco transaction', {
          refPayco: x_ref_payco,
          threeDsStatus: x_three_d_s,
        });
      }
      // ========== END 3DS VALIDATION ==========

      if (isApproved) {
        // Payment successful
        if (payment) {
          await PaymentModel.updateStatus(paymentId, 'completed', {
            transaction_id: x_transaction_id,
            approval_code: x_approval_code,
            epayco_ref: x_ref_payco,
            epaycoRef: x_ref_payco, // Store in reference field
          });
        }

        // ========== SECURITY LAYER 5: Audit Logging ==========
        await PaymentSecurityService.logPaymentEvent({
          paymentId: paymentId,
          userId: userId,
          eventType: 'completed',
          provider: 'epayco',
          amount: parseFloat(x_amount),
          status: 'success',
          ipAddress: null,
          userAgent: null,
          details: {
            reference: x_ref_payco,
            transactionId: x_transaction_id,
            approvalCode: x_approval_code,
            method: 'credit_card',
            planId: planId,
            threeDsStatus: x_three_d_s,
            eciFlag: x_eci,
          },
        });

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

            // Send notification to support group for manual follow-up
            try {
              await this.sendSupportGroupNotification({
                userId,
                customerName: x_customer_name,
                customerEmail: x_customer_email,
                plan,
                amount: parseFloat(x_amount),
                currency: x_currency_code || 'COP',
                transactionId: x_ref_payco,
                expiryDate,
              });
            } catch (supportNotifError) {
              logger.error('Error sending support group notification (non-critical):', {
                error: supportNotifError.message,
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
      } else if (isRejected || isFailed) {
        // Payment failed or rejected
        if (payment) {
          await PaymentModel.updateStatus(paymentId, 'failed', {
            transaction_id: x_transaction_id,
            epayco_ref: x_ref_payco,
            epaycoRef: x_ref_payco, // Store in reference field
          });
        }

        // ========== Audit Logging for Failed Payments ==========
        await PaymentSecurityService.logPaymentEvent({
          paymentId: paymentId,
          userId: userId,
          eventType: 'rejected',
          provider: 'epayco',
          amount: parseFloat(x_amount),
          status: 'failed',
          ipAddress: null,
          userAgent: null,
          details: {
            reference: x_ref_payco,
            transactionId: x_transaction_id,
            responseCode: x_cod_response,
            reason: x_response_reason_text,
            transactionState: x_transaction_state,
          },
        });

        logger.warn('Payment rejected by ePayco', {
          paymentId,
          refPayco: x_ref_payco,
          state: x_transaction_state,
          codResponse: x_cod_response,
          reason: x_response_reason_text,
        });

        return { success: true }; // Return success to acknowledge webhook
      } else if (isPending) {
        // Payment pending
        if (payment) {
          await PaymentModel.updateStatus(paymentId, 'pending', {
            transaction_id: x_transaction_id,
            epayco_ref: x_ref_payco,
            epaycoRef: x_ref_payco, // Store in reference field
          });
        }

        logger.info('Payment abandoned by user', {
          paymentId,
          refPayco: x_ref_payco,
          state: x_transaction_state,
        });

        return { success: true };
      }

      return { success: true };
    } catch (error) {
      logger.error('Error processing ePayco webhook:', {
        error: error.message,
        stack: error.stack,
      });

      // ========== SECURITY LAYER 6: Error Logging ==========
      if (webhookData.x_extra2 && webhookData.x_extra1) {
        await PaymentSecurityService.logPaymentError({
          paymentId: webhookData.x_extra2,
          userId: webhookData.x_extra1,
          provider: 'epayco',
          errorCode: error.code || 'PAYMENT_ERROR',
          errorMessage: error.message,
          stackTrace: error.stack,
        });

        await PaymentSecurityService.logPaymentEvent({
          paymentId: webhookData.x_extra2,
          userId: webhookData.x_extra1,
          eventType: 'error',
          provider: 'epayco',
          amount: parseFloat(webhookData.x_amount) || 0,
          status: 'failed',
          ipAddress: null,
          userAgent: null,
          details: { 
            reason: error.message,
            reference: webhookData.x_ref_payco,
            transactionId: webhookData.x_transaction_id,
          },
        });
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Process Daimo webhook confirmation
   * @param {Object} webhookData - Daimo webhook data
   * @returns {Object} { success: boolean, error?: string, alreadyProcessed?: boolean }
   */
  static async processDaimoWebhook(webhookData) {
    const DaimoService = require('./daimoService');

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
        paymentId: metadata?.paymentId,
        fullMetadata: metadata,
      });

      const userId = metadata?.userId;
      const planId = metadata?.planId;
      const paymentId = metadata?.paymentId;
      const chatId = metadata?.chatId;
      const farcasterFid = metadata?.farcasterFid;

      if (!userId || !planId) {
        logger.error('Missing user ID or plan ID in Daimo webhook', { 
          eventId: id, 
          metadata,
          hasUserId: !!userId,
          hasPlanId: !!planId,
        });
        return { success: false, error: 'Missing user ID or plan ID' };
      }

      // Warn if payment ID is missing but continue processing
      if (!paymentId) {
        logger.warn('Payment ID missing in Daimo webhook metadata', {
          eventId: id,
          userId,
          planId,
          metadata,
        });
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
            daimoEventId: source?.txHash || id, // Store in reference field
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

          // Update subscription with Farcaster FID if available
          const subscriptionUpdate = {
            status: 'active',
            planId,
            expiry: expiryDate,
          };

          // Store Farcaster FID if present in payment metadata
          if (farcasterFid) {
            subscriptionUpdate.farcaster_fid = farcasterFid;
            subscriptionUpdate.farcaster_linked_at = new Date();
          }

          await UserModel.updateSubscription(userId, subscriptionUpdate);

          logger.info('User subscription activated via Daimo webhook', {
            userId,
            planId,
            expiryDate,
            txHash: source?.txHash,
            farcasterFid: farcasterFid || null,
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
            daimoEventId: source?.txHash || id, // Store in reference field
          });
        }

        logger.warn('Daimo payment bounced', {
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
            daimoEventId: source?.txHash || id, // Store in reference field
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
      // Validate and normalize input parameters
      const numericUserId = parseInt(userId, 10);
      if (!userId || Number.isNaN(numericUserId) || numericUserId <= 0) {
        logger.error('Invalid userId provided', { userId });
        throw new Error('ID de usuario inválido.');
      }

      if (!planId || typeof planId !== 'string') {
        logger.error('Invalid planId provided', { planId });
        throw new Error('ID de plan inválido.');
      }

      if (!provider || !['epayco', 'daimo'].includes(provider)) {
        logger.error('Invalid provider provided', { provider });
        throw new Error('Proveedor de pago inválido.');
      }

      const plan = await PlanModel.getById(planId);
      if (!plan || !plan.active) {
        logger.error('Plan inválido o inactivo', { planId });
        throw new Error('El plan seleccionado no existe o está inactivo.');
      }

       const payment = await PaymentModel.create({
         userId: numericUserId,
         planId,
         provider,
         sku,
         amount: plan.price,
         status: 'pending',
       });

       logger.info('Payment created', {
         paymentId: payment.id,
         userId: numericUserId,
         planId,
         provider,
         amount: plan.price
       });

       // Common configuration for all providers
       const webhookDomain = process.env.BOT_WEBHOOK_DOMAIN;

       // Generate ePayco payment link
       if (provider === 'epayco') {
         const epaycoPublicKey = process.env.EPAYCO_PUBLIC_KEY;
         const epaycoTestMode = process.env.EPAYCO_TEST_MODE === 'true';

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
           // Create Daimo payment intent with paymentId
           const paymentIntent = DaimoConfig.createPaymentIntent({
             amount: plan.price,
             userId: userId,
             planId: planId,
             chatId: chatId,
             paymentId: payment.id,
             description: `${plan.display_name || plan.name} - PNPtv Subscription`,
           });

           // Generate Daimo payment link
           const daimoPayLink = DaimoConfig.generatePaymentLink(paymentIntent);

           // Generate checkout page URL (our hosted page with Daimo Pay SDK)
           const checkoutUrl = `${webhookDomain}/daimo/${payment.id}`;

           // Save both URLs to database
           await PaymentModel.updateStatus(payment.id, 'pending', {
             payment_url: daimoPayLink,
             destination_address: DaimoConfig.getDaimoConfig().treasuryAddress,
           });

           logger.info('Daimo payment URLs generated', {
             paymentId: payment.id,
             planId: plan.id,
             userId,
             amountUSD: plan.price,
             checkoutUrl,
             daimoPayLink,
           });

           // Return checkout page URL (better UX than raw Daimo link)
           return {
             success: true,
             paymentUrl: checkoutUrl,
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

  /**
   * Verify ePayco webhook signature
   * @param {Object} webhookData - ePayco webhook data
   * @returns {boolean} Verification result
   */
  static verifyEpaycoSignature(webhookData) {
    try {
      const { x_signature, x_ref_payco, x_transaction_id, x_amount, x_currency_code } = webhookData;

      if (!x_signature) {
        logger.warn('ePayco signature missing');
        return false;
      }

      const privateKey = process.env.EPAYCO_PRIVATE_KEY;
      if (!privateKey) {
        const isProduction = process.env.NODE_ENV === 'production';
        if (isProduction) {
          throw new Error('EPAYCO_PRIVATE_KEY must be configured in production');
        }
        logger.warn('ePayco private key not configured, skipping verification in development');
        return true;
      }

      const p_cust_id_cliente = process.env.EPAYCO_P_CUST_ID || '';
      const signatureString = `${p_cust_id_cliente}^${privateKey}^${x_ref_payco}^${x_transaction_id}^${x_amount}^${x_currency_code}`;
      const expectedSignature = crypto.createHash('sha256').update(signatureString).digest('hex');

      const isValid = x_signature === expectedSignature;
      if (!isValid) {
        logger.error('Invalid ePayco signature', {
          received: x_signature,
          expected: expectedSignature,
        });
      }

      return isValid;
    } catch (error) {
      logger.error('Error verifying ePayco signature:', error);
      throw error;
    }
  }

  /**
   * Verify Daimo webhook signature
   * @param {Object} webhookData - Daimo webhook data
   * @returns {boolean} Verification result
   */
  static verifyDaimoSignature(webhookData) {
    try {
      const { signature } = webhookData;

      if (!signature) {
        logger.warn('Daimo signature missing');
        return false;
      }

      const webhookSecret = process.env.DAIMO_WEBHOOK_SECRET;
      if (!webhookSecret) {
        const isProduction = process.env.NODE_ENV === 'production';
        if (isProduction) {
          throw new Error('DAIMO_WEBHOOK_SECRET must be configured in production');
        }
        logger.warn('Daimo webhook secret not configured, skipping verification in development');
        return true;
      }

      const payloadString = JSON.stringify({
        id: webhookData.id,
        type: webhookData.type,
        source: webhookData.source,
        metadata: webhookData.metadata,
      });

      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payloadString)
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      if (!isValid) {
        logger.error('Invalid Daimo signature');
      }

      return isValid;
    } catch (error) {
      logger.error('Error verifying Daimo signature:', error);
      if (error.message && (error.message.includes('DAIMO_WEBHOOK_SECRET') || error.message.includes('production'))) {
        throw error;
      }
      return false;
    }
  }

  /**
   * Get payment history for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Payment history
   */
  static async getPaymentHistory(userId) {
    try {
      return await PaymentModel.getByUser(userId);
    } catch (error) {
      logger.error('Error fetching payment history:', { userId, error: error.message });
      return [];
    }
  }

  /**
   * Retry operation with exponential backoff
   * @param {Function} operation - Operation to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {string} operationName - Name of the operation for logging
   * @returns {Promise} Result of the operation
   */
  static async retryWithBackoff(operation, maxRetries = 3, operationName = 'operation') {
    let lastError;
    const maxDelay = 10000; // 10 seconds cap

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Attempting ${operationName}`, { attempt: attempt + 1, maxRetries: maxRetries + 1 });
        const result = await operation();
        if (attempt > 0) {
          logger.info(`${operationName} succeeded after ${attempt} retries`);
        }
        return result;
      } catch (error) {
        lastError = error;
        logger.warn(`${operationName} failed`, {
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          error: error.message,
        });

        if (attempt < maxRetries) {
          const baseDelay = 1000;
          const exponentialDelay = baseDelay * Math.pow(2, attempt);
          const delay = Math.min(exponentialDelay, maxDelay);

          logger.info(`Retrying ${operationName} in ${delay}ms`, { attempt: attempt + 1 });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logger.error(`${operationName} failed after ${maxRetries + 1} attempts`, {
      error: lastError.message,
    });
    throw lastError;
  }
}

module.exports = PaymentService;
