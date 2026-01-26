#!/usr/bin/env node

/**
 * Apply Recurring Subscriptions Migration
 * This script applies the 039_add_recurring_subscription_fields.sql migration
 * to fix the missing recurring_subscriptions table and subscription_type column
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

async function applyMigration() {
  // Load environment variables
  require('dotenv').config();

  const migrationFile = path.join(__dirname, '..', 'database', 'migrations', '039_add_recurring_subscription_fields.sql');
  
  if (!fs.existsSync(migrationFile)) {
    logger.error('❌ Migration file not found:', migrationFile);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationFile, 'utf8');

  // Create PostgreSQL connection pool
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE || 'pnptvbot',
    user: process.env.POSTGRES_USER || 'pnptvbot',
    password: process.env.POSTGRES_PASSWORD || '',
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();

  try {
    logger.info('🚀 Applying Recurring Subscriptions Migration...');
    logger.info('='.repeat(70));

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (const [index, statement] of statements.entries()) {
      try {
        // Skip empty statements and comments
        if (!statement || statement.startsWith('--') || statement.startsWith('/*')) {
          continue;
        }

        logger.info(`📋 [${index + 1}/${statements.length}] Executing: ${statement.substring(0, 80)}${statement.length > 80 ? '...' : ''}`);
        
        await client.query(statement);
        successCount++;
        logger.info(`✅ Success`);
      } catch (error) {
        errorCount++;
        // Don't fail on "already exists" errors
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate key') ||
            error.message.includes('column.*already exists')) {
          logger.warn(`⚠️  Skipped (already exists): ${error.message}`);
        } else {
          logger.error(`❌ Error executing statement: ${error.message}`);
          logger.error(`   Statement: ${statement}`);
        }
      }
    }

    logger.info('='.repeat(70));
    logger.info(`📊 Migration Results:`);
    logger.info(`   ✅ Successful statements: ${successCount}`);
    logger.info(`   ⚠️  Skipped statements: ${errorCount}`);
    logger.info(`   📝 Total statements: ${statements.length}`);

    if (errorCount === 0 || (errorCount > 0 && successCount > 0)) {
      logger.info('🎉 Migration completed successfully!');
    } else {
      logger.error('❌ Migration completed with errors');
    }

  } catch (error) {
    logger.error('❌ Fatal error during migration:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
applyMigration().catch(error => {
  logger.error('❌ Migration failed:', error);
  process.exit(1);
});
