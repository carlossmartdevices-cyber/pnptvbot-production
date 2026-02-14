const PaymentService = require('../../../src/bot/services/paymentService');
const PlanModel = require('../../../src/models/planModel');
const PaymentModel = require('../../../src/models/paymentModel');
const crypto = require('crypto');

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
    PaymentModel.updateStatus.mockResolvedValue({});
    const result = await PaymentService.createPayment({ userId: '1', planId: 'good', provider: 'epayco', sku: 'sku' });
    expect(result.success).toBe(true);
    expect(result.paymentUrl).toContain('/payment/pay123');
    expect(result.paymentId).toBe('pay123');
  });

  it('should generate ePayco checkout signature with caret separators', () => {
    const previousEnv = {
      EPAYCO_P_KEY: process.env.EPAYCO_P_KEY,
      EPAYCO_P_CUST_ID: process.env.EPAYCO_P_CUST_ID,
      EPAYCO_PRIVATE_KEY: process.env.EPAYCO_PRIVATE_KEY,
      EPAYCO_PUBLIC_KEY: process.env.EPAYCO_PUBLIC_KEY,
      NODE_ENV: process.env.NODE_ENV,
    };

    process.env.EPAYCO_P_KEY = 'test_p_key';
    process.env.EPAYCO_P_CUST_ID = 'test_cust_id';
    process.env.NODE_ENV = 'test';

    const invoice = 'PAY-ABCDEFGH';
    const amount = '40000';
    const currencyCode = 'COP';

    const expected = crypto
      .createHash('md5')
      .update(`${process.env.EPAYCO_P_CUST_ID}^${process.env.EPAYCO_P_KEY}^${invoice}^${amount}^${currencyCode}`)
      .digest('hex');

    const signature = PaymentService.generateEpaycoCheckoutSignature({
      invoice,
      amount,
      currencyCode,
    });

    expect(signature).toBe(expected);

    process.env.EPAYCO_P_KEY = previousEnv.EPAYCO_P_KEY;
    process.env.EPAYCO_P_CUST_ID = previousEnv.EPAYCO_P_CUST_ID;
    process.env.EPAYCO_PRIVATE_KEY = previousEnv.EPAYCO_PRIVATE_KEY;
    process.env.EPAYCO_PUBLIC_KEY = previousEnv.EPAYCO_PUBLIC_KEY;
    process.env.NODE_ENV = previousEnv.NODE_ENV;
  });
});
