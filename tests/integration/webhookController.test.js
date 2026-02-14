// Mock dependencies
jest.mock('../../src/bot/services/paymentService');
jest.mock('../../src/utils/logger');
jest.mock('../../src/models/paymentWebhookEventModel', () => ({
  logEvent: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../src/config/redis', () => ({
  cache: {
    acquireLock: jest.fn().mockResolvedValue(true),
    releaseLock: jest.fn().mockResolvedValue(true),
  },
}));
jest.mock('../../src/bot/services/daimoService', () => ({
  verifyWebhookSignature: jest.fn().mockReturnValue(true),
}));
jest.mock('../../src/config/daimo', () => ({
  validateWebhookPayload: jest.fn().mockReturnValue({ valid: true }),
}));

const PaymentService = require('../../src/bot/services/paymentService');
const webhookController = require('../../src/bot/api/controllers/webhookController');

const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
  };
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

const callHandler = async (handler, payload, headers = {}) => {
  const req = { body: payload, headers };
  const res = createMockRes();
  await handler(req, res);
  return res;
};

describe('Webhook Controller Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    PaymentService.verifyEpaycoSignature.mockReturnValue(true); // Default to valid signature
    PaymentService.verifyDaimoSignature.mockReturnValue(true); // Default to valid signature

    // Ensure that EPAYCO_P_KEY is set in the test environment for signature verification logic
    process.env.EPAYCO_P_KEY = 'test_p_key';
    process.env.EPAYCO_PRIVATE_KEY = 'test_private_key';
    process.env.EPAYCO_PUBLIC_KEY = 'test_public_key';
    process.env.EPAYCO_P_CUST_ID = 'test_cust_id';
    process.env.DAIMO_WEBHOOK_SECRET = 'test_daimo_secret';
  });

  describe('ePayco Webhook', () => {
    describe('Payload Validation', () => {
      it('should reject webhook with missing required fields', async () => {
        // Missing x_transaction_id, x_transaction_state, x_amount, x_currency_code, x_extra1, x_extra2, x_extra3, x_signature
        const invalidPayload = {
          x_ref_payco: 'test-123',
        };

        const response = await callHandler(
          webhookController.handleEpaycoWebhook,
          invalidPayload,
        );

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
          success: false,
          code: 'INVALID_PAYLOAD',
          message: expect.stringContaining('\"x_transaction_id\" is required'),
        });
      });

      it('should reject webhook with missing x_transaction_state', async () => {
        const invalidPayload = {
          x_ref_payco: 'test-123',
          x_transaction_id: 'txn_123',
          x_amount: '10.00',
          x_currency_code: 'USD',
          x_extra1: 'payment-id',
          x_extra2: 'user-id',
          x_extra3: 'plan-id',
          x_signature: 'test-signature',
          // Missing x_transaction_state
        };

        const response = await callHandler(
          webhookController.handleEpaycoWebhook,
          invalidPayload,
        );

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
          success: false,
          code: 'INVALID_PAYLOAD',
          message: '\"value\" must contain at least one of [x_transaction_state, x_cod_transaction_state]',
        });
      });

      it('should accept webhook with all required fields', async () => {
        PaymentService.processEpaycoWebhook.mockResolvedValue({
          success: true,
        });

        const validPayload = {
          x_ref_payco: 'test-123',
          x_transaction_id: 'txn_123',
          x_transaction_state: 'Aceptada',
          x_amount: '10.00',
          x_currency_code: 'USD',
          x_extra1: 'payment-id',
          x_extra2: 'user-id',
          x_extra3: 'plan-id',
          x_signature: 'test-signature',
        };

        const response = await callHandler(
          webhookController.handleEpaycoWebhook,
          validPayload,
        );

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({ success: true });
        expect(PaymentService.processEpaycoWebhook).toHaveBeenCalledWith(validPayload);
      });
    });

    describe('Error Handling', () => {
      it('should return 400 when payment service returns error', async () => {
        PaymentService.processEpaycoWebhook.mockResolvedValue({
          success: false,
          code: 'EPAYCO_REJECTED', // Added specific error code
          message: 'Payment not found',
        });

        const validPayload = {
          x_ref_payco: 'test-123',
          x_transaction_id: 'txn_123',
          x_transaction_state: 'Aceptada',
          x_amount: '10.00',
          x_currency_code: 'USD',
          x_extra1: 'payment-id',
          x_extra2: 'user-id',
          x_extra3: 'plan-id',
          x_signature: 'test-signature',
        };

        const response = await callHandler(
          webhookController.handleEpaycoWebhook,
          validPayload,
        );

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
          success: false,
          code: 'EPAYCO_REJECTED',
          message: 'Payment not found',
        });
      });

      it('should return 500 when payment service throws error', async () => {
        PaymentService.processEpaycoWebhook.mockRejectedValue(
          new Error('Database connection failed'),
        );

        const validPayload = {
          x_ref_payco: 'test-123',
          x_transaction_id: 'txn_123',
          x_transaction_state: 'Aceptada',
          x_amount: '10.00',
          x_currency_code: 'USD',
          x_extra1: 'payment-id',
          x_extra2: 'user-id',
          x_extra3: 'plan-id',
          x_signature: 'test-signature',
        };

        const response = await callHandler(
          webhookController.handleEpaycoWebhook,
          validPayload,
        );

        expect(response.statusCode).toBe(500);
        expect(response.body).toEqual({
          success: false,
          code: 'INTERNAL_ERROR', // Added specific error code
          message: 'Internal server error',
        });
      });
    });

    describe('Response Format', () => {
      it('should return consistent response format for success', async () => {
        PaymentService.processEpaycoWebhook.mockResolvedValue({
          success: true,
        });

        const validPayload = {
          x_ref_payco: 'test-123',
          x_transaction_id: 'txn_123',
          x_transaction_state: 'Aceptada',
          x_amount: '10.00',
          x_currency_code: 'USD',
          x_extra1: 'payment-id',
          x_extra2: 'user-id',
          x_extra3: 'plan-id',
          x_signature: 'test-signature',
        };

        const response = await callHandler(
          webhookController.handleEpaycoWebhook,
          validPayload,
        );

        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('success');
        expect(response.body.success).toBe(true);
      });

      it('should return consistent response format for validation errors', async () => {
        const invalidPayload = {
          x_ref_payco: 'test-123',
          // Missing x_transaction_id
        };

        const response = await callHandler(
          webhookController.handleEpaycoWebhook,
          invalidPayload,
        );

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
          success: false,
          code: 'INVALID_PAYLOAD',
          message: expect.stringContaining('\"x_transaction_id\" is required'),
        });
      });
    });
  });

  describe('Daimo Webhook', () => {
    describe('Payload Validation', () => {
      it('should reject webhook with missing required fields', async () => {
        const invalidPayload = {
          // Missing transaction_id, status and metadata
        };

        const response = await callHandler(
          webhookController.handleDaimoWebhook,
          invalidPayload,
        );

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
          success: false,
          error: expect.stringContaining('Missing required fields'),
        });
      });

      it('should reject webhook with invalid metadata structure', async () => {
        const invalidPayload = {
          transaction_id: 'test-123',
          status: 'completed',
          signature: 'test-signature',
          metadata: {
            // Missing paymentId, userId, planId
            someOtherField: 'value',
          },
        };

        const response = await callHandler(
          webhookController.handleDaimoWebhook,
          invalidPayload,
        );

        expect(response.statusCode).toBe(400);
        expect(response.body.error).toContain('Invalid metadata structure');
      });

      it('should reject webhook with missing paymentId in metadata', async () => {
        const invalidPayload = {
          transaction_id: 'test-123',
          status: 'completed',
          signature: 'test-signature',
          metadata: {
            userId: 'user-123',
            planId: 'plan-456',
            // Missing paymentId
          },
        };

        const response = await callHandler(
          webhookController.handleDaimoWebhook,
          invalidPayload,
        );

        expect(response.statusCode).toBe(400);
        expect(response.body.error).toContain('Invalid metadata structure');
      });

      it('should accept webhook with all required fields and valid metadata', async () => {
        PaymentService.processDaimoWebhook.mockResolvedValue({
          success: true,
        });

        const validPayload = {
          transaction_id: 'test-123',
          status: 'completed',
          signature: 'test-signature',
          metadata: {
            paymentId: 'payment-123',
            userId: 'user-456',
            planId: 'plan-789',
          },
        };

        const response = await callHandler(
          webhookController.handleDaimoWebhook,
          validPayload,
        );

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({ success: true });
        expect(PaymentService.processDaimoWebhook).toHaveBeenCalledWith(validPayload);
      });

      it('should return 200 for duplicate Daimo webhook indicating already processed', async () => {
        PaymentService.processDaimoWebhook.mockResolvedValue({
          success: true,
          alreadyProcessed: true,
        });

        const duplicatePayload = {
          transaction_id: 'test-123',
          status: 'completed',
          signature: 'test-signature',
          metadata: {
            paymentId: 'payment-123',
            userId: 'user-456',
            planId: 'plan-789',
          },
        };

        const response = await callHandler(
          webhookController.handleDaimoWebhook,
          duplicatePayload,
        );

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({ success: true, alreadyProcessed: true });
        expect(PaymentService.processDaimoWebhook).toHaveBeenCalledWith(duplicatePayload);
      });
    });

    describe('Error Handling', () => {
      it('should return 400 when payment service returns error', async () => {
        PaymentService.processDaimoWebhook.mockResolvedValue({
          success: false,
          code: 'DAIMO_INVALID_SIGNATURE', // Added specific error code
          message: 'Invalid signature',
        });

        const validPayload = {
          transaction_id: 'test-123',
          status: 'completed',
          signature: 'test-signature',
          metadata: {
            paymentId: 'payment-123',
            userId: 'user-456',
            planId: 'plan-789',
          },
        };

        const response = await callHandler(
          webhookController.handleDaimoWebhook,
          validPayload,
        );

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
          success: false,
          code: 'DAIMO_INVALID_SIGNATURE',
          message: 'Invalid signature',
        });
      });

      it('should return 500 when payment service throws error', async () => {
        PaymentService.processDaimoWebhook.mockRejectedValue(
          new Error('Redis connection failed'),
        );

        const validPayload = {
          transaction_id: 'test-123',
          status: 'completed',
          signature: 'test-signature',
          metadata: {
            paymentId: 'payment-123',
            userId: 'user-456',
            planId: 'plan-789',
          },
        };

        const response = await callHandler(
          webhookController.handleDaimoWebhook,
          validPayload,
        );

        expect(response.statusCode).toBe(500);
        expect(response.body).toEqual({
          success: false,
          code: 'INTERNAL_ERROR', // Added specific error code
          message: 'Internal server error',
        });
      });
    });

    describe('Response Format', () => {
      it('should return consistent response format for all outcomes', async () => {
        PaymentService.processDaimoWebhook.mockResolvedValue({
          success: true,
        });

        const validPayload = {
          transaction_id: 'test-123',
          status: 'completed',
          signature: 'test-signature',
          metadata: {
            paymentId: 'payment-123',
            userId: 'user-456',
            planId: 'plan-789',
          },
        };

        const response = await callHandler(
          webhookController.handleDaimoWebhook,
          validPayload,
        );

        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('success');
        expect(typeof response.body.success).toBe('boolean');
      });
    });
  });

  describe('Security', () => {
    it('should not expose internal error details in webhook responses', async () => {
      PaymentService.processEpaycoWebhook.mockRejectedValue(
        new Error('Database password is incorrect'),
      );

      const validPayload = {
        x_ref_payco: 'test-123',
        x_transaction_state: 'Aceptada',
        x_transaction_id: 'txn_123',
        x_amount: '10.00',
        x_currency_code: 'USD',
        x_extra1: 'payment-id',
        x_extra2: 'user-id',
        x_extra3: 'plan-id',
        x_signature: 'test-signature',
      };
      const response = await callHandler(
        webhookController.handleEpaycoWebhook,
        validPayload,
      );

      expect(response.statusCode).toBe(500);
      expect(response.body).toEqual({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      });
      expect(response.body.message).not.toContain('password');
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await callHandler(
        webhookController.handleEpaycoWebhook,
        'invalid json{',
        { 'content-type': 'application/json' },
      );

      expect(response.statusCode).toBe(400);
    });
  });
});