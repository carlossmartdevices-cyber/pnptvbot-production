const PaymentService = require('../../../src/bot/services/paymentService');
const PlanModel = require('../../../src/models/planModel');
const PaymentModel = require('../../../src/models/paymentModel');

jest.mock('../../../src/models/planModel');
jest.mock('../../../src/models/paymentModel');

describe('PaymentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw error if plan does not exist', async () => {
    PlanModel.getById.mockResolvedValue(null);
    await expect(PaymentService.createPayment({ userId: '1', planId: 'bad', provider: 'epayco', sku: 'sku' }))
      .rejects.toThrow('El plan seleccionado no existe o está inactivo.');
  });

  it('should throw error if plan is inactive', async () => {
    PlanModel.getById.mockResolvedValue({ active: false });
    await expect(PaymentService.createPayment({ userId: '1', planId: 'bad', provider: 'epayco', sku: 'sku' }))
      .rejects.toThrow('El plan seleccionado no existe o está inactivo.');
  });

  it('should create payment and return url if plan is valid', async () => {
    PlanModel.getById.mockResolvedValue({ active: true, price: 100 });
    PaymentModel.create.mockResolvedValue({ id: 'pay123' });
    const result = await PaymentService.createPayment({ userId: '1', planId: 'good', provider: 'epayco', sku: 'sku' });
    expect(result.success).toBe(true);
    expect(result.paymentUrl).toContain('epayco.com/pay?paymentId=pay123');
    expect(result.paymentId).toBe('pay123');
  });
});
