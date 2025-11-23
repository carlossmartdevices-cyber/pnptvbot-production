#!/usr/bin/env node

/**
 * Update plans to correct configuration
 */

const path = require('path');
const { initializePostgres, query } = require('../src/config/postgres');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const correctPlans = [
  {
    id: 'week-trial-pass',
    name: 'Week Trial Pass',
    display_name: 'Week Trial Pass',
    tier: 'Basic',
    price: 14.99,
    currency: 'USD',
    duration: 7,
    duration_days: 7,
    description: 'Try premium features for one week',
    features: JSON.stringify([
      'Premium channel access',
      'Access to Nearby Members feature',
      'Weekly video releases',
      'Community features'
    ]),
    icon: '🎯',
    active: true,
    recommended: false,
    is_lifetime: false
  },
  {
    id: 'monthly-pass',
    name: 'Monthly Pass',
    display_name: 'Monthly Pass',
    tier: 'PNP',
    price: 24.99,
    currency: 'USD',
    duration: 30,
    duration_days: 30,
    description: 'Full monthly access to all premium features',
    features: JSON.stringify([
      'Everything in Week Trial Pass',
      'Unlimited premium channel access',
      'Long-session videos',
      'Full videography access',
      'Priority support'
    ]),
    icon: '⭐',
    active: true,
    recommended: true,
    is_lifetime: false
  },
  {
    id: 'crystal-pass',
    name: 'Crystal Pass',
    display_name: 'Crystal Pass',
    tier: 'Crystal',
    price: 49.99,
    currency: 'USD',
    duration: 180,
    duration_days: 180,
    description: '6 months of premium access',
    features: JSON.stringify([
      'Everything in Monthly Pass',
      '6 months unlimited access',
      'Exclusive content',
      'Early access to new releases',
      'VIP community status'
    ]),
    icon: '💎',
    active: true,
    recommended: false,
    is_lifetime: false
  },
  {
    id: 'diamond-pass',
    name: 'Diamond Pass',
    display_name: 'Diamond Pass',
    tier: 'Diamond',
    price: 99.99,
    currency: 'USD',
    duration: 365,
    duration_days: 365,
    description: 'Full year of premium access',
    features: JSON.stringify([
      'Everything in Crystal Pass',
      'Full year unlimited access',
      'VIP customer support',
      'Custom profile badge',
      'Access to exclusive events',
      'Behind-the-scenes content'
    ]),
    icon: '👑',
    active: true,
    recommended: false,
    is_lifetime: false
  },
  {
    id: 'lifetime-pass',
    name: 'Lifetime Pass',
    display_name: 'Lifetime Pass',
    tier: 'Premium',
    price: 249.00,
    currency: 'USD',
    duration: 36500,
    duration_days: 36500,
    description: 'Lifetime access to all features',
    features: JSON.stringify([
      'Everything in Diamond Pass',
      'Lifetime unlimited access',
      'Never pay again',
      'Founder badge',
      'Priority feature requests',
      'Exclusive founder perks'
    ]),
    icon: '♾️',
    active: true,
    recommended: false,
    is_lifetime: true
  }
];

async function updatePlans() {
  console.log('\n' + '='.repeat(70));
  console.log('🔄 UPDATING PLANS TO CORRECT CONFIGURATION');
  console.log('='.repeat(70));
  console.log();

  try {
    initializePostgres();

    // Step 1: Deactivate old/wrong plans
    console.log('📊 Step 1: Deactivating old plans...\n');
    const plansToDeactivate = ['trial-week', 'pnp-member', 'new-plan', 'existing-plan', 'crystal-member', 'diamond-member'];

    for (const planId of plansToDeactivate) {
      await query('UPDATE plans SET active = false WHERE id = $1', [planId]);
      console.log(`   ✓ Deactivated: ${planId}`);
    }

    // Step 2: Insert/Update correct plans
    console.log('\n📊 Step 2: Creating correct plans...\n');

    for (const plan of correctPlans) {
      await query(`
        INSERT INTO plans (
          id, name, display_name, tier, price, currency, duration, duration_days,
          description, features, icon, active, recommended, is_lifetime,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          name = $2,
          display_name = $3,
          tier = $4,
          price = $5,
          currency = $6,
          duration = $7,
          duration_days = $8,
          description = $9,
          features = $10,
          icon = $11,
          active = $12,
          recommended = $13,
          is_lifetime = $14,
          updated_at = NOW()
      `, [
        plan.id, plan.name, plan.display_name, plan.tier, plan.price, plan.currency,
        plan.duration, plan.duration_days, plan.description, plan.features, plan.icon,
        plan.active, plan.recommended, plan.is_lifetime
      ]);

      console.log(`   ✓ Created/Updated: ${plan.name} - $${plan.price} (${plan.duration} days)`);
    }

    // Step 3: Verify results
    console.log('\n📊 Step 3: Verifying active plans...\n');
    const result = await query('SELECT id, name, price, duration, active FROM plans WHERE active = true ORDER BY price ASC');

    console.log('Active plans:');
    result.rows.forEach((plan, index) => {
      console.log(`   ${index + 1}. ${plan.name} - $${plan.price} (${plan.duration} days)`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('✅ PLANS UPDATED SUCCESSFULLY!');
    console.log('='.repeat(70));
    console.log('\n⚠️  Remember to restart the bot to clear cache:\n');
    console.log('   redis-cli FLUSHDB && pm2 restart pnptv-bot\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error updating plans:', error.message);
    console.error(error);
    process.exit(1);
  }
}

updatePlans();
