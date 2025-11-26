// Mock dependencies
jest.mock('../../../src/config/postgres');
jest.mock('../../../src/config/redis');

const PlanModel = require('../../../src/models/planModel');
const { query } = require('../../../src/config/postgres');
const { cache } = require('../../../src/config/redis');

describe('PlanModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock cache
    cache.get = jest.fn().mockResolvedValue(null);
    cache.set = jest.fn().mockResolvedValue(true);
    cache.del = jest.fn().mockResolvedValue(true);
    cache.delPattern = jest.fn().mockResolvedValue(true);
    cache.getOrSet = jest.fn().mockImplementation(async (key, fn) => fn());
  });

  describe('getAll', () => {
    it('should get all plans from database', async () => {
      const plans = [
        { id: 'basic', name: 'Basic', price: 9.99, active: true },
        { id: 'premium', name: 'Premium', price: 19.99, active: true },
      ];

      query.mockResolvedValue({ rows: plans });

      const result = await PlanModel.getAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM plans WHERE active = true ORDER BY price ASC'
      );
      expect(cache.getOrSet).toHaveBeenCalled();
    });

    it('should return cached plans', async () => {
      const cachedPlans = [
        { id: 'basic', name: 'Basic', price: 9.99 },
      ];
      cache.getOrSet.mockResolvedValue(cachedPlans);

      const result = await PlanModel.getAll();

      expect(result).toEqual(cachedPlans);
    });

    it('should return default plans on error', async () => {
      query.mockRejectedValue(new Error('Database error'));

      const result = await PlanModel.getAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
    });
  });

  describe('getById', () => {
    it('should get plan by ID from database', async () => {
      const planData = {
        id: 'basic',
        name: 'Basic',
        price: 9.99,
        active: true,
      };

      query.mockResolvedValue({ rows: [planData] });

      const result = await PlanModel.getById('basic');

      expect(result).toBeDefined();
      expect(result.id).toBe('basic');
      expect(result.name).toBe('Basic');
      expect(cache.getOrSet).toHaveBeenCalled();
    });

    it('should return cached plan', async () => {
      const cachedPlan = { id: 'basic', name: 'Basic', price: 9.99 };
      cache.getOrSet.mockResolvedValue(cachedPlan);

      const result = await PlanModel.getById('basic');

      expect(result).toEqual(cachedPlan);
    });

    it('should return null for non-existent plan', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await PlanModel.getById('non-existent');

      expect(result).toBeNull();
    });

    it('should handle errors', async () => {
      query.mockRejectedValue(new Error('Database error'));

      const result = await PlanModel.getById('basic');

      expect(result).toBeNull();
    });
  });

  describe('createOrUpdate', () => {
    it('should create new plan', async () => {
      query.mockResolvedValue({ rowCount: 1 });

      const planData = {
        name: 'New Plan',
        price: 29.99,
        active: true,
      };

      const result = await PlanModel.createOrUpdate('new-plan', planData);

      expect(result).toBeDefined();
      expect(result.name).toBe('New Plan');
      expect(query).toHaveBeenCalled();
      expect(cache.del).toHaveBeenCalledWith('plan:new-plan');
      expect(cache.del).toHaveBeenCalledWith('plans:all');
    });

    it('should update existing plan', async () => {
      query.mockResolvedValue({ rowCount: 1 });

      const planData = {
        name: 'Updated Plan',
        price: 39.99,
      };

      const result = await PlanModel.createOrUpdate('existing-plan', planData);

      expect(result).toBeDefined();
      expect(result.name).toBe('Updated Plan');
      expect(query).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      query.mockRejectedValue(new Error('Database error'));

      await expect(PlanModel.createOrUpdate('plan-id', {})).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete plan', async () => {
      query.mockResolvedValue({ rowCount: 1 });

      const result = await PlanModel.delete('plan-to-delete');

      expect(result).toBe(true);
      expect(query).toHaveBeenCalled();
      expect(cache.del).toHaveBeenCalledWith('plan:plan-to-delete');
      expect(cache.del).toHaveBeenCalledWith('plans:all');
    });

    it('should handle errors', async () => {
      query.mockRejectedValue(new Error('Delete failed'));

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
      query.mockResolvedValue({ rowCount: 1 });

      const result = await PlanModel.initializeDefaultPlans();

      expect(result).toBe(true);
      expect(query).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      query.mockRejectedValue(new Error('Initialization failed'));

      const result = await PlanModel.initializeDefaultPlans();

      expect(result).toBe(false);
    });
  });
});
