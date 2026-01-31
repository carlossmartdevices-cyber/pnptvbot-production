#!/usr/bin/env node

/**
 * Add role and status columns to users table
 */

const { Pool } = require('pg');
const logger = require('../src/utils/logger');

async function addPerformerRoleAndStatus() {
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
    logger.info('🔧 Adding role and status columns to users table...');

    // Check if role column already exists
    const checkRoleQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'role'
    `;

    const roleResult = await client.query(checkRoleQuery);

    if (roleResult.rows.length > 0) {
      logger.info('✅ role column already exists in users table');
    } else {
      // Add the role column
      const addRoleQuery = `
        ALTER TABLE users
        ADD COLUMN role VARCHAR(50) DEFAULT 'user'
      `;
      await client.query(addRoleQuery);
      logger.info('✅ Successfully added role column to users table');
    }

    // Check if status column already exists
    const checkStatusQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'status'
    `;

    const statusResult = await client.query(checkStatusQuery);

    if (statusResult.rows.length > 0) {
      logger.info('✅ status column already exists in users table');
    } else {
      // Add the status column
      const addStatusQuery = `
        ALTER TABLE users
        ADD COLUMN status VARCHAR(50) DEFAULT 'offline'
      `;
      await client.query(addStatusQuery);
      logger.info('✅ Successfully added status column to users table');
    }

    // Create indexes for better performance
    const addRoleIndexQuery = `
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)
    `;
    await client.query(addRoleIndexQuery);
    logger.info('✅ Successfully created index on role column');

    const addStatusIndexQuery = `
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)
    `;
    await client.query(addStatusIndexQuery);
    logger.info('✅ Successfully created index on status column');

  } catch (error) {
    logger.error('❌ Error adding role and status columns:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
addPerformerRoleAndStatus().catch(error => {
  logger.error('❌ Failed to add role and status columns:', error);
  process.exit(1);
});
