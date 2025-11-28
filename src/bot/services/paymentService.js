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
  static async createPayment({ userId, planId, provider, sku }) {
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

       // Registrar estado inicial en la base de datos (ya se guarda como 'pending' en create)

       // Simular creación de enlace de pago (reemplazar con API real de ePayco/Daimo)
       const paymentUrl = `https://${provider}.com/pay?paymentId=${payment.id}`;

       return { success: true, paymentUrl, paymentId: payment.id };
    } catch (error) {
      logger.error('Error creando pago:', { error: error.message, planId, provider });
      throw new Error(
        error.message.includes('plan')
          ? 'El plan seleccionado no existe o está inactivo.'
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

  // Verify signature for ePayco
  static verifyEpaycoSignature(webhookData) {
    const signature = webhookData.x_signature;
    if (!signature) return false;

    const secret = process.env.EPAYCO_PRIVATE_KEY;
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('EPAYCO_PRIVATE_KEY must be configured in production');
      }
      // In non-production allow bypass for testing/dev
      return true;
    }

    // Expected signature string
    const { x_cust_id_cliente, x_ref_payco, x_transaction_id, x_amount } = webhookData;
    const signatureString = `${x_cust_id_cliente || ''}^${secret}^${x_ref_payco || ''}^${x_transaction_id || ''}^${x_amount || ''}`;
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(signatureString);
    const expected = hmac.digest('hex');
    return expected === signature;
  }

  // Verify signature for Daimo
  static verifyDaimoSignature(webhookData) {
    const signature = webhookData.signature;
    if (!signature) return false;

    const secret = process.env.DAIMO_WEBHOOK_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('DAIMO_WEBHOOK_SECRET must be configured in production');
      }
      return true;
    }

    // Build payload depending on fields present in the webhookData
    const payloadObj = { transaction_id: webhookData.transaction_id };
    if ('status' in webhookData) payloadObj.status = webhookData.status;
    if ('metadata' in webhookData) payloadObj.metadata = webhookData.metadata;
    if ('amount' in webhookData && !('metadata' in webhookData)) payloadObj.amount = webhookData.amount;

    const payload = JSON.stringify(payloadObj);
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expected = hmac.digest('hex');
    return expected === signature;
  }

  // Retry helper with exponential backoff
  static async retryWithBackoff(operation, maxRetries = 3, operationName = 'operation') {
    let lastErr = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastErr = err;
        if (attempt === maxRetries) break;
        const delay = Math.min(10000, 1000 * Math.pow(2, attempt));
        // eslint-disable-next-line no-await-in-loop
        await new Promise((res) => setTimeout(res, delay));
      }
    }
    throw lastErr;
  }

  // Process ePayco webhook payload (lightweight for tests)
  static async processEpaycoWebhook(body) {
    try {
      const txId = body.data?.id || body?.transactionId || null;
      const provider = 'epayco';
      if (!txId) return { success: false };
      const existing = await PaymentModel.getByTransactionId(txId, provider);
      if (existing) {
        // mark completed
        await PaymentModel.updateStatus(existing.id || existing.paymentId || txId, 'completed');
        return { success: true };
      }
      return { success: false };
    } catch (error) {
      logger.error('Error processing ePayco webhook', error);
      return { success: false };
    }
  }

  // Process Daimo webhook payload (lightweight for tests)
  static async processDaimoWebhook(body) {
    try {
      const txId = body.transactionId || body.data?.transaction_id || null;
      const provider = 'daimo';
      if (!txId) return { success: false };
      const existing = await PaymentModel.getByTransactionId(txId, provider);
      if (existing) {
        await PaymentModel.updateStatus(existing.id || existing.paymentId || txId, 'completed');
        return { success: true };
      }
      return { success: false };
    } catch (error) {
      logger.error('Error processing Daimo webhook', error);
      return { success: false };
    }
  }

  static async getPaymentHistory(userId, limit = 20) {
    try {
      return await PaymentModel.getByUser(userId, limit);
    } catch (error) {
      logger.error('Error getting payment history', error);
      return [];
    }
  }
}

module.exports = PaymentService;
