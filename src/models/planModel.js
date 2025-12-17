const { query } = require('../config/postgres');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Plan Model - Handles subscription plan data with PostgreSQL
 */
class Plan {
  static TABLE = 'plans';

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
          const result = await query(
            `SELECT * FROM ${this.TABLE} WHERE active = true ORDER BY price ASC`
          );

          const plans = result.rows.map((row) => this.mapRowToPlan(row));

          logger.info(`Fetched ${plans.length} plans from PostgreSQL`);
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
          const result = await query(
            `SELECT * FROM ${this.TABLE} WHERE id = $1`,
            [planId]
          );

          if (result.rows.length === 0) {
            logger.warn(`Plan not found: ${planId}`);
            return null;
          }

          logger.info(`Fetched plan from PostgreSQL: ${planId}`);
          return this.mapRowToPlan(result.rows[0]);
        },
        3600, // Cache for 1 hour
      );
    } catch (error) {
      logger.error('Error getting plan:', error);
      return null;
    }
  }

  /**
   * Map database row to plan object
   * @param {Object} row - Database row
   * @returns {Object} Plan object
   */
  static mapRowToPlan(row) {
    return {
      id: row.id,
      sku: row.sku,
      name: row.name || row.display_name,
      nameEs: row.name_es,
      price: parseFloat(row.price),
      currency: row.currency || 'USD',
      duration: row.duration_days || row.duration || 30,
      features: row.features || [],
      featuresEs: row.features_es || [],
      active: row.active,
      isLifetime: row.is_lifetime || false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
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

      const sql = `
        INSERT INTO ${this.TABLE} (id, sku, name, name_es, price, currency, duration_days, features, features_es, active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          sku = EXCLUDED.sku,
          name = EXCLUDED.name,
          name_es = EXCLUDED.name_es,
          price = EXCLUDED.price,
          currency = EXCLUDED.currency,
          duration_days = EXCLUDED.duration_days,
          features = EXCLUDED.features,
          features_es = EXCLUDED.features_es,
          active = EXCLUDED.active,
          updated_at = NOW()
        RETURNING *
      `;

      const result = await query(sql, [
        planId,
        data.sku,
        data.name,
        data.nameEs,
        data.price,
        data.currency || 'USD',
        data.duration || 30,
        JSON.stringify(data.features || []),
        JSON.stringify(data.featuresEs || []),
        data.active !== undefined ? data.active : true,
      ]);

      // Invalidate cache
      await cache.del(`plan:${planId}`);
      await cache.del('plans:all');

      logger.info('Plan created/updated', { planId, sku: data.sku });
      return this.mapRowToPlan(result.rows[0]);
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
      await query(`DELETE FROM ${this.TABLE} WHERE id = $1`, [planId]);

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
        price: 24.99,
        currency: 'USD',
        duration: 30,
        features: [
          'Premium channel access',
          'Basic support',
          'Access to Nearby Members feature',
          'Zoom meeting access: 3 per month',
        ],
        featuresEs: [
          'Acceso a canales premium',
          'Soporte básico',
          'Acceso a Miembros Cercanos',
          'Acceso a reuniones Zoom: 3 por mes',
        ],
        active: true,
      },
      {
        id: 'crystal_member',
        sku: 'EASYBOT-PNP-120D',
        name: 'Crystal Member',
        nameEs: 'Miembro Crystal',
        price: 49.99,
        currency: 'USD',
        duration: 120,
        features: [
          'All premium features',
          'Video calls',
          'Priority support',
          'Access to Nearby Members feature',
          'Zoom meeting access: 5 per month',
        ],
        featuresEs: [
          'Todas las características premium',
          'Llamadas de video',
          'Soporte prioritario',
          'Acceso a Miembros Cercanos',
          'Acceso a reuniones Zoom: 5 por mes',
        ],
        active: true,
      },
      {
        id: 'diamond_member',
        sku: 'EASYBOT-PNP-365D',
        name: 'Diamond Member',
        nameEs: 'Miembro Diamond',
        price: 99.99,
        currency: 'USD',
        duration: 365,
        features: [
          'All premium features',
          'Video calls',
          'VIP access',
          'Priority support',
          'Exclusive content',
          'Access to Nearby Members feature',
          'Zoom meeting access: 5 per month',
        ],
        featuresEs: [
          'Todas las características premium',
          'Llamadas de video',
          'Acceso VIP',
          'Soporte prioritario',
          'Contenido exclusivo',
          'Acceso a Miembros Cercanos',
          'Acceso a reuniones Zoom: 5 por mes',
        ],
        active: true,
      },
      {
        id: 'lifetime_pass',
        sku: 'EASYBOT-PNP-LIFE',
        name: 'Lifetime Pass',
        nameEs: 'Pase de por Vida',
        price: 249.99,
        currency: 'USD',
        duration: 36500, // 100 years as "lifetime"
        features: [
          'All premium features',
          'Video calls',
          'VIP access',
          'Priority support',
          'Exclusive content',
          'Lifetime access',
          'Access to Nearby Members feature',
          'Zoom meeting access: 5 per month',
          'Exclusive: Live streaming with Santino',
        ],
        featuresEs: [
          'Todas las características premium',
          'Llamadas de video',
          'Acceso VIP',
          'Soporte prioritario',
          'Contenido exclusivo',
          'Acceso de por vida',
          'Acceso a Miembros Cercanos',
          'Acceso a reuniones Zoom: 5 por mes',
          'Exclusivo: Transmisión en vivo con Santino',
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
