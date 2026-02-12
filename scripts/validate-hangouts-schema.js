#!/usr/bin/env node

/**
 * Validate Hangouts schema completeness
 * Checks if all required columns and features exist
 */

const { Pool } = require('pg');
require('dotenv').config();

async function validateSchema() {
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

    console.log('\n✅ HANGOUTS SCHEMA VALIDATION REPORT\n');
    console.log('=' .repeat(60));

    // Check video_calls table
    console.log('\n📊 VIDEO_CALLS TABLE:');
    const videoCallsColumns = [
      'id', 'creator_id', 'creator_name', 'channel_name', 'title',
      'max_participants', 'current_participants', 'enforce_camera', 'allow_guests',
      'is_public', 'recording_enabled', 'recording_url', 'is_active',
      'created_at', 'ended_at', 'duration_seconds', 'metadata'
    ];

    const videoCallsResult = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'video_calls'
    `);

    const videoCallsExisting = videoCallsResult.rows.map(r => r.column_name);
    let videoCallsOK = true;

    for (const col of videoCallsColumns) {
      const exists = videoCallsExisting.includes(col);
      console.log(`  ${exists ? '✅' : '❌'} ${col}`);
      if (!exists) videoCallsOK = false;
    }

    // Check call_participants table
    console.log('\n📊 CALL_PARTICIPANTS TABLE:');
    const callParticipantsColumns = [
      'id', 'call_id', 'user_id', 'user_name', 'is_host', 'is_guest',
      'was_kicked', 'joined_at', 'left_at', 'total_duration_seconds'
    ];

    const callParticipantsResult = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'call_participants'
    `);

    const callParticipantsExisting = callParticipantsResult.rows.map(r => r.column_name);
    let callParticipantsOK = true;

    for (const col of callParticipantsColumns) {
      const exists = callParticipantsExisting.includes(col);
      console.log(`  ${exists ? '✅' : '❌'} ${col}`);
      if (!exists) callParticipantsOK = false;
    }

    // Check main_rooms table
    console.log('\n📊 MAIN_ROOMS TABLE:');
    const mainRoomsColumns = [
      'id', 'name', 'description', 'channel_name', 'bot_user_id',
      'max_participants', 'current_participants', 'enforce_camera',
      'auto_approve_publisher', 'is_active', 'created_at', 'updated_at'
    ];

    const mainRoomsResult = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'main_rooms'
    `);

    const mainRoomsExisting = mainRoomsResult.rows.map(r => r.column_name);
    let mainRoomsOK = true;

    for (const col of mainRoomsColumns) {
      const exists = mainRoomsExisting.includes(col);
      console.log(`  ${exists ? '✅' : '❌'} ${col}`);
      if (!exists) mainRoomsOK = false;
    }

    // Check room_participants table
    console.log('\n📊 ROOM_PARTICIPANTS TABLE:');
    const roomParticipantsColumns = [
      'id', 'room_id', 'user_id', 'user_name', 'is_publisher', 'is_moderator',
      'joined_at', 'left_at', 'total_duration_seconds'
    ];

    const roomParticipantsResult = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'room_participants'
    `);

    const roomParticipantsExisting = roomParticipantsResult.rows.map(r => r.column_name);
    let roomParticipantsOK = true;

    for (const col of roomParticipantsColumns) {
      const exists = roomParticipantsExisting.includes(col);
      console.log(`  ${exists ? '✅' : '❌'} ${col}`);
      if (!exists) roomParticipantsOK = false;
    }

    // Check room_events table
    console.log('\n📊 ROOM_EVENTS TABLE:');
    const roomEventsColumns = [
      'id', 'room_id', 'event_type', 'initiator_user_id', 'target_user_id', 'metadata', 'created_at'
    ];

    const roomEventsResult = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'room_events'
    `);

    const roomEventsExisting = roomEventsResult.rows.map(r => r.column_name);
    let roomEventsOK = true;

    for (const col of roomEventsColumns) {
      const exists = roomEventsExisting.includes(col);
      console.log(`  ${exists ? '✅' : '❌'} ${col}`);
      if (!exists) roomEventsOK = false;
    }

    // Check agora_channels table
    console.log('\n📊 AGORA_CHANNELS TABLE:');
    const agoraChannelsColumns = [
      'id', 'channel_name', 'channel_type', 'feature_name', 'created_by',
      'max_participants', 'is_active', 'metadata', 'created_at', 'deactivated_at'
    ];

    const agoraChannelsResult = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'agora_channels'
    `);

    const agoraChannelsExisting = agoraChannelsResult.rows.map(r => r.column_name);
    let agoraChannelsOK = true;

    for (const col of agoraChannelsColumns) {
      const exists = agoraChannelsExisting.includes(col);
      console.log(`  ${exists ? '✅' : '❌'} ${col}`);
      if (!exists) agoraChannelsOK = false;
    }

    // Check seed data
    console.log('\n📊 SEED DATA:');
    const mainRoomsCount = await client.query('SELECT COUNT(*) as count FROM main_rooms');
    const count = parseInt(mainRoomsCount.rows[0].count);
    console.log(`  ${count >= 3 ? '✅' : '❌'} Main rooms: ${count}/3`);

    // Overall status
    console.log('\n' + '='.repeat(60));
    const allOK = videoCallsOK && callParticipantsOK && mainRoomsOK &&
                  roomParticipantsOK && roomEventsOK && agoraChannelsOK && count >= 3;

    if (allOK) {
      console.log('✨ SCHEMA IS COMPLETE AND READY FOR USE! ✨\n');
      console.log('Next steps:');
      console.log('  1. Run integration tests: npm run test:integration');
      console.log('  2. Test /api/hangouts endpoints');
      console.log('  3. Deploy Phase 2\n');
    } else {
      console.log('⚠️  SCHEMA IS INCOMPLETE - NEEDS MIGRATION FIXES\n');
      console.log('Missing:');
      if (!videoCallsOK) console.log('  - video_calls columns');
      if (!callParticipantsOK) console.log('  - call_participants columns');
      if (!mainRoomsOK) console.log('  - main_rooms columns');
      if (!roomParticipantsOK) console.log('  - room_participants columns');
      if (!roomEventsOK) console.log('  - room_events columns');
      if (!agoraChannelsOK) console.log('  - agora_channels columns');
      if (count < 3) console.log('  - main_rooms seed data');
      console.log();
    }

    client.release();
    process.exit(allOK ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (pool) await pool.end();
  }
}

validateSchema();
