#!/usr/bin/env node

/**
 * Unify Tier Prime with Membership Active
 * This script ensures consistency between tier and subscription_status
 */

const { Pool } = require('pg');
const logger = require('../src/utils/logger');

async function unifyTierMembership() {
  require('dotenv').config();

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
    logger.info('🔧 Unifying Tier Prime with Membership Active...');
    logger.info('='.repeat(70));

    // Step 1: Analyze current data
    logger.info('📊 Step 1: Analyzing current user statuses...');
    const analysisQuery = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE tier = 'Prime') as prime_tier_count,
        COUNT(*) FILTER (WHERE subscription_status = 'active') as active_subscription_count,
        COUNT(*) FILTER (WHERE tier = 'Prime' AND subscription_status = 'active') as consistent_count,
        COUNT(*) FILTER (WHERE tier = 'Prime' AND subscription_status != 'active') as inconsistent_prime_count,
        COUNT(*) FILTER (WHERE tier != 'Prime' AND subscription_status = 'active') as inconsistent_active_count
      FROM users
    `;

    const analysisResult = await client.query(analysisQuery);
    const stats = analysisResult.rows[0];

    logger.info(`   Total users: ${stats.total_users}`);
    logger.info(`   Prime tier users: ${stats.prime_tier_count}`);
    logger.info(`   Active subscription users: ${stats.active_subscription_count}`);
    logger.info(`   Consistent (Prime + Active): ${stats.consistent_count}`);
    logger.info(`   Inconsistent Prime tier: ${stats.inconsistent_prime_count}`);
    logger.info(`   Inconsistent Active status: ${stats.inconsistent_active_count}`);

    // Step 2: Fix inconsistent Prime tier users
    if (stats.inconsistent_prime_count > 0) {
      logger.info('\n🔧 Step 2: Fixing inconsistent Prime tier users...');
      const fixPrimeQuery = `
        UPDATE users 
        SET subscription_status = 'active' 
        WHERE tier = 'Prime' AND subscription_status != 'active'
      `;

      const fixPrimeResult = await client.query(fixPrimeQuery);
      logger.info(`   ✅ Updated ${fixPrimeResult.rowCount} users: Prime tier → Active subscription`);
    }

    // Step 3: Fix inconsistent Active subscription users
    if (stats.inconsistent_active_count > 0) {
      logger.info('\n🔧 Step 3: Fixing inconsistent Active subscription users...');
      const fixActiveQuery = `
        UPDATE users 
        SET tier = 'Prime' 
        WHERE subscription_status = 'active' AND tier != 'Prime'
      `;

      const fixActiveResult = await client.query(fixActiveQuery);
      logger.info(`   ✅ Updated ${fixActiveResult.rowCount} users: Active subscription → Prime tier`);
    }

    // Step 4: Standardize case for 'free' tier
    logger.info('\n🔧 Step 4: Standardizing tier case...');
    const standardizeCaseQuery = `
      UPDATE users 
      SET tier = 'Free' 
      WHERE tier = 'free'
    `;

    const standardizeResult = await client.query(standardizeCaseQuery);
    logger.info(`   ✅ Updated ${standardizeResult.rowCount} users: 'free' → 'Free'`);

    // Step 5: Verify the results
    logger.info('\n📊 Step 5: Verifying results...');
    const verificationQuery = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE tier = 'Prime' AND subscription_status = 'active') as prime_active_count,
        COUNT(*) FILTER (WHERE tier = 'Free' AND subscription_status = 'free') as free_free_count,
        COUNT(*) FILTER (WHERE tier = 'Free' AND subscription_status = 'churned') as free_churned_count
      FROM users
    `;

    const verificationResult = await client.query(verificationQuery);
    const finalStats = verificationResult.rows[0];

    logger.info(`   Total users: ${finalStats.total_users}`);
    logger.info(`   Prime + Active: ${finalStats.prime_active_count}`);
    logger.info(`   Free + Free: ${finalStats.free_free_count}`);
    logger.info(`   Free + Churned: ${finalStats.free_churned_count}`);

    logger.info('\n' + '='.repeat(70));
    logger.info('🎉 Unification completed successfully!');
    logger.info('   All Prime tier users now have Active subscription status');
    logger.info('   All Active subscription users now have Prime tier');
    logger.info('   Tier case standardized to proper capitalization');

  } catch (error) {
    logger.error('❌ Error unifying tier and membership:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the unification
unifyTierMembership().catch(error => {
  logger.error('❌ Failed to unify tier and membership:', error);
  process.exit(1);
});
