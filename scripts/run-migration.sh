#!/bin/bash
cd /root/pnptvbot-production
source /root/.bashrc
pm2 exec bot "node -e \"
const { getPool } = require('./src/config/postgres');
(async () => {
  try {
    const pool = getPool();
    console.log('Running migration: adding is_prime column...');
    await pool.query('ALTER TABLE IF EXISTS media_library ADD COLUMN IF NOT EXISTS is_prime BOOLEAN DEFAULT false;');
    console.log('✓ Column added');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_media_library_is_prime ON media_library(is_prime);');
    console.log('✓ Index created');
    await pool.end();
    console.log('✓ Migration completed!');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
})();
\""
