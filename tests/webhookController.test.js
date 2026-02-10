jest.mock('../src/bot/services/paymentService');
jest.mock('../src/utils/logger');
jest.mock('../src/models/paymentWebhookEventModel', () => ({
  logEvent: jest.fn().mockResolvedValue(true),
}));
jest.mock('../src/config/redis', () => ({
  cache: {
    acquireLock: jest.fn().mockResolvedValue(true),
    releaseLock: jest.fn().mockResolvedValue(true),
  },
}));
jest.mock('../src/bot/services/paymentSecurityService', () => ({
  checkReplayAttack: jest.fn().mockResolvedValue({ isReplay: false }),
  logPaymentError: jest.fn().mockResolvedValue(true),
}));
jest.mock('../src/validation/schemas/payment.schema', () => ({
  schemas: {
    epaycoWebhook: {
      validate: jest.fn().mockReturnValue({ error: null }),
    },
  },
}));

const PaymentService = require('../src/bot/services/paymentService');
const { cache } = require('../src/config/redis');
const { handleEpaycoWebhook } = require('../src/bot/api/controllers/webhookController');

const basePayload = {
  x_transaction_id: 'txn_123',
  x_ref_payco: 'ref_123',
  x_transaction_state: 'Aceptada',
  x_extra1: 'user-1',
  x_extra2: 'plan-1',
  x_extra3: 'payment-1',
  x_signature: 'signature',
};

const createRes = () => {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
};

describe('handleEpaycoWebhook', () => {
  jest.setTimeout(10000);

  beforeEach(() => {
    jest.clearAllMocks();
    PaymentService.processEpaycoWebhook.mockResolvedValue({ success: true });
    PaymentService.verifyEpaycoSignature.mockReturnValue({ valid: true });
  });

  test('rejects when ref_payco is missing', async () => {
    const req = { body: { ...basePayload, x_ref_payco: undefined } };
    const res = createRes();

    await handleEpaycoWebhook(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      code: 'MISSING_REF_PAYCO',
    });
  });

  test('rejects when signature is missing', async () => {
    PaymentService.verifyEpaycoSignature.mockReturnValueOnce({
      valid: false,
      reason: 'missing_signature',
      error: 'Missing signature',
    });
    const req = { body: { ...basePayload, x_signature: undefined } };
    const res = createRes();

    await handleEpaycoWebhook(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      code: 'INVALID_SIGNATURE',
    });
  });

  test('rejects when signature is invalid', async () => {
    PaymentService.verifyEpaycoSignature.mockReturnValueOnce({
      valid: false,
      reason: 'invalid_signature',
      error: 'Invalid signature',
    });
    const req = { body: basePayload };
    const res = createRes();

    await handleEpaycoWebhook(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      code: 'INVALID_SIGNATURE',
    });
  });

  test('marks duplicate webhooks after successful processing', async () => {
    // First call succeeds (lock acquired)
    cache.acquireLock.mockResolvedValueOnce(true);
    // Second call fails (lock already held = duplicate)
    cache.acquireLock.mockResolvedValueOnce(false);

    const req = { body: basePayload };
    const res1 = createRes();
    const res2 = createRes();

    await handleEpaycoWebhook(req, res1);
    await handleEpaycoWebhook(req, res2);

    expect(res1.statusCode).toBe(200);
    expect(res1.body).toMatchObject({ success: true });
    expect(res2.statusCode).toBe(200);
    expect(res2.body).toMatchObject({ success: true, duplicate: true });
  });

  afterAll(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });
});
