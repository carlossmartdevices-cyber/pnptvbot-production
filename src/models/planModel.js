const { getFirestore } = require('../config/firebase');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

const COLLECTION = 'plans';

/**
 * Plan Model - Handles subscription plan data
 */
class PlanModel {
  /**
   * Get all plans
   * @returns {Promise<Array>} All subscription plans
   */
  static async getAll() {
    try {
      const cacheKey = 'plans:all';
      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      const db = getFirestore();
      const snapshot = await db.collection(COLLECTION)
        .where('active', '==', true)
        .orderBy('price', 'asc')
        .get();

      const plans = [];
      snapshot.forEach((doc) => {
        plans.push({ id: doc.id, ...doc.data() });
      });

      await cache.set(cacheKey, plans, 3600); // Cache for 1 hour

      return plans;
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

      const db = getFirestore();
      const doc = await db.collection(COLLECTION).doc(planId).get();

      if (!doc.exists) {
        return null;
      }

      const plan = { id: doc.id, ...doc.data() };
      await cache.set(cacheKey, plan, 3600);

      return plan;
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

      const doc = await planRef.get();
      if (!doc.exists) {
        data.createdAt = new Date();
      }

      await planRef.set(data, { merge: true });

      // Invalidate cache
      await cache.del(`plan:${planId}`);
      await cache.del('plans:all');

      logger.info('Plan created/updated', { planId });
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
   * Get default plans (fallback if database is empty)
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

module.exports = PlanModel;
