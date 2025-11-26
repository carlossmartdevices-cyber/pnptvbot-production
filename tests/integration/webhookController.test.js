const request = require('supertest');
const express = require('express');
const crypto = require('crypto');

// Mock dependencies
jest.mock('../../src/bot/services/paymentService');
jest.mock('../../src/utils/logger');

const PaymentService = require('../../src/bot/services/paymentService');
const webhookController = require('../../src/bot/api/controllers/webhookController');

describe('Webhook Controller Integration Tests', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Express app with webhook routes
    app = express();
    app.use(express.json());
    app.post('/api/webhooks/epayco', webhookController.handleEpaycoWebhook);
    app.post('/api/webhooks/daimo', webhookController.handleDaimoWebhook);
  });

  describe('ePayco Webhook', () => {
    describe('Payload Validation', () => {
      it('should reject webhook with missing required fields', async () => {
        const invalidPayload = {
          x_ref_payco: 'test-123',
          // Missing x_transaction_state, x_extra1, x_extra2, x_extra3
        };

        const response = await request(app)
          .post('/api/webhooks/epayco')
          .send(invalidPayload);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          success: false,
          error: expect.stringContaining('Missing required fields'),
        });
      });

      it('should reject webhook with missing x_transaction_state', async () => {
        const invalidPayload = {
          x_ref_payco: 'test-123',
          x_extra1: 'payment-id',
          x_extra2: 'user-id',
          x_extra3: 'plan-id',
          // Missing x_transaction_state
        };

        const response = await request(app)
          .post('/api/webhooks/epayco')
          .send(invalidPayload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('x_transaction_state');
      });

      it('should accept webhook with all required fields', async () => {
        PaymentService.processEpaycoWebhook.mockResolvedValue({
          success: true,
        });

        const validPayload = {
          x_ref_payco: 'test-123',
          x_transaction_state: 'Aceptada',
          x_extra1: 'payment-id',
          x_extra2: 'user-id',
          x_extra3: 'plan-id',
          x_signature: 'test-signature',
        };

        const response = await request(app)
          .post('/api/webhooks/epayco')
          .send(validPayload);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true });
        expect(PaymentService.processEpaycoWebhook).toHaveBeenCalledWith(validPayload);
      });
    });

    describe('Error Handling', () => {
      it('should return 400 when payment service returns error', async () => {
        PaymentService.processEpaycoWebhook.mockResolvedValue({
          success: false,
          error: 'Payment not found',
        });

        const validPayload = {
          x_ref_payco: 'test-123',
          x_transaction_state: 'Aceptada',
          x_extra1: 'payment-id',
          x_extra2: 'user-id',
          x_extra3: 'plan-id',
        };

        const response = await request(app)
          .post('/api/webhooks/epayco')
          .send(validPayload);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          success: false,
          error: 'Payment not found',
        });
      });

      it('should return 500 when payment service throws error', async () => {
        PaymentService.processEpaycoWebhook.mockRejectedValue(
          new Error('Database connection failed'),
        );

        const validPayload = {
          x_ref_payco: 'test-123',
          x_transaction_state: 'Aceptada',
          x_extra1: 'payment-id',
          x_extra2: 'user-id',
          x_extra3: 'plan-id',
        };

        const response = await request(app)
          .post('/api/webhooks/epayco')
          .send(validPayload);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          success: false,
          error: 'Internal server error',
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
          x_transaction_state: 'Aceptada',
          x_extra1: 'payment-id',
          x_extra2: 'user-id',
          x_extra3: 'plan-id',
        };

        const response = await request(app)
          .post('/api/webhooks/epayco')
          .send(validPayload);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success');
        expect(response.body.success).toBe(true);
      });

      it('should return consistent response format for validation errors', async () => {
        const invalidPayload = {
          x_ref_payco: 'test-123',
        };

        const response = await request(app)
          .post('/api/webhooks/epayco')
          .send(invalidPayload);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('error');
        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Daimo Webhook', () => {
    describe('Payload Validation', () => {
      it('should reject webhook with missing required fields', async () => {
        const invalidPayload = {
          transaction_id: 'test-123',
          // Missing status and metadata
        };

        const response = await request(app)
          .post('/api/webhooks/daimo')
          .send(invalidPayload);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          success: false,
          error: expect.stringContaining('Missing required fields'),
        });
      });

      it('should reject webhook with invalid metadata structure', async () => {
        const invalidPayload = {
          transaction_id: 'test-123',
          status: 'completed',
          metadata: {
            // Missing paymentId, userId, planId
            someOtherField: 'value',
          },
        };

        const response = await request(app)
          .post('/api/webhooks/daimo')
          .send(invalidPayload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid metadata structure');
      });

      it('should reject webhook with missing paymentId in metadata', async () => {
        const invalidPayload = {
          transaction_id: 'test-123',
          status: 'completed',
          metadata: {
            userId: 'user-123',
            planId: 'plan-456',
            // Missing paymentId
          },
        };

        const response = await request(app)
          .post('/api/webhooks/daimo')
          .send(invalidPayload);

        expect(response.status).toBe(400);
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

        const response = await request(app)
          .post('/api/webhooks/daimo')
          .send(validPayload);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true });
        expect(PaymentService.processDaimoWebhook).toHaveBeenCalledWith(validPayload);
      });
    });

    describe('Error Handling', () => {
      it('should return 400 when payment service returns error', async () => {
        PaymentService.processDaimoWebhook.mockResolvedValue({
          success: false,
          error: 'Invalid signature',
        });

        const validPayload = {
          transaction_id: 'test-123',
          status: 'completed',
          metadata: {
            paymentId: 'payment-123',
            userId: 'user-456',
            planId: 'plan-789',
          },
        };

        const response = await request(app)
          .post('/api/webhooks/daimo')
          .send(validPayload);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          success: false,
          error: 'Invalid signature',
        });
      });

      it('should return 500 when payment service throws error', async () => {
        PaymentService.processDaimoWebhook.mockRejectedValue(
          new Error('Redis connection failed'),
        );

        const validPayload = {
          transaction_id: 'test-123',
          status: 'completed',
          metadata: {
            paymentId: 'payment-123',
            userId: 'user-456',
            planId: 'plan-789',
          },
        };

        const response = await request(app)
          .post('/api/webhooks/daimo')
          .send(validPayload);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          success: false,
          error: 'Internal server error',
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
          metadata: {
            paymentId: 'payment-123',
            userId: 'user-456',
            planId: 'plan-789',
          },
        };

        const response = await request(app)
          .post('/api/webhooks/daimo')
          .send(validPayload);

        expect(response.status).toBe(200);
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
        x_extra1: 'payment-id',
        x_extra2: 'user-id',
        x_extra3: 'plan-id',
      };

      const response = await request(app)
        .post('/api/webhooks/epayco')
        .send(validPayload);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
      expect(response.body.error).not.toContain('password');
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/webhooks/epayco')
        .set('Content-Type', 'application/json')
        .send('invalid json{');

      expect(response.status).toBe(400);
    });
  });
});
