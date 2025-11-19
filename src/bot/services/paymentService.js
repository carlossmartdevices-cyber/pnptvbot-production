const PaymentModel = require('../../models/paymentModel');
const InvoiceService = require('../../bot/services/invoiceservice');
const EmailService = require('../../bot/services/emailservice');
const PlanModel = require('../../models/planModel');
const UserModel = require('../../models/userModel');
const logger = require('../../utils/logger');

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
  static async createPayment({ userId, planId, provider, sku, chatId }) {
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

         // Use price in Colombian pesos for ePayco
         const priceInCOP = plan.price_in_cop || (parseFloat(plan.price) * 4000); // Fallback conversion

         // Validate price in COP
         if (!priceInCOP || priceInCOP <= 0) {
           logger.error('Invalid price in COP', { planId: plan.id, price_in_cop: plan.price_in_cop });
           throw new Error('Precio inválido para este plan. Contacta soporte.');
         }

         // Create payment reference
         const paymentRef = `PAY-${payment.id.substring(0, 8).toUpperCase()}`;

         // Generate ePayco Checkout URL with parameters
         const planName = plan.display_name || plan.name;
         const description = `Suscripción ${planName} - PNPtv`;

         // ePayco Checkout Standard URL
         const baseUrl = epaycoTestMode
           ? 'https://checkout.epayco.co/checkout.html'
           : 'https://checkout.epayco.co/checkout.html';

         const params = new URLSearchParams({
           key: epaycoPublicKey,
           external: 'true',
           name: description,
           description: description,
           invoice: paymentRef,
           currency: 'cop',
           amount: priceInCOP.toString(),
           tax_base: '0',
           tax: '0',
           country: 'co',
           lang: 'es',
           external_reference: payment.id,
           confirmation: `${webhookDomain}/api/webhooks/epayco`,
           response: `${webhookDomain}/payment/response`,
           test: epaycoTestMode ? 'true' : 'false',
           autoclick: 'true'
         });

         const paymentUrl = `${baseUrl}?${params.toString()}`;

         logger.info('ePayco payment URL generated', {
           paymentId: payment.id,
           paymentRef,
           planId: plan.id,
           amountUSD: plan.price,
           amountCOP: priceInCOP,
           testMode: epaycoTestMode
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
      const payment = await PaymentModel.getPaymentById(paymentId);
      if (!payment) {
        logger.error('Pago no encontrado', { paymentId });
        throw new Error('No se encontró el pago. Verifica el ID o contacta soporte.');
      }

      await PaymentModel.updatePayment(paymentId, { status: 'completed' });

      // Generar factura
      const invoice = await InvoiceService.generateInvoice({
        userId: payment.userId,
        planSku: payment.sku,
        amount: payment.amount,
      });

      // Enviar factura por email
      const user = await UserModel.getById(payment.userId);
      await EmailService.sendInvoiceEmail({
        to: user.email,
        subject: `Factura por suscripción (SKU: ${payment.sku})`,
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
