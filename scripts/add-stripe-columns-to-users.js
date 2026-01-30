const { query, closePool } = require('../src/config/postgres');
const logger = require('../src/utils/logger'); // Assuming a logger utility exists

async function addStripeColumns() {
  try {
    logger.info('Starting migration: Adding stripe_customer_id and stripe_price_id to users table...');

    await query(`
      ALTER TABLE users
      ADD COLUMN stripe_customer_id VARCHAR(255) NULL,
      ADD COLUMN stripe_price_id VARCHAR(255) NULL;
    `);

    logger.info('Migration completed successfully: Added stripe_customer_id and stripe_price_id to users table.');
  } catch (error) {
    logger.error('Migration failed to add stripe columns to users table:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

addStripeColumns();
