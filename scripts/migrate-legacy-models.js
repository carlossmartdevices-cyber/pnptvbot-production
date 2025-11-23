#!/usr/bin/env node

/**
 * Migrate legacy Firebase models to PostgreSQL
 * Creates missing tables for moderation and radio functionality
 */

const path = require('path');
const { initializePostgres, query } = require('../src/config/postgres');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function migrateLegacyModels() {
  console.log('\n' + '='.repeat(70));
  console.log('🔄 MIGRATING LEGACY MODELS TO POSTGRESQL');
  console.log('='.repeat(70));
  console.log();

  try {
    initializePostgres();

    // Step 1: Create group_settings table
    console.log('📊 Step 1: Creating group_settings table...\n');
    await query(`
      CREATE TABLE IF NOT EXISTS group_settings (
        group_id TEXT PRIMARY KEY,
        anti_links_enabled BOOLEAN DEFAULT true,
        anti_spam_enabled BOOLEAN DEFAULT true,
        anti_flood_enabled BOOLEAN DEFAULT true,
        profanity_filter_enabled BOOLEAN DEFAULT false,
        max_warnings INTEGER DEFAULT 3,
        flood_limit INTEGER DEFAULT 5,
        flood_window INTEGER DEFAULT 10,
        mute_duration INTEGER DEFAULT 3600,
        allowed_domains TEXT[] DEFAULT '{}',
        banned_words TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✓ group_settings table created');

    // Step 2: Create username_history table
    console.log('\n📊 Step 2: Creating username_history table...\n');
    await query(`
      CREATE TABLE IF NOT EXISTS username_history (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        old_username TEXT,
        new_username TEXT,
        group_id TEXT,
        changed_at TIMESTAMP DEFAULT NOW(),
        flagged BOOLEAN DEFAULT false
      )
    `);
    console.log('   ✓ username_history table created');

    // Create index for faster lookups
    await query(`
      CREATE INDEX IF NOT EXISTS idx_username_history_user_id
      ON username_history(user_id)
    `);
    console.log('   ✓ username_history index created');

    // Step 3: Create radio_schedule table
    console.log('\n📊 Step 3: Creating radio_schedule table...\n');
    await query(`
      CREATE TABLE IF NOT EXISTS radio_schedule (
        id SERIAL PRIMARY KEY,
        day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
        time_slot TEXT NOT NULL,
        program_name TEXT NOT NULL,
        description TEXT,
        host TEXT,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✓ radio_schedule table created');

    // Create index for schedule lookups
    await query(`
      CREATE INDEX IF NOT EXISTS idx_radio_schedule_day_time
      ON radio_schedule(day_of_week, time_slot)
    `);
    console.log('   ✓ radio_schedule index created');

    // Step 4: Verify tables
    console.log('\n📊 Step 4: Verifying tables...\n');
    const tables = await query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('group_settings', 'username_history', 'radio_schedule')
      ORDER BY tablename
    `);

    console.log('Verified tables:');
    tables.rows.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table.tablename}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('✅ LEGACY MODELS MIGRATION COMPLETED!');
    console.log('='.repeat(70));
    console.log('\n⚠️  Remember to restart the bot:\n');
    console.log('   pm2 restart pnptv-bot\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error migrating legacy models:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migrateLegacyModels();
