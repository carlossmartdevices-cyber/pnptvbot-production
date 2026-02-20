#!/usr/bin/env node
/**
 * Migration: Add is_prime column to media_library table
 * Usage: node scripts/add-prime-column.js
 */

const { getPool } = require('../src/config/postgres');

async function runMigration() {
  try {
    const pool = getPool();
    
    console.log('Adding is_prime column to media_library...');
    await pool.query(
      `ALTER TABLE IF EXISTS media_library ADD COLUMN IF NOT EXISTS is_prime BOOLEAN DEFAULT false;`
    );
    console.log('✓ is_prime column added');

    console.log('Creating index on is_prime...');
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_media_library_is_prime ON media_library(is_prime);`
    );
    console.log('✓ Index created');

    console.log('\n✓ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
