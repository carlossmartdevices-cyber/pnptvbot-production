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

          const plans = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

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
   * SKU format: EASYBOTS-PNP-XXX where XXX is duration in days (3 digits)
   * Example: EASYBOTS-PNP-007 (7 days), EASYBOTS-PNP-030 (30 days), EASYBOTS-PNP-000 (lifetime)
   * @param {string} planId - Plan ID
   * @param {number} duration - Duration in days
   * @returns {string} Generated SKU
   */
  static generateSKU(planId, duration) {
    // For lifetime plans (very large duration), use 000
    if (duration >= 36500 || planId.includes('lifetime')) {
      return 'EASYBOTS-PNP-000';
    }

    // Convert duration to 3-digit format with zero padding
    const durationStr = String(duration).padStart(3, '0');
    return `EASYBOTS-PNP-${durationStr}`;
  }

  /**
   * Get default plans (fallback if database is empty)
   * @returns {Array} Default plans
   */
  static getDefaultPlans() {
    return [
      {
        id: 'trial_week',
        sku: 'EASYBOTS-PNP-007',
        name: 'Trial Week',
        nameEs: 'Semana de Prueba',
        displayName: 'Trial Week',
        tier: 'Basic',
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
          'Acceso a la función Miembros Cercanos',
          'Acceso a reuniones Zoom: 1 por semana',
        ],
        icon: '🎯',
        active: true,
      },
      {
        id: 'pnp_member',
        sku: 'EASYBOTS-PNP-030',
        name: 'PNP Member',
        nameEs: 'Miembro PNP',
        displayName: 'PNP Member',
        tier: 'PNP',
        price: 24.99,
        currency: 'USD',
        duration: 30,
        features: [
          'Everything in Trial Week',
          'Unlimited premium channel access',
          'Zoom meeting access: 2 per week',
          'Priority customer support',
        ],
        featuresEs: [
          'Todo lo de Semana de Prueba',
          'Acceso ilimitado a canales premium',
          'Acceso a reuniones Zoom: 2 por semana',
          'Soporte al cliente prioritario',
        ],
        icon: '⭐',
        active: true,
      },
      {
        id: 'crystal_member',
        sku: 'EASYBOTS-PNP-030',
        name: 'Crystal Member',
        nameEs: 'Miembro Crystal',
        displayName: 'Crystal Member',
        tier: 'Crystal',
        price: 49.99,
        currency: 'USD',
        duration: 30,
        features: [
          'Everything in PNP Member',
          'Zoom meeting access: 4 per week',
          'Exclusive content access',
          'Early access to new features',
        ],
        featuresEs: [
          'Todo lo de Miembro PNP',
          'Acceso a reuniones Zoom: 4 por semana',
          'Acceso a contenido exclusivo',
          'Acceso anticipado a nuevas funciones',
        ],
        icon: '💎',
        active: true,
      },
      {
        id: 'diamond_member',
        sku: 'EASYBOTS-PNP-030',
        name: 'Diamond Member',
        nameEs: 'Miembro Diamond',
        displayName: 'Diamond Member',
        tier: 'Diamond',
        price: 99.99,
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
          'Todo lo de Miembro Crystal',
          'Acceso ilimitado a reuniones Zoom',
          'Soporte al cliente VIP',
          'Insignia de perfil personalizada',
          'Acceso a eventos exclusivos',
        ],
        icon: '👑',
        active: true,
      },
      {
        id: 'lifetime_pass',
        sku: 'EASYBOTS-PNP-000',
        name: 'Lifetime Pass',
        nameEs: 'Pase de por Vida',
        displayName: 'Lifetime Pass',
        tier: 'Premium',
        price: 249.99,
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
          'Todo lo de Miembro Diamond',
          'Acceso de por vida a todas las funciones',
          'No pagues nunca más',
          'Insignia de fundador',
          'Solicitudes de funciones prioritarias',
        ],
        icon: '♾️',
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
