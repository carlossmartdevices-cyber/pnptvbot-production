const crypto = require('crypto');

// Mock dependencies
jest.mock('../../../src/config/redis');
jest.mock('../../../src/models/paymentModel');
jest.mock('../../../src/models/userModel');
jest.mock('../../../src/models/planModel');
jest.mock('../../../src/models/subscriberModel');
jest.mock('../../../src/bot/services/paymentSecurityService', () => ({
  logPaymentEvent: jest.fn().mockResolvedValue(true),
  logPaymentError: jest.fn().mockResolvedValue(true),
  setPaymentTimeout: jest.fn().mockResolvedValue(true),
  generateSecurePaymentToken: jest.fn().mockResolvedValue('token'),
  createPaymentRequestHash: jest.fn().mockReturnValue('hash'),
  validatePaymentAmount: jest.fn().mockResolvedValue({ valid: true }),
  requireTwoFactorAuth: jest.fn().mockResolvedValue({ required: false }),
  checkReplayAttack: jest.fn().mockResolvedValue({ isReplay: false }),
}));
jest.mock('../../../src/utils/logger');

const PaymentModel = require('../../../src/models/paymentModel');
const PaymentService = require('../../../src/bot/services/paymentService');

describe('PaymentService Security Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('ePayco Signature Verification', () => {
    it('should return false when signature is missing', () => {
      process.env.EPAYCO_PRIVATE_KEY = 'test-secret';

      const webhookData = {
        x_ref_payco: 'ref123',
        x_transaction_id: 'txn123',
        x_amount: '9.99',
        // Missing x_signature
      };

      const result = PaymentService.verifyEpaycoSignature(webhookData);

      expect(result).toBe(false);
    });

    it('should throw ConfigurationError when private key is missing', () => {
      delete process.env.EPAYCO_PRIVATE_KEY;
      delete process.env.EPAYCO_P_KEY;

      const webhookData = {
        x_ref_payco: 'ref123',
        x_signature: 'test-signature',
      };

      expect(() => {
        PaymentService.verifyEpaycoSignature(webhookData);
      }).toThrow('EPAYCO_P_KEY or EPAYCO_PRIVATE_KEY must be configured');
    });

    it('should verify valid ePayco signature correctly', () => {
      const secret = 'test-secret-key';
      process.env.EPAYCO_P_KEY = secret;
      process.env.EPAYCO_P_CUST_ID = 'cust123';

      const webhookData = {
        x_ref_payco: 'ref456',
        x_transaction_id: 'txn789',
        x_amount: '19.99',
        x_currency_code: 'USD',
      };

      // Generate valid signature (ePayco uses SHA256 hash, not HMAC)
      const signatureString = `${process.env.EPAYCO_P_CUST_ID}^${secret}^${webhookData.x_ref_payco}^${webhookData.x_transaction_id}^${webhookData.x_amount}^${webhookData.x_currency_code}`;
      const validSignature = crypto.createHash('sha256').update(signatureString).digest('hex');

      webhookData.x_signature = validSignature;

      const result = PaymentService.verifyEpaycoSignature(webhookData);

      expect(result).toBe(true);
    });

    it('should reject invalid ePayco signature', () => {
      process.env.EPAYCO_P_KEY = 'test-secret-key';
      process.env.EPAYCO_P_CUST_ID = 'cust123';

      const webhookData = {
        x_ref_payco: 'ref456',
        x_transaction_id: 'txn789',
        x_amount: '19.99',
        x_signature: 'invalid-signature-12345',
      };

      const result = PaymentService.verifyEpaycoSignature(webhookData);

      expect(result).toBe(false);
    });

    it('should reject tampered webhook data', () => {
      const secret = 'test-secret-key';
      process.env.EPAYCO_P_KEY = secret;
      process.env.EPAYCO_P_CUST_ID = 'cust123';

      const webhookData = {
        x_ref_payco: 'ref456',
        x_transaction_id: 'txn789',
        x_amount: '19.99',
      };

      // Generate signature for original amount
      const signatureString = `${process.env.EPAYCO_P_CUST_ID}^${secret}^${webhookData.x_ref_payco}^${webhookData.x_transaction_id}^${webhookData.x_amount}`;
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(signatureString);
      const validSignature = hmac.digest('hex');

      webhookData.x_signature = validSignature;

      // Tamper with amount after signature generation
      webhookData.x_amount = '99.99';

      const result = PaymentService.verifyEpaycoSignature(webhookData);

      expect(result).toBe(false);
    });

    it('should verify signature with normalized amount and currency variants', () => {
      const secret = 'test-secret-key';
      process.env.EPAYCO_P_KEY = secret;
      process.env.EPAYCO_P_CUST_ID = 'cust123';

      const webhookData = {
        x_ref_payco: 'ref-amount-1',
        x_transaction_id: 'txn-amount-1',
        x_amount: 10000,
        x_currency_code: 'cop',
      };

      const signatureString = `${process.env.EPAYCO_P_CUST_ID}^${secret}^${webhookData.x_ref_payco}^${webhookData.x_transaction_id}^10000.00^COP`;
      webhookData.x_signature = crypto.createHash('sha256').update(signatureString).digest('hex');

      const result = PaymentService.verifyEpaycoSignature(webhookData);

      expect(result).toBe(true);
    });

    it('should verify checkout md5 signature using invoice data', () => {
      const secret = 'test-secret-key';
      process.env.EPAYCO_P_KEY = secret;
      process.env.EPAYCO_P_CUST_ID = 'cust123';

      const webhookData = {
        x_id_invoice: 'inv-123',
        x_amount: 49,
        x_currency_code: 'usd',
      };

      const md5String = `${process.env.EPAYCO_P_CUST_ID}^${secret}^${webhookData.x_id_invoice}^49.00^USD`;
      webhookData.x_signature = crypto.createHash('md5').update(md5String).digest('hex');

      const result = PaymentService.verifyEpaycoSignature(webhookData);

      expect(result).toBe(true);
    });
  });

  describe('ePayco State Normalization', () => {
    it('should normalize by transaction state code', () => {
      expect(PaymentService.normalizeEpaycoTransactionState(null, 5)).toBe('Cancelada');
      expect(PaymentService.normalizeEpaycoTransactionState(undefined, '6')).toBe('Reversada');
    });
  });

  describe('Daimo Signature Verification', () => {
    it('should return false when signature is missing', () => {
      process.env.DAIMO_WEBHOOK_SECRET = 'test-secret';

      const webhookData = {
        transaction_id: 'txn123',
        status: 'completed',
        // Missing signature
      };

      const result = PaymentService.verifyDaimoSignature(webhookData);

      expect(result).toBe(false);
    });

    it('should throw ConfigurationError when secret is missing', () => {
      delete process.env.DAIMO_WEBHOOK_SECRET;

      const webhookData = {
        transaction_id: 'txn123',
        signature: 'test-signature',
      };

      expect(() => {
        PaymentService.verifyDaimoSignature(webhookData);
      }).toThrow('DAIMO_WEBHOOK_SECRET must be configured');
    });

    it('should verify valid Daimo signature correctly', () => {
      const secret = 'test-webhook-secret';
      process.env.DAIMO_WEBHOOK_SECRET = secret;

      const webhookData = {
        transaction_id: 'txn123',
        status: 'completed',
        metadata: {
          paymentId: 'pay123',
          userId: 'user456',
          planId: 'plan789',
        },
      };

      // Generate valid signature
      const payload = JSON.stringify({
        transaction_id: webhookData.transaction_id,
        status: webhookData.status,
        metadata: webhookData.metadata,
      });
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload);
      const validSignature = hmac.digest('hex');

      webhookData.signature = validSignature;

      const result = PaymentService.verifyDaimoSignature(webhookData);

      expect(result).toBe(true);
    });

    it('should reject invalid Daimo signature', () => {
      process.env.DAIMO_WEBHOOK_SECRET = 'test-webhook-secret';

      const webhookData = {
        transaction_id: 'txn123',
        status: 'completed',
        signature: 'invalid-signature-xyz',
      };

      const result = PaymentService.verifyDaimoSignature(webhookData);

      expect(result).toBe(false);
    });

    it('should reject tampered Daimo webhook data', () => {
      const secret = 'test-webhook-secret';
      process.env.DAIMO_WEBHOOK_SECRET = secret;

      const webhookData = {
        transaction_id: 'txn123',
        status: 'completed',
        amount: 10.00,
      };

      // Generate signature for original data
      const payload = JSON.stringify({
        transaction_id: webhookData.transaction_id,
        status: webhookData.status,
        amount: webhookData.amount,
      });
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload);
      const validSignature = hmac.digest('hex');

      webhookData.signature = validSignature;

      // Tamper with amount
      webhookData.amount = 100.00;

      const result = PaymentService.verifyDaimoSignature(webhookData);

      expect(result).toBe(false);
    });
  });

  describe('Retry Logic with Exponential Backoff', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await PaymentService.retryWithBackoff(
        operation,
        3,
        'test-operation',
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValue('success');

      const result = await PaymentService.retryWithBackoff(
        operation,
        3,
        'test-operation',
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'));

      await expect(
        PaymentService.retryWithBackoff(operation, 2, 'test-operation'),
      ).rejects.toThrow('Persistent failure');

      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should use exponential backoff delays', async () => {
      jest.useFakeTimers();

      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValue('success');

      const promise = PaymentService.retryWithBackoff(
        operation,
        2,
        'test-operation',
      );

      // First call happens immediately
      await Promise.resolve();
      expect(operation).toHaveBeenCalledTimes(1);

      // First retry after 1000ms (2^0 * 1000)
      await jest.advanceTimersByTimeAsync(1000);
      expect(operation).toHaveBeenCalledTimes(2);

      // Second retry after 2000ms (2^1 * 1000)
      await jest.advanceTimersByTimeAsync(2000);
      expect(operation).toHaveBeenCalledTimes(3);

      await promise;

      jest.useRealTimers();
    });

    it('should cap delay at 10 seconds', async () => {
      jest.useFakeTimers();

      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockRejectedValueOnce(new Error('Failure 3'))
        .mockRejectedValueOnce(new Error('Failure 4'))
        .mockResolvedValue('success');

      const promise = PaymentService.retryWithBackoff(
        operation,
        4,
        'test-operation',
      );

      // First call
      await Promise.resolve();

      // Retry 1: 1000ms (2^0 * 1000)
      await jest.advanceTimersByTimeAsync(1000);

      // Retry 2: 2000ms (2^1 * 1000)
      await jest.advanceTimersByTimeAsync(2000);

      // Retry 3: 4000ms (2^2 * 1000)
      await jest.advanceTimersByTimeAsync(4000);

      // Retry 4: 8000ms (2^3 * 1000)
      await jest.advanceTimersByTimeAsync(8000);

      // Retry 5: would be 16000ms but capped at 10000ms
      await jest.advanceTimersByTimeAsync(10000);

      const result = await promise;
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(5);

      jest.useRealTimers();
    }, 30000);
  });

  describe('ePayco Recovery Robustness', () => {
    it('should recover webhook context from payment record when extras are missing', async () => {
      const payment = {
        id: '4a8f5d18-9f02-4ca8-a0c4-c1507e8f8ff8',
        userId: '8599671840',
        planId: 'diamond-pass',
      };

      PaymentModel.getById.mockResolvedValue(payment);
      PaymentModel.updateStatus.mockResolvedValue(true);

      const result = await PaymentService.processEpaycoWebhook({
        x_ref_payco: '335234189',
        x_transaction_id: '3352341891770988814',
        x_transaction_state: 'Pendiente',
        x_cod_transaction_state: '3',
        x_amount: '399960',
        x_currency_code: 'COP',
        x_customer_email: 'test@example.com',
      });

      expect(result.success).toBe(true);
      expect(PaymentModel.getById).toHaveBeenCalledWith('335234189');
      expect(PaymentModel.updateStatus).toHaveBeenCalledWith(
        '4a8f5d18-9f02-4ca8-a0c4-c1507e8f8ff8',
        'pending',
        expect.objectContaining({
          epayco_ref: '335234189',
          transaction_id: '3352341891770988814',
        }),
      );
    });

    it('should backfill x_extra fields during recovery replay', async () => {
      const paymentId = '9f11d5cd-ec86-4625-bcd5-ffeb9a008730';
      const refPayco = '339999001';

      jest.spyOn(PaymentService, 'checkEpaycoTransactionStatus').mockResolvedValue({
        success: true,
        needsRecovery: true,
        currentStatus: 'Aprobada',
        statusData: {
          estado: 'Aprobada',
          reference: refPayco,
          transactionId: 'trx-ep-001',
        },
        transactionData: {
          data: [{ estado: 'Aprobada', ref_payco: refPayco, transaction_id: 'trx-ep-001' }],
        },
      });

      const processSpy = jest.spyOn(PaymentService, 'processEpaycoWebhook')
        .mockResolvedValue({ success: true });

      PaymentModel.getById.mockResolvedValue({
        id: paymentId,
        userId: '8391276595',
        planId: 'week-trial-pass',
        amount: 14.99,
        currency: 'USD',
      });

      const result = await PaymentService.recoverStuckPendingPayment(paymentId, refPayco);

      expect(result.success).toBe(true);
      expect(result.webhookReplayed).toBe(true);
      expect(processSpy).toHaveBeenCalledWith(expect.objectContaining({
        x_ref_payco: refPayco,
        x_extra1: '8391276595',
        x_extra2: 'week-trial-pass',
        x_extra3: paymentId,
        _recovery: true,
      }));

      PaymentService.checkEpaycoTransactionStatus.mockRestore();
      processSpy.mockRestore();
    });

    it('should extract transaction status from array-based payloads', () => {
      const extracted = PaymentService.extractEpaycoStatusFromPayload({
        data: [
          {
            estado: 'Aprobada',
            ref_payco: '338887766',
            transaction_id: 'tx-338887766',
            extras: {
              extra1: '12345',
              extra2: 'week-pass',
              extra3: 'pay-uuid-1',
            },
          },
        ],
      });

      expect(extracted).toEqual(expect.objectContaining({
        estado: 'Aprobada',
        reference: '338887766',
        transactionId: 'tx-338887766',
        extra1: '12345',
        extra2: 'week-pass',
        extra3: 'pay-uuid-1',
      }));
    });
  });

  describe('Production Security Checks', () => {
    it('should enforce strict security in production environment', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.EPAYCO_PRIVATE_KEY;

      const webhookData = {
        x_ref_payco: 'ref123',
        x_signature: 'test',
      };

      expect(() => {
        PaymentService.verifyEpaycoSignature(webhookData);
      }).toThrow();
    });

    it('should be lenient in development environment', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.DAIMO_WEBHOOK_SECRET;

      const webhookData = {
        transaction_id: 'txn123',
        signature: 'test',
      };

      const result = PaymentService.verifyDaimoSignature(webhookData);
      expect(result).toBe(true);
    });
  });
});
