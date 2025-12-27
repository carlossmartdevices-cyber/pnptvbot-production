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

    // Drop dependent tables first (with CASCADE)
    logger.info('Dropping existing tables if they exist...');
    const dropStatements = [
      'DROP TABLE IF EXISTS call_participants CASCADE',
      'DROP TABLE IF EXISTS video_calls CASCADE',
      'DROP TABLE IF EXISTS room_participants CASCADE',
      'DROP TABLE IF EXISTS room_events CASCADE',
      'DROP TABLE IF EXISTS main_rooms CASCADE',
      'DROP TABLE IF EXISTS webinar_registrations CASCADE',
      'DROP TABLE IF EXISTS webinars CASCADE',
      'DROP TABLE IF EXISTS playlist_tracks CASCADE',
      'DROP TABLE IF EXISTS radio_playlists CASCADE',
      'DROP TABLE IF EXISTS radio_listen_history CASCADE',
      'DROP TABLE IF EXISTS radio_now_playing CASCADE',
      'DROP TABLE IF EXISTS radio_subscribers CASCADE',
      'DROP TABLE IF EXISTS radio_tracks CASCADE',
      'DROP TABLE IF EXISTS agora_channels CASCADE',
      'DROP TRIGGER IF EXISTS call_participant_count_trigger ON call_participants',
      'DROP TRIGGER IF EXISTS room_participant_count_trigger ON room_participants',
      'DROP TRIGGER IF EXISTS track_play_count_trigger ON radio_now_playing',
      'DROP FUNCTION IF EXISTS update_room_participant_count()',
      'DROP FUNCTION IF EXISTS update_call_participant_count()',
      'DROP FUNCTION IF EXISTS increment_track_play_count()',
    ];

    for (const stmt of dropStatements) {
      try {
        await client.query(stmt);
        logger.info(`✓ ${stmt}`);
      } catch (e) {
        // Ignore errors for non-existent objects
        if (!e.message.includes('does not exist')) {
          throw e;
        }
      }
    }

    logger.info('Reading schema file...');
    const schemaPath = path.join(__dirname, '../database/migrations/hangouts_radio_schema.sql');
    let schema = fs.readFileSync(schemaPath, 'utf8');

    // Remove the DROP statements from the schema file as we already did them
    schema = schema.replace(/DROP TRIGGER IF EXISTS .*\n/g, '');
    schema = schema.replace(/DROP FUNCTION IF EXISTS .*\n/g, '');

    logger.info('Applying schema...');
    await client.query(schema);

    logger.info('✅ Schema applied successfully!');
    client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error applying schema:', error.message);
    logger.error('Error details:', error);
    await pool.end();
    process.exit(1);
  }
}

applySchema();
