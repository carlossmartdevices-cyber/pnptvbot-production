const PaymentService = require('../../../src/bot/services/paymentService');
const PaymentSecurityService = require('../../../src/bot/services/paymentSecurityService');
const PaymentController = require('../../../src/bot/api/controllers/paymentController');

jest.mock('../../../src/bot/services/paymentService');
jest.mock('../../../src/bot/services/paymentSecurityService');

// Helper to create mock req/res
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

describe('PaymentController.processTokenizedCharge', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock PaymentSecurityService methods to pass validation
    PaymentSecurityService.checkPaymentRateLimit.mockResolvedValue({ allowed: true });
    PaymentSecurityService.validatePCICompliance.mockReturnValue({ compliant: true });
    PaymentSecurityService.checkPaymentTimeout.mockResolvedValue({ expired: false });
    PaymentSecurityService.logPaymentEvent.mockReturnValue(Promise.resolve({}));
    PaymentSecurityService.logPaymentError.mockReturnValue(Promise.resolve({}));
  });

  describe('Validation', () => {
    it('should return 400 if paymentId is missing', async () => {
      const { req, res } = createMockReqRes({
        cardNumber: '4575623182290326',
        expYear: '2027',
        expMonth: '12',
        cvc: '123',
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

    it('should return 400 if card number is missing', async () => {
      const { req, res } = createMockReqRes({
        paymentId: 'pay_123',
        expYear: '2027',
        expMonth: '12',
        cvc: '123',
        name: 'Juan',
        email: 'test@test.com',
        docType: 'CC',
        docNumber: '123456',
      });

      await PaymentController.processTokenizedCharge(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if email is missing', async () => {
      const { req, res } = createMockReqRes({
        paymentId: 'pay_123',
        cardNumber: '4575623182290326',
        expYear: '2027',
        expMonth: '12',
        cvc: '123',
        name: 'Juan',
        docType: 'CC',
        docNumber: '123456',
      });

      await PaymentController.processTokenizedCharge(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for invalid card number (too short)', async () => {
      const { req, res } = createMockReqRes({
        paymentId: 'pay_123',
        cardNumber: '1234',
        expYear: '2027',
        expMonth: '12',
        cvc: '123',
        name: 'Juan',
        email: 'test@test.com',
        docType: 'CC',
        docNumber: '123456',
      });

      await PaymentController.processTokenizedCharge(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('tarjeta'),
      }));
    });

    it('should return 400 for card number with letters', async () => {
      const { req, res } = createMockReqRes({
        paymentId: 'pay_123',
        cardNumber: '4575 6231 ABCD 0326',
        expYear: '2027',
        expMonth: '12',
        cvc: '123',
        name: 'Juan',
        email: 'test@test.com',
        docType: 'CC',
        docNumber: '123456',
      });

      await PaymentController.processTokenizedCharge(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should strip spaces from card number before validation', async () => {
      PaymentService.processTokenizedCharge.mockResolvedValue({
        success: true,
        status: 'approved',
        transactionId: 'ref_123',
      });

      const { req, res } = createMockReqRes({
        paymentId: 'pay_123',
        cardNumber: '4575 6231 8229 0326', // with spaces
        expYear: '2027',
        expMonth: '12',
        cvc: '123',
        name: 'Juan',
        email: 'test@test.com',
        docType: 'CC',
        docNumber: '123456',
      });

      await PaymentController.processTokenizedCharge(req, res);

      // Should call service with cleaned card number
      expect(PaymentService.processTokenizedCharge).toHaveBeenCalledWith(
        expect.objectContaining({
          card: expect.objectContaining({
            number: '4575623182290326', // spaces stripped
          }),
        }),
      );
    });
  });

  describe('Successful charge', () => {
    it('should return success for approved charge', async () => {
      PaymentService.processTokenizedCharge.mockResolvedValue({
        success: true,
        status: 'approved',
        transactionId: 'ref_123',
        message: 'Pago aprobado exitosamente',
      });

      const { req, res } = createMockReqRes({
        paymentId: 'pay_123',
        cardNumber: '4575623182290326',
        expYear: '2027',
        expMonth: '12',
        cvc: '123',
        name: 'Juan',
        lastName: 'Perez',
        email: 'test@test.com',
        docType: 'CC',
        docNumber: '123456',
        dues: '3',
      });

      await PaymentController.processTokenizedCharge(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 'approved',
        transactionId: 'ref_123',
        message: 'Pago aprobado exitosamente',
      });
      expect(res.status).not.toHaveBeenCalled(); // 200 is default

      // Verify dues passed correctly
      expect(PaymentService.processTokenizedCharge).toHaveBeenCalledWith(
        expect.objectContaining({ dues: '3' }),
      );
    });

    it('should return success for pending charge', async () => {
      PaymentService.processTokenizedCharge.mockResolvedValue({
        success: true,
        status: 'pending',
        transactionId: 'ref_pend',
        message: 'El pago esta pendiente',
      });

      const { req, res } = createMockReqRes({
        paymentId: 'pay_123',
        cardNumber: '4575623182290326',
        expYear: '2027',
        expMonth: '12',
        cvc: '123',
        name: 'Juan',
        email: 'test@test.com',
        docType: 'CC',
        docNumber: '123456',
      });

      await PaymentController.processTokenizedCharge(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        status: 'pending',
      }));
    });
  });

  describe('Failed charge', () => {
    it('should return 402 for rejected charge', async () => {
      PaymentService.processTokenizedCharge.mockResolvedValue({
        success: false,
        status: 'rejected',
        error: 'Fondos insuficientes',
      });

      const { req, res } = createMockReqRes({
        paymentId: 'pay_123',
        cardNumber: '4575623182290326',
        expYear: '2027',
        expMonth: '12',
        cvc: '123',
        name: 'Juan',
        email: 'test@test.com',
        docType: 'CC',
        docNumber: '123456',
      });

      await PaymentController.processTokenizedCharge(req, res);

      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Fondos insuficientes',
      }));
    });

    it('should return 400 for generic service error', async () => {
      PaymentService.processTokenizedCharge.mockResolvedValue({
        success: false,
        error: 'Payment not found',
      });

      const { req, res } = createMockReqRes({
        paymentId: 'pay_123',
        cardNumber: '4575623182290326',
        expYear: '2027',
        expMonth: '12',
        cvc: '123',
        name: 'Juan',
        email: 'test@test.com',
        docType: 'CC',
        docNumber: '123456',
      });

      await PaymentController.processTokenizedCharge(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('Error handling', () => {
    it('should return 500 if service throws', async () => {
      PaymentService.processTokenizedCharge.mockRejectedValue(new Error('Unexpected DB crash'));

      const { req, res } = createMockReqRes({
        paymentId: 'pay_123',
        cardNumber: '4575623182290326',
        expYear: '2027',
        expMonth: '12',
        cvc: '123',
        name: 'Juan',
        email: 'test@test.com',
        docType: 'CC',
        docNumber: '123456',
      });

      await PaymentController.processTokenizedCharge(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Error interno'),
      }));
    });
  });

  describe('IP forwarding', () => {
    it('should use x-forwarded-for header for client IP', async () => {
      PaymentService.processTokenizedCharge.mockResolvedValue({
        success: true,
        status: 'approved',
        transactionId: 'ref_ip',
      });

      const { req, res } = createMockReqRes(
        {
          paymentId: 'pay_123',
          cardNumber: '4575623182290326',
          expYear: '2027',
          expMonth: '12',
          cvc: '123',
          name: 'Juan',
          email: 'test@test.com',
          docType: 'CC',
          docNumber: '123456',
        },
        { 'x-forwarded-for': '200.1.2.3, 10.0.0.1' },
      );

      await PaymentController.processTokenizedCharge(req, res);

      expect(PaymentService.processTokenizedCharge).toHaveBeenCalledWith(
        expect.objectContaining({ ip: '200.1.2.3' }),
      );
    });
  });

  describe('Data formatting', () => {
    it('should pad single-digit month with zero', async () => {
      PaymentService.processTokenizedCharge.mockResolvedValue({
        success: true,
        status: 'approved',
        transactionId: 'ref_fmt',
      });

      const { req, res } = createMockReqRes({
        paymentId: 'pay_123',
        cardNumber: '4575623182290326',
        expYear: '2027',
        expMonth: '3', // single digit
        cvc: '123',
        name: 'Juan',
        email: 'test@test.com',
        docType: 'CC',
        docNumber: '123456',
      });

      await PaymentController.processTokenizedCharge(req, res);

      expect(PaymentService.processTokenizedCharge).toHaveBeenCalledWith(
        expect.objectContaining({
          card: expect.objectContaining({
            exp_month: '03', // padded
          }),
        }),
      );
    });

    it('should default dues to 1 if not provided', async () => {
      PaymentService.processTokenizedCharge.mockResolvedValue({
        success: true,
        status: 'approved',
        transactionId: 'ref_dues',
      });

      const { req, res } = createMockReqRes({
        paymentId: 'pay_123',
        cardNumber: '4575623182290326',
        expYear: '2027',
        expMonth: '12',
        cvc: '123',
        name: 'Juan',
        email: 'test@test.com',
        docType: 'CC',
        docNumber: '123456',
        // no dues
      });

      await PaymentController.processTokenizedCharge(req, res);

      expect(PaymentService.processTokenizedCharge).toHaveBeenCalledWith(
        expect.objectContaining({ dues: '1' }),
      );
    });

    it('should use name as lastName fallback', async () => {
      PaymentService.processTokenizedCharge.mockResolvedValue({
        success: true,
        status: 'approved',
        transactionId: 'ref_ln',
      });

      const { req, res } = createMockReqRes({
        paymentId: 'pay_123',
        cardNumber: '4575623182290326',
        expYear: '2027',
        expMonth: '12',
        cvc: '123',
        name: 'Juan',
        // no lastName
        email: 'test@test.com',
        docType: 'CC',
        docNumber: '123456',
      });

      await PaymentController.processTokenizedCharge(req, res);

      expect(PaymentService.processTokenizedCharge).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: expect.objectContaining({
            last_name: 'Juan', // fallback to name
          }),
        }),
      );
    });
  });
});
