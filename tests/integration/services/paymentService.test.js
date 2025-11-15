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
      expect(result.paymentUrl).toContain('checkout.epayco.co');
      expect(result.paymentId).toBe('pay_123');
      expect(PaymentModel.updateStatus).toHaveBeenCalledWith('pay_123', 'pending', expect.objectContaining({
        paymentUrl: expect.stringContaining('checkout.epayco.co'),
        provider: 'epayco',
      }));
    });

    it('should create a payment with Daimo provider', async () => {
      // Mock PlanModel.getById
      PlanModel.getById.mockResolvedValue({
        id: 'plan_456',
        name: 'Premium',
        price: 10,
        currency: 'USDC',
        duration: 30,
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

      // Mock Daimo API response
      axios.post.mockResolvedValue({
        data: {
          payment_url: 'https://mock.daimo.com/pay/123',
          transaction_id: 'txn_123',
        },
      });

      // Set environment variables
      process.env.DAIMO_API_KEY = 'test_api_key';
      process.env.BOT_WEBHOOK_DOMAIN = 'https://example.com';

      const result = await PaymentService.createPayment({
        userId: 456,
        planId: 'plan_456',
        provider: 'daimo',
      });

      expect(result.success).toBe(true);
      expect(result.paymentUrl).toBe('https://mock.daimo.com/pay/123');
      expect(result.paymentId).toBe('pay_456');
      expect(PaymentModel.updateStatus).toHaveBeenCalledWith('pay_456', 'pending', {
        paymentUrl: 'https://mock.daimo.com/pay/123',
        transactionId: 'txn_123',
        provider: 'daimo',
      });
    });

    it('should throw error when plan is not found', async () => {
      PlanModel.getById.mockResolvedValue(null);

      await expect(PaymentService.createPayment({
        userId: 123,
        planId: 'invalid_plan',
        provider: 'epayco',
      })).rejects.toThrow('Plan not found');
    });

    it('should throw error for invalid payment data', async () => {
      // Mock PlanModel to return a valid plan so we test validation
      PlanModel.getById.mockResolvedValue({
        id: 'plan_123',
        name: 'Premium',
        price: 10,
        currency: 'USD',
        duration: 30,
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
      });

      PaymentModel.create.mockResolvedValue({
        id: 'pay_456',
        userId: 456,
        planId: 'plan_456',
        amount: 10,
        currency: 'USDC',
        provider: 'daimo',
      });

      // Mock Daimo API error
      axios.post.mockRejectedValue(new Error('Internal server error'));

      process.env.DAIMO_API_KEY = 'test_api_key';
      process.env.BOT_WEBHOOK_DOMAIN = 'https://example.com';

      await expect(PaymentService.createPayment({
        userId: 456,
        planId: 'plan_456',
        provider: 'daimo',
      })).rejects.toThrow('Internal server error');
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
        transaction_id: 'txn_123',
        status: 'completed',
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
      expect(PaymentModel.updateStatus).toHaveBeenCalledWith('pay_123', 'success', {
        transactionId: 'txn_123',
        completedAt: expect.any(Date),
      });
      expect(cache.releaseLock).toHaveBeenCalled();
    });

    it('should handle idempotency (duplicate webhooks)', async () => {
      PaymentModel.getById.mockResolvedValue({
        id: 'pay_123',
        userId: 'user_123',
        planId: 'plan_123',
        status: 'pending',
      });

      // Simulate lock already acquired
      cache.acquireLock.mockResolvedValue(false);

      const crypto = require('crypto');
      const webhookData = {
        transaction_id: 'txn_123',
        status: 'completed',
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

      expect(result.success).toBe(false);
      expect(result.error).toContain('pay_123');
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
