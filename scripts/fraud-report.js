#!/usr/bin/env node

/**
 * Fraud Detection Monitoring Report
 * Comprehensive fraud analysis and reporting
 */

const { query } = require('../src/config/postgres');
const logger = require('../src/utils/logger');

async function generateFraudReport() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🚨 FRAUD DETECTION MONITORING REPORT');
    console.log(`Generated: ${new Date().toLocaleString()}`);
    console.log('='.repeat(80) + '\n');

    // 1. Total fraud flags
    const flagsResult = await query(`
      SELECT COUNT(*) as total_flags,
             COUNT(DISTINCT user_id) as unique_users,
             AVG(risk_score) as avg_risk_score,
             MAX(risk_score) as max_risk_score
      FROM fraud_flags
    `);

    const { total_flags, unique_users, avg_risk_score, max_risk_score } = flagsResult.rows[0];

    console.log('📊 FRAUD FLAGS SUMMARY');
    console.log('-'.repeat(80));
    console.log(`Total fraud flags: ${total_flags}`);
    console.log(`Unique users flagged: ${unique_users}`);
    console.log(`Average risk score: ${parseFloat(avg_risk_score).toFixed(2)}`);
    console.log(`Maximum risk score: ${max_risk_score}\n`);

    // 2. High-risk users
    console.log('🔴 HIGH-RISK USERS (Risk Score ≥ 6)');
    console.log('-'.repeat(80));

    const highRiskResult = await query(`
      SELECT user_id,
             COUNT(*) as flag_count,
             AVG(risk_score) as avg_risk,
             MAX(created_at) as last_flag,
             STRING_AGG(DISTINCT flagged_rules, '; ') as rules
      FROM fraud_flags
      GROUP BY user_id
      HAVING AVG(risk_score::INT) >= 6
      ORDER BY avg_risk DESC
      LIMIT 20
    `);

    if (highRiskResult.rows.length === 0) {
      console.log('✅ No high-risk users detected.\n');
    } else {
      highRiskResult.rows.forEach((row, idx) => {
        console.log(`${idx + 1}. User: ${row.user_id}`);
        console.log(`   📊 Flags: ${row.flag_count} | Avg Risk: ${parseFloat(row.avg_risk).toFixed(2)}`);
        console.log(`   📅 Last Flag: ${new Date(row.last_flag).toLocaleString()}`);
        console.log(`   ⚠️  Rules Triggered: ${row.rules}`);
        console.log('');
      });
    }

    // 3. Most common fraud patterns
    console.log('\n📈 MOST COMMON FRAUD PATTERNS');
    console.log('-'.repeat(80));

    const patternsResult = await query(`
      SELECT flagged_rules,
             COUNT(*) as occurrence_count
      FROM fraud_flags
      WHERE flagged_rules IS NOT NULL
      GROUP BY flagged_rules
      ORDER BY occurrence_count DESC
      LIMIT 15
    `);

    patternsResult.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.flagged_rules}: ${row.occurrence_count} occurrences`);
    });

    // 4. Fraud by time period
    console.log('\n\n📅 FRAUD TRENDS');
    console.log('-'.repeat(80));

    const trendsResult = await query(`
      SELECT DATE(created_at) as date,
             COUNT(*) as daily_flags,
             COUNT(DISTINCT user_id) as daily_users,
             AVG(risk_score::INT) as avg_daily_risk
      FROM fraud_flags
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 10
    `);

    console.log('Last 10 Days:');
    trendsResult.rows.forEach((row) => {
      console.log(
        `${row.date}: ${row.daily_flags} flags | ${row.daily_users} users | Risk: ${parseFloat(row.avg_daily_risk).toFixed(2)}`
      );
    });

    // 5. Suspicious email patterns
    console.log('\n\n✉️  SUSPICIOUS EMAIL PATTERNS');
    console.log('-'.repeat(80));

    const emailResult = await query(`
      SELECT email,
             COUNT(*) as email_flag_count,
             COUNT(DISTINCT user_id) as linked_users
      FROM fraud_flags
      WHERE email IS NOT NULL
      GROUP BY email
      HAVING COUNT(*) >= 2
      ORDER BY email_flag_count DESC
      LIMIT 10
    `);

    if (emailResult.rows.length === 0) {
      console.log('✅ No suspicious email patterns.\n');
    } else {
      emailResult.rows.forEach((row, idx) => {
        console.log(`${idx + 1}. ${row.email}`);
        console.log(`   Flags: ${row.email_flag_count} | Linked Users: ${row.linked_users}`);
      });
    }

    // 6. Suspicious card patterns
    console.log('\n\n💳 SUSPICIOUS CARD PATTERNS');
    console.log('-'.repeat(80));

    const cardResult = await query(`
      SELECT card_last_four,
             COUNT(*) as card_flag_count,
             COUNT(DISTINCT user_id) as linked_users,
             SUM(CAST(amount AS FLOAT)) as total_amount
      FROM fraud_flags
      WHERE card_last_four IS NOT NULL
      GROUP BY card_last_four
      HAVING COUNT(*) >= 2
      ORDER BY card_flag_count DESC
      LIMIT 10
    `);

    if (cardResult.rows.length === 0) {
      console.log('✅ No suspicious card patterns.\n');
    } else {
      cardResult.rows.forEach((row, idx) => {
        console.log(`${idx + 1}. Card ****${row.card_last_four}`);
        console.log(`   Flags: ${row.card_flag_count} | Linked Users: ${row.linked_users} | Total: $${parseFloat(row.total_amount).toFixed(2)}`);
      });
    }

    // 7. Fraud by amount
    console.log('\n\n💰 FRAUD BY TRANSACTION AMOUNT');
    console.log('-'.repeat(80));

    const amountResult = await query(`
      SELECT 
        CASE
          WHEN CAST(amount AS FLOAT) < 10 THEN 'Micro ($0-10)'
          WHEN CAST(amount AS FLOAT) < 50 THEN 'Small ($10-50)'
          WHEN CAST(amount AS FLOAT) < 100 THEN 'Medium ($50-100)'
          WHEN CAST(amount AS FLOAT) < 500 THEN 'Large ($100-500)'
          ELSE 'Very Large ($500+)'
        END as amount_bucket,
        COUNT(*) as flag_count,
        AVG(CAST(amount AS FLOAT)) as avg_amount
      FROM fraud_flags
      WHERE amount IS NOT NULL
      GROUP BY amount_bucket
      ORDER BY flag_count DESC
    `);

    amountResult.rows.forEach((row) => {
      console.log(`${row.amount_bucket}: ${row.flag_count} flags | Avg: $${parseFloat(row.avg_amount).toFixed(2)}`);
    });

    // 8. Risk score distribution
    console.log('\n\n📊 RISK SCORE DISTRIBUTION');
    console.log('-'.repeat(80));

    const riskResult = await query(`
      SELECT 
        CASE
          WHEN risk_score <= 2 THEN 'Low (0-2)'
          WHEN risk_score <= 4 THEN 'Medium (3-4)'
          WHEN risk_score <= 6 THEN 'High (5-6)'
          ELSE 'Critical (7+)'
        END as risk_level,
        COUNT(*) as count,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM fraud_flags
      GROUP BY risk_level
      ORDER BY count DESC
    `);

    riskResult.rows.forEach((row) => {
      console.log(`${row.risk_level}: ${row.count} flags (${row.percentage}%)`);
    });

    // 9. Recommendations
    console.log('\n\n💡 RECOMMENDATIONS');
    console.log('-'.repeat(80));

    if (highRiskResult.rows.length > 0) {
      console.log(`1. ⚠️  Review and potentially block ${highRiskResult.rows.length} high-risk users`);
    }

    if (emailResult.rows.length > 0) {
      console.log(`2. 📧 Investigate ${emailResult.rows.length} suspicious email addresses`);
    }

    if (cardResult.rows.length > 0) {
      console.log(`3. 💳 Blacklist ${cardResult.rows.length} suspicious cards`);
    }

    console.log('4. 🔍 Implement IP-based fraud detection');
    console.log('5. 📱 Add device fingerprinting');
    console.log('6. 🌍 Enable geo-blocking for high-risk countries');

    console.log('\n' + '='.repeat(80));
    console.log('✅ Fraud report generated successfully');
    console.log('='.repeat(80) + '\n');
  } catch (error) {
    console.error('❌ Error generating fraud report:', error);
    logger.error('Error in fraud report:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  generateFraudReport()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to generate fraud report:', error.message);
      process.exit(1);
    });
}

module.exports = generateFraudReport;
