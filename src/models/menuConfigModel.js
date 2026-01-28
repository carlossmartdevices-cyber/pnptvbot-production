const { getFirestore } = require('../config/firebase');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

const COLLECTION = 'menu_configs';

/**
 * Menu Config Model - Handles menu configuration and customization
 */
class MenuConfigModel {
  /**
   * Get all menu configurations (with caching)
   * @returns {Promise<Array>} All menu configs
   */
  static async getAll() {
    try {
      const cacheKey = 'menus:all';

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();
          const snapshot = await db.collection(COLLECTION)
            .orderBy('order', 'asc')
            .get();

          const menus = [];
          snapshot.forEach((doc) => {
            menus.push({ id: doc.id, ...doc.data() });
          });

          logger.info(`Fetched ${menus.length} menu configs from database`);

          // If empty, return default menus
          return menus.length > 0 ? menus : this.getDefaultMenus();
        },
        1800, // Cache for 30 minutes
      );
    } catch (error) {
      logger.error('Error getting menu configs:', error);
      return this.getDefaultMenus();
    }
  }

  /**
   * Get menu configuration by ID (with caching)
   * @param {string} menuId - Menu ID
   * @returns {Promise<Object|null>} Menu config
   */
  static async getById(menuId) {
    try {
      const cacheKey = `menu:${menuId}`;

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();
          const doc = await db.collection(COLLECTION).doc(menuId).get();

          if (!doc.exists) {
            logger.warn(`Menu config not found: ${menuId}`);
            return null;
          }

          return { id: doc.id, ...doc.data() };
        },
        1800, // Cache for 30 minutes
      );
    } catch (error) {
      logger.error('Error getting menu config:', error);
      return null;
    }
  }

  /**
   * Create or update menu configuration
   * @param {string} menuId - Menu ID
   * @param {Object} menuData - Menu data
   * @returns {Promise<Object>} Created/updated menu config
   */
  static async createOrUpdate(menuId, menuData) {
    try {
      const db = getFirestore();
      const menuRef = db.collection(COLLECTION).doc(menuId);

      const data = {
        ...menuData,
        updatedAt: new Date(),
      };

      const doc = await menuRef.get();
      if (!doc.exists) {
        data.createdAt = new Date();
      }

      await menuRef.set(data, { merge: true });

      // Invalidate cache
      await this.invalidateCache();

      logger.info('Menu config created/updated', { menuId });
      return { id: menuId, ...data };
    } catch (error) {
      logger.error('Error creating/updating menu config:', error);
      throw error;
    }
  }

  /**
   * Delete menu configuration
   * @param {string} menuId - Menu ID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(menuId) {
    try {
      // Check if menu is deletable
      const menu = await this.getById(menuId);
      if (menu && !menu.deletable) {
        logger.warn(`Cannot delete system menu: ${menuId}`);
        return false;
      }

      const db = getFirestore();
      await db.collection(COLLECTION).doc(menuId).delete();

      // Invalidate cache
      await this.invalidateCache();

      logger.info('Menu config deleted', { menuId });
      return true;
    } catch (error) {
      logger.error('Error deleting menu config:', error);
      return false;
    }
  }

  /**
   * Get menus available for a specific user based on their subscription tier
   * @param {string} userPlanId - User's plan ID (free, basic, premium, gold)
   * @returns {Promise<Array>} Available menus
   */
  static async getAvailableMenusForTier(userPlanId) {
    try {
      const allMenus = await this.getAll();

      // Filter menus based on status and tier restrictions
      const availableMenus = allMenus.filter((menu) => {
        // Skip disabled menus
        if (menu.status === 'disabled') {
          return false;
        }

        // If menu is active for all, include it
        if (menu.status === 'active') {
          return true;
        }

        // If tier_restricted, check if user's plan is in allowedTiers
        if (menu.status === 'tier_restricted') {
          const planTier = userPlanId || 'free';
          return menu.allowedTiers && menu.allowedTiers.includes(planTier);
        }

        return false;
      });

      logger.debug(`Found ${availableMenus.length} available menus for tier: ${userPlanId}`);
      return availableMenus;
    } catch (error) {
      logger.error('Error getting available menus for tier:', error);
      return [];
    }
  }

  /**
   * Check if a menu is available for a specific user tier
   * @param {string} menuId - Menu ID
   * @param {string} userPlanId - User's plan ID
   * @returns {Promise<boolean>} True if menu is available
   */
  static async isMenuAvailable(menuId, userPlanId) {
    try {
      const menu = await this.getById(menuId);
      if (!menu) {
        return false;
      }

      // Disabled menus are not available
      if (menu.status === 'disabled') {
        return false;
      }

      // Active menus are available to all
      if (menu.status === 'active') {
        return true;
      }

      // Tier restricted menus
      if (menu.status === 'tier_restricted') {
        const planTier = userPlanId || 'free';
        return menu.allowedTiers && menu.allowedTiers.includes(planTier);
      }

      return false;
    } catch (error) {
      logger.error('Error checking menu availability:', error);
      return false;
    }
  }

  /**
   * Get default menus (system menus that exist by default)
   * @returns {Array} Default menu configurations
   */
  static getDefaultMenus() {
    return [
      {
        id: 'subscribe',
        menuId: 'subscribe',
        name: 'Subscribe to PRIME',
        nameEs: 'Suscribirse a PRIME',
        parentId: null, // Main menu item
        status: 'active',
        allowedTiers: [], // Empty = all tiers
        order: 1,
        icon: '💎',
        action: 'show_subscription_plans',
        type: 'default', // System menu
        actionType: 'submenu', // Shows subscription plans
        actionData: {},
        customizable: true, // Can be disabled/restricted by admin
        deletable: false, // Cannot be deleted (system menu)
      },
      {
        id: 'profile',
        menuId: 'profile',
        name: 'My Profile',
        nameEs: 'Mi Perfil',
        parentId: null,
        status: 'active',
        allowedTiers: [],
        order: 2,
        icon: '👤',
        action: 'show_profile',
        type: 'default',
        actionType: 'submenu',
        actionData: {},
        customizable: true,
        deletable: false,
      },
      {
        id: 'nearby',
        menuId: 'nearby',
        name: 'Nearby Users',
        nameEs: 'Usuarios Cercanos',
        parentId: null,
        status: 'active',
        allowedTiers: [],
        order: 3,
        icon: '🌍',
        action: 'show_nearby_unified',
        type: 'default',
        actionType: 'submenu',
        actionData: {},
        customizable: true,
        deletable: false,
      },
      {
        id: 'live',
        menuId: 'live',
        name: 'Live Streams',
        nameEs: 'Transmisiones en Vivo',
        parentId: null,
        status: 'active',
        allowedTiers: [],
        order: 4,
        icon: '🎤',
        action: 'show_live',
        type: 'default',
        actionType: 'submenu',
        actionData: {},
        customizable: true,
        deletable: false,
      },
      {
        id: 'radio',
        menuId: 'radio',
        name: 'Radio',
        nameEs: 'Radio',
        parentId: null,
        status: 'active',
        allowedTiers: [],
        order: 5,
        icon: '📻',
        action: 'show_radio',
        type: 'default',
        actionType: 'submenu',
        actionData: {},
        customizable: true,
        deletable: false,
      },
      {
        id: 'zoom',
        menuId: 'zoom',
        name: 'Zoom Rooms',
        nameEs: 'Salas Zoom',
        parentId: null,
        status: 'active',
        allowedTiers: [],
        order: 6,
        icon: '🎥',
        action: 'show_zoom',
        type: 'default',
        actionType: 'submenu',
        actionData: {},
        customizable: true,
        deletable: false,
      },
      {
        id: 'support',
        menuId: 'support',
        name: 'Support',
        nameEs: 'Soporte',
        parentId: null,
        status: 'active',
        allowedTiers: [],
        order: 7,
        icon: '🤖',
        action: 'show_support',
        type: 'default',
        actionType: 'submenu',
        actionData: {},
        customizable: true,
        deletable: false,
      },
      {
        id: 'settings',
        menuId: 'settings',
        name: 'Settings',
        nameEs: 'Configuración',
        parentId: null,
        status: 'active',
        allowedTiers: [],
        order: 8,
        icon: '⚙️',
        action: 'show_settings',
        type: 'default',
        actionType: 'submenu',
        actionData: {},
        customizable: true,
        deletable: false,
      },
    ];
  }

  /**
   * Initialize default menu configurations in database
   * @returns {Promise<boolean>} Success status
   */
  static async initializeDefaultMenus() {
    try {
      const defaultMenus = this.getDefaultMenus();

      for (const menu of defaultMenus) {
        await this.createOrUpdate(menu.id, menu);
      }

      logger.info('Default menu configs initialized');
      return true;
    } catch (error) {
      logger.error('Error initializing default menus:', error);
      return false;
    }
  }

  /**
   * Reorder menus
   * @param {Array<string>} menuIds - Array of menu IDs in desired order
   * @returns {Promise<boolean>} Success status
   */
  static async reorderMenus(menuIds) {
    try {
      const db = getFirestore();

      // Update order for each menu
      for (let i = 0; i < menuIds.length; i++) {
        const menuId = menuIds[i];
        const menuRef = db.collection(COLLECTION).doc(menuId);

        await menuRef.update({
          order: i + 1,
          updatedAt: new Date(),
        });
      }

      // Invalidate cache
      await this.invalidateCache();

      logger.info('Menus reordered successfully');
      return true;
    } catch (error) {
      logger.error('Error reordering menus:', error);
      return false;
    }
  }

  /**
   * Get custom menus (created by admins)
   * @returns {Promise<Array>} Custom menus
   */
  static async getCustomMenus() {
    try {
      const allMenus = await this.getAll();
      return allMenus.filter((menu) => menu.type === 'custom');
    } catch (error) {
      logger.error('Error getting custom menus:', error);
      return [];
    }
  }

  /**
   * Invalidate all menu caches
   * @returns {Promise<boolean>} Success status
   */
  static async invalidateCache() {
    try {
      await cache.delPattern('menu:*');
      await cache.del('menus:all');
      logger.info('All menu caches invalidated');
      return true;
    } catch (error) {
      logger.error('Error invalidating menu cache:', error);
      return false;
    }
  }

  /**
   * Prewarm cache with all menu configs
   * @returns {Promise<boolean>} Success status
   */
  static async prewarmCache() {
    try {
      logger.info('Prewarming menu configs cache...');

      // Load all menus into cache
      const menus = await this.getAll();

      // Load individual menu caches
      for (const menu of menus) {
        await this.getById(menu.id);
      }

      logger.info(`Cache prewarmed with ${menus.length} menu configs`);
      return true;
    } catch (error) {
      logger.error('Error prewarming menu cache:', error);
      return false;
    }
  }
}

module.exports = MenuConfigModel;
