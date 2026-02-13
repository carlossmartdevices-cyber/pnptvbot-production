jest.mock('../../../src/config/redis', () => ({
  cache: {
    acquireLock: jest.fn().mockResolvedValue(true),
    releaseLock: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../../../src/models/planModel');
jest.mock('../../../src/models/paymentModel');
jest.mock('../../../src/models/userModel');
jest.mock('../../../src/config/epayco', () => {
  const mockEpaycoClient = {
    token: { create: jest.fn() },
    customers: { create: jest.fn() },
    charge: { create: jest.fn() },
  };
  return {
    getEpaycoClient: jest.fn(() => mockEpaycoClient),
    __mockClient: mockEpaycoClient,
  };
});
jest.mock('../../../src/bot/services/businessNotificationService', () => ({
  notifyPayment: jest.fn().mockResolvedValue(true),
}));

const PaymentService = require('../../../src/bot/services/paymentService');
const PlanModel = require('../../../src/models/planModel');
const PaymentModel = require('../../../src/models/paymentModel');
const UserModel = require('../../../src/models/userModel');
const { cache } = require('../../../src/config/redis');
const { __mockClient: epaycoClient } = require('../../../src/config/epayco');

const BASE_PARAMS = {
  paymentId: 'pay-abcd1234-test',
  tokenCard: 'tok_1234567890',
  customer: {
    name: 'Juan',
    last_name: 'Perez',
    email: 'juan@test.com',
    doc_type: 'CC',
    doc_number: '1234567890',
    city: 'Bogota',
    address: 'Cra 1 #2-3',
    phone: '3001234567',
    cell_phone: '3001234567',
  },
  dues: '1',
  ip: '192.168.1.1',
  browserInfo: {
    language: 'es-CO',
    colorDepth: 24,
    screenHeight: 1080,
    screenWidth: 1920,
    timezoneOffset: 300,
  },
  userAgent: 'Mozilla/5.0 Test',
  acceptHeader: 'application/json',
};

const MOCK_PAYMENT = {
  id: 'pay-abcd1234-test',
  userId: 'user_123',
  user_id: 'user_123',
  planId: 'plan_123',
  plan_id: 'plan_123',
  amount: 24.99,
  status: 'pending',
  metadata: {},
};

const MOCK_PLAN = {
  id: 'plan_123',
  name: 'Monthly Pass',
  display_name: 'Monthly Pass',
  sku: 'MONTHLY',
  price: 24.99,
  duration: 30,
  duration_days: 30,
  active: true,
};

describe('PaymentService.processTokenizedCharge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EPAYCO_WEBHOOK_DOMAIN = 'https://test.easybots.store';
    process.env.BOT_WEBHOOK_DOMAIN = 'https://test.pnptv.app';
    jest.spyOn(PaymentService, 'sendPaymentConfirmationNotification').mockResolvedValue(true);
  });

  it('returns processing when lock is not acquired', async () => {
    cache.acquireLock.mockResolvedValueOnce(false);
    const result = await PaymentService.processTokenizedCharge(BASE_PARAMS);
    expect(result.success).toBe(false);
    expect(result.status).toBe('processing');
  });

  it('returns error if payment is missing', async () => {
    PaymentModel.getById.mockResolvedValue(null);
    const result = await PaymentService.processTokenizedCharge(BASE_PARAMS);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Payment not found');
  });

  it('returns idempotent success if payment is already completed', async () => {
    PaymentModel.getById.mockResolvedValue({ ...MOCK_PAYMENT, status: 'completed', epaycoRef: 'ref_done' });
    const result = await PaymentService.processTokenizedCharge(BASE_PARAMS);
    expect(result.success).toBe(true);
    expect(result.status).toBe('approved');
    expect(result.transactionId).toBe('ref_done');
  });

  it('rejects requests without tokenCard', async () => {
    PaymentModel.getById.mockResolvedValue(MOCK_PAYMENT);
    PlanModel.getById.mockResolvedValue(MOCK_PLAN);
    const result = await PaymentService.processTokenizedCharge({
      ...BASE_PARAMS,
      tokenCard: null,
      card: { number: '4575623182290326' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Token de tarjeta inválido');
  });

  it('returns error when customer creation fails', async () => {
    PaymentModel.getById.mockResolvedValue(MOCK_PAYMENT);
    PlanModel.getById.mockResolvedValue(MOCK_PLAN);
    epaycoClient.customers.create.mockResolvedValue({ status: false });

    const result = await PaymentService.processTokenizedCharge(BASE_PARAMS);

    expect(result.success).toBe(false);
    expect(result.error).toContain('cliente');
  });

  it('approves charge, activates subscription and sends browser_info', async () => {
    PaymentModel.getById.mockResolvedValue(MOCK_PAYMENT);
    PlanModel.getById.mockResolvedValue(MOCK_PLAN);
    UserModel.getById.mockResolvedValue({ id: 'user_123', language: 'es' });
    UserModel.updateSubscription.mockResolvedValue(true);
    PaymentModel.updateStatus.mockResolvedValue(true);

    epaycoClient.customers.create.mockResolvedValue({
      status: true,
      data: { customerId: 'cust_123' },
    });
    epaycoClient.charge.create.mockResolvedValue({
      data: {
        estado: 'Aceptada',
        respuesta: 'Aprobada',
        ref_payco: 'ref_999',
        transactionID: 'txn_999',
      },
    });

    const result = await PaymentService.processTokenizedCharge(BASE_PARAMS);

    expect(result.success).toBe(true);
    expect(result.status).toBe('approved');
    expect(UserModel.updateSubscription).toHaveBeenCalledWith('user_123', {
      status: 'active',
      planId: 'plan_123',
      expiry: expect.any(Date),
    });
    expect(epaycoClient.charge.create).toHaveBeenCalledWith(expect.objectContaining({
      token_card: 'tok_1234567890',
      customer_id: 'cust_123',
      currency: 'COP',
      browser_info: expect.objectContaining({
        language: 'es-CO',
        user_agent: expect.any(String),
      }),
      ip: '192.168.1.1',
    }));
  });

  it('reuses persisted customer id for retry idempotency', async () => {
    PaymentModel.getById.mockResolvedValue({
      ...MOCK_PAYMENT,
      metadata: { epayco_customer_id: 'cust_existing' },
    });
    PlanModel.getById.mockResolvedValue(MOCK_PLAN);
    PaymentModel.updateStatus.mockResolvedValue(true);
    epaycoClient.charge.create.mockResolvedValue({
      data: { estado: 'Rechazada', respuesta: 'Declined' },
    });

    await PaymentService.processTokenizedCharge(BASE_PARAMS);

    expect(epaycoClient.customers.create).not.toHaveBeenCalled();
    expect(epaycoClient.charge.create).toHaveBeenCalledWith(expect.objectContaining({
      customer_id: 'cust_existing',
    }));
  });

  it('returns pending with redirect URL when bank challenge is required', async () => {
    PaymentModel.getById.mockResolvedValue(MOCK_PAYMENT);
    PlanModel.getById.mockResolvedValue(MOCK_PLAN);
    PaymentModel.updateStatus.mockResolvedValue(true);
    epaycoClient.customers.create.mockResolvedValue({
      status: true,
      data: { customerId: 'cust_123' },
    });
    epaycoClient.charge.create.mockResolvedValue({
      data: {
        estado: 'Pendiente',
        ref_payco: 'ref_pend',
        transactionID: 'txn_pend',
        urlbanco: 'https://bank.epayco.co/3ds/test123',
      },
    });

    const result = await PaymentService.processTokenizedCharge(BASE_PARAMS);

    expect(result.success).toBe(true);
    expect(result.status).toBe('pending');
    expect(result.redirectUrl).toBe('https://bank.epayco.co/3ds/test123');
  });
});
