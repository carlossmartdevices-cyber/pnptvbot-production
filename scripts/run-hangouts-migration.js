#!/usr/bin/env node

/**
 * Script to run Hangouts migration
 * Usage: node scripts/run-hangouts-migration.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const MIGRATION_FILE = path.join(__dirname, '../database/migrations/044_hangouts_video_schema.sql');

async function runMigration() {
  let pool;

  try {
    console.log('🚀 Starting Hangouts migration...\n');

    // Initialize pool
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
    console.log(`📡 Testing connection to ${user}@${host}:${port}/${database}...`);
    const testClient = await pool.connect();
    await testClient.query('SELECT NOW()');
    testClient.release();
    console.log('✅ Connection successful\n');

    // Read migration file
    console.log(`📖 Reading migration file: ${MIGRATION_FILE}`);
    if (!fs.existsSync(MIGRATION_FILE)) {
      throw new Error(`Migration file not found: ${MIGRATION_FILE}`);
    }

    const migrationSQL = fs.readFileSync(MIGRATION_FILE, 'utf8');
    console.log('✅ Migration file loaded\n');

    // Execute migration
    console.log('⚙️  Executing migration SQL...\n');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(migrationSQL);
      await client.query('COMMIT');
      console.log('✅ Migration completed successfully\n');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Validate tables were created
    console.log('🔍 Validating created tables...\n');
    const validateClient = await pool.connect();

    try {
      const tables = [
        'video_calls',
        'call_participants',
        'main_rooms',
        'room_participants',
        'room_events',
        'agora_channels'
      ];

      for (const table of tables) {
        const result = await validateClient.query(
          `SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = $1
          )`,
          [table]
        );

        if (result.rows[0].exists) {
          console.log(`  ✅ Table '${table}' created`);
        } else {
          throw new Error(`Table '${table}' was not created`);
        }
      }

      // Check enums
      console.log('\n🔍 Validating ENUMs...\n');
      const enums = [
        'video_call_status',
        'room_event_type'
      ];

      for (const enumType of enums) {
        const result = await validateClient.query(
          `SELECT EXISTS (
            SELECT 1 FROM pg_type
            WHERE typname = $1
          )`,
          [enumType]
        );

        if (result.rows[0].exists) {
          console.log(`  ✅ ENUM '${enumType}' created`);
        } else {
          throw new Error(`ENUM '${enumType}' was not created`);
        }
      }

      // Check seed data
      console.log('\n🔍 Validating seed data...\n');
      const mainRoomsResult = await validateClient.query(
        'SELECT COUNT(*) as count FROM main_rooms'
      );

      const roomCount = parseInt(mainRoomsResult.rows[0].count);
      console.log(`  ✅ Main rooms seeded: ${roomCount} rooms`);

      if (roomCount < 3) {
        console.warn(`  ⚠️  Warning: Expected 3 main rooms, found ${roomCount}`);
      }

      // Get table statistics
      console.log('\n📊 Table structure overview:\n');
      const statsResult = await validateClient.query(`
        SELECT
          tablename,
          (SELECT count(*) FROM information_schema.columns
           WHERE table_name = tablename) as column_count
        FROM pg_tables
        WHERE tablename IN ('video_calls', 'call_participants', 'main_rooms', 'room_participants', 'room_events', 'agora_channels')
        ORDER BY tablename
      `);

      for (const row of statsResult.rows) {
        console.log(`  ${row.tablename}: ${row.column_count} columns`);
      }

    } finally {
      validateClient.release();
    }

    console.log('\n✨ All validations passed!\n');
    console.log('📝 Next steps:');
    console.log('  1. Run integration tests: npm run test:integration');
    console.log('  2. Test hangouts API endpoints');
    console.log('  3. Verify models can connect to tables\n');

  } catch (error) {
    console.error('\n❌ Migration failed:\n');
    console.error(error.message);
    if (error.detail) console.error('Detail:', error.detail);
    if (error.hint) console.error('Hint:', error.hint);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run migration
runMigration();
