require('dotenv-safe').config({ allowEmptyValues: true });
const { initializeDatabase, testConnection } = require('../src/config/database');
const Plan = require('../src/models/planModel');
const logger = require('../src/utils/logger');

/**
 * Update database with new subscription plans
 */
const updatePlans = async () => {
  try {
    logger.info('Updating subscription plans...');

    // Initialize PostgreSQL
    initializeDatabase();
    const connected = await testConnection();

    if (!connected) {
      throw new Error('Failed to connect to PostgreSQL');
    }

    // New PNPtv subscription plans (updated to match database schema)
    const newPlans = [
      {
        id: 'trial-week',
        name: 'Trial Week',
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
          'Zoom meeting access: 1 per week'
        ],
        icon: '🎯',
        active: true,
        recommended: false,
        isLifetime: false,
      },
      {
        id: 'pnp-member',
        name: 'PNP Member',
        displayName: 'PNP Member',
        tier: 'PNP',
        price: 24.99,
        currency: 'USD',
        duration: 30,
        durationDays: 30,
        description: 'Full access to all premium features',
        features: [
          'Premium channel access',
          'Basic support',
          'Access to Nearby Members feature',
          'Zoom meeting access: 3 per month'
        ],
        icon: '⭐',
        active: true,
        recommended: true,
        isLifetime: false,
      },
      {
        id: 'crystal-member',
        name: 'Crystal Member',
        displayName: 'Crystal Member',
        tier: 'Crystal',
        price: 49.99,
        currency: 'USD',
        duration: 120,
        durationDays: 120,
        description: 'Extended membership with exclusive benefits',
        features: [
          'All premium features',
          'Video calls',
          'Priority support',
          'Access to Nearby Members feature',
          'Zoom meeting access: 5 per month'
        ],
        icon: '💎',
        active: true,
        recommended: false,
        isLifetime: false,
      },
      {
        id: 'diamond-member',
        name: 'Diamond Member',
        displayName: 'Diamond Member',
        tier: 'Diamond',
        price: 99.99,
        currency: 'USD',
        duration: 365,
        durationDays: 365,
        description: 'Annual membership with VIP benefits',
        features: [
          'All premium features',
          'Video calls',
          'VIP access',
          'Priority support',
          'Exclusive content',
          'Access to Nearby Members feature',
          'Zoom meeting access: 5 per month'
        ],
        icon: '👑',
        active: true,
        recommended: false,
        isLifetime: false,
      },
      {
        id: 'lifetime-pass',
        name: 'Lifetime Pass',
        displayName: 'Lifetime Pass',
        tier: 'Premium',
        price: 249.99,
        currency: 'USD',
        duration: 36500, // 100 years as "lifetime"
        durationDays: 36500,
        description: 'One-time payment for lifetime access',
        features: [
          'All premium features',
          'Video calls',
          'VIP access',
          'Priority support',
          'Exclusive content',
          'Lifetime access',
          'Access to Nearby Members feature',
          'Zoom meeting access: 5 per month',
          'Exclusive: Live streaming with Santino'
        ],
        icon: '♾️',
        active: true,
        recommended: false,
        isLifetime: true,
      },
    ];

    // Delete old plans
    logger.info('Removing old plans...');
    await Plan.destroy({ where: {} });

    // Create new plans
    logger.info('Creating new plans...');
    for (const plan of newPlans) {
      await Plan.createOrUpdate(plan.id, plan);
      logger.info(`✓ Plan created: ${plan.name} - Tier: ${plan.tier} - $${plan.price} (${plan.duration} days)`);
    }

    logger.info('✓ Subscription plans updated successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Failed to update plans:', error);
    process.exit(1);
  }
};

// Run update if called directly
if (require.main === module) {
  updatePlans();
}

module.exports = { updatePlans };
