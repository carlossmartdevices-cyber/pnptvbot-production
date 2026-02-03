require('dotenv').config({ allowEmptyValues: true });
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

    // New PNPtv subscription plans
    const newPlans = [
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
          'Zoom meeting access: 1 per week'
        ],
        featuresEs: [
          'Acceso a canales premium',
          'Acceso a Miembros Cercanos',
          'Acceso a reuniones Zoom: 1 por semana'
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
          'Zoom meeting access: 3 per month'
        ],
        featuresEs: [
          'Acceso a canales premium',
          'Soporte básico',
          'Acceso a Miembros Cercanos',
          'Acceso a reuniones Zoom: 3 por mes'
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
          'Zoom meeting access: 5 per month'
        ],
        featuresEs: [
          'Todas las características premium',
          'Llamadas de video',
          'Soporte prioritario',
          'Acceso a Miembros Cercanos',
          'Acceso a reuniones Zoom: 5 por mes'
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
          'Zoom meeting access: 5 per month'
        ],
        featuresEs: [
          'Todas las características premium',
          'Llamadas de video',
          'Acceso VIP',
          'Soporte prioritario',
          'Contenido exclusivo',
          'Acceso a Miembros Cercanos',
          'Acceso a reuniones Zoom: 5 por mes'
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
          'Exclusive: Live streaming with Santino'
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
          'Exclusivo: Transmisión en vivo con Santino'
        ],
        active: true,
      },
    ];

    // Delete old plans
    logger.info('Removing old plans...');
    await Plan.destroy({ where: {} });

    // Create new plans
    logger.info('Creating new plans...');
    for (const plan of newPlans) {
      await Plan.createOrUpdate(plan.id, plan);
      logger.info(`✓ Plan created: ${plan.name} - SKU: ${plan.sku} - $${plan.price} (${plan.duration} days)`);
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
