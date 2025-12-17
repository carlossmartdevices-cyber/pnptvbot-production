#!/usr/bin/env node

/**
 * Test script to verify what plans are being displayed to users
 */

const path = require('path');
const { initializePostgres, query } = require('../src/config/postgres');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function testPlansDisplay() {
  console.log('\n📊 Testing Plans Display\n');
  console.log('='.repeat(70));

  try {
    // Initialize PostgreSQL
    initializePostgres();

    // Get all active plans (same query as PlanModel.getAll())
    const result = await query('SELECT * FROM plans WHERE active = true ORDER BY price ASC');
    const plans = result.rows;

    console.log(`\n✅ Found ${plans.length} active plans in database:\n`);

    plans.forEach((plan, index) => {
      console.log(`${index + 1}. ${plan.icon || '💎'} ${plan.display_name || plan.name}`);
      console.log(`   ID: ${plan.id}`);
      console.log(`   Price: $${plan.price}`);
      console.log(`   Tier: ${plan.tier}`);
      console.log(`   Duration: ${plan.duration} days`);
      console.log(`   Active: ${plan.active}`);
      console.log(`   Recommended: ${plan.recommended}`);
      if (plan.features && Array.isArray(plan.features)) {
        console.log(`   Features: ${plan.features.length} feature(s)`);
        plan.features.forEach(f => console.log(`     ✓ ${f}`));
      }
      console.log();
    });

    console.log('='.repeat(70));
    console.log('\n✅ These are the plans users will see in the menu\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testPlansDisplay();
