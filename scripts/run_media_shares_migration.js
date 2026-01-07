#!/usr/bin/env node

/**
 * Run Media Shares Table Migration
 * Creates the media_shares table for tracking media popularity
 */

const { getPool } = require('../src/config/postgres');
const fs = require('fs');
const logger = require('../src/utils/logger');

async function runMigration() {
  try {
    logger.info('🚀 Starting media_shares table migration...');
    
    // Read migration SQL file
    const migrationSQL = fs.readFileSync(
      './database/migrations/033_create_media_shares_table.sql',
      'utf8'
    );
    
    logger.info('✅ Migration SQL loaded');
    
    // Execute migration
    const pool = getPool();
    await pool.query('BEGIN');
    
    try {
      // Split SQL into individual statements
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      for (const statement of statements) {
        await pool.query(statement);
        logger.info(`✅ Executed: ${statement.substring(0, 50)}...`);
      }
      
      await pool.query('COMMIT');
      logger.info('🎉 Migration completed successfully!');
      logger.info('✅ media_shares table created');
      logger.info('✅ Indexes created');
      logger.info('✅ Triggers configured');
      logger.info('✅ Comments added');
      
      return true;
    } catch (error) {
      await pool.query('ROLLBACK');
      logger.error('❌ Migration failed, rolled back:', error.message);
      return false;
    }
  } catch (error) {
    logger.error('❌ Migration error:', error.message);
    return false;
  }
}

// Check if script is run directly
if (require.main === module) {
  runMigration()
    .then(success => {
      if (success) {
        logger.info('\n🎊 Media shares table is ready!');
        logger.info('The system can now track media popularity.');
      } else {
        logger.error('\n❌ Migration failed. Check logs for details.');
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error('\n❌ Unexpected error:', error.message);
      process.exit(1);
    });
}

module.exports = { runMigration };
