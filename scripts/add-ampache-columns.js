#!/usr/bin/env node

require('dotenv').config({ path: '.env.production' });

const { Pool } = require('pg');
const logger = require('../apps/backend/utils/logger');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    logger.info('Starting Ampache columns migration...');

    // Add ampache_song_id to media_library
    await client.query(`
      ALTER TABLE media_library
      ADD COLUMN IF NOT EXISTS ampache_song_id VARCHAR(50);
    `);
    logger.info('✓ Added ampache_song_id column to media_library');

    // Create unique index for ampache_song_id deduplication
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_media_library_ampache_song_id
      ON media_library(ampache_song_id) WHERE ampache_song_id IS NOT NULL;
    `);
    logger.info('✓ Created unique index on media_library.ampache_song_id');

    // Add ampache_song_id to radio_now_playing_new (the underlying table)
    await client.query(`
      ALTER TABLE radio_now_playing_new
      ADD COLUMN IF NOT EXISTS ampache_song_id VARCHAR(50);
    `);
    logger.info('✓ Added ampache_song_id column to radio_now_playing_new');

    // Recreate the radio_now_playing view to include the new column
    await client.query(`
      DROP VIEW IF EXISTS radio_now_playing;
    `);
    logger.info('✓ Dropped radio_now_playing view');

    await client.query(`
      CREATE VIEW radio_now_playing AS
      SELECT id, track_id, title, artist, duration, cover_url, started_at, ends_at, listener_count, updated_at, ampache_song_id
      FROM radio_now_playing_new;
    `);
    logger.info('✓ Recreated radio_now_playing view with ampache_song_id column');

    logger.info('✅ Ampache columns migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.release();
    await pool.end();
  }
}

runMigration();
