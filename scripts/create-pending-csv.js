#!/usr/bin/env node

const fs = require('fs');
const { parse } = require('csv-parse/sync');

// Read success emails
const successEmails = new Set(
  fs.readFileSync('/tmp/success_emails.txt', 'utf8')
    .split('\n')
    .filter(e => e.trim())
    .map(e => e.toLowerCase().trim())
);

// Read original CSV
const csvContent = fs.readFileSync('/root/pnptvbot-production/Customes_legacy.csv', 'utf8');
const records = parse(csvContent, { columns: true, skip_empty_lines: true });

// Filter out successful emails
const pendingRecords = records.filter(r => {
  const email = r.Email?.toLowerCase().trim();
  return !successEmails.has(email);
});

// Remove duplicates by email
const seen = new Set();
const uniquePending = pendingRecords.filter(r => {
  const email = r.Email?.toLowerCase().trim();
  if (seen.has(email)) return false;
  seen.add(email);
  return true;
});

// Create CSV manually
const headers = Object.keys(records[0]);
const csvLines = [headers.join(',')];
uniquePending.forEach(record => {
  const values = headers.map(h => {
    const val = record[h] || '';
    // Escape quotes and wrap in quotes if contains comma
    if (val.includes(',') || val.includes('"')) {
      return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
  });
  csvLines.push(values.join(','));
});

fs.writeFileSync('/root/pnptvbot-production/Customes_legacy_pending.csv', csvLines.join('\n'));

console.log('✅ Archivo creado: Customes_legacy_pending.csv');
console.log('📊 Total original:', records.length);
console.log('✅ Emails ya enviados:', successEmails.size);
console.log('📧 Pendientes únicos:', uniquePending.length);
