const fs = require('fs');
const path = require('path');
const { getPool } = require('../src/config/postgres');

async function apply() {
  const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '053_fix_broadcasts_missing_broadcast_id.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Broadcast ID fix migration applied successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to apply broadcast ID fix migration:', error);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

apply();
