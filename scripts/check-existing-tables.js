#!/usr/bin/env node

/**
 * Check which hangouts tables already exist
 */

const { Pool } = require('pg');
require('dotenv').config();

async function checkTables() {
  let pool;

  try {
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

    const client = await pool.connect();

    const tables = [
      'video_calls',
      'call_participants',
      'main_rooms',
      'room_participants',
      'room_events',
      'agora_channels'
    ];

    console.log('\n🔍 Checking existing tables:\n');

    for (const table of tables) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        ) as exists,
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = 'public'
         AND table_name = $1) as column_count
      `, [table]);

      const exists = result.rows[0].exists;
      const columnCount = parseInt(result.rows[0].column_count);

      if (exists) {
        console.log(`  ❌ Table '${table}' ALREADY EXISTS (${columnCount} columns)`);
      } else {
        console.log(`  ✅ Table '${table}' does not exist (can be created)`);
      }
    }

    // Check video_calls columns if it exists
    const videoCallsCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'video_calls'
      ) as exists
    `);

    if (videoCallsCheck.rows[0].exists) {
      console.log('\n📋 Video_calls existing columns:\n');
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'video_calls'
        ORDER BY ordinal_position
      `);

      for (const col of columnsResult.rows) {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      }
    }

    client.release();

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (pool) await pool.end();
  }
}

checkTables();
