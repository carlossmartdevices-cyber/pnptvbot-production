const path = require('path');
process.env.NODE_CONFIG_DIR = path.join(__dirname, '../src/config');

// Load .env.production directly
const fs = require('fs');
const envFile = path.join(__dirname, '../.env.production');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  lines.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      let value = valueParts.join('=').trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  });
}

const { Pool } = require('pg');

async function runMigration() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE || 'pnptv',
    user: process.env.POSTGRES_USER || 'pnptv',
    password: process.env.POSTGRES_PASSWORD || '',
  });

  try {
    console.log('Connecting to PostgreSQL...');
    const client = await pool.connect();
    
    console.log('Adding is_prime column to media_library...');
    await client.query(`
      ALTER TABLE IF EXISTS media_library 
      ADD COLUMN IF NOT EXISTS is_prime BOOLEAN DEFAULT false;
    `);
    console.log('✓ Column added');
    
    console.log('Creating index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_media_library_is_prime 
      ON media_library(is_prime);
    `);
    console.log('✓ Index created');
    
    client.release();
    await pool.end();
    console.log('✓ Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration();
