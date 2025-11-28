const { getFirestore } = require('../config/firebase');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Plan Model - Handles subscription plan data with Firestore
 */
class Plan {
  static COLLECTION = 'plans';

  /**
   * Get all active plans (with caching)
   * @returns {Promise<Array>} All subscription plans
   */
  static async getAll() {
    try {
      const cacheKey = 'plans:all';

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();
          const snapshot = await db
            .collection(this.COLLECTION)
            .where('active', '==', true)
            .orderBy('price', 'asc')
            .get();

          // Firestore snapshots in tests may provide either `docs` array or implement `forEach`.
          let plans = [];
          if (snapshot && Array.isArray(snapshot.docs)) {
            plans = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          } else if (snapshot && typeof snapshot.forEach === 'function') {
            snapshot.forEach((doc) => {
              plans.push({ id: doc.id, ...doc.data() });
            });
          }

          logger.info(`Fetched ${plans.length} plans from Firestore`);
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
   * Get plan by ID (with caching)
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
          const doc = await db.collection(this.COLLECTION).doc(planId).get();

          if (!doc.exists) {
            logger.warn(`Plan not found: ${planId}`);
            return null;
          }

          logger.info(`Fetched plan from Firestore: ${planId}`);
          return {
            id: doc.id,
            ...doc.data(),
          };
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
      // Auto-generate SKU if not provided
      const data = { ...planData };
      if (!data.sku && data.duration) {
        data.sku = this.generateSKU(planId, data.duration);
        logger.info(`Auto-generated SKU: ${data.sku} for plan: ${planId}`);
      }

      const db = getFirestore();

      // Check if document exists to determine createdAt
      const docRef = db.collection(this.COLLECTION).doc(planId);
      // Let errors bubble up if the underlying DB read fails (tests expect failures)
      const existing = await docRef.get();
      const docExists = !!existing && !!existing.exists;

      const planDoc = {
        id: planId,
        sku: data.sku,
        name: data.name,
        nameEs: data.nameEs,
        price: data.price,
        currency: data.currency || 'USD',
        duration: data.duration || 30,
        features: data.features || [],
        featuresEs: data.featuresEs || [],
        active: data.active !== undefined ? data.active : true,
        updatedAt: new Date(),
        createdAt: docExists ? undefined : new Date(),
      };

      await db.collection(this.COLLECTION).doc(planId).set(planDoc, { merge: true });

      // Invalidate cache
      await cache.del(`plan:${planId}`);
      await cache.del('plans:all');

      logger.info('Plan created/updated', { planId, sku: data.sku });
      return planDoc;
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
      await db.collection(this.COLLECTION).doc(planId).delete();

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
   * SKU format: EASYBOT-{CLIENT}-{DURATION}D
   * Example: EASYBOT-PNP-7D, EASYBOT-PNP-30D
   * @param {string} planId - Plan ID
   * @param {number} duration - Duration in days
   * @returns {string} Generated SKU
   */
  static generateSKU(planId, duration) {
    // Extract client identifier from plan ID or use PNP as default
    const client = 'PNP';
    return `EASYBOT-${client}-${duration}D`;
  }

  /**
   * Get default plans (fallback if database is empty)
   * @returns {Array} Default plans
   */
  static getDefaultPlans() {
    return [
      {
        id: 'trial_week',
        sku: 'EASYBOT-PNP-7D',
        name: 'Trial Week',
        nameEs: 'Semana de Prueba',
        price: 14.99,
        currency: 'USD',
        duration: 7,
        features: [
          'Premium channel access',
          'Access to Nearby Members feature',
          'Zoom meeting access: 1 per week',
        ],
        featuresEs: [
          'Acceso a canales premium',
          'Acceso a función Miembros Cercanos',
          'Acceso a reuniones Zoom: 1 por semana',
        ],
        active: true,
      },
      {
        id: 'pnp_member',
        sku: 'EASYBOT-PNP-30D',
        name: 'PNP Member',
        nameEs: 'Miembro PNP',
        price: 29.99,
        currency: 'USD',
        duration: 30,
        features: [
          'Everything in Trial Week',
          'Unlimited premium channel access',
          'Zoom meeting access: 2 per week',
          'Priority customer support',
        ],
        featuresEs: [
          'Todo en Semana de Prueba',
          'Acceso ilimitado a canales premium',
          'Acceso a reuniones Zoom: 2 por semana',
          'Soporte prioritario al cliente',
        ],
        active: true,
      },
      {
        id: 'crystal_member',
        sku: 'EASYBOT-PNP-30D-CRYSTAL',
        name: 'Crystal Member',
        nameEs: 'Miembro Crystal',
        price: 59.99,
        currency: 'USD',
        duration: 30,
        features: [
          'Everything in PNP Member',
          'Zoom meeting access: 4 per week',
          'Exclusive content access',
          'Early access to new features',
        ],
        featuresEs: [
          'Todo en Miembro PNP',
          'Acceso a reuniones Zoom: 4 por semana',
          'Acceso a contenido exclusivo',
          'Acceso anticipado a nuevas funciones',
        ],
        active: true,
      },
      {
        id: 'diamond_member',
        sku: 'EASYBOT-PNP-30D-DIAMOND',
        name: 'Diamond Member',
        nameEs: 'Miembro Diamond',
        price: 89.99,
        currency: 'USD',
        duration: 30,
        features: [
          'Everything in Crystal Member',
          'Unlimited Zoom meeting access',
          'VIP customer support',
          'Custom profile badge',
          'Access to exclusive events',
        ],
        featuresEs: [
          'Todo en Miembro Crystal',
          'Acceso ilimitado a reuniones Zoom',
          'Soporte VIP al cliente',
          'Insignia de perfil personalizada',
          'Acceso a eventos exclusivos',
        ],
        active: true,
      },
      {
        id: 'lifetime_pass',
        sku: 'EASYBOT-PNP-LIFETIME',
        name: 'Lifetime Pass',
        nameEs: 'Pase de por Vida',
        price: 499.99,
        currency: 'USD',
        duration: 36500, // 100 years
        features: [
          'Everything in Diamond Member',
          'Lifetime access to all features',
          'Never pay again',
          'Founder badge',
          'Priority feature requests',
        ],
        featuresEs: [
          'Todo en Miembro Diamond',
          'Acceso de por vida a todas las funciones',
          'Nunca vuelvas a pagar',
          'Insignia de fundador',
          'Solicitudes de funciones prioritarias',
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

module.exports = Plan;
