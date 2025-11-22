const { query } = require('../config/postgres');
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
          const result = await query('SELECT * FROM plans WHERE active = true ORDER BY price ASC');
          const plans = result.rows;
          logger.info(`Fetched ${plans.length} plans from PostgreSQL`);
          return plans.length > 0 ? plans : this.getDefaultPlans();
        },
        3600,
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
          const result = await query('SELECT * FROM plans WHERE id = $1', [planId]);
          if (result.rows.length === 0) {
            logger.warn(`Plan not found: ${planId}`);
            return null;
          }
          logger.info(`Fetched plan from PostgreSQL: ${planId}`);
          return result.rows[0];
        },
        3600,
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
      const data = { ...planData };

      await query(`INSERT INTO plans (id, name, display_name, tier, price, price_in_cop, currency, duration, duration_days, description, features, icon, active, recommended, is_lifetime, requires_manual_activation, payment_method, wompi_payment_link, crypto_bonus, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        ON CONFLICT (id) DO UPDATE SET
          name = $2,
          display_name = $3,
          tier = $4,
          price = $5,
          price_in_cop = $6,
          currency = $7,
          duration = $8,
          duration_days = $9,
          description = $10,
          features = $11,
          icon = $12,
          active = $13,
          recommended = $14,
          is_lifetime = $15,
          requires_manual_activation = $16,
          payment_method = $17,
          wompi_payment_link = $18,
          crypto_bonus = $19,
          updated_at = $20`,
        [
          planId,
          data.name,
          data.displayName || data.name,
          data.tier || 'Basic',
          data.price,
          data.priceInCop || null,
          data.currency || 'USD',
          data.duration || 30,
          data.durationDays || data.duration || 30,
          data.description || null,
          JSON.stringify(data.features || []),
          data.icon || null,
          data.active !== undefined ? data.active : true,
          data.recommended || false,
          data.isLifetime || false,
          data.requiresManualActivation || false,
          data.paymentMethod || null,
          data.wompiPaymentLink || null,
          data.cryptoBonus ? JSON.stringify(data.cryptoBonus) : null,
          new Date()
        ]
      );
      await cache.del(`plan:${planId}`);
      await cache.del('plans:all');
      logger.info('Plan created/updated', { planId, tier: data.tier });
      return data;
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
      await query('DELETE FROM plans WHERE id = $1', [planId]);
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
        durationDays: 7,
        description: 'Try premium features for one week',
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
        recommended: false,
        isLifetime: false,
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
        durationDays: 30,
        description: 'Full access to all premium features',
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
        recommended: true,
        isLifetime: false,
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
        duration: 120,
        durationDays: 120,
        description: 'Extended membership with exclusive benefits',
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
        recommended: false,
        isLifetime: false,
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
        duration: 365,
        durationDays: 365,
        description: 'Annual membership with VIP benefits',
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
        recommended: false,
        isLifetime: false,
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
        durationDays: 36500,
        description: 'One-time payment for lifetime access',
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
        recommended: false,
        isLifetime: true,
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
