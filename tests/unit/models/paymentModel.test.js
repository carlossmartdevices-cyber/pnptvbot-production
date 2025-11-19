// Mock dependencies
jest.mock('../../../src/config/postgres');
jest.mock('uuid');

const PaymentModel = require('../../../src/models/paymentModel');
const { query } = require('../../../src/config/postgres');
const { v4: uuidv4 } = require('uuid');

describe('PaymentModel', () => {
  const mockUuid = '123e4567-e89b-12d3-a456-426614174000';
  const mockPaymentId = '987fcdeb-51a2-43d7-b123-456789abcdef';

  beforeEach(() => {
    jest.clearAllMocks();
    uuidv4.mockReturnValue(mockUuid);
  });

  describe('create', () => {
    it('should create payment with generated ID', async () => {
      query.mockResolvedValue({ rows: [], rowCount: 1 });

      const paymentData = {
        userId: 123456789,
        amount: 9.99,
        currency: 'USD',
        planId: 'basic',
        provider: 'epayco',
      };

      const result = await PaymentModel.create(paymentData);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockUuid);
      expect(result.status).toBe('pending');
      expect(result.amount).toBe(9.99);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(query).toHaveBeenCalled();
    });

    it('should create payment with provided ID', async () => {
      query.mockResolvedValue({ rows: [], rowCount: 1 });

      const customId = '550e8400-e29b-41d4-a716-446655440000';
      const paymentData = {
        paymentId: customId,
        userId: 123456789,
        amount: 19.99,
      };

      const result = await PaymentModel.create(paymentData);

      expect(result.id).toBe(customId);
      expect(query).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      query.mockRejectedValue(new Error('Database error'));

      await expect(PaymentModel.create({ userId: 123 })).rejects.toThrow();
    });
  });

  describe('getById', () => {
    it('should get payment by ID', async () => {
      const paymentData = {
        id: mockPaymentId,
        user_id: '123456789',
        amount: 9.99,
        status: 'success',
      };

      query.mockResolvedValue({ rows: [paymentData] });

      const result = await PaymentModel.getById(mockPaymentId);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockPaymentId);
      expect(result.amount).toBe(9.99);
    });

    it('should return null for non-existent payment', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await PaymentModel.getById('550e8400-e29b-41d4-a716-446655440099');

      expect(result).toBeNull();
    });

    it('should handle errors', async () => {
      query.mockRejectedValue(new Error('Database error'));

      const result = await PaymentModel.getById(mockPaymentId);

      expect(result).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('should update payment status', async () => {
      query.mockResolvedValue({ rowCount: 1 });

      const result = await PaymentModel.updateStatus(mockPaymentId, 'success', {
        transactionId: 'txn-456',
      });

      expect(result).toBe(true);
      expect(query).toHaveBeenCalled();
      const callArgs = query.mock.calls[0];
      expect(callArgs[0]).toContain('UPDATE payments');
      expect(callArgs[0]).toContain('status = $1');
      expect(callArgs[0]).toContain('payment_id = $2'); // transactionId mapped to payment_id
    });

    it('should handle errors', async () => {
      query.mockRejectedValue(new Error('Update failed'));

      const result = await PaymentModel.updateStatus(mockPaymentId, 'failed');

      expect(result).toBe(false);
    });
  });

  describe('getByUser', () => {
    it('should get user payments', async () => {
      const payments = [
        { id: mockUuid, user_id: '123456789', amount: 9.99 },
        { id: mockPaymentId, user_id: '123456789', amount: 19.99 },
      ];

      query.mockResolvedValue({ rows: payments });

      const result = await PaymentModel.getByUser(123456789);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1'),
        ['123456789', 20]
      );
    });

    it('should limit results', async () => {
      query.mockResolvedValue({ rows: [] });

      await PaymentModel.getByUser(123456789, 10);

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        ['123456789', 10]
      );
    });

    it('should handle errors', async () => {
      query.mockRejectedValue(new Error('Query error'));

      const result = await PaymentModel.getByUser(123456789);

      expect(result).toEqual([]);
    });
  });

  describe('getByStatus', () => {
    it('should get payments by status', async () => {
      const payments = [
        { id: mockUuid, status: 'pending', amount: 9.99 },
      ];

      query.mockResolvedValue({ rows: payments });

      const result = await PaymentModel.getByStatus('pending');

      expect(Array.isArray(result)).toBe(true);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        ['pending', 100]
      );
    });

    it('should handle errors', async () => {
      query.mockRejectedValue(new Error('Query error'));

      const result = await PaymentModel.getByStatus('success');

      expect(result).toEqual([]);
    });
  });

  describe('getByTransactionId', () => {
    it('should get payment by transaction ID', async () => {
      const paymentData = {
        id: mockPaymentId,
        payment_id: 'txn-123',
        provider: 'epayco',
        amount: 9.99,
      };

      query.mockResolvedValue({ rows: [paymentData] });

      const result = await PaymentModel.getByTransactionId('txn-123', 'epayco');

      expect(result).toBeDefined();
      expect(result.id).toBe(mockPaymentId);
      expect(result.payment_id).toBe('txn-123');
    });

    it('should return null when not found', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await PaymentModel.getByTransactionId('non-existent', 'epayco');

      expect(result).toBeNull();
    });

    it('should handle errors', async () => {
      query.mockRejectedValue(new Error('Query error'));

      const result = await PaymentModel.getByTransactionId('txn-123', 'epayco');

      expect(result).toBeNull();
    });
  });

  describe('getRevenue', () => {
    it('should calculate revenue statistics', async () => {
      const payments = [
        {
          amount: '9.99',
          plan_id: 'basic',
          provider: 'epayco',
        },
        {
          amount: '19.99',
          plan_id: 'premium',
          provider: 'epayco',
        },
        {
          amount: '29.99',
          plan_id: 'gold',
          provider: 'daimo',
        },
      ];

      query.mockResolvedValue({ rows: payments });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const result = await PaymentModel.getRevenue(startDate, endDate);

      expect(result.total).toBeCloseTo(59.97, 2);
      expect(result.count).toBe(3);
      expect(result.average).toBeCloseTo(19.99, 2);
      expect(result.byPlan).toHaveProperty('basic', 1);
      expect(result.byPlan).toHaveProperty('premium', 1);
      expect(result.byProvider).toHaveProperty('epayco', 2);
      expect(result.byProvider).toHaveProperty('daimo', 1);
    });

    it('should handle empty results', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await PaymentModel.getRevenue(new Date(), new Date());

      expect(result.total).toBe(0);
      expect(result.count).toBe(0);
      expect(result.average).toBe(0);
    });

    it('should handle errors', async () => {
      query.mockRejectedValue(new Error('Query error'));

      const result = await PaymentModel.getRevenue(new Date(), new Date());

      expect(result.total).toBe(0);
      expect(result.count).toBe(0);
    });
  });
});
