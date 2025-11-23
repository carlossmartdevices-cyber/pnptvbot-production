/**
 * Test script to verify Plan model works correctly
 */

require('dotenv').config();
const Plan = require('../src/models/planModel');
const logger = require('../src/utils/logger');

async function testPlanModel() {
  try {
    logger.info('Testing Plan model...');

    // Test getAll
    logger.info('Getting all plans...');
    const plans = await Plan.getAll();
    logger.info(`Found ${plans.length} plans:`);
    plans.forEach(plan => {
      logger.info(`  - ${plan.id}: ${plan.name} ($${plan.price}) - ${plan.duration} days - isLifetime: ${plan.is_lifetime || plan.isLifetime}`);
    });

    // Test getById for lifetime-pass
    logger.info('\nGetting lifetime-pass plan...');
    const lifetimePlan = await Plan.getById('lifetime-pass');
    if (lifetimePlan) {
      logger.info(`Found lifetime plan:`);
      logger.info(`  ID: ${lifetimePlan.id}`);
      logger.info(`  Name: ${lifetimePlan.name}`);
      logger.info(`  Price: $${lifetimePlan.price}`);
      logger.info(`  Duration: ${lifetimePlan.duration} days`);
      logger.info(`  Is Lifetime: ${lifetimePlan.is_lifetime}`);
    } else {
      logger.error('Lifetime plan not found!');
    }

    return true;
  } catch (error) {
    logger.error('Error testing plan model:', error);
    return false;
  }
}

testPlanModel()
  .then((success) => {
    if (success) {
      console.log('\n✅ Plan model test completed successfully!');
      process.exit(0);
    } else {
      console.error('\n❌ Plan model test failed');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
