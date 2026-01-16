#!/usr/bin/env node

/**
 * Authentication System Monitoring Script
 * Runs tests and checks system health
 */

const AuthTester = require('../src/api/test/authTest');
const logger = require('../src/utils/logger');
const { query } = require('../src/config/postgres');

/**
 * Main monitoring function
 */
async function monitorAuthSystem() {
  logger.info('🔍 Starting authentication system monitoring...');
  
  try {
    // Run comprehensive tests
    const testResults = await runTests();
    
    // Check system health
    const healthStatus = await checkHealth();
    
    // Get user statistics
    const userStats = await getUserStatistics();
    
    // Log summary
    logSummary(testResults, healthStatus, userStats);
    
    // Return exit code
    return testResults.failed === 0 ? 0 : 1;
    
  } catch (error) {
    logger.error('❌ Monitoring failed:', error);
    return 1;
  }
}

/**
 * Run authentication tests
 */
async function runTests() {
  logger.info('🧪 Running authentication tests...');
  
  const authTester = new AuthTester();
  const results = await authTester.runAllTests();
  
  return results;
}

/**
 * Check system health
 */
async function checkHealth() {
  logger.info('❤️ Checking system health...');
  
  const healthStatus = {
    database: 'unknown',
    authentication: 'unknown',
    permissions: 'unknown'
  };
  
  // Check database
  try {
    await query('SELECT 1');
    healthStatus.database = 'healthy';
    logger.info('✅ Database: Healthy');
  } catch (error) {
    healthStatus.database = 'unhealthy';
    logger.error('❌ Database: Unhealthy -', error.message);
  }
  
  // Check if we can query user data
  try {
    const result = await query(
      'SELECT COUNT(*) as count FROM users WHERE accepted_terms = TRUE'
    );
    healthStatus.authentication = 'healthy';
    healthStatus.permissions = 'healthy';
    logger.info('✅ Authentication & Permissions: Healthy');
  } catch (error) {
    healthStatus.authentication = 'unhealthy';
    healthStatus.permissions = 'unhealthy';
    logger.error('❌ Authentication: Unhealthy -', error.message);
  }
  
  return healthStatus;
}

/**
 * Get user statistics
 */
async function getUserStatistics() {
  logger.info('📊 Gathering user statistics...');
  
  try {
    const result = await query(
      `SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN accepted_terms = TRUE THEN 1 ELSE 0 END) as terms_accepted,
        SUM(CASE WHEN subscription_status = 'free' THEN 1 ELSE 0 END) as free_users,
        SUM(CASE WHEN subscription_status = 'active' THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN subscription_status = 'expired' THEN 1 ELSE 0 END) as expired_users,
        SUM(CASE WHEN subscription_status = 'churned' THEN 1 ELSE 0 END) as churned_users
       FROM users`
    );
    
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    
    return {
      total_users: 0,
      terms_accepted: 0,
      free_users: 0,
      active_users: 0,
      expired_users: 0,
      churned_users: 0
    };
    
  } catch (error) {
    logger.error('❌ Failed to get user statistics:', error.message);
    return null;
  }
}

/**
 * Log monitoring summary
 */
function logSummary(testResults, healthStatus, userStats) {
  logger.info('\n' + '='.repeat(60));
  logger.info('📋 AUTHENTICATION SYSTEM MONITORING SUMMARY');
  logger.info('='.repeat(60));
  
  // Test results
  logger.info('\n🧪 TEST RESULTS:');
  logger.info(`   Total Tests: ${testResults.total}`);
  logger.info(`   Passed: ${testResults.passed} (${(testResults.passed / testResults.total * 100).toFixed(2)}%)`);
  logger.info(`   Failed: ${testResults.failed}`);
  logger.info(`   Duration: ${testResults.endTime - testResults.startTime}ms`);
  
  if (testResults.errors.length > 0) {
    logger.warn('\n⚠️  TEST ERRORS:');
    testResults.errors.forEach((error, index) => {
      logger.warn(`   ${index + 1}. ${error.test}: ${error.error}`);
    });
  }
  
  // Health status
  logger.info('\n❤️  SYSTEM HEALTH:');
  Object.entries(healthStatus).forEach(([component, status]) => {
    const symbol = status === 'healthy' ? '✅' : '❌';
    logger.info(`   ${symbol} ${component}: ${status}`);
  });
  
  // User statistics
  if (userStats) {
    logger.info('\n👥 USER STATISTICS:');
    logger.info(`   Total Users: ${userStats.total_users}`);
    logger.info(`   Terms Accepted: ${userStats.terms_accepted} (${(userStats.terms_accepted / userStats.total_users * 100).toFixed(2)}%)`);
    logger.info(`   FREE Users: ${userStats.free_users}`);
    logger.info(`   PRIME Users: ${userStats.active_users}`);
    logger.info(`   Expired Users: ${userStats.expired_users}`);
    logger.info(`   Churned Users: ${userStats.churned_users}`);
  }
  
  // Overall status
  const allHealthy = Object.values(healthStatus).every(status => status === 'healthy');
  const allTestsPassed = testResults.failed === 0;
  
  logger.info('\n' + '='.repeat(60));
  if (allHealthy && allTestsPassed) {
    logger.info('🎉 SYSTEM STATUS: HEALTHY - All systems operational');
  } else if (allHealthy && !allTestsPassed) {
    logger.info('⚠️  SYSTEM STATUS: DEGRADED - Some tests failed');
  } else {
    logger.info('❌ SYSTEM STATUS: UNHEALTHY - Requires attention');
  }
  logger.info('='.repeat(60) + '\n');
}

// Run monitoring if called directly
if (require.main === module) {
  monitorAuthSystem().then(exitCode => {
    process.exit(exitCode);
  });
}

module.exports = {
  monitorAuthSystem,
  runTests,
  checkHealth,
  getUserStatistics
};