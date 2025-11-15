require('dotenv-safe').config({ allowEmptyValues: true });
const { initializeDatabase, testConnection } = require('../src/config/database');
const Plan = require('../src/models/planModel');
const logger = require('../src/utils/logger');

/**
 * Seed database with initial data
 */
const seedDatabase = async () => {
  try {
    logger.info('Starting database seed...');

    // Initialize PostgreSQL
    initializeDatabase();
    const connected = await testConnection();

    if (!connected) {
      throw new Error('Failed to connect to PostgreSQL');
    }

    // Initialize default plans
    logger.info('Seeding default subscription plans...');
    await Plan.initializeDefaultPlans();

    logger.info('✓ Database seeded successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Failed to seed database:', error);
    process.exit(1);
  }
};

// Run seed if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
