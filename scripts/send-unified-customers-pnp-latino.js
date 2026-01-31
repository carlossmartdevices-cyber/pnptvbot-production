#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const EmailService = require('../src/services/emailService');

const CSV_FILE = path.join(__dirname, '../unified_customers.csv');
const SENT_LOG_FILE = path.join(__dirname, '../sent_unified_pnp_latino.log');
const DELAY_MS = Number(process.env.PNP_LATINO_EMAIL_DELAY_MS || 15000);

const args = process.argv.slice(2);
const langArg = args.find(arg => arg.startsWith('--lang='));
const TARGET_LANGUAGE = langArg ? langArg.split('=')[1] : 'en';
const dryRun = args.includes('--dry-run');

const loadSentEmails = () => {
  if (!fs.existsSync(SENT_LOG_FILE)) {
    return new Set();
  }
  const content = fs.readFileSync(SENT_LOG_FILE, 'utf8');
  return new Set(content.split('\n').filter(Boolean).map((line) => line.trim().toLowerCase()));
};

const logSentEmail = (email) => {
  fs.appendFileSync(SENT_LOG_FILE, `${email.toLowerCase().trim()}\n`);
};

const readCustomers = () => {
  if (!fs.existsSync(CSV_FILE)) {
    throw new Error(`CSV not found: ${CSV_FILE}`);
  }
  const raw = fs.readFileSync(CSV_FILE, 'utf8');
  return parse(raw, { columns: true, skip_empty_lines: true });
};

const isEmailSafe = EmailService.isEmailSafe.bind(EmailService);

async function sendCampaign() {
  console.log('🚀 PNP Latino Is Back campaign');
  console.log(`📁 Source CSV: ${CSV_FILE}`);
  console.log(`🌐 Language: ${TARGET_LANGUAGE}`);
  console.log(`🕒 Delay per email: ${DELAY_MS}ms`);
  console.log(`💾 Dry run: ${dryRun}`);

  const customers = readCustomers();
  console.log(`📊 Total unified customers: ${customers.length}`);

  const sentEmails = loadSentEmails();
  const pending = customers.filter((record) => {
    const email = (record.Email || '').toLowerCase().trim();
    return email && !sentEmails.has(email);
  });

  console.log(`📧 Pending (not yet logged) customers: ${pending.length}`);
  if (pending.length === 0) {
    console.log('✅ Nothing to do, all emails already sent.');
    return;
  }

  let success = 0;
  let fail = 0;

  for (let i = 0; i < pending.length; i++) {
    const customer = pending[i];
    const email = (customer.Email || '').toLowerCase().trim();
    const name = customer.Name || 'PNP Latino Member';

    if (!isEmailSafe(email)) {
      console.log(`❌ [${i + 1}/${pending.length}] Invalid email: ${email}`);
      fail++;
      continue;
    }

    console.log(`📤 [${i + 1}/${pending.length}] Sending to ${name} (${email})`);

    if (!dryRun) {
      try {
        const result = await EmailService.sendReactivationEmail({
          email,
          userName: name,
          lifetimeDealLink: 'https://pnptv.app/lifetime100',
          telegramLink: 'https://t.me/pnplatinotv_bot',
          userLanguage: TARGET_LANGUAGE
        });

        if (result.success) {
          success++;
          logSentEmail(email);
          console.log(`✅ Sent ${email}`);
        } else {
          fail++;
          console.log(`❌ Failed ${email}: ${result.message || 'unknown error'}`);
        }
      } catch (error) {
        fail++;
        console.log(`❌ Error ${email}: ${error.message}`);
      }

      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log('\n📊 Campaign summary:');
  console.log(`   ✅ Sent: ${success}`);
  console.log(`   ❌ Failed: ${fail}`);
  console.log(`   📝 Log file: ${SENT_LOG_FILE}`);
  if (dryRun) {
    console.log('🧪 Dry run mode: no emails were dispatched.');
  }
}

if (require.main === module) {
  sendCampaign().catch((error) => {
    console.error('❌ Campaign failed:', error);
    process.exit(1);
  });
} else {
  module.exports = { sendCampaign };
}
