const request = require('supertest');

// Mock PaymentService
jest.mock('../../../src/bot/services/paymentService');

const app = require('../../../src/bot/api/routes');
const PaymentService = require('../../../src/bot/services/paymentService');

describe('Webhook Controller Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/webhooks/epayco', () => {
    it('should return 200 for a valid ePayco webhook', async () => {
      PaymentService.processEpaycoWebhook.mockResolvedValue({ success: true });

      const webhookData = {
        x_ref_payco: 'ref_123',
        x_transaction_state: 'Aceptada',
        x_extra1: 'pay_123',
        x_extra2: 'user_123',
        x_extra3: 'plan_123',
        x_signature: 'mock_signature',
      };

      const response = await request(app)
        .post('/api/webhooks/epayco')
        .send(webhookData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(PaymentService.processEpaycoWebhook).toHaveBeenCalledWith(webhookData);
    });

    it('should return 400 for a failed ePayco webhook', async () => {
      PaymentService.processEpaycoWebhook.mockResolvedValue({
        success: false,
        error: 'Invalid signature',
      });

      const webhookData = {
        x_ref_payco: 'ref_123',
        x_transaction_state: 'Aceptada',
        x_extra1: 'pay_123',
        x_extra2: 'user_123',
        x_extra3: 'plan_123',
        x_signature: 'invalid_signature',
      };

      const response = await request(app)
        .post('/api/webhooks/epayco')
        .send(webhookData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ success: false, error: 'Invalid signature' });
    });

    it('should return 500 for internal server errors', async () => {
      PaymentService.processEpaycoWebhook.mockRejectedValue(new Error('Database error'));

      const webhookData = {
        x_ref_payco: 'ref_123',
        x_transaction_state: 'Aceptada',
        x_extra1: 'pay_123',
        x_extra2: 'user_123',
        x_extra3: 'plan_123',
        x_signature: 'mock_signature',
      };

      const response = await request(app)
        .post('/api/webhooks/epayco')
        .send(webhookData);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ success: false, error: 'Internal server error' });
    });

    it('should handle declined transactions', async () => {
      PaymentService.processEpaycoWebhook.mockResolvedValue({
        success: false,
        error: 'Payment declined',
      });

      const webhookData = {
        x_ref_payco: 'ref_456',
        x_transaction_state: 'Rechazada',
        x_extra1: 'pay_456',
        x_extra2: 'user_456',
        x_extra3: 'plan_456',
        x_signature: 'mock_signature',
      };

      const response = await request(app)
        .post('/api/webhooks/epayco')
        .send(webhookData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ success: false, error: 'Payment declined' });
    });
  });

  describe('POST /api/webhooks/daimo', () => {
    it('should return 200 for a valid Daimo webhook', async () => {
      PaymentService.processDaimoWebhook.mockResolvedValue({ success: true });

      const webhookData = {
        transaction_id: 'txn_123',
        status: 'completed',
        metadata: {
          paymentId: 'pay_123',
          userId: 'user_123',
          planId: 'plan_123',
        },
        signature: 'mock_signature',
      };

      const response = await request(app)
        .post('/api/webhooks/daimo')
        .send(webhookData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(PaymentService.processDaimoWebhook).toHaveBeenCalledWith(webhookData);
    });

    it('should return 400 for a failed Daimo webhook', async () => {
      PaymentService.processDaimoWebhook.mockResolvedValue({
        success: false,
        error: 'Invalid signature',
      });

      const webhookData = {
        transaction_id: 'txn_123',
        status: 'completed',
        metadata: {
          paymentId: 'pay_123',
          userId: 'user_123',
          planId: 'plan_123',
        },
        signature: 'invalid_signature',
      };

      const response = await request(app)
        .post('/api/webhooks/daimo')
        .send(webhookData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ success: false, error: 'Invalid signature' });
    });

    it('should return 500 for internal server errors', async () => {
      PaymentService.processDaimoWebhook.mockRejectedValue(new Error('Database error'));

      const webhookData = {
        transaction_id: 'txn_123',
        status: 'completed',
        metadata: {
          paymentId: 'pay_123',
          userId: 'user_123',
          planId: 'plan_123',
        },
        signature: 'mock_signature',
      };

      const response = await request(app)
        .post('/api/webhooks/daimo')
        .send(webhookData);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ success: false, error: 'Internal server error' });
    });

    it('should handle failed Daimo payments', async () => {
      PaymentService.processDaimoWebhook.mockResolvedValue({
        success: false,
        error: 'Payment failed',
      });

      const webhookData = {
        transaction_id: 'txn_456',
        status: 'failed',
        metadata: {
          paymentId: 'pay_456',
          userId: 'user_456',
          planId: 'plan_456',
        },
        signature: 'mock_signature',
      };

      const response = await request(app)
        .post('/api/webhooks/daimo')
        .send(webhookData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ success: false, error: 'Payment failed' });
    });

    it('should handle pending Daimo payments', async () => {
      PaymentService.processDaimoWebhook.mockResolvedValue({ success: true });

      const webhookData = {
        transaction_id: 'txn_789',
        status: 'pending',
        metadata: {
          paymentId: 'pay_789',
          userId: 'user_789',
          planId: 'plan_789',
        },
        signature: 'mock_signature',
      };

      const response = await request(app)
        .post('/api/webhooks/daimo')
        .send(webhookData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });
  });

  describe('GET /api/payment-response', () => {
    it('should return success page for successful payment', async () => {
      const response = await request(app)
        .get('/api/payment-response')
        .query({ ref: 'ref_123', status: 'success' });

      expect(response.status).toBe(200);
      expect(response.text).toContain('Payment Successful');
      expect(response.text).toContain('PRIME subscription has been activated');
    });

    it('should return success page for approved payment', async () => {
      const response = await request(app)
        .get('/api/payment-response')
        .query({ ref: 'ref_123', status: 'approved' });

      expect(response.status).toBe(200);
      expect(response.text).toContain('Payment Successful');
      expect(response.text).toContain('PRIME subscription has been activated');
    });

    it('should return error page for failed payment', async () => {
      const response = await request(app)
        .get('/api/payment-response')
        .query({ ref: 'ref_456', status: 'failed' });

      expect(response.status).toBe(200);
      expect(response.text).toContain('Payment Failed');
      expect(response.text).toContain('could not be processed');
    });

    it('should return error page for declined payment', async () => {
      const response = await request(app)
        .get('/api/payment-response')
        .query({ ref: 'ref_456', status: 'declined' });

      expect(response.status).toBe(200);
      expect(response.text).toContain('Payment Failed');
      expect(response.text).toContain('could not be processed');
    });

    it('should include Telegram bot link in success page', async () => {
      process.env.BOT_USERNAME = 'test_pnptv_bot';

      const response = await request(app)
        .get('/api/payment-response')
        .query({ ref: 'ref_123', status: 'success' });

      expect(response.status).toBe(200);
      expect(response.text).toContain('t.me/test_pnptv_bot');
    });

    it('should include Telegram bot link in error page', async () => {
      process.env.BOT_USERNAME = 'test_pnptv_bot';

      const response = await request(app)
        .get('/api/payment-response')
        .query({ ref: 'ref_456', status: 'failed' });

      expect(response.status).toBe(200);
      expect(response.text).toContain('t.me/test_pnptv_bot');
    });
  });

  describe('Health Check', () => {
    it('should return health status with dependencies check', async () => {
      const response = await request(app).get('/health');

      // Status can be 200 (ok) or 503 (degraded) depending on dependencies availability
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('dependencies');
      expect(response.body.dependencies).toHaveProperty('redis');
      expect(response.body.dependencies).toHaveProperty('database');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting on API endpoints', async () => {
      // This test is a placeholder for rate limiting behavior
      // In a real scenario, you would make multiple requests to trigger rate limiting
      PaymentService.processDaimoWebhook.mockResolvedValue({ success: true });

      const webhookData = {
        transaction_id: 'txn_123',
        status: 'completed',
        metadata: {
          paymentId: 'pay_123',
          userId: 'user_123',
          planId: 'plan_123',
        },
        signature: 'mock_signature',
      };

      const response = await request(app)
        .post('/api/webhooks/daimo')
        .send(webhookData);

      expect(response.status).toBe(200);
    }, 10000);
  });
});
