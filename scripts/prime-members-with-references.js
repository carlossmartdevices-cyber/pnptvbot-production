#!/usr/bin/env node
/**
 * Prime Members Report with Payment References
 * Shows all active PRIME members with their payment reference info
 * 
 * Usage:
 *   node scripts/prime-members-with-references.js
 */

require('dotenv').config();
const { query } = require('../src/config/postgres');
const logger = require('../src/utils/logger');

async function generatePrimeMembersReport() {
  try {
    console.log('\n📊 PRIME MEMBERS REPORT WITH PAYMENT REFERENCES\n');
    console.log('═'.repeat(80));
    console.log('');

    // Get all active PRIME users with their most recent completed payment
    const result = await query(`
      SELECT 
        u.id as telegram_id,
        u.username,
        u.first_name,
        u.last_name,
        u.subscription_status,
        u.plan_id as subscription_plan_id,
        u.plan_expiry as subscription_expiry,
        p.id as payment_id,
        p.reference as payment_reference,
        p.provider,
        p.amount,
        p.currency,
        p.completed_at
      FROM users u
      LEFT JOIN LATERAL (
        SELECT id, reference, provider, amount, currency, completed_at
        FROM payments
        WHERE user_id = u.id
          AND status = 'completed'
        ORDER BY completed_at DESC
        LIMIT 1
      ) p ON true
      WHERE u.subscription_status = 'active'
      ORDER BY u.plan_expiry DESC NULLS LAST, u.id
    `);

    if (result.rows.length === 0) {
      console.log('No active PRIME members found.');
      process.exit(0);
    }

    console.log(`Total Active PRIME Members: ${result.rows.length}\n`);

    // Statistics
    const withReferences = result.rows.filter(r => r.payment_reference).length;
    const withoutReferences = result.rows.length - withReferences;
    const epaycoCount = result.rows.filter(r => r.provider === 'epayco').length;
    const daimoCount = result.rows.filter(r => r.provider === 'daimo').length;

    console.log('📈 Statistics:');
    console.log(`  ✅ With Payment Reference: ${withReferences}`);
    console.log(`  ❌ Without Payment Reference: ${withoutReferences}`);
    console.log(`  💳 ePayco Payments: ${epaycoCount}`);
    console.log(`  🔗 Daimo Payments: ${daimoCount}`);
    console.log('');
    console.log('═'.repeat(80));
    console.log('');

    // Display each member
    result.rows.forEach((member, index) => {
      console.log(`${index + 1}. User: @${member.username || 'no_username'}`);
      console.log(`   Telegram ID: ${member.telegram_id}`);
      console.log(`   Name: ${member.first_name || ''} ${member.last_name || ''}`);
      console.log(`   Plan: ${member.subscription_plan_id || 'Unknown'}`);
      console.log(`   Expiry: ${member.subscription_expiry ? new Date(member.subscription_expiry).toLocaleDateString() : 'Lifetime'}`);
      
      if (member.payment_reference) {
        console.log(`   ✅ Payment Reference: ${member.payment_reference}`);
      } else {
        console.log(`   ❌ Payment Reference: Not available`);
      }
      
      if (member.provider) {
        console.log(`   Provider: ${member.provider}`);
        console.log(`   Amount: ${member.amount || 'N/A'} ${member.currency || 'USD'}`);
        console.log(`   Completed: ${member.completed_at ? new Date(member.completed_at).toLocaleString() : 'N/A'}`);
      }
      
      console.log('');
    });

    console.log('═'.repeat(80));
    console.log('');
    console.log('💡 To add a payment reference to a user:');
    console.log('   node scripts/add-payment-reference.js <payment_id> <epayco_reference>');
    console.log('');
    console.log('💡 To find a payment by reference:');
    console.log('   node scripts/find-payment-by-reference.js <epayco_reference>');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('Error generating report:', error);
    process.exit(1);
  }
}

generatePrimeMembersReport();
