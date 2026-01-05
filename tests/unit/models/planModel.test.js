// Mock dependencies
jest.mock('../../../src/config/firebase');
jest.mock('../../../src/config/redis');
jest.mock('../../../src/config/postgres', () => ({
  query: jest.fn(),
}));

const PlanModel = require('../../../src/models/planModel');
const { cache } = require('../../../src/config/redis');
const { query } = require('../../../src/config/postgres');

describe('PlanModel', () => {
  const now = new Date();
  const planRows = [
    {
      id: 'basic',
      sku: 'BASIC',
      name: 'Basic',
      name_es: 'Basico',
      price: 9.99,
      currency: 'USD',
      duration_days: 30,
      features: ['feature1'],
      features_es: ['caracteristica1'],
      active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'premium',
      sku: 'PREMIUM',
      name: 'Premium',
      name_es: 'Premium',
      price: 19.99,
      currency: 'USD',
      duration_days: 30,
      features: ['feature2'],
      features_es: ['caracteristica2'],
      active: true,
      created_at: now,
      updated_at: now,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rows: planRows });
    cache.getOrSet = jest.fn().mockImplementation(async (_k, fn) => fn());
    cache.get = jest.fn().mockResolvedValue(null);
    cache.set = jest.fn().mockResolvedValue(true);
    cache.del = jest.fn().mockResolvedValue(true);
  });

  describe('getAll', () => {
    it('should get all plans from database', async () => {
      const result = await PlanModel.getAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(cache.getOrSet).toHaveBeenCalled();
    });

    it('should return cached plans', async () => {
      const cachedPlans = [{ id: 'basic', name: 'Basic', price: 9.99 }];
      cache.getOrSet.mockResolvedValueOnce(cachedPlans);

      const result = await PlanModel.getAll();

      expect(result).toEqual(cachedPlans);
    });

    it('should return default plans on error', async () => {
      query.mockRejectedValueOnce(new Error('Database error'));

      const result = await PlanModel.getAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('id');
    });
  });

  describe('getById', () => {
    it('should get plan by ID from database', async () => {
      const result = await PlanModel.getById('basic');

      expect(result).toBeDefined();
      expect(result.id).toBe('basic');
      expect(result.name).toBe('Basic');
      expect(cache.getOrSet).toHaveBeenCalled();
    });

    it('should return null for non-existent plan', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await PlanModel.getById('non-existent');

      expect(result).toBeNull();
    });

    it('should handle errors', async () => {
      query.mockRejectedValueOnce(new Error('Database error'));

      const result = await PlanModel.getById('basic');

      expect(result).toBeNull();
    });
  });

  describe('createOrUpdate', () => {
    it('should create new plan', async () => {
      const planData = {
        name: 'New Plan',
        price: 29.99,
        active: true,
      };

      const result = await PlanModel.createOrUpdate('new-plan', planData);

      expect(result).toBeDefined();
      expect(result.id).toBe('basic'); // from mock rows
      expect(cache.del).toHaveBeenCalledWith('plan:new-plan');
      expect(cache.del).toHaveBeenCalledWith('plans:all');
    });

    it('should update existing plan', async () => {
      const planData = { name: 'Updated Plan', price: 39.99 };

      const result = await PlanModel.createOrUpdate('existing-plan', planData);

      expect(result).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should handle errors', async () => {
      query.mockRejectedValueOnce(new Error('Database error'));

      await expect(PlanModel.createOrUpdate('plan-id', {})).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete plan', async () => {
      const result = await PlanModel.delete('plan-to-delete');

      expect(result).toBe(true);
      expect(cache.del).toHaveBeenCalledWith('plan:plan-to-delete');
      expect(cache.del).toHaveBeenCalledWith('plans:all');
    });

    it('should handle errors', async () => {
      query.mockRejectedValueOnce(new Error('Delete failed'));

      const result = await PlanModel.delete('plan-id');

      expect(result).toBe(false);
    });
  });

  describe('getDefaultPlans', () => {
    it('should return default plans', () => {
      const plans = PlanModel.getDefaultPlans();

      expect(Array.isArray(plans)).toBe(true);
      expect(plans.length).toBeGreaterThan(0);
      expect(plans[0]).toHaveProperty('id');
      expect(plans[0]).toHaveProperty('name');
      expect(plans[0]).toHaveProperty('price');
      expect(plans[0]).toHaveProperty('features');
    });

    it('should have at least 3 default plans', () => {
      const plans = PlanModel.getDefaultPlans();

      expect(plans.length).toBeGreaterThanOrEqual(3);
    });

    it('should have bilingual features', () => {
      const plans = PlanModel.getDefaultPlans();

      plans.forEach(plan => {
        expect(plan).toHaveProperty('name');
        expect(plan).toHaveProperty('nameEs');
        expect(plan).toHaveProperty('features');
        expect(plan).toHaveProperty('featuresEs');
      });
    });
  });

  describe('initializeDefaultPlans', () => {
    it('should initialize default plans', async () => {
      const result = await PlanModel.initializeDefaultPlans();

      expect(result).toBe(true);
      expect(cache.del).toHaveBeenCalledWith('plans:all');
    });

    it('should handle errors', async () => {
      query.mockRejectedValueOnce(new Error('Initialization failed'));

      const result = await PlanModel.initializeDefaultPlans();

      expect(result).toBe(false);
    });
  });
});
