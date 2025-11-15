const { DataTypes, Model, Op } = require('sequelize');
const { getDatabase } = require('../config/database');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Plan Model - PostgreSQL/Sequelize implementation
 */
class Plan extends Model {
  /**
   * Get all active plans
   * @returns {Promise<Array>} All subscription plans
   */
  static async getAll() {
    try {
      const cacheKey = 'plans:all';
      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      const plans = await this.findAll({
        where: { active: true },
        order: [['price', 'ASC']],
      });

      const plansData = plans.map((plan) => plan.toJSON());
      await cache.set(cacheKey, plansData, 3600); // Cache for 1 hour

      return plansData;
    } catch (error) {
      logger.error('Error getting plans:', error);
      return this.getDefaultPlans();
    }
  }

  /**
   * Get plan by ID
   * @param {string} planId - Plan ID
   * @returns {Promise<Object|null>} Plan data
   */
  static async getById(planId) {
    try {
      const cacheKey = `plan:${planId}`;
      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      const plan = await this.findByPk(planId);

      if (plan) {
        const planData = plan.toJSON();
        await cache.set(cacheKey, planData, 3600);
        return planData;
      }

      return null;
    } catch (error) {
      logger.error('Error getting plan:', error);
      return null;
    }
  }

  /**
   * Create or update plan
   * @param {string} planId - Plan ID
   * @param {Object} planData - Plan data
   * @returns {Promise<Object>} Created/updated plan
   */
  static async createOrUpdate(planId, planData) {
    try {
      const [plan] = await this.upsert({
        id: planId,
        name: planData.name,
        nameEs: planData.nameEs,
        price: planData.price,
        currency: planData.currency || 'USD',
        duration: planData.duration || 30,
        features: planData.features || [],
        featuresEs: planData.featuresEs || [],
        active: planData.active !== undefined ? planData.active : true,
      });

      // Invalidate cache
      await cache.del(`plan:${planId}`);
      await cache.del('plans:all');

      logger.info('Plan created/updated', { planId });
      return plan.toJSON();
    } catch (error) {
      logger.error('Error creating/updating plan:', error);
      throw error;
    }
  }

  /**
   * Delete plan
   * @param {string} planId - Plan ID
   * @returns {Promise<boolean>} Success status
   */
  static async deletePlan(planId) {
    try {
      await this.destroy({
        where: { id: planId },
      });

      // Invalidate cache
      await cache.del(`plan:${planId}`);
      await cache.del('plans:all');

      logger.info('Plan deleted', { planId });
      return true;
    } catch (error) {
      logger.error('Error deleting plan:', error);
      return false;
    }
  }

  /**
   * Get default plans (fallback)
   * @returns {Array} Default plans
   */
  static getDefaultPlans() {
    return [
      {
        id: 'basic',
        name: 'Basic',
        nameEs: 'Básico',
        price: 9.99,
        currency: 'USD',
        duration: 30,
        features: [
          'Access to radio',
          'Basic Zoom rooms',
          'Profile customization',
        ],
        featuresEs: [
          'Acceso a radio',
          'Salas Zoom básicas',
          'Personalización de perfil',
        ],
        active: true,
      },
      {
        id: 'premium',
        name: 'Premium',
        nameEs: 'Premium',
        price: 19.99,
        currency: 'USD',
        duration: 30,
        features: [
          'Everything in Basic',
          'Unlimited Zoom rooms',
          'Live streaming',
          'Priority support',
        ],
        featuresEs: [
          'Todo en Básico',
          'Salas Zoom ilimitadas',
          'Transmisiones en vivo',
          'Soporte prioritario',
        ],
        active: true,
      },
      {
        id: 'gold',
        name: 'Gold',
        nameEs: 'Gold',
        price: 29.99,
        currency: 'USD',
        duration: 30,
        features: [
          'Everything in Premium',
          'Advanced analytics',
          'Custom branding',
          'API access',
          'Dedicated support',
        ],
        featuresEs: [
          'Todo en Premium',
          'Analíticas avanzadas',
          'Marca personalizada',
          'Acceso API',
          'Soporte dedicado',
        ],
        active: true,
      },
    ];
  }

  /**
   * Initialize default plans in database
   * @returns {Promise<boolean>} Success status
   */
  static async initializeDefaultPlans() {
    try {
      const defaultPlans = this.getDefaultPlans();

      for (const plan of defaultPlans) {
        await this.createOrUpdate(plan.id, plan);
      }

      logger.info('Default plans initialized');
      return true;
    } catch (error) {
      logger.error('Error initializing default plans:', error);
      return false;
    }
  }
}

/**
 * Initialize Plan model
 * @param {Sequelize} sequelize - Sequelize instance
 * @returns {Plan} Plan model
 */
const initPlanModel = (sequelize) => {
  Plan.init(
    {
      id: {
        type: DataTypes.STRING(50),
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      nameEs: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'name_es',
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'USD',
      },
      duration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 30,
      },
      features: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
      },
      featuresEs: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
        field: 'features_es',
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: 'Plan',
      tableName: 'plans',
      timestamps: true,
      underscored: true,
    },
  );

  return Plan;
};

// Auto-initialize if database is available
try {
  const sequelize = getDatabase();
  initPlanModel(sequelize);
} catch (error) {
  logger.warn('Plan model not initialized yet');
}

module.exports = Plan;
module.exports.initPlanModel = initPlanModel;
