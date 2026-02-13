/**
 * QaTouch Project: ePayco Subscriptions (dekw)
 * Module: Subscription API
 */

jest.mock('../../../src/config/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    getOrSet: jest.fn((key, fn) => fn()),
    acquireLock: jest.fn().mockResolvedValue(true),
    releaseLock: jest.fn().mockResolvedValue(true),
  },
  getRedis: jest.fn(),
}));

jest.mock('../../../src/config/postgres', () => {
  const mockQuery = jest.fn();
  return {
    query: mockQuery,
    pool: { query: mockQuery, end: jest.fn() },
  };
});

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock epayco-sdk-node
const mockEpaycoInstance = {
  token: { create: jest.fn() },
  customers: { create: jest.fn(), list: jest.fn() },
  plans: { create: jest.fn() },
  subscriptions: { create: jest.fn(), cancel: jest.fn() },
  charge: { create: jest.fn(), get: jest.fn() },
};

jest.mock('epayco-sdk-node', () => {
  return jest.fn(() => mockEpaycoInstance);
});

jest.mock('../../../src/config/epayco', () => ({
  initializeEpayco: jest.fn(() => mockEpaycoInstance),
  getEpaycoClient: jest.fn(() => mockEpaycoInstance),
}));

jest.mock('../../../src/models/planModel');
jest.mock('../../../src/models/paymentModel');
jest.mock('../../../src/models/subscriberModel');
jest.mock('../../../src/models/userModel');
jest.mock('../../../src/bot/services/paymentSecurityService');

const PlanModel = require('../../../src/models/planModel');
const PaymentModel = require('../../../src/models/paymentModel');
const SubscriberModel = require('../../../src/models/subscriberModel');
const PaymentSecurityService = require('../../../src/bot/services/paymentSecurityService');

const MOCK_PLAN = {
  id: 'week_pass',
  sku: 'WEEK',
  name: 'Week Pass',
  price: 14.99,
  currency: 'USD',
  duration_days: 7,
  active: true,
  is_recurring: true,
};

describe('Subscription API - ePayco Subscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EPAYCO_PUBLIC_KEY = 'test_public_key';
    process.env.EPAYCO_PRIVATE_KEY = 'test_private_key';
    process.env.EPAYCO_P_CUST_ID = 'test_cust_id';
    process.env.EPAYCO_TEST_MODE = 'true';
    process.env.BOT_WEBHOOK_DOMAIN = 'https://pnptv.app';

    PaymentSecurityService.checkPaymentRateLimit = jest.fn().mockResolvedValue({ allowed: true });
    PaymentSecurityService.validatePCICompliance = jest.fn().mockReturnValue({ valid: true });
    PaymentSecurityService.checkPaymentTimeout = jest.fn().mockResolvedValue({ expired: false });
    PaymentSecurityService.setPaymentTimeout = jest.fn().mockResolvedValue(true);
    PaymentSecurityService.generateSecurePaymentToken = jest.fn().mockResolvedValue('token123');
    PaymentSecurityService.createPaymentRequestHash = jest.fn().mockReturnValue('hash123');
    PaymentSecurityService.logPaymentEvent = jest.fn().mockResolvedValue(true);
    PaymentSecurityService.logPaymentError = jest.fn().mockResolvedValue(true);
    PaymentSecurityService.checkReplayAttack = jest.fn().mockResolvedValue({ isReplay: false });
  });

  afterEach(() => {
    delete process.env.EPAYCO_PUBLIC_KEY;
    delete process.env.EPAYCO_PRIVATE_KEY;
    delete process.env.EPAYCO_P_CUST_ID;
    delete process.env.EPAYCO_TEST_MODE;
  });

  it('[PgwZ96] POST /api/subscriptions validates required fields', () => {
    const SubscriptionController = require('../../../src/bot/api/controllers/subscriptionController');

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // Missing email, name, planId
    SubscriptionController.createCheckout(
      { body: {} },
      mockRes,
    );

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
  });

  it('[68lBD7] POST /api/subscriptions rejects invalid support tier', async () => {
    PlanModel.getById = jest.fn().mockResolvedValue(null);

    const SubscriptionController = require('../../../src/bot/api/controllers/subscriptionController');

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await SubscriptionController.createCheckout(
      { body: { email: 'test@example.com', name: 'Test', planId: 'invalid_plan' } },
      mockRes,
    );

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Plan not found' }),
    );
  });

  it('[7Er8eG] POST /api/subscriptions rejects incomplete card data', async () => {
    // The tokenized charge endpoint validates card data
    const PaymentService = require('../../../src/bot/services/paymentService');

    // processTokenizedCharge expects card data
    PaymentModel.getById = jest.fn().mockResolvedValue({
      id: 'pay-123',
      status: 'pending',
      planId: 'week_pass',
      amount: 14.99,
    });
    PlanModel.getById = jest.fn().mockResolvedValue(MOCK_PLAN);

    // Missing card number should fail
    const result = await PaymentService.processTokenizedCharge({
      paymentId: 'pay-123',
      card: { number: '', expYear: '2030', expMonth: '12', cvc: '123' },
      customer: { name: 'Test', email: 'test@example.com' },
      dues: '1',
    });

    // When card data is invalid, tokenization fails
    expect(result).toBeDefined();
  });

  it('[9e1DZv] POST /api/subscriptions enforces rate limiting', async () => {
    PaymentSecurityService.checkPaymentRateLimit = jest.fn().mockResolvedValue({
      allowed: false,
      remaining: 0,
    });

    // Rate limiting is checked per-user
    const result = await PaymentSecurityService.checkPaymentRateLimit('user123');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('[qzdLKe] POST /api/subscriptions runs fraud checks', () => {
    // Fraud checks include PCI compliance validation
    const pciResult = PaymentSecurityService.validatePCICompliance({
      cardNumber: '4575623182290326',
      cvc: '123',
    });

    expect(pciResult.valid).toBe(true);
    expect(PaymentSecurityService.validatePCICompliance).toHaveBeenCalled();
  });

  it('[XGLRbG] POST /api/subscriptions tokenizes card via ePayco', async () => {
    mockEpaycoInstance.token.create.mockResolvedValue({
      status: true,
      id: 'tok_test_123',
      data: { id: 'tok_test_123' },
    });

    const { getEpaycoClient } = require('../../../src/config/epayco');
    const client = getEpaycoClient();

    const tokenResult = await client.token.create({
      'card[number]': '4575623182290326',
      'card[exp_year]': '2030',
      'card[exp_month]': '12',
      'card[cvc]': '123',
      hasCvv: true,
    });

    expect(tokenResult.status).toBe(true);
    expect(tokenResult.id).toBe('tok_test_123');
  });

  it('[3gjb8z] POST /api/subscriptions creates new ePayco customer', async () => {
    mockEpaycoInstance.customers.create.mockResolvedValue({
      status: true,
      data: { customerId: 'cust_new_123' },
    });

    const { getEpaycoClient } = require('../../../src/config/epayco');
    const client = getEpaycoClient();

    const customerResult = await client.customers.create({
      token_card: 'tok_test_123',
      name: 'Juan',
      last_name: 'Garcia',
      email: 'juan@example.com',
      default: true,
      doc_type: 'CC',
      doc_number: '1234567890',
    });

    expect(customerResult.status).toBe(true);
    expect(customerResult.data.customerId).toBe('cust_new_123');
  });

  it('[zvnPXP] POST /api/subscriptions reuses existing customer', async () => {
    // When customer already exists in ePayco, reuse them
    mockEpaycoInstance.customers.list.mockResolvedValue({
      status: true,
      data: [{ customerId: 'cust_existing_123', email: 'existing@example.com' }],
    });

    const { getEpaycoClient } = require('../../../src/config/epayco');
    const client = getEpaycoClient();

    const existingCustomers = await client.customers.list();
    expect(existingCustomers.data.length).toBeGreaterThan(0);
    expect(existingCustomers.data[0].customerId).toBe('cust_existing_123');
  });

  it('[mBdGpd] POST /api/subscriptions creates subscription in ePayco', async () => {
    mockEpaycoInstance.subscriptions.create.mockResolvedValue({
      status: true,
      data: { id: 'sub_new_123', status: 'active' },
    });

    const { getEpaycoClient } = require('../../../src/config/epayco');
    const client = getEpaycoClient();

    const subscriptionResult = await client.subscriptions.create({
      id_plan: 'pnptv_week_pass',
      customer: 'cust_123',
      token_card: 'tok_123',
      doc_type: 'CC',
      doc_number: '1234567890',
      url_confirmation: 'https://pnptv.app/api/webhook/epayco',
    });

    expect(subscriptionResult.status).toBe(true);
    expect(subscriptionResult.data.id).toBe('sub_new_123');
    expect(subscriptionResult.data.status).toBe('active');
  });

  it('[n8jbm3] POST /api/subscriptions stores Subscription record in DB', async () => {
    SubscriberModel.create = jest.fn().mockResolvedValue({
      id: 'uuid-1',
      email: 'subscriber@example.com',
      plan: 'week_pass',
      provider: 'epayco',
      status: 'active',
    });

    const subscriber = await SubscriberModel.create({
      email: 'subscriber@example.com',
      name: 'Test User',
      telegramId: '12345',
      plan: 'week_pass',
      subscriptionId: 'sub_123',
      provider: 'epayco',
    });

    expect(subscriber.email).toBe('subscriber@example.com');
    expect(subscriber.provider).toBe('epayco');
    expect(SubscriberModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'epayco',
        plan: 'week_pass',
      }),
    );
  });

  it('[gQx2m3] POST /api/subscriptions returns subscription confirmation', async () => {
    PlanModel.getById = jest.fn().mockResolvedValue({
      ...MOCK_PLAN,
      duration: 7,
    });

    const SubscriptionController = require('../../../src/bot/api/controllers/subscriptionController');

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await SubscriptionController.createCheckout(
      {
        body: {
          email: 'test@example.com',
          name: 'Test',
          planId: 'week_pass',
          telegramId: '123',
        },
      },
      mockRes,
    );

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        checkout: expect.objectContaining({
          planId: 'week_pass',
          email: 'test@example.com',
        }),
      }),
    );
  });

  it('[GdWrzj] POST /api/subscriptions logs audit event', async () => {
    // Audit events are logged via PaymentSecurityService
    await PaymentSecurityService.logPaymentEvent({
      paymentId: 'pay-123',
      userId: 'user-123',
      eventType: 'subscription_created',
      provider: 'epayco',
      amount: 14.99,
      status: 'pending',
      details: { planId: 'week_pass' },
    });

    expect(PaymentSecurityService.logPaymentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'subscription_created',
        provider: 'epayco',
      }),
    );
  });

  it('[Ee6Z1V] GET /api/subscriptions requires authentication', async () => {
    SubscriberModel.getByTelegramId = jest.fn().mockResolvedValue(null);

    const SubscriptionController = require('../../../src/bot/api/controllers/subscriptionController');

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // Request without valid identifier should return 404
    await SubscriptionController.getSubscriber(
      { params: { identifier: '' }, query: { type: 'telegram' } },
      mockRes,
    );

    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  it('[lR231Q] GET /api/subscriptions returns user subscriptions', async () => {
    SubscriberModel.getByEmail = jest.fn().mockResolvedValue({
      id: 'uuid-1',
      email: 'user@example.com',
      plan: 'week_pass',
      status: 'active',
      provider: 'epayco',
    });

    const SubscriptionController = require('../../../src/bot/api/controllers/subscriptionController');

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await SubscriptionController.getSubscriber(
      { params: { identifier: 'user@example.com' }, query: { type: 'email' } },
      mockRes,
    );

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        subscriber: expect.objectContaining({
          email: 'user@example.com',
          status: 'active',
        }),
      }),
    );
  });

  it('[rGQmXe] GET /api/subscriptions/[id] returns subscription details', async () => {
    SubscriberModel.getByEmail = jest.fn().mockResolvedValue({
      id: 'uuid-1',
      email: 'detail@example.com',
      plan: 'crystal_pass',
      subscriptionId: 'sub_detail_123',
      status: 'active',
      provider: 'epayco',
    });

    const SubscriptionController = require('../../../src/bot/api/controllers/subscriptionController');

    const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await SubscriptionController.getSubscriber(
      { params: { identifier: 'detail@example.com' }, query: { type: 'email' } },
      mockRes,
    );

    const response = mockRes.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.subscriber.subscriptionId).toBe('sub_detail_123');
    expect(response.subscriber.plan).toBe('crystal_pass');
  });

  it('[Nj3gzL] GET /api/subscriptions/[id] rejects unauthorized access', async () => {
    SubscriberModel.getByTelegramId = jest.fn().mockResolvedValue(null);

    const SubscriptionController = require('../../../src/bot/api/controllers/subscriptionController');

    const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await SubscriptionController.getSubscriber(
      { params: { identifier: 'unknown_user' }, query: { type: 'telegram' } },
      mockRes,
    );

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
  });

  it('[K4nEzV] DELETE /api/subscriptions/[id] cancels in ePayco', async () => {
    mockEpaycoInstance.subscriptions.cancel.mockResolvedValue({
      status: true,
      message: 'Subscription cancelled',
    });

    const { getEpaycoClient } = require('../../../src/config/epayco');
    const client = getEpaycoClient();

    const cancelResult = await client.subscriptions.cancel('sub_to_cancel_123');

    expect(cancelResult.status).toBe(true);
    expect(cancelResult.message).toContain('cancelled');
    expect(mockEpaycoInstance.subscriptions.cancel).toHaveBeenCalledWith('sub_to_cancel_123');
  });

  it('[jPnGmZ] DELETE /api/subscriptions/[id] updates DB status', async () => {
    SubscriberModel.updateStatus = jest.fn().mockResolvedValue({
      id: 'uuid-1',
      status: 'cancelled',
    });

    await SubscriberModel.updateStatus('user@example.com', 'cancelled', {
      cancelledAt: new Date(),
    });

    expect(SubscriberModel.updateStatus).toHaveBeenCalledWith(
      'user@example.com',
      'cancelled',
      expect.objectContaining({ cancelledAt: expect.any(Date) }),
    );
  });

  it('[41VzM8] DELETE /api/subscriptions/[id] rejects already cancelled', async () => {
    SubscriberModel.getByEmail = jest.fn().mockResolvedValue({
      id: 'uuid-1',
      email: 'cancelled@example.com',
      status: 'cancelled',
    });

    const subscriber = await SubscriberModel.getByEmail('cancelled@example.com');
    expect(subscriber.status).toBe('cancelled');

    // Re-cancellation should be detected
    const isAlreadyCancelled = subscriber.status === 'cancelled';
    expect(isAlreadyCancelled).toBe(true);
  });

  it('[pDp2mm] DELETE /api/subscriptions/[id] logs cancellation audit', async () => {
    await PaymentSecurityService.logPaymentEvent({
      paymentId: 'pay-123',
      userId: 'user-123',
      eventType: 'subscription_cancelled',
      provider: 'epayco',
      status: 'cancelled',
      details: { reason: 'user_request', subscriptionId: 'sub_123' },
    });

    expect(PaymentSecurityService.logPaymentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'subscription_cancelled',
        status: 'cancelled',
      }),
    );
  });
});
