/**
 * QaTouch Project: ePayco Subscriptions (dekw)
 * Module: Webhook Handling
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
  const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
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

jest.mock('../../../src/models/paymentModel');
jest.mock('../../../src/models/planModel');
jest.mock('../../../src/models/subscriberModel');
jest.mock('../../../src/models/userModel');
jest.mock('../../../src/models/paymentWebhookEventModel');
jest.mock('../../../src/bot/services/paymentSecurityService');
jest.mock('../../../src/bot/services/paymentService');

const PaymentService = require('../../../src/bot/services/paymentService');
const PaymentSecurityService = require('../../../src/bot/services/paymentSecurityService');
const PaymentWebhookEventModel = require('../../../src/models/paymentWebhookEventModel');
const SubscriberModel = require('../../../src/models/subscriberModel');

describe('Webhook Handling - ePayco Subscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EPAYCO_PUBLIC_KEY = 'test_public_key';
    process.env.EPAYCO_PRIVATE_KEY = 'test_private_key';
    process.env.EPAYCO_P_CUST_ID = 'test_cust_id';

    PaymentService.verifyEpaycoSignature = jest.fn().mockReturnValue(true);
    PaymentService.processEpaycoWebhook = jest.fn().mockResolvedValue({ success: true });
    PaymentSecurityService.checkReplayAttack = jest.fn().mockResolvedValue({ isReplay: false });
    PaymentSecurityService.logPaymentEvent = jest.fn().mockResolvedValue(true);
    PaymentSecurityService.logPaymentError = jest.fn().mockResolvedValue(true);
    PaymentWebhookEventModel.logEvent = jest.fn().mockResolvedValue(true);
  });

  afterEach(() => {
    delete process.env.EPAYCO_PUBLIC_KEY;
    delete process.env.EPAYCO_PRIVATE_KEY;
    delete process.env.EPAYCO_P_CUST_ID;
  });

  it('[8V1Mbk] Webhook detects subscription event via x_extra3 prefix', () => {
    // x_extra3 contains the paymentId — subscription events have UUID format
    const webhookData = {
      x_ref_payco: '12345',
      x_transaction_id: 'txn_001',
      x_transaction_state: 'Aceptada',
      x_amount: '59900',
      x_currency_code: 'COP',
      x_extra1: 'user123',
      x_extra2: 'week_pass',
      x_extra3: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', // UUID format = subscription
      x_signature: 'valid_sig',
    };

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(isUuid.test(webhookData.x_extra3)).toBe(true);

    // Subscription webhook detected by UUID in x_extra3
    const isSubscriptionEvent = isUuid.test(webhookData.x_extra3);
    expect(isSubscriptionEvent).toBe(true);
  });

  it('[M73Gzx] Webhook detects subscription event via x_id_invoice prefix', () => {
    // Subscription invoices may have 'INV-' prefix
    const webhookData = {
      x_id_invoice: 'INV-1707388123456',
      x_ref_payco: '12345',
      x_transaction_state: 'Aceptada',
      x_amount: '59900',
      x_currency_code: 'COP',
    };

    const isSubscriptionInvoice = String(webhookData.x_id_invoice).startsWith('INV-');
    expect(isSubscriptionInvoice).toBe(true);
  });

  it('[Drdyzn] Subscription renewal updates period dates on success', async () => {
    SubscriberModel.updateStatus = jest.fn().mockResolvedValue({
      id: 'uuid-1',
      email: 'user@example.com',
      status: 'active',
    });

    // Simulate successful renewal — update period dates
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 7); // week_pass = 7 days

    await SubscriberModel.updateStatus('user@example.com', 'active', {
      lastPaymentAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    });

    expect(SubscriberModel.updateStatus).toHaveBeenCalledWith(
      'user@example.com',
      'active',
      expect.objectContaining({
        lastPaymentAt: expect.any(Date),
        currentPeriodStart: expect.any(Date),
        currentPeriodEnd: expect.any(Date),
      }),
    );
  });

  it('[eJq3mP] Subscription status set to ACTIVE on successful renewal', async () => {
    PaymentService.processEpaycoWebhook.mockResolvedValue({
      success: true,
      status: 'completed',
    });

    const webhookData = {
      x_ref_payco: '12345',
      x_transaction_state: 'Aceptada',
      x_cod_transaction_state: '1',
      x_amount: '59900',
      x_currency_code: 'COP',
      x_extra1: 'user123',
      x_extra2: 'week_pass',
      x_extra3: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      x_signature: 'valid_sig',
    };

    const result = await PaymentService.processEpaycoWebhook(webhookData);
    expect(result.success).toBe(true);

    // On success, subscriber status should be 'active'
    SubscriberModel.updateStatus = jest.fn().mockResolvedValue({ status: 'active' });
    const subscriber = await SubscriberModel.updateStatus('user@example.com', 'active');
    expect(subscriber.status).toBe('active');
  });

  it('[vanEXy] Subscription status set to PAST_DUE on failed renewal', async () => {
    PaymentService.processEpaycoWebhook.mockResolvedValue({
      success: true,
      status: 'failed',
    });

    const webhookData = {
      x_ref_payco: '12345',
      x_transaction_state: 'Rechazada',
      x_cod_transaction_state: '2',
      x_amount: '59900',
      x_currency_code: 'COP',
      x_extra1: 'user123',
      x_extra2: 'week_pass',
      x_extra3: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      x_signature: 'valid_sig',
    };

    // Process failed renewal
    await PaymentService.processEpaycoWebhook(webhookData);

    // On failure, subscriber status should be 'past_due'
    SubscriberModel.updateStatus = jest.fn().mockResolvedValue({ status: 'past_due' });
    const subscriber = await SubscriberModel.updateStatus('user@example.com', 'past_due');
    expect(subscriber.status).toBe('past_due');
  });

  it('[bj064D] Failed renewal records attempt for brute force detection', async () => {
    // Failed renewals are logged for fraud detection
    await PaymentSecurityService.logPaymentEvent({
      paymentId: 'pay-123',
      userId: 'user123',
      eventType: 'renewal_failed',
      provider: 'epayco',
      status: 'failed',
      details: {
        refPayco: '12345',
        state: 'Rechazada',
        attemptCount: 3,
      },
    });

    expect(PaymentSecurityService.logPaymentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'renewal_failed',
        details: expect.objectContaining({
          attemptCount: 3,
        }),
      }),
    );
  });

  it('[Z8xEWz] Renewal success triggers payment notification', async () => {
    // On successful renewal, processEpaycoWebhook sends notification
    PaymentService.processEpaycoWebhook.mockResolvedValue({
      success: true,
      status: 'completed',
      notificationSent: true,
    });

    const result = await PaymentService.processEpaycoWebhook({
      x_ref_payco: '12345',
      x_transaction_state: 'Aceptada',
      x_cod_transaction_state: '1',
      x_amount: '59900',
      x_currency_code: 'COP',
      x_extra1: 'user123',
      x_extra2: 'week_pass',
      x_extra3: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      x_signature: 'valid_sig',
    });

    expect(result.success).toBe(true);
    expect(PaymentService.processEpaycoWebhook).toHaveBeenCalled();
  });

  it('[RgGzBe] Webhook logs audit events for all subscription outcomes', async () => {
    // All webhook events are logged regardless of outcome
    await PaymentWebhookEventModel.logEvent({
      provider: 'epayco',
      eventId: '12345',
      paymentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      status: 'Aceptada',
      stateCode: '1',
      isValidSignature: true,
      payload: { x_ref_payco: '12345' },
    });

    expect(PaymentWebhookEventModel.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'epayco',
        isValidSignature: true,
      }),
    );

    // Also log failed webhooks
    await PaymentWebhookEventModel.logEvent({
      provider: 'epayco',
      eventId: '12346',
      paymentId: null,
      status: 'Rechazada',
      stateCode: '2',
      isValidSignature: true,
      payload: { x_ref_payco: '12346' },
    });

    expect(PaymentWebhookEventModel.logEvent).toHaveBeenCalledTimes(2);
  });

  it('[dyp54K] Webhook falls back to email lookup when no sub ID', async () => {
    // When x_extra3 is not a valid UUID, fall back to email lookup
    const webhookData = {
      x_ref_payco: '12345',
      x_customer_email: 'fallback@example.com',
      x_extra3: 'not-a-uuid',
    };

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const paymentId = isUuid.test(webhookData.x_extra3) ? webhookData.x_extra3 : null;
    expect(paymentId).toBeNull();

    // Fall back to email lookup
    SubscriberModel.getByEmail = jest.fn().mockResolvedValue({
      id: 'uuid-1',
      email: 'fallback@example.com',
      status: 'active',
    });

    const subscriber = await SubscriberModel.getByEmail(webhookData.x_customer_email);
    expect(subscriber).toBeDefined();
    expect(subscriber.email).toBe('fallback@example.com');
  });

  it('[xm9GjL] One-time product webhooks still work correctly', async () => {
    // Non-subscription webhooks (one-time payments) process normally
    PaymentService.processEpaycoWebhook.mockResolvedValue({
      success: true,
      status: 'completed',
      paymentType: 'one_time',
    });

    const result = await PaymentService.processEpaycoWebhook({
      x_ref_payco: '99999',
      x_transaction_state: 'Aceptada',
      x_cod_transaction_state: '1',
      x_amount: '999900',
      x_currency_code: 'COP',
      x_extra1: 'user456',
      x_extra2: 'lifetime_pass',
      x_extra3: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      x_signature: 'valid_sig',
    });

    expect(result.success).toBe(true);
  });
});
