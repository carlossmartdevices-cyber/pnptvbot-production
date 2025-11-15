// Mock dependencies
jest.mock('../../../src/config/firebase');
jest.mock('uuid');

const PaymentModel = require('../../../src/models/paymentModel');
const { getFirestore } = require('../../../src/config/firebase');
const { v4: uuidv4 } = require('uuid');

describe('PaymentModel', () => {
  let mockDb;
  let mockCollection;
  let mockDoc;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDoc = {
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
      exists: false,
      id: 'test-payment-id',
      data: jest.fn(),
    };

    mockCollection = {
      doc: jest.fn().mockReturnValue(mockDoc),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn(),
    };

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
    };

    getFirestore.mockReturnValue(mockDb);
    uuidv4.mockReturnValue('test-uuid-123');
  });

  describe('create', () => {
    it('should create payment with generated ID', async () => {
      mockDoc.set.mockResolvedValue();

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
      expect(result.amount).toBe(9.99);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(mockDoc.set).toHaveBeenCalled();
    });

    it('should create payment with provided ID', async () => {
      mockDoc.set.mockResolvedValue();

      const paymentData = {
        paymentId: 'custom-id',
        userId: 123456789,
        amount: 19.99,
      };

      const result = await PaymentModel.create(paymentData);

      expect(result.id).toBe('custom-id');
      expect(mockCollection.doc).toHaveBeenCalledWith('custom-id');
    });

    it('should handle errors', async () => {
      mockDoc.set.mockRejectedValue(new Error('Database error'));

      await expect(PaymentModel.create({ userId: 123 })).rejects.toThrow();
    });
  });

  describe('getById', () => {
    it('should get payment by ID', async () => {
      const paymentData = {
        userId: 123456789,
        amount: 9.99,
        status: 'success',
      };

      mockDoc.get.mockResolvedValue({
        exists: true,
        id: 'payment-123',
        data: () => paymentData,
      });

      const result = await PaymentModel.getById('payment-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('payment-123');
      expect(result.amount).toBe(9.99);
    });

    it('should return null for non-existent payment', async () => {
      mockDoc.get.mockResolvedValue({ exists: false });

      const result = await PaymentModel.getById('non-existent');

      expect(result).toBeNull();
    });

    it('should handle errors', async () => {
      mockDoc.get.mockRejectedValue(new Error('Database error'));

      const result = await PaymentModel.getById('payment-123');

      expect(result).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('should update payment status', async () => {
      mockDoc.update.mockResolvedValue();

      const result = await PaymentModel.updateStatus('payment-123', 'success', {
        transactionId: 'txn-456',
      });

      expect(result).toBe(true);
      expect(mockDoc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          transactionId: 'txn-456',
          updatedAt: expect.any(Date),
        })
      );
    });

    it('should handle errors', async () => {
      mockDoc.update.mockRejectedValue(new Error('Update failed'));

      const result = await PaymentModel.updateStatus('payment-123', 'failed');

      expect(result).toBe(false);
    });
  });

  describe('getByUser', () => {
    it('should get user payments', async () => {
      const payments = [
        {
          id: '1',
          data: () => ({ userId: '123456789', amount: 9.99 }),
        },
        {
          id: '2',
          data: () => ({ userId: '123456789', amount: 19.99 }),
        },
      ];

      mockCollection.get.mockResolvedValue({
        forEach: (callback) => payments.forEach(callback),
      });

      const result = await PaymentModel.getByUser(123456789);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(mockCollection.where).toHaveBeenCalledWith('userId', '==', '123456789');
    });

    it('should limit results', async () => {
      mockCollection.get.mockResolvedValue({
        forEach: () => {},
      });

      await PaymentModel.getByUser(123456789, 10);

      expect(mockCollection.limit).toHaveBeenCalledWith(10);
    });

    it('should handle errors', async () => {
      mockCollection.get.mockRejectedValue(new Error('Query error'));

      const result = await PaymentModel.getByUser(123456789);

      expect(result).toEqual([]);
    });
  });

  describe('getByStatus', () => {
    it('should get payments by status', async () => {
      const payments = [
        {
          id: '1',
          data: () => ({ status: 'pending', amount: 9.99 }),
        },
      ];

      mockCollection.get.mockResolvedValue({
        forEach: (callback) => payments.forEach(callback),
      });

      const result = await PaymentModel.getByStatus('pending');

      expect(Array.isArray(result)).toBe(true);
      expect(mockCollection.where).toHaveBeenCalledWith('status', '==', 'pending');
    });

    it('should handle errors', async () => {
      mockCollection.get.mockRejectedValue(new Error('Query error'));

      const result = await PaymentModel.getByStatus('success');

      expect(result).toEqual([]);
    });
  });

  describe('getByTransactionId', () => {
    it('should get payment by transaction ID', async () => {
      const paymentData = {
        transactionId: 'txn-123',
        provider: 'epayco',
        amount: 9.99,
      };

      mockCollection.get.mockResolvedValue({
        empty: false,
        docs: [{
          id: 'payment-123',
          data: () => paymentData,
        }],
      });

      const result = await PaymentModel.getByTransactionId('txn-123', 'epayco');

      expect(result).toBeDefined();
      expect(result.id).toBe('payment-123');
      expect(result.transactionId).toBe('txn-123');
    });

    it('should return null when not found', async () => {
      mockCollection.get.mockResolvedValue({
        empty: true,
      });

      const result = await PaymentModel.getByTransactionId('non-existent', 'epayco');

      expect(result).toBeNull();
    });

    it('should handle errors', async () => {
      mockCollection.get.mockRejectedValue(new Error('Query error'));

      const result = await PaymentModel.getByTransactionId('txn-123', 'epayco');

      expect(result).toBeNull();
    });
  });

  describe('getRevenue', () => {
    it('should calculate revenue statistics', async () => {
      const payments = [
        {
          data: () => ({
            amount: 9.99,
            planId: 'basic',
            provider: 'epayco',
          }),
        },
        {
          data: () => ({
            amount: 19.99,
            planId: 'premium',
            provider: 'epayco',
          }),
        },
        {
          data: () => ({
            amount: 29.99,
            planId: 'gold',
            provider: 'daimo',
          }),
        },
      ];

      mockCollection.get.mockResolvedValue({
        forEach: (callback) => payments.forEach(callback),
      });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const result = await PaymentModel.getRevenue(startDate, endDate);

      expect(result.total).toBe(59.97);
      expect(result.count).toBe(3);
      expect(result.average).toBeCloseTo(19.99, 2);
      expect(result.byPlan).toHaveProperty('basic', 1);
      expect(result.byPlan).toHaveProperty('premium', 1);
      expect(result.byProvider).toHaveProperty('epayco', 2);
      expect(result.byProvider).toHaveProperty('daimo', 1);
    });

    it('should handle empty results', async () => {
      mockCollection.get.mockResolvedValue({
        forEach: () => {},
      });

      const result = await PaymentModel.getRevenue(new Date(), new Date());

      expect(result.total).toBe(0);
      expect(result.count).toBe(0);
      expect(result.average).toBe(0);
    });

    it('should handle errors', async () => {
      mockCollection.get.mockRejectedValue(new Error('Query error'));

      const result = await PaymentModel.getRevenue(new Date(), new Date());

      expect(result.total).toBe(0);
      expect(result.count).toBe(0);
    });
  });
});
