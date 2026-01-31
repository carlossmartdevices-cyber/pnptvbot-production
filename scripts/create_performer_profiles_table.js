#!/usr/bin/env node

/**
 * Create performer_profiles table
 */

const { Pool } = require('pg');
const logger = require('../src/utils/logger');

async function createPerformerProfilesTable() {
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
    logger.info('🔧 Creating performer_profiles table...');

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS performer_profiles (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) UNIQUE NOT NULL,
        bio TEXT,
        photos JSONB,
        videos JSONB,
        tags JSONB,
        rates JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await client.query(createTableQuery);
    logger.info('✅ Successfully created performer_profiles table');

  } catch (error) {
    logger.error('❌ Error creating performer_profiles table:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
createPerformerProfilesTable().catch(error => {
  logger.error('❌ Failed to create performer_profiles table:', error);
  process.exit(1);
});
