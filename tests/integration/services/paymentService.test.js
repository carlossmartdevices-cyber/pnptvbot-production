const PaymentModel = require('../../../src/models/paymentModel');
const UserModel = require('../../../src/models/userModel');
const PlanModel = require('../../../src/models/planModel');
const { cache } = require('../../../src/config/redis');

// Mock all external dependencies BEFORE importing PaymentService
jest.mock('axios');
jest.mock('../../../src/models/paymentModel');
jest.mock('../../../src/models/userModel');
jest.mock('../../../src/models/planModel');
jest.mock('../../../src/config/redis', () => ({
  cache: {
    acquireLock: jest.fn(),
    releaseLock: jest.fn(),
  },
}));

const PaymentService = require('../../../src/bot/services/paymentService');
const axios = require('axios');

describe('PaymentService Integration Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    it('should create a payment with ePayco provider', async () => {
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

      // Set environment variables
      process.env.EPAYCO_PUBLIC_KEY = 'test_public_key';
      process.env.BOT_WEBHOOK_DOMAIN = 'https://example.com';

      const result = await PaymentService.createPayment({
        userId: 123,
        planId: 'plan_123',
        provider: 'epayco',
      });

      expect(result.success).toBe(true);
      expect(result.paymentUrl).toContain('/payment/pay_123');
      expect(result.paymentId).toBe('pay_123');
    });

    it('should create a payment with Daimo provider', async () => {
      // Mock PlanModel.getById
      PlanModel.getById.mockResolvedValue({
        id: 'plan_456',
        name: 'Premium',
        price: 10,
        currency: 'USDC',
        duration: 30,
        active: true,
      });

      // Mock PaymentModel.create
      PaymentModel.create.mockResolvedValue({
        id: 'pay_456',
        userId: 456,
        planId: 'plan_456',
        amount: 10,
        currency: 'USDC',
        provider: 'daimo',
      });

      // Mock PaymentModel.updateStatus
      PaymentModel.updateStatus.mockResolvedValue(true);

      // Set environment variables - need treasury address for Daimo
      process.env.DAIMO_API_KEY = 'test_api_key';
      process.env.DAIMO_TREASURY_ADDRESS = '0xcaf17dbbccc0e9ac87dad1af1f2fe3ba3a4d0613';
      process.env.DAIMO_REFUND_ADDRESS = '0xcaf17dbbccc0e9ac87dad1af1f2fe3ba3a4d0613';
      process.env.BOT_WEBHOOK_DOMAIN = 'https://example.com';

      const result = await PaymentService.createPayment({
        userId: 456,
        planId: 'plan_456',
        provider: 'daimo',
      });

      expect(result.success).toBe(true);
      expect(result.paymentUrl).toContain('/daimo/pay_456');
      expect(result.paymentId).toBe('pay_456');
    });

    it('should throw error when plan is not found', async () => {
      PlanModel.getById.mockResolvedValue(null);

      await expect(PaymentService.createPayment({
        userId: 123,
        planId: 'invalid_plan',
        provider: 'epayco',
      })).rejects.toThrow('El plan seleccionado no existe o está inactivo');
    });

    it('should throw error for invalid payment data', async () => {
      // Mock PlanModel to return a valid plan so we test validation
      PlanModel.getById.mockResolvedValue({
        id: 'plan_123',
        name: 'Premium',
        price: 10,
        currency: 'USD',
        duration: 30,
        active: true,
      });

      await expect(PaymentService.createPayment({
        userId: 'invalid_user_id', // Should be a number
        planId: 'plan_123',
        provider: 'invalid_provider', // Invalid provider
      })).rejects.toThrow();
    });

    it('should throw error when Daimo API fails', async () => {
      PlanModel.getById.mockResolvedValue({
        id: 'plan_456',
        name: 'Premium',
        price: 10,
        currency: 'USDC',
        duration: 30,
        active: true,
      });

      PaymentModel.create.mockResolvedValue({
        id: 'pay_456',
        userId: 456,
        planId: 'plan_456',
        amount: 10,
        currency: 'USDC',
        provider: 'daimo',
      });

      // Mock DaimoConfig to throw an error
      const DaimoConfig = require('../../../src/config/daimo');
      jest.spyOn(DaimoConfig, 'createPaymentIntent').mockImplementation(() => {
        throw new Error('Daimo configuration error');
      });

      process.env.DAIMO_API_KEY = 'test_api_key';
      process.env.BOT_WEBHOOK_DOMAIN = 'https://example.com';

      await expect(PaymentService.createPayment({
        userId: 456,
        planId: 'plan_456',
        provider: 'daimo',
      })).rejects.toThrow();

      DaimoConfig.createPaymentIntent.mockRestore();
    }, 15000); // Increase timeout for retry mechanism
  });

  describe('processDaimoWebhook', () => {
    beforeEach(() => {
      // Set environment variables for signature verification
      process.env.DAIMO_WEBHOOK_SECRET = 'test_secret';
    });

    it('should process a successful Daimo webhook', async () => {
      // Mock PaymentModel.getById
      PaymentModel.getById.mockResolvedValue({
        id: 'pay_123',
        userId: 'user_123',
        planId: 'plan_123',
        status: 'pending',
        amount: 10,
        currency: 'USDC',
      });

      // Mock PlanModel.getById
      PlanModel.getById.mockResolvedValue({
        id: 'plan_123',
        name: 'Premium',
        price: 10,
        currency: 'USDC',
        duration: 30,
        active: true,
      });

      // Mock UserModel.getById
      UserModel.getById.mockResolvedValue({
        id: 'user_123',
        language: 'es',
      });

      // Mock UserModel.updateSubscription
      UserModel.updateSubscription.mockResolvedValue(true);

      // Mock PaymentModel.updateStatus
      PaymentModel.updateStatus.mockResolvedValue(true);

      // Mock cache methods
      cache.acquireLock.mockResolvedValue(true);
      cache.releaseLock.mockResolvedValue(true);

      // Create valid signature
      const crypto = require('crypto');
      const webhookData = {
        id: 'txn_123',
        status: 'payment_completed',
        source: {
          txHash: 'txn_123',
        },
        metadata: {
          paymentId: 'pay_123',
          userId: 'user_123',
          planId: 'plan_123',
        },
      };

      const payload = JSON.stringify(webhookData);
      const hmac = crypto.createHmac('sha256', process.env.DAIMO_WEBHOOK_SECRET);
      hmac.update(payload);
      const signature = hmac.digest('hex');

      webhookData.signature = signature;

      const result = await PaymentService.processDaimoWebhook(webhookData);

      expect(result.success).toBe(true);
      expect(UserModel.updateSubscription).toHaveBeenCalledWith('user_123', {
        status: 'active',
        planId: 'plan_123',
        expiry: expect.any(Date),
      });
      expect(PaymentModel.updateStatus).toHaveBeenCalledWith('pay_123', 'completed', expect.objectContaining({
        transaction_id: 'txn_123',
      }));
    });

    it('should handle idempotency (duplicate webhooks)', async () => {
      // Mock payment already processed (status: completed)
      PaymentModel.getById.mockResolvedValue({
        id: 'pay_123',
        userId: 'user_123',
        planId: 'plan_123',
        status: 'completed',
      });

      const crypto = require('crypto');
      const webhookData = {
        id: 'txn_123',
        status: 'payment_completed',
        source: {
          txHash: 'txn_123',
        },
        metadata: {
          paymentId: 'pay_123',
          userId: 'user_123',
          planId: 'plan_123',
        },
      };

      const payload = JSON.stringify(webhookData);
      const hmac = crypto.createHmac('sha256', process.env.DAIMO_WEBHOOK_SECRET);
      hmac.update(payload);
      const signature = hmac.digest('hex');

      webhookData.signature = signature;

      const result = await PaymentService.processDaimoWebhook(webhookData);

      expect(result.success).toBe(true);
      expect(result.alreadyProcessed).toBe(true);
    });
  });

  describe('getPaymentHistory', () => {
    it('should return payment history for a user', async () => {
      const mockPayments = [
        {
          id: 'pay_1',
          userId: 'user_123',
          planId: 'plan_123',
          amount: 10,
          status: 'success',
        },
        {
          id: 'pay_2',
          userId: 'user_123',
          planId: 'plan_456',
          amount: 20,
          status: 'success',
        },
      ];

      PaymentModel.getByUser.mockResolvedValue(mockPayments);

      const result = await PaymentService.getPaymentHistory('user_123');

      expect(result).toEqual(mockPayments);
      expect(PaymentModel.getByUser).toHaveBeenCalledWith('user_123');
    });

    it('should return empty array on error', async () => {
      PaymentModel.getByUser.mockRejectedValue(new Error('Database error'));

      const result = await PaymentService.getPaymentHistory('user_123');

      expect(result).toEqual([]);
    });
  });
});
