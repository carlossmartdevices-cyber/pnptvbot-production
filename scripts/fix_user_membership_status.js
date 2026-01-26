#!/usr/bin/env node

/**
 * Fix User Membership Status
 * Implements the business logic:
 * - Churned = Free (for all effects except marketing)
 * - Free = Membership not active
 * - Churned = Free (same treatment)
 * - Membership Active (Prime) = User holds any plan, regardless of plan type
 */

const { Pool } = require('pg');
const logger = require('../src/utils/logger');

async function fixUserMembershipStatus() {
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
    logger.info('🔧 Fixing User Membership Status...');
    logger.info('='.repeat(70));

    // Step 1: Analyze current data
    logger.info('📊 Step 1: Analyzing current user statuses...');
    const analysisQuery = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE tier = 'Prime') as prime_tier_count,
        COUNT(*) FILTER (WHERE tier = 'Free') as free_tier_count,
        COUNT(*) FILTER (WHERE tier = 'free') as lowercase_free_count,
        COUNT(*) FILTER (WHERE subscription_status = 'active') as active_status_count,
        COUNT(*) FILTER (WHERE subscription_status = 'free') as free_status_count,
        COUNT(*) FILTER (WHERE subscription_status = 'churned') as churned_status_count,
        COUNT(*) FILTER (WHERE plan_id IS NOT NULL AND plan_id != '') as has_plan_count,
        COUNT(*) FILTER (WHERE plan_expiry IS NOT NULL AND plan_expiry > NOW()) as active_plan_count
      FROM users
    `;

    const analysisResult = await client.query(analysisQuery);
    const stats = analysisResult.rows[0];

    logger.info(`   Total users: ${stats.total_users}`);
    logger.info(`   Prime tier: ${stats.prime_tier_count}`);
    logger.info(`   Free tier: ${stats.free_tier_count}`);
    logger.info(`   Lowercase 'free': ${stats.lowercase_free_count}`);
    logger.info(`   Active status: ${stats.active_status_count}`);
    logger.info(`   Free status: ${stats.free_status_count}`);
    logger.info(`   Churned status: ${stats.churned_status_count}`);
    logger.info(`   Users with plans: ${stats.has_plan_count}`);
    logger.info(`   Users with active plans: ${stats.active_plan_count}`);

    // Step 2: Implement business logic
    // Rule: Membership Active (Prime) = User holds any plan, regardless of plan type
    logger.info('\n🔧 Step 2: Implementing business logic...');
    
    // 2a. Users with active plans should be Prime + Active
    logger.info('   2a. Fixing users with active plans...');
    const fixActivePlansQuery = `
      UPDATE users 
      SET 
        tier = 'Prime',
        subscription_status = 'active'
      WHERE 
        (plan_id IS NOT NULL AND plan_id != '') 
        AND (plan_expiry IS NULL OR plan_expiry > NOW())
        AND (tier != 'Prime' OR subscription_status != 'active')
    `;

    const activePlansResult = await client.query(fixActivePlansQuery);
    logger.info(`      ✅ Updated ${activePlansResult.rowCount} users with active plans → Prime + Active`);

    // 2b. Users with expired plans should be Free + Free (or Free + Churned)
    logger.info('   2b. Fixing users with expired plans...');
    const fixExpiredPlansQuery = `
      UPDATE users 
      SET 
        tier = 'Free',
        subscription_status = CASE 
          WHEN subscription_status = 'churned' THEN 'churned'
          ELSE 'free'
        END
      WHERE 
        (plan_id IS NOT NULL AND plan_id != '') 
        AND plan_expiry IS NOT NULL 
        AND plan_expiry <= NOW()
        AND (tier != 'Free' OR (subscription_status != 'free' AND subscription_status != 'churned'))
    `;

    const expiredPlansResult = await client.query(fixExpiredPlansQuery);
    logger.info(`      ✅ Updated ${expiredPlansResult.rowCount} users with expired plans → Free + (Free/Churned)`);

    // 2c. Users without plans should be Free + Free (or Free + Churned)
    logger.info('   2c. Fixing users without plans...');
    const fixNoPlansQuery = `
      UPDATE users 
      SET 
        tier = 'Free',
        subscription_status = CASE 
          WHEN subscription_status = 'churned' THEN 'churned'
          ELSE 'free'
        END
      WHERE 
        (plan_id IS NULL OR plan_id = '')
        AND (tier != 'Free' OR (subscription_status != 'free' AND subscription_status != 'churned'))
    `;

    const noPlansResult = await client.query(fixNoPlansQuery);
    logger.info(`      ✅ Updated ${noPlansResult.rowCount} users without plans → Free + (Free/Churned)`);

    // 2d. Standardize case for 'free' tier
    logger.info('   2d. Standardizing tier case...');
    const standardizeCaseQuery = `
      UPDATE users 
      SET tier = 'Free' 
      WHERE tier = 'free'
    `;

    const standardizeResult = await client.query(standardizeCaseQuery);
    logger.info(`      ✅ Updated ${standardizeResult.rowCount} users: 'free' → 'Free'`);

    // Step 3: Verify the results
    logger.info('\n📊 Step 3: Verifying results...');
    const verificationQuery = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE tier = 'Prime' AND subscription_status = 'active') as prime_active_count,
        COUNT(*) FILTER (WHERE tier = 'Free' AND subscription_status = 'free') as free_free_count,
        COUNT(*) FILTER (WHERE tier = 'Free' AND subscription_status = 'churned') as free_churned_count,
        COUNT(*) FILTER (WHERE tier = 'Prime' AND subscription_status != 'active') as inconsistent_prime_count,
        COUNT(*) FILTER (WHERE tier = 'Free' AND subscription_status = 'active') as inconsistent_free_count
      FROM users
    `;

    const verificationResult = await client.query(verificationQuery);
    const finalStats = verificationResult.rows[0];

    logger.info(`   Total users: ${finalStats.total_users}`);
    logger.info(`   Prime + Active: ${finalStats.prime_active_count}`);
    logger.info(`   Free + Free: ${finalStats.free_free_count}`);
    logger.info(`   Free + Churned: ${finalStats.free_churned_count}`);
    logger.info(`   Inconsistent Prime: ${finalStats.inconsistent_prime_count}`);
    logger.info(`   Inconsistent Free: ${finalStats.inconsistent_free_count}`);

    // Step 4: Create summary report
    logger.info('\n📊 Step 4: Creating summary report...');
    const summaryQuery = `
      SELECT 
        tier,
        subscription_status,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE plan_id IS NOT NULL AND plan_id != '' AND (plan_expiry IS NULL OR plan_expiry > NOW())) as active_plans,
        COUNT(*) FILTER (WHERE plan_id IS NOT NULL AND plan_id != '' AND plan_expiry IS NOT NULL AND plan_expiry <= NOW()) as expired_plans,
        COUNT(*) FILTER (WHERE plan_id IS NULL OR plan_id = '') as no_plans
      FROM users
      GROUP BY tier, subscription_status
      ORDER BY tier, subscription_status
    `;

    const summaryResult = await client.query(summaryQuery);

    logger.info('\n   Final User Status Distribution:');
    logger.info('   ' + '='.repeat(66));
    logger.info('   | Tier   | Status    | Count | Active Plans | Expired Plans | No Plans |');
    logger.info('   ' + '='.repeat(66));
    
    summaryResult.rows.forEach(row => {
      logger.info(`   | ${row.tier.padEnd(6)} | ${row.subscription_status.padEnd(9)} | ${row.count.toString().padEnd(5)} | ${row.active_plans.toString().padEnd(12)} | ${row.expired_plans.toString().padEnd(13)} | ${row.no_plans.toString().padEnd(8)} |`);
    });

    logger.info('   ' + '='.repeat(66));

    logger.info('\n' + '='.repeat(70));
    logger.info('🎉 Membership Status Fix Completed Successfully!');
    logger.info('');
    logger.info('Business Logic Implemented:');
    logger.info('   ✅ Membership Active (Prime) = User holds any active plan');
    logger.info('   ✅ Free = Membership not active (no plan or expired plan)');
    logger.info('   ✅ Churned = Free (for all effects except marketing)');
    logger.info('   ✅ Tier case standardized to proper capitalization');
    logger.info('');
    logger.info('All users now have consistent membership status!');

  } catch (error) {
    logger.error('❌ Error fixing user membership status:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixUserMembershipStatus().catch(error => {
  logger.error('❌ Failed to fix user membership status:', error);
  process.exit(1);
});
