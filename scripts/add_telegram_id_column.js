#!/usr/bin/env node

/**
 * Add telegram_id column to users table
 * This fixes the "column telegram_id does not exist" error
 */

const { Pool } = require('pg');
const logger = require('../src/utils/logger');

async function addTelegramIdColumn() {
  require('dotenv').config();

  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE || 'pnptvbot',
    user: process.env.POSTGRES_USER || 'pnptvbot',
    password: process.env.POSTGRES_PASSWORD || '',
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();

  try {
    logger.info('🔧 Adding telegram_id column to users table...');

    // Check if column already exists
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'telegram_id'
    `;
    
    const result = await client.query(checkQuery);
    
    if (result.rows.length > 0) {
      logger.info('✅ telegram_id column already exists in users table');
      return;
    }

    // Add the telegram_id column
    const addColumnQuery = `
      ALTER TABLE users 
      ADD COLUMN telegram_id VARCHAR(255)
    `;
    
    await client.query(addColumnQuery);
    logger.info('✅ Successfully added telegram_id column to users table');

    // Create index for better performance
    const addIndexQuery = `
      CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)
    `;
    
    await client.query(addIndexQuery);
    logger.info('✅ Successfully created index on telegram_id column');

  } catch (error) {
    logger.error('❌ Error adding telegram_id column:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
addTelegramIdColumn().catch(error => {
  logger.error('❌ Failed to add telegram_id column:', error);
  process.exit(1);
});
