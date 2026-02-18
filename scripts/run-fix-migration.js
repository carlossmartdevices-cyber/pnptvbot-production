#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function runFixMigration() {
  let pool;

  try {
    console.log('\n🔧 Running Agora Channels fix migration...\n');

    const host = process.env.POSTGRES_HOST || 'localhost';
    const port = parseInt(process.env.POSTGRES_PORT || '5432');
    const database = process.env.POSTGRES_DATABASE || 'pnptvbot';
    const user = process.env.POSTGRES_USER || 'pnptvbot';
    const password = process.env.POSTGRES_PASSWORD || '';

    pool = new Pool({
      host,
      port,
      database,
      user,
      password,
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
    });

    // Test connection
    const testClient = await pool.connect();
    await testClient.query('SELECT NOW()');
    testClient.release();
    console.log('✅ Connection successful\n');

    // Read migration file
    const migrationFile = path.join(__dirname, '../database/migrations/045_fix_agora_channels_schema.sql');
    const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

    // Execute migration
    console.log('⚙️  Executing fix migration...\n');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(migrationSQL);
      await client.query('COMMIT');
      console.log('✅ Fix migration completed successfully\n');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Validate
    console.log('🔍 Validating fixes...\n');
    const validateClient = await pool.connect();

    try {
      const result = await validateClient.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'agora_channels'
        ORDER BY column_name
      `);

      console.log('Agora channels columns:');
      for (const row of result.rows) {
        console.log(`  ✅ ${row.column_name}`);
      }
    } finally {
      validateClient.release();
    }

    console.log('\n✨ Schema is now complete!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    process.exit(1);
  } finally {
    if (pool) await pool.end();
  }
}

runFixMigration();
