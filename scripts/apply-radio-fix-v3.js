const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Database configuration
const config = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DATABASE || 'pnptvbot',
  user: process.env.POSTGRES_USER || 'pnptvbot',
  password: process.env.POSTGRES_PASSWORD || '',
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

async function applyMigration() {
  const pool = new Pool(config);
  const client = await pool.connect();

  try {
    console.log('🔧 Starting radio_now_playing table migration (v3)...');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../database/migrations/fix_radio_now_playing_schema_v3.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📖 Reading migration file:', migrationPath);

    // Execute the migration
    console.log('🚀 Executing migration...');
    await client.query('BEGIN');
    
    await client.query(migrationSQL);
    
    await client.query('COMMIT');

    console.log('✅ Migration completed successfully!');
    console.log('📋 Changes applied:');
    console.log('   - Created radio_now_playing_new table with correct schema');
    console.log('   - Created view radio_now_playing pointing to new table');
    console.log('   - Added necessary indexes and triggers');
    console.log('   - Code should now work with WHERE id = 1 queries');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    console.error('📝 Error details:', error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
applyMigration().then(() => {
  console.log('🎉 All done!');
  process.exit(0);
});