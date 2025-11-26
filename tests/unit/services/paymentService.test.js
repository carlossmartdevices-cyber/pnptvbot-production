const PaymentService = require('../../../src/bot/services/paymentService');
const PlanModel = require('../../../src/models/planModel');
const PaymentModel = require('../../../src/models/paymentModel');

jest.mock('../../../src/models/planModel');
jest.mock('../../../src/models/paymentModel');

describe('PaymentService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Set up required environment variables
    process.env = {
      ...originalEnv,
      EPAYCO_PUBLIC_KEY: 'test_public_key',
      EPAYCO_TEST_MODE: 'true',
      BOT_WEBHOOK_DOMAIN: 'https://test.example.com'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should throw error if plan does not exist', async () => {
    PlanModel.getById.mockResolvedValue(null);
    await expect(PaymentService.createPayment({ userId: 1, planId: 'bad', provider: 'epayco', sku: 'sku' }))
      .rejects.toThrow('El plan seleccionado no existe o está inactivo.');
  });

  it('should throw error if plan is inactive', async () => {
    PlanModel.getById.mockResolvedValue({ active: false });
    await expect(PaymentService.createPayment({ userId: 1, planId: 'bad', provider: 'epayco', sku: 'sku' }))
      .rejects.toThrow('El plan seleccionado no existe o está inactivo.');
  });

  it('should create payment and return url if plan is valid', async () => {
    PlanModel.getById.mockResolvedValue({ active: true, price: 100 });
    PaymentModel.create.mockResolvedValue({ id: 'pay123' });
    const result = await PaymentService.createPayment({ userId: 1, planId: 'good', provider: 'epayco', sku: 'sku' });
    expect(result.success).toBe(true);
    expect(result.paymentUrl).toBeDefined();
    expect(result.paymentUrl).toContain('pay123');
    expect(result.paymentId).toBe('pay123');
  });
});
