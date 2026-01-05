// Mock dependencies
jest.mock('../../../src/config/postgres', () => ({
  query: jest.fn(),
}));
jest.mock('uuid');

const PaymentModel = require('../../../src/models/paymentModel');
const { query } = require('../../../src/config/postgres');
const { v4: uuidv4 } = require('uuid');

describe('PaymentModel', () => {
  const now = new Date();
  const defaultRows = [
    {
      id: 'payment-123',
      payment_id: 'payment-123',
      user_id: '123456789',
      plan_id: 'basic',
      provider: 'epayco',
      amount: 9.99,
      currency: 'USD',
      status: 'pending',
      reference: 'ref-123',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'payment-456',
      payment_id: 'payment-456',
      user_id: '123456789',
      plan_id: 'premium',
      provider: 'daimo',
      amount: 19.99,
      currency: 'USD',
      status: 'completed',
      reference: 'txn-123',
      created_at: now,
      updated_at: now,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rows: defaultRows });
    uuidv4.mockReturnValue('test-uuid-123');
  });

  describe('create', () => {
    it('should create payment with generated ID', async () => {
      const paymentData = {
        userId: 123456789,
        amount: 9.99,
        currency: 'USD',
        planId: 'basic',
        provider: 'epayco',
      };

      const result = await PaymentModel.create(paymentData);

      expect(result).toBeDefined();
      expect(result.id).toBe('test-uuid-123');
      expect(result.status).toBe('pending');
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payments'),
        expect.any(Array)
      );
    });

    it('should create payment with provided ID', async () => {
      const paymentData = {
        paymentId: 'custom-id',
        userId: 123456789,
        amount: 19.99,
      };

      const result = await PaymentModel.create(paymentData);

      expect(result.id).toBe('custom-id');
    });

    it('should handle errors', async () => {
      query.mockRejectedValueOnce(new Error('Database error'));

      await expect(PaymentModel.create({ userId: 123 })).rejects.toThrow();
    });
  });

  describe('getById', () => {
    it('should get payment by ID', async () => {
      const result = await PaymentModel.getById('payment-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('payment-123');
      expect(result.amount).toBe(9.99);
    });

    it('should return null for non-existent payment', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await PaymentModel.getById('non-existent');

      expect(result).toBeNull();
    });

    it('should handle errors', async () => {
      query.mockRejectedValueOnce(new Error('Database error'));

      const result = await PaymentModel.getById('payment-123');

      expect(result).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('should update payment status', async () => {
      const result = await PaymentModel.updateStatus('payment-123', 'success', {
        transactionId: 'txn-456',
      });

      expect(result).toBe(true);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE payments SET'),
        expect.arrayContaining(['success', expect.any(Date)])
      );
    });

    it('should handle errors', async () => {
      query.mockRejectedValueOnce(new Error('Update failed'));

      const result = await PaymentModel.updateStatus('payment-123', 'failed');

      expect(result).toBe(false);
    });
  });

  describe('getByUser', () => {
    it('should get user payments', async () => {
      const result = await PaymentModel.getByUser(123456789);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should limit results', async () => {
      await PaymentModel.getByUser(123456789, 10);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC LIMIT $2'),
        expect.arrayContaining(['123456789', 10])
      );
    });

    it('should handle errors', async () => {
      query.mockRejectedValueOnce(new Error('Query error'));

      const result = await PaymentModel.getByUser(123456789);

      expect(result).toEqual([]);
    });
  });

  describe('getByStatus', () => {
    it('should get payments by status', async () => {
      const result = await PaymentModel.getByStatus('pending');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        ['pending', expect.any(Number)]
      );
    });

    it('should handle errors', async () => {
      query.mockRejectedValueOnce(new Error('Query error'));

      const result = await PaymentModel.getByStatus('success');

      expect(result).toEqual([]);
    });
  });

  describe('getByTransactionId', () => {
    it('should get payment by transaction ID', async () => {
      query.mockResolvedValueOnce({
        rows: [{
          id: 'payment-456',
          payment_id: 'payment-456',
          user_id: 'user-123',
          plan_id: 'basic',
          provider: 'epayco',
          amount: 19.99,
          currency: 'USD',
          status: 'completed',
          reference: 'txn-123',
          created_at: now,
          updated_at: now,
        }],
      });

      const result = await PaymentModel.getByTransactionId('txn-123', 'epayco');

      expect(result).toBeDefined();
      expect(result.id).toBe('payment-456');
      expect(result.reference).toBe('txn-123');
    });

    it('should return null when not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await PaymentModel.getByTransactionId('non-existent', 'epayco');

      expect(result).toBeNull();
    });

    it('should handle errors', async () => {
      query.mockRejectedValueOnce(new Error('Query error'));

      const result = await PaymentModel.getByTransactionId('txn-123', 'epayco');

      expect(result).toBeNull();
    });
  });

  describe('getRevenue', () => {
    it('should calculate revenue statistics', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ total: 59.97, count: 3 }] }) // statsResult
        .mockResolvedValueOnce({
          rows: [
            { plan_id: 'basic', count: 1 },
            { plan_id: 'premium', count: 1 },
          ],
        }) // byPlanResult
        .mockResolvedValueOnce({
          rows: [
            { provider: 'epayco', count: 2, total: 29.98 },
            { provider: 'daimo', count: 1, total: 29.99 },
          ],
        }); // byProviderResult

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const result = await PaymentModel.getRevenue(startDate, endDate);

      expect(result.total).toBe(59.97);
      expect(result.count).toBe(3);
      expect(result.average).toBeCloseTo(19.99, 2);
      expect(result.byPlan).toHaveProperty('basic', 1);
      expect(result.byPlan).toHaveProperty('premium', 1);
      expect(result.byProvider).toHaveProperty('epayco');
      expect(result.byProvider).toHaveProperty('daimo');
    });

    it('should handle errors', async () => {
      query.mockRejectedValueOnce(new Error('Query error'));

      const result = await PaymentModel.getRevenue(new Date(), new Date());

      expect(result.total).toBe(0);
      expect(result.count).toBe(0);
      expect(result.average).toBe(0);
    });
  });
});
