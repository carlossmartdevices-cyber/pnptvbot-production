#!/usr/bin/env node
/**
 * Migration 030: Social posts, group chat, and direct messages tables
 * Usage: node scripts/run-social-chat-migration.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load env
const dotenv = require('dotenv');
if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.production'), allowEmptyValues: true });
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), allowEmptyValues: true, override: false });
} else {
  dotenv.config({ allowEmptyValues: true });
}

const MIGRATION_FILE = path.join(__dirname, '../migrations/030_create_social_chat_dm_tables.sql');

async function runMigration() {
  let pool;
  try {
    pool = new Pool({
      host:     process.env.POSTGRES_HOST     || 'localhost',
      port:     parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DATABASE || process.env.POSTGRES_DB || 'pnptvbot',
      user:     process.env.POSTGRES_USER     || 'pnptvbot',
      password: process.env.POSTGRES_PASSWORD || '',
    });

    const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
    console.log('Running migration 030: social, chat, DM tables...');
    await pool.query(sql);
    console.log('✓ Migration 030 completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.end();
  }
}

runMigration();
