#!/usr/bin/env node

/**
 * Verify Media Shares Table
 * Checks if the media_shares table exists and is properly configured
 */

const { getPool } = require('../src/config/postgres');
const logger = require('../src/utils/logger');

async function verifyTable() {
  try {
    logger.info('🔍 Verifying media_shares table...');
    
    const pool = getPool();
    
    // Check if table exists
    const tableCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'media_shares'
      )`
    );
    
    if (!tableCheck.rows[0].exists) {
      logger.error('❌ media_shares table does not exist');
      return false;
    }
    
    logger.info('✅ media_shares table exists');
    
    // Check table structure
    const tableStructure = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = 'media_shares'
       ORDER BY ordinal_position`
    );
    
    logger.info('✅ Table structure:');
    tableStructure.rows.forEach(col => {
      logger.info(`   • ${col.column_name} (${col.data_type})`);
    });
    
    // Check indexes
    const indexes = await pool.query(
      `SELECT indexname
       FROM pg_indexes
       WHERE tablename = 'media_shares'`
    );
    
    logger.info('✅ Indexes:');
    indexes.rows.forEach(idx => {
      logger.info(`   • ${idx.indexname}`);
    });
    
    // Check if table has data (optional)
    const count = await pool.query('SELECT COUNT(*) as count FROM media_shares');
    logger.info(`✅ Current records: ${count.rows[0].count}`);
    
    logger.info('🎉 media_shares table is properly configured!');
    logger.info('✅ Ready to track media popularity');
    
    return true;
  } catch (error) {
    logger.error('❌ Verification error:', error.message);
    return false;
  }
}

// Check if script is run directly
if (require.main === module) {
  verifyTable()
    .then(success => {
      if (success) {
        logger.info('\n🎊 Verification complete!');
        logger.info('The media popularity system is ready to use.');
      } else {
        logger.error('\n❌ Verification failed.');
        logger.error('Please run the migration script first.');
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error('\n❌ Unexpected error:', error.message);
      process.exit(1);
    });
}

module.exports = { verifyTable };
