#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const logger = require('../src/utils/logger');

async function applySchema() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '55432'),
    database: process.env.POSTGRES_DATABASE || 'pnptvbot',
    user: process.env.POSTGRES_USER || 'pnptvbot',
    password: process.env.POSTGRES_PASSWORD || '',
    ssl: false,
  });

  try {
    logger.info('Connecting to PostgreSQL...');
    const client = await pool.connect();

    logger.info('Reading schema file...');
    const schemaPath = path.join(__dirname, '../database/migrations/hangouts_radio_schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    logger.info('Applying schema...');
    await client.query(schema);

    logger.info('✅ Schema applied successfully!');
    client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error applying schema:', error);
    await pool.end();
    process.exit(1);
  }
}

applySchema();
