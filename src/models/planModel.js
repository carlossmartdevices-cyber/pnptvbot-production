const { getFirestore } = require('../config/firebase');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

const COLLECTION = 'plans';

/**
 * Plan Model - Handles subscription plan data
 */
class PlanModel {
  /**
   * Get all plans (with optimized caching)
   * @returns {Promise<Array>} All subscription plans
   */
  static async getAll() {
    try {
      const cacheKey = 'plans:all';

      // Use getOrSet for simplified cache-aside pattern
      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();
          const snapshot = await db.collection(COLLECTION)
            .where('active', '==', true)
            .orderBy('price', 'asc')
            .get();

          const plans = [];
          snapshot.forEach((doc) => {
            plans.push({ id: doc.id, ...doc.data() });
          });

          logger.info(`Fetched ${plans.length} plans from database`);
          return plans.length > 0 ? plans : this.getDefaultPlans();
        },
        3600, // Cache for 1 hour
      );
    } catch (error) {
      logger.error('Error getting plans:', error);
      return this.getDefaultPlans();
    }
  }

  /**
   * Get plan by ID (with optimized caching)
   * @param {string} planId - Plan ID
   * @returns {Promise<Object|null>} Plan data
   */
  static async getById(planId) {
    try {
      const cacheKey = `plan:${planId}`;

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();
          const doc = await db.collection(COLLECTION).doc(planId).get();

          if (!doc.exists) {
            logger.warn(`Plan not found: ${planId}`);
            return null;
          }

          const plan = { id: doc.id, ...doc.data() };
          logger.info(`Fetched plan from database: ${planId}`);
          return plan;
        },
        3600, // Cache for 1 hour
      );
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
      const db = getFirestore();
      const planRef = db.collection(COLLECTION).doc(planId);

      const data = {
        ...planData,
        updatedAt: new Date(),
      };

      // Auto-generate SKU if not provided
      if (!data.sku && data.duration) {
        data.sku = this.generateSKU(planId, data.duration);
        logger.info(`Auto-generated SKU: ${data.sku} for plan: ${planId}`);
      }

      const doc = await planRef.get();
      if (!doc.exists) {
        data.createdAt = new Date();
      }

      await planRef.set(data, { merge: true });

      // Invalidate cache
      await cache.del(`plan:${planId}`);
      await cache.del('plans:all');

      logger.info('Plan created/updated', { planId, sku: data.sku });
      return { id: planId, ...data };
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
  static async delete(planId) {
    try {
      const db = getFirestore();
      await db.collection(COLLECTION).doc(planId).delete();

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
   * Generate SKU for a plan
   * SKU format: PNPTV-{PLANID}-{DURATION}D
   * Example: PNPTV-BASIC-30D, PNPTV-PREMIUM-30D
   * @param {string} planId - Plan ID
   * @param {number} duration - Duration in days
   * @returns {string} Generated SKU
   */
  static generateSKU(planId, duration) {
    const planIdUpper = planId.toUpperCase();
    return `PNPTV-${planIdUpper}-${duration}D`;
  }

  /**
   * Get default plans (fallback if database is empty)
   * @returns {Array} Default plans
   */
  static getDefaultPlans() {
    return [
      {
        id: 'basic',
        sku: 'PNPTV-BASIC-30D', // SKU for invoices and reports
        name: 'Basic',
        nameEs: 'Básico',
        price: 9.99,
        currency: 'USD',
        duration: 30, // days
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
        sku: 'PNPTV-PREMIUM-30D',
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
        sku: 'PNPTV-GOLD-30D',
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

  /**
   * Prewarm cache with all plans
   * Call this on application startup to ensure fast first requests
   * @returns {Promise<boolean>} Success status
   */
  static async prewarmCache() {
    try {
      logger.info('Prewarming plans cache...');

      // Load all plans into cache
      const plans = await this.getAll();

      // Load individual plan caches
      for (const plan of plans) {
        await this.getById(plan.id);
      }

      logger.info(`Cache prewarmed with ${plans.length} plans`);
      return true;
    } catch (error) {
      logger.error('Error prewarming plans cache:', error);
      return false;
    }
  }

  /**
   * Invalidate all plan caches
   * @returns {Promise<boolean>} Success status
   */
  static async invalidateCache() {
    try {
      await cache.delPattern('plan:*');
      await cache.del('plans:all');
      logger.info('All plan caches invalidated');
      return true;
    } catch (error) {
      logger.error('Error invalidating plan cache:', error);
      return false;
    }
  }
}

module.exports = PlanModel;
