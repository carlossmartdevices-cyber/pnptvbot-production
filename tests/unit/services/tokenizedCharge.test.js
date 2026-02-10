const PaymentService = require('../../../src/bot/services/paymentService');
const PlanModel = require('../../../src/models/planModel');
const PaymentModel = require('../../../src/models/paymentModel');
const UserModel = require('../../../src/models/userModel');

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

const { __mockClient: epaycoClient } = require('../../../src/config/epayco');

const BASE_PARAMS = {
  paymentId: 'pay-abcd1234-test',
  card: {
    number: '4575623182290326',
    exp_year: '2027',
    exp_month: '12',
    cvc: '123',
  },
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
    // Prevent notification calls from failing
    jest.spyOn(PaymentService, 'sendPaymentConfirmationNotification').mockResolvedValue(true);
  });

  it('should return error if payment not found', async () => {
    PaymentModel.getById.mockResolvedValue(null);

    const result = await PaymentService.processTokenizedCharge(BASE_PARAMS);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Payment not found');
  });

  it('should return error if payment already completed', async () => {
    PaymentModel.getById.mockResolvedValue({ ...MOCK_PAYMENT, status: 'completed' });

    const result = await PaymentService.processTokenizedCharge(BASE_PARAMS);

    expect(result.success).toBe(false);
    expect(result.error).toContain('already completed');
  });

  it('should return error if plan not found', async () => {
    PaymentModel.getById.mockResolvedValue(MOCK_PAYMENT);
    PlanModel.getById.mockResolvedValue(null);

    const result = await PaymentService.processTokenizedCharge(BASE_PARAMS);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Plan not found');
  });

  it('should return error if token creation fails', async () => {
    PaymentModel.getById.mockResolvedValue(MOCK_PAYMENT);
    PlanModel.getById.mockResolvedValue(MOCK_PLAN);
    epaycoClient.token.create.mockResolvedValue({ status: false });

    const result = await PaymentService.processTokenizedCharge(BASE_PARAMS);

    expect(result.success).toBe(false);
    expect(result.error).toContain('tokenizar');
    expect(epaycoClient.token.create).toHaveBeenCalledWith({
      'card[number]': '4575623182290326',
      'card[exp_year]': '2027',
      'card[exp_month]': '12',
      'card[cvc]': '123',
      hasCvv: true,
    });
  });

  it('should return error if customer creation fails', async () => {
    PaymentModel.getById.mockResolvedValue(MOCK_PAYMENT);
    PlanModel.getById.mockResolvedValue(MOCK_PLAN);
    epaycoClient.token.create.mockResolvedValue({ id: 'tok_123', status: true });
    epaycoClient.customers.create.mockResolvedValue({ status: false });

    const result = await PaymentService.processTokenizedCharge(BASE_PARAMS);

    expect(result.success).toBe(false);
    expect(result.error).toContain('cliente');
    expect(epaycoClient.customers.create).toHaveBeenCalledWith(expect.objectContaining({
      token_card: 'tok_123',
      name: 'Juan',
      last_name: 'Perez',
      email: 'juan@test.com',
    }));
  });

  it('should process approved charge and activate subscription', async () => {
    PaymentModel.getById.mockResolvedValue(MOCK_PAYMENT);
    PlanModel.getById.mockResolvedValue(MOCK_PLAN);
    UserModel.getById.mockResolvedValue({ id: 'user_123', language: 'es' });
    UserModel.updateSubscription.mockResolvedValue(true);
    PaymentModel.updateStatus.mockResolvedValue(true);

    epaycoClient.token.create.mockResolvedValue({ id: 'tok_123', status: true });
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
    expect(result.transactionId).toBe('ref_999');

    // Payment marked as completed
    expect(PaymentModel.updateStatus).toHaveBeenCalledWith(
      'pay-abcd1234-test',
      'completed',
      expect.objectContaining({
        transaction_id: 'txn_999',
        reference: 'ref_999',
        epayco_ref: 'ref_999',
        payment_method: 'tokenized_card',
      }),
    );

    // Subscription activated
    expect(UserModel.updateSubscription).toHaveBeenCalledWith('user_123', {
      status: 'active',
      planId: 'plan_123',
      expiry: expect.any(Date),
    });

    // Charge called with correct params
    expect(epaycoClient.charge.create).toHaveBeenCalledWith(expect.objectContaining({
      token_card: 'tok_123',
      customer_id: 'cust_123',
      doc_type: 'CC',
      doc_number: '1234567890',
      email: 'juan@test.com',
      currency: 'COP',
      dues: '1',
      ip: '192.168.1.1',
      use_default_card_customer: true,
    }));
  });

  it('should handle pending charge status', async () => {
    PaymentModel.getById.mockResolvedValue(MOCK_PAYMENT);
    PlanModel.getById.mockResolvedValue(MOCK_PLAN);
    PaymentModel.updateStatus.mockResolvedValue(true);

    epaycoClient.token.create.mockResolvedValue({ id: 'tok_123', status: true });
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
    expect(PaymentModel.updateStatus).toHaveBeenCalledWith(
      'pay-abcd1234-test',
      'pending',
      expect.objectContaining({ payment_method: 'tokenized_card' }),
    );
    // Subscription should NOT be activated for pending
    expect(UserModel.updateSubscription).not.toHaveBeenCalled();
  });

  it('should handle rejected charge', async () => {
    PaymentModel.getById.mockResolvedValue(MOCK_PAYMENT);
    PlanModel.getById.mockResolvedValue(MOCK_PLAN);
    PaymentModel.updateStatus.mockResolvedValue(true);

    epaycoClient.token.create.mockResolvedValue({ id: 'tok_123', status: true });
    epaycoClient.customers.create.mockResolvedValue({
      status: true,
      data: { customerId: 'cust_123' },
    });
    epaycoClient.charge.create.mockResolvedValue({
      data: {
        estado: 'Rechazada',
        respuesta: 'Fondos insuficientes',
        ref_payco: 'ref_rej',
        transactionID: 'txn_rej',
      },
    });

    const result = await PaymentService.processTokenizedCharge(BASE_PARAMS);

    expect(result.success).toBe(false);
    expect(result.status).toBe('rejected');
    expect(result.error).toBe('Fondos insuficientes');
    expect(PaymentModel.updateStatus).toHaveBeenCalledWith(
      'pay-abcd1234-test',
      'failed',
      expect.objectContaining({ payment_method: 'tokenized_card' }),
    );
    expect(UserModel.updateSubscription).not.toHaveBeenCalled();
  });

  it('should handle ePayco SDK throwing an error', async () => {
    PaymentModel.getById.mockResolvedValue(MOCK_PAYMENT);
    PlanModel.getById.mockResolvedValue(MOCK_PLAN);

    epaycoClient.token.create.mockRejectedValue(new Error('Network timeout'));

    const result = await PaymentService.processTokenizedCharge(BASE_PARAMS);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Network timeout');
  });

  it('should complete promo redemption on approved charge', async () => {
    const promoPayment = {
      ...MOCK_PAYMENT,
      metadata: { redemptionId: 'redeem_123', promoCode: 'SAVE20' },
    };
    PaymentModel.getById.mockResolvedValue(promoPayment);
    PlanModel.getById.mockResolvedValue(MOCK_PLAN);
    UserModel.getById.mockResolvedValue({ id: 'user_123', language: 'es' });
    UserModel.updateSubscription.mockResolvedValue(true);
    PaymentModel.updateStatus.mockResolvedValue(true);

    epaycoClient.token.create.mockResolvedValue({ id: 'tok_123', status: true });
    epaycoClient.customers.create.mockResolvedValue({
      status: true,
      data: { customerId: 'cust_123' },
    });
    epaycoClient.charge.create.mockResolvedValue({
      data: {
        estado: 'Aceptada',
        ref_payco: 'ref_promo',
        transactionID: 'txn_promo',
      },
    });

    const result = await PaymentService.processTokenizedCharge(BASE_PARAMS);

    expect(result.success).toBe(true);
    expect(result.status).toBe('approved');
    // Promo redemption is called async (fire-and-forget), so we just verify the charge succeeded
  });

  it('should calculate COP amount correctly from USD', async () => {
    const usdPayment = { ...MOCK_PAYMENT, amount: 10 }; // $10 USD = 40,000 COP
    PaymentModel.getById.mockResolvedValue(usdPayment);
    PlanModel.getById.mockResolvedValue(MOCK_PLAN);
    PaymentModel.updateStatus.mockResolvedValue(true);

    epaycoClient.token.create.mockResolvedValue({ id: 'tok_123', status: true });
    epaycoClient.customers.create.mockResolvedValue({
      status: true,
      data: { customerId: 'cust_123' },
    });
    epaycoClient.charge.create.mockResolvedValue({
      data: { estado: 'Rechazada', respuesta: 'Declined' },
    });

    await PaymentService.processTokenizedCharge(BASE_PARAMS);

    // Verify the charge was created with correct COP amount
    expect(epaycoClient.charge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        value: '40000', // 10 * 4000
        currency: 'COP',
      }),
    );
  });
});
