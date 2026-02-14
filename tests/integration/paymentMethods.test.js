const PaymentService = require('../../src/bot/services/paymentService');
const PlanModel = require('../../src/models/planModel');
const PaymentModel = require('../../src/models/paymentModel');
const UserModel = require('../../src/models/userModel');
const DaimoService = require('../../src/bot/services/daimoService');

// Mock all external dependencies BEFORE importing PaymentService
jest.mock('../../src/models/planModel');
jest.mock('../../src/models/paymentModel');
jest.mock('../../src/models/userModel');
jest.mock('../../src/models/subscriberModel', () => ({
  getBySubscriptionId: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../src/bot/services/daimoService');
jest.mock('../../src/bot/services/emailservice', () => ({
  sendInvoiceEmail: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('../../src/bot/services/invoiceservice', () => ({
  generateInvoice: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('../../src/bot/services/businessNotificationService', () => ({
  notifyPayment: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../src/bot/services/paymentSecurityService', () => ({
  logPaymentEvent: jest.fn().mockResolvedValue(true),
  logPaymentError: jest.fn().mockResolvedValue(true),
  encryptPaymentDataAtRest: jest.fn().mockResolvedValue(true),
  validatePaymentConsistency: jest.fn().mockResolvedValue({ valid: true }),
  checkReplayAttack: jest.fn().mockResolvedValue({ isReplay: false }),
  setPaymentTimeout: jest.fn().mockResolvedValue(true),
  generateSecurePaymentToken: jest.fn().mockResolvedValue('token'),
  createPaymentRequestHash: jest.fn().mockResolvedValue('hash'),
}));
jest.mock('../../src/config/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true),
    acquireLock: jest.fn().mockResolvedValue(true),
    releaseLock: jest.fn().mockResolvedValue(true),
  },
}));
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('telegraf', () => ({
  Telegraf: jest.fn().mockImplementation(() => ({
    telegram: {
      sendMessage: jest.fn().mockResolvedValue(true),
    },
  })),
}));

describe('Payment Methods Integration Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Set environment variables for testing
    process.env.BOT_WEBHOOK_DOMAIN = 'https://test.pnptv.app';
    process.env.CHECKOUT_DOMAIN = 'https://test.easybots.store';
    process.env.EPAYCO_WEBHOOK_DOMAIN = 'https://test.easybots.store';
    process.env.EPAYCO_PUBLIC_KEY = 'test_public_key';
    delete process.env.EPAYCO_P_CUST_ID;
    delete process.env.EPAYCO_P_KEY;
    process.env.DAIMO_API_KEY = 'test_daimo_key';
    // Ensure NODE_ENV is set for the signature bypass to work in test environment
    process.env.NODE_ENV = 'test';
    // Mock PaymentService.sendPaymentConfirmationNotification to prevent timeouts
    jest.spyOn(PaymentService, 'sendPaymentConfirmationNotification').mockResolvedValue(true);
  });

  describe('ePayco Payment Method', () => {
    it('should create ePayco payment with direct checkout page', async () => {
      // Mock PlanModel.getById
      PlanModel.getById.mockResolvedValue({
        id: 'plan_123',
        name: 'Premium',
        price: 10,
        currency: 'USD',
        duration: 30,
        active: true,
      });

      // Mock PaymentModel.create
      PaymentModel.create.mockResolvedValue({
        id: 'pay_123',
        userId: 123,
        planId: 'plan_123',
        amount: 10,
        currency: 'USD',
        provider: 'epayco',
      });

      // Mock PaymentModel.updateStatus
      PaymentModel.updateStatus.mockResolvedValue(true);

      const result = await PaymentService.createPayment({
        userId: 123,
        planId: 'plan_123',
        provider: 'epayco',
      });

      expect(result.success).toBe(true);
      expect(result.paymentUrl).toContain('paymentId=pay_123');
      expect(result.paymentId).toBe('pay_123');
      expect(PaymentModel.updateStatus).toHaveBeenCalledWith('pay_123', 'pending', expect.objectContaining({
        paymentUrl: expect.stringContaining('paymentId=pay_123'),
        provider: 'epayco',
      }));
    });

    it('[B8mBvR] should handle ePayco webhook successfully', async () => {
      // Mock PaymentModel.getById
      PaymentModel.getById.mockResolvedValue({
        id: 'pay_123',
        userId: 'user_123',
        planId: 'plan_123',
        status: 'pending',
      });

      // Mock PlanModel.getById
      PlanModel.getById.mockResolvedValue({
        id: 'plan_123',
        name: 'Premium',
        price: 10,
        duration: 30,
      });

      // Mock UserModel.updateSubscription
      UserModel.updateSubscription.mockResolvedValue(true);

      // Mock PaymentModel.updateStatus
      PaymentModel.updateStatus.mockResolvedValue(true);

      // Mock UserModel.getById
      UserModel.getById.mockResolvedValue({
        id: 'user_123',
        first_name: 'Test',
        language: 'es',
      });

      const webhookData = {
        x_ref_payco: 'ref_123',
        x_transaction_id: 'txn_123',
        x_transaction_state: 'Aceptada',
        x_approval_code: 'app_123',
        x_amount: '10.00',
        x_extra1: 'user_123',
        x_extra2: 'plan_123',
        x_extra3: 'pay_123',
        x_customer_email: 'test@example.com',
        x_customer_name: 'Test User',
      };

      const result = await PaymentService.processEpaycoWebhook(webhookData);

      expect(result.success).toBe(true);
      expect(UserModel.updateSubscription).toHaveBeenCalledWith('user_123', {
        status: 'active',
        planId: 'plan_123',
        expiry: expect.any(Date),
      });
      expect(PaymentModel.updateStatus).toHaveBeenCalledWith('pay_123', 'completed', {
        transaction_id: 'txn_123',
        approval_code: 'app_123',
        reference: 'ref_123',
        epayco_ref: 'ref_123',
        amount_currency_validated: true,
        webhook_processed_at: expect.any(String),
      });
    });

    it('should handle ePayco webhook failure', async () => {
      // Mock PaymentModel.getById
      PaymentModel.getById.mockResolvedValue({
        id: 'pay_123',
        userId: 'user_123',
        planId: 'plan_123',
        status: 'pending',
      });

      // Mock PaymentModel.updateStatus
      PaymentModel.updateStatus.mockResolvedValue(true);

      const webhookData = {
        x_ref_payco: 'ref_123',
        x_transaction_id: 'txn_123',
        x_transaction_state: 'Rechazada',
        x_extra1: 'user_123',
        x_extra2: 'plan_123',
        x_extra3: 'pay_123',
      };

      const result = await PaymentService.processEpaycoWebhook(webhookData);

      expect(result.success).toBe(true);
      expect(PaymentModel.updateStatus).toHaveBeenCalledWith('pay_123', 'failed', {
        transaction_id: 'txn_123',
        reference: 'ref_123',
        epayco_ref: 'ref_123',
        epayco_estado: 'Rechazada',
        epayco_respuesta: undefined,
        error: 'Rechazada',
        abandoned_3ds: false,
      });
    });
  });

  describe('Daimo Payment Method', () => {
    beforeEach(() => {
      // Set Daimo environment variables
      process.env.DAIMO_TREASURY_ADDRESS = '0x123456789';
      process.env.DAIMO_REFUND_ADDRESS = '0x987654321';
    });

    it('should create Daimo payment with fallback when Daimo is not fully configured', async () => {
      // Mock PlanModel.getById
      PlanModel.getById.mockResolvedValue({
        id: 'plan_789',
        name: 'Premium',
        price: 10,
        currency: 'USDC',
        duration: 30,
        active: true,
      });

      // Mock PaymentModel.create
      PaymentModel.create.mockResolvedValue({
        id: 'pay_789',
        userId: 789,
        planId: 'plan_789',
        amount: 10,
        currency: 'USDC',
        provider: 'daimo',
      });

      // Mock PaymentModel.updateStatus
      PaymentModel.updateStatus.mockResolvedValue(true);

      const result = await PaymentService.createPayment({
        userId: 789,
        planId: 'plan_789',
        provider: 'daimo',
      });

      expect(result.success).toBe(true);
      expect(result.paymentUrl).toContain('daimo-checkout/pay_789');
      expect(result.paymentId).toBe('pay_789');
      expect(PaymentModel.updateStatus).toHaveBeenCalledWith('pay_789', 'pending', {
        paymentUrl: expect.stringContaining('daimo-checkout/pay_789'),
        provider: 'daimo',
        fallback: true,
      });
    });

    it('should handle Daimo payment failure with fallback', async () => {
      // Mock PlanModel.getById
      PlanModel.getById.mockResolvedValue({
        id: 'plan_789',
        name: 'Premium',
        price: 10,
        currency: 'USDC',
        duration: 30,
        active: true,
      });

      // Mock PaymentModel.create
      PaymentModel.create.mockResolvedValue({
        id: 'pay_789',
        userId: 789,
        planId: 'plan_789',
        amount: 10,
        currency: 'USDC',
        provider: 'daimo',
      });

      // Mock PaymentModel.updateStatus
      PaymentModel.updateStatus.mockResolvedValue(true);

      const result = await PaymentService.createPayment({
        userId: 789,
        planId: 'plan_789',
        provider: 'daimo',
      });

      expect(result.success).toBe(true);
      expect(result.paymentUrl).toContain('daimo-checkout/pay_789');
      expect(result.paymentId).toBe('pay_789');
    });

    it('should process Daimo webhook successfully', async () => {
      // Mock PaymentModel.getById
      PaymentModel.getById.mockResolvedValue({
        id: 'pay_123',
        userId: 'user_123',
        planId: 'plan_123',
        status: 'pending',
      });

      // Mock PlanModel.getById
      PlanModel.getById.mockResolvedValue({
        id: 'plan_123',
        name: 'Premium',
        price: 10,
        duration: 30,
      });

      // Mock UserModel.getById
      UserModel.getById.mockResolvedValue({
        id: 'user_123',
        first_name: 'Test',
        language: 'es',
      });

      // Mock UserModel.updateSubscription
      UserModel.updateSubscription.mockResolvedValue(true);

      // Mock PaymentModel.updateStatus
      PaymentModel.updateStatus.mockResolvedValue(true);

      const webhookData = {
        id: 'event_123',
        status: 'payment_completed',
        source: {
          txHash: 'txn_123',
          payerAddress: '0x123',
          chainId: 10,
          amountUnits: '10000000',
        },
        metadata: {
          paymentId: 'pay_123',
          userId: 'user_123',
          planId: 'plan_123',
        },
      };

      const result = await PaymentService.processDaimoWebhook(webhookData);

      expect(result.success).toBe(true);
      expect(UserModel.updateSubscription).toHaveBeenCalledWith('user_123', {
        status: 'active',
        planId: 'plan_123',
        expiry: expect.any(Date),
      });
      expect(PaymentModel.updateStatus).toHaveBeenCalledWith('pay_123', 'completed', {
        transaction_id: 'txn_123',
        daimo_event_id: 'event_123',
        payer_address: '0x123',
        chain_id: 10,
      });
    });

    it('should handle Daimo webhook failure', async () => {
      // Mock PaymentModel.getById
      PaymentModel.getById.mockResolvedValue({
        id: 'pay_123',
        userId: 'user_123',
        planId: 'plan_123',
        status: 'pending',
      });

      // Mock PaymentModel.updateStatus
      PaymentModel.updateStatus.mockResolvedValue(true);

      const webhookData = {
        id: 'event_123',
        status: 'payment_failed',
        source: {
          txHash: 'txn_123',
        },
        metadata: {
          paymentId: 'pay_123',
          userId: 'user_123',
          planId: 'plan_123',
        },
      };

      const result = await PaymentService.processDaimoWebhook(webhookData);

      expect(result.success).toBe(true);
      expect(PaymentModel.updateStatus).toHaveBeenCalledWith('pay_123', 'failed', {
        transaction_id: 'txn_123',
        daimo_event_id: 'event_123',
      });
    });
  });

  describe('Payment Signature Verification', () => {
    it('should verify ePayco signature correctly', () => {
      process.env.EPAYCO_P_KEY = 'test_secret';
      process.env.EPAYCO_P_CUST_ID = 'client_123';
      process.env.NODE_ENV = 'development';

      const webhookData = {
        x_ref_payco: 'ref_123',
        x_transaction_id: 'txn_123',
        x_amount: '10.00',
        x_currency_code: 'cop',
      };

      const crypto = require('crypto');
      const signatureString = [
        process.env.EPAYCO_P_CUST_ID,
        process.env.EPAYCO_P_KEY,
        webhookData.x_ref_payco,
        webhookData.x_transaction_id,
        webhookData.x_amount,
        webhookData.x_currency_code,
      ].join('^');
      webhookData.x_signature = crypto.createHash('sha256').update(signatureString).digest('hex');

      const result = PaymentService.verifyEpaycoSignature(webhookData);
      expect(result).toBe(true);
    });

    it('should throw error if ePayco private key is not configured', () => {
      delete process.env.EPAYCO_PRIVATE_KEY;
      delete process.env.EPAYCO_P_KEY; // Ensure both are undefined
      process.env.NODE_ENV = 'test'; // Still non-production

      expect(() => PaymentService.verifyEpaycoSignature({ x_signature: 'sig' })).toThrow('EPAYCO_P_KEY or EPAYCO_PRIVATE_KEY must be configured');
    });

    it('should verify Daimo signature correctly', () => {
      const webhookData = {
        id: 'event_123',
        status: 'completed',
        signature: 'valid_signature',
      };

      // Mock crypto to return expected signature
      const crypto = require('crypto');
      jest.spyOn(crypto, 'createHmac').mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('valid_signature'),
      });

      process.env.DAIMO_WEBHOOK_SECRET = 'test_secret';
      process.env.NODE_ENV = 'development';

      const result = PaymentService.verifyDaimoSignature(webhookData);
      expect(result).toBe(true);
    });
  });

  describe('Payment Error Handling', () => {
    it('should throw error for invalid plan', async () => {
      PlanModel.getById.mockResolvedValue(null);

      await expect(PaymentService.createPayment({
        userId: 123,
        planId: 'invalid_plan',
        provider: 'epayco',
      })).rejects.toThrow('El plan seleccionado no existe o está inactivo.');
    });

    it('should throw error for inactive plan', async () => {
      PlanModel.getById.mockResolvedValue({
        id: 'plan_123',
        active: false,
      });

      await expect(PaymentService.createPayment({
        userId: 123,
        planId: 'plan_123',
        provider: 'epayco',
      })).rejects.toThrow('El plan seleccionado no existe o está inactivo.');
    });

    it('should handle payment model errors gracefully', async () => {
      PlanModel.getById.mockResolvedValue({
        id: 'plan_123',
        name: 'Premium',
        price: 10,
        active: true,
      });

      PaymentModel.create.mockRejectedValue(new Error('Database error'));

      await expect(PaymentService.createPayment({
        userId: 123,
        planId: 'plan_123',
        provider: 'epayco',
      })).rejects.toThrow('Payment creation failed: Database error');
    });
  });
});
