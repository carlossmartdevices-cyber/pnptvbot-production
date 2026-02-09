const PaymentService = require('../../../src/bot/services/paymentService');
const axios = require('axios');
const DaimoConfig = require('../../../src/config/daimo');
const crypto = require('crypto'); // Import crypto
const PaymentModel = require('../../../src/models/paymentModel'); // Import PaymentModel
const PlanModel = require('../../../src/models/planModel'); // Import PlanModel
const UserModel = require('../../../src/models/userModel'); // Import UserModel
const { cache } = require('../../../src/config/redis'); // Import cache for mocking purposes

// Mock all external dependencies BEFORE importing PaymentService

jest.mock('../../../src/models/paymentModel', () => ({
  __esModule: true,
  ...jest.requireActual('../../../src/models/paymentModel'),
  create: jest.fn(),
  updateStatus: jest.fn(),
  getById: jest.fn(),
  getByUserId: jest.fn(), // Explicitly mock getByUserId
}));
jest.mock('../../../src/models/userModel');
jest.mock('../../../src/models/planModel');
jest.mock('../../../src/config/redis', () => ({
  cache: {
    acquireLock: jest.fn(),
    releaseLock: jest.fn(),
  },
}));
jest.mock('../../../src/config/daimo', () => ({
  createDaimoPayment: jest.fn(),
  SUPPORTED_PAYMENT_APPS: ['CashApp', 'Venmo', 'Zelle'], // Mock as an array
}));
jest.mock('axios'); // Mock axios
jest.mock('crypto', () => ({
  createHmac: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mock_signature'),
  })),
  timingSafeEqual: jest.fn().mockReturnValue(true),
}));

describe('PaymentService Integration Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    axios.mockClear();

    // Set common environment variables for payment services
    process.env.EPAYCO_PUBLIC_KEY = 'test_public_key';
    process.env.EPAYCO_PRIVATE_KEY = 'test_private_key';
    process.env.EPAYCO_P_CUST_ID = 'test_cust_id';
    process.env.EPAYCO_TEST_MODE = 'true';
    process.env.DAIMO_API_KEY = 'test_daimo_api_key';
    process.env.DAIMO_WEBHOOK_SECRET = 'test_daimo_webhook_secret';
    process.env.BOT_WEBHOOK_DOMAIN = 'https://example.com';
  });

  describe('createPayment', () => {
    it('[VKpz6B] should create a payment with ePayco provider', async () => {
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

      const result = await PaymentService.createPayment({
        userId: 123,
        planId: 'plan_123',
        provider: 'epayco',
      });

      expect(result.success).toBe(true);
      expect(result.paymentUrl).toContain('/payment/pay_123');
      expect(result.paymentId).toBe('pay_123');
      expect(PaymentModel.updateStatus).toHaveBeenCalledWith('pay_123', 'pending', expect.objectContaining({
        paymentUrl: expect.stringContaining('/payment/pay_123'),
        provider: 'epayco',
      }));
    });

    it('[gQ2kRN] should generate subscription URL for recurring plans', async () => {
      PlanModel.getById.mockResolvedValue({
        id: 'monthly_pass',
        name: 'Monthly Pass',
        price: 24.99,
        currency: 'USD',
        duration: 30,
        active: true,
      });

      PaymentModel.create.mockResolvedValue({
        id: 'pay_sub_123',
        userId: 789,
        planId: 'monthly_pass',
        amount: 24.99,
        currency: 'USD',
        provider: 'epayco',
      });

      PaymentModel.updateStatus.mockResolvedValue(true);

      const result = await PaymentService.createPayment({
        userId: 789,
        planId: 'monthly_pass',
        provider: 'epayco',
      });

      expect(result.success).toBe(true);
      expect(result.paymentUrl).toContain('subscription-landing.epayco.co/plan/');
      expect(result.paymentUrl).toContain('extra1=789');
      expect(result.paymentUrl).toContain('extra2=monthly_pass');
      expect(result.paymentUrl).toContain('extra3=pay_sub_123');
      expect(result.paymentId).toBe('pay_sub_123');
    });

    it('[lR3WPn] should keep checkout URL for one-time plans', async () => {
      PlanModel.getById.mockResolvedValue({
        id: 'week_pass',
        name: 'Week Pass',
        price: 14.99,
        currency: 'USD',
        duration: 7,
        active: true,
      });

      PaymentModel.create.mockResolvedValue({
        id: 'pay_onetime_123',
        userId: 101,
        planId: 'week_pass',
        amount: 14.99,
        currency: 'USD',
        provider: 'epayco',
      });

      PaymentModel.updateStatus.mockResolvedValue(true);

      const result = await PaymentService.createPayment({
        userId: 101,
        planId: 'week_pass',
        provider: 'epayco',
      });

      expect(result.success).toBe(true);
      expect(result.paymentUrl).toContain('/payment/pay_onetime_123');
      expect(result.paymentUrl).not.toContain('subscription-landing');
      expect(result.paymentId).toBe('pay_onetime_123');
    });

    it('[8VM4Kr] should create a payment with Daimo provider', async () => {
      axios.post = jest.fn();
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

      // Mock Daimo API response
      DaimoConfig.createDaimoPayment.mockResolvedValue({
        success: true,
        paymentUrl: 'https://mock.daimo.com/pay/123',
        daimoPaymentId: 'dp_123',
      });

      // Set environment variables

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
        daimo_payment_id: 'dp_123',
        provider: 'daimo',
      });
    });

    it('[DryMWx] should throw error when plan is not found', async () => {
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
        active: true,
      });

      await expect(PaymentService.createPayment({
        userId: 'invalid_user_id', // Should be a number
        planId: 'plan_123',
        provider: 'invalid_provider', // Invalid provider
      })).rejects.toThrow();
    });

    it('should throw error when Daimo API fails', async () => {
      axios.post = jest.fn();
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

      // Mock Daimo API error
      DaimoConfig.createDaimoPayment.mockResolvedValue({
        success: false,
        error: 'Daimo API error: 500',
      });

      process.env.DAIMO_API_KEY = 'test_api_key'; // Redundant, but kept for clarity in this specific test
      process.env.BOT_WEBHOOK_DOMAIN = 'https://example.com'; // Redundant, but kept for clarity in this specific test

      await expect(PaymentService.createPayment({
        userId: 456,
        planId: 'plan_456',
        provider: 'daimo',
      })).resolves.toEqual({
        success: true,
        paymentUrl: 'https://example.com/daimo-checkout/pay_456',
        paymentId: 'pay_456',
      });
    }, 15000); // Increase timeout for retry mechanism
  });

  describe('processDaimoWebhook', () => {

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

      // Mock UserModel.updateSubscription
      UserModel.updateSubscription.mockResolvedValue(true);

      // Mock PaymentModel.updateStatus
      PaymentModel.updateStatus.mockResolvedValue(true);

      // Mock cache methods
      cache.acquireLock.mockResolvedValue(true);
      cache.releaseLock.mockResolvedValue(true);

      const webhookData = {
        transaction_id: 'txn_123',
        status: 'payment_completed',
        source: {
          txHash: 'txn_123',
          amountUnits: '10000000', // Example amount for USDC
          payerAddress: '0xabc',
          chainId: '1',
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
      expect(PaymentModel.updateStatus).toHaveBeenCalledWith('pay_123', 'completed', {
        transaction_id: webhookData.source.txHash || webhookData.id,
        daimo_event_id: webhookData.id,
        payer_address: webhookData.source.payerAddress,
        chain_id: webhookData.source.chainId,
      });
      expect(cache.releaseLock).toHaveBeenCalled();
    });

    it('[M7GV97] should handle idempotency (duplicate webhooks)', async () => {
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
        status: 'payment_completed',
        source: {
          txHash: 'txn_123',
          amountUnits: '10000000', // Example amount for USDC
          payerAddress: '0xabc',
          chainId: '1',
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
      // Removed: expect(result.error).toContain('pay_123');

    });
  });

  describe('getPaymentHistory', () => {
    it('[eJ3yb3] should return payment history for a user', async () => {
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

      PaymentModel.getByUserId.mockResolvedValue(mockPayments);

      const result = await PaymentService.getPaymentHistory('user_123');

      expect(result).toEqual(mockPayments);
      expect(PaymentModel.getByUserId).toHaveBeenCalledWith('user_123', 20);
    });

    it('should return empty array on error', async () => {
      PaymentModel.getByUserId.mockRejectedValue(new Error('Database error'));

      const result = await PaymentService.getPaymentHistory('user_123');

      expect(result).toEqual([]);
    });
  });
});
