const PaymentService = require('../../../src/bot/services/paymentService');
const PaymentSecurityService = require('../../../src/bot/services/paymentSecurityService');
const PaymentController = require('../../../src/bot/api/controllers/paymentController');

jest.mock('../../../src/bot/services/paymentService');
jest.mock('../../../src/bot/services/paymentSecurityService');

function createMockReqRes(body = {}, headers = {}) {
  const req = {
    body,
    headers: { 'content-type': 'application/json', ...headers },
    connection: { remoteAddress: '127.0.0.1' },
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

const BASE_BODY = {
  paymentId: 'pay_123',
  tokenCard: 'tok_123456789',
  name: 'Juan',
  lastName: 'Perez',
  email: 'test@test.com',
  docType: 'CC',
  docNumber: '123456',
  dues: '1',
  browserInfo: {
    language: 'es-CO',
    colorDepth: 24,
    screenWidth: 1920,
    screenHeight: 1080,
    timezoneOffset: 300,
  },
};

describe('PaymentController.processTokenizedCharge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    PaymentSecurityService.checkPaymentRateLimit.mockResolvedValue({ allowed: true });
    PaymentSecurityService.validatePCICompliance.mockReturnValue({ compliant: true });
    PaymentSecurityService.checkPaymentTimeout.mockResolvedValue({ expired: false });
    PaymentSecurityService.logPaymentEvent.mockReturnValue(Promise.resolve({}));
    PaymentSecurityService.logPaymentError.mockReturnValue(Promise.resolve({}));
  });

  it('rejects raw PAN/CVC payloads for PCI compliance', async () => {
    const { req, res } = createMockReqRes({
      ...BASE_BODY,
      cardNumber: '4575623182290326',
      cvc: '123',
      expMonth: '12',
      expYear: '2027',
    });

    await PaymentController.processTokenizedCharge(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringContaining('PCI-DSS'),
    }));
    expect(PaymentService.processTokenizedCharge).not.toHaveBeenCalled();
  });

  it('returns 400 if required tokenized fields are missing', async () => {
    const { req, res } = createMockReqRes({
      paymentId: 'pay_123',
      name: 'Juan',
      email: 'test@test.com',
      docType: 'CC',
      docNumber: '123456',
    });

    await PaymentController.processTokenizedCharge(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringContaining('Faltan campos'),
    }));
  });

  it('returns approved response when service approves charge', async () => {
    PaymentService.processTokenizedCharge.mockResolvedValue({
      success: true,
      status: 'approved',
      transactionId: 'ref_123',
      message: 'Pago aprobado exitosamente',
    });
    const { req, res } = createMockReqRes(BASE_BODY, { 'x-forwarded-for': '200.1.2.3, 10.0.0.1' });

    await PaymentController.processTokenizedCharge(req, res);

    expect(PaymentService.processTokenizedCharge).toHaveBeenCalledWith(expect.objectContaining({
      paymentId: 'pay_123',
      tokenCard: 'tok_123456789',
      ip: '200.1.2.3',
      browserInfo: BASE_BODY.browserInfo,
      customer: expect.objectContaining({
        name: 'Juan',
        last_name: 'Perez',
      }),
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      status: 'approved',
    }));
  });

  it('returns pending response when service returns pending', async () => {
    PaymentService.processTokenizedCharge.mockResolvedValue({
      success: true,
      status: 'pending',
      transactionId: 'ref_pend',
    });
    const { req, res } = createMockReqRes(BASE_BODY);

    await PaymentController.processTokenizedCharge(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      status: 'pending',
    }));
  });

  it('returns 402 for rejected charges', async () => {
    PaymentService.processTokenizedCharge.mockResolvedValue({
      success: false,
      status: 'rejected',
      error: 'Fondos insuficientes',
    });
    const { req, res } = createMockReqRes(BASE_BODY);

    await PaymentController.processTokenizedCharge(req, res);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'Fondos insuficientes',
    }));
  });

  it('returns 409 when another charge attempt is already processing', async () => {
    PaymentService.processTokenizedCharge.mockResolvedValue({
      success: false,
      status: 'processing',
      error: 'Ya existe un intento de cobro en curso para este pago. Espera unos segundos.',
    });
    const { req, res } = createMockReqRes(BASE_BODY);

    await PaymentController.processTokenizedCharge(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('returns 500 when service throws an unexpected error', async () => {
    PaymentService.processTokenizedCharge.mockRejectedValue(new Error('Unexpected DB crash'));
    const { req, res } = createMockReqRes(BASE_BODY);

    await PaymentController.processTokenizedCharge(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringContaining('Error interno'),
    }));
  });
});
