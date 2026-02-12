#!/usr/bin/env node

/**
 * Run Hangouts Integration Tests
 * Usage: node scripts/run-hangouts-tests.js
 */

const { spawn } = require('child_process');

const testFile = 'tests/integration/hangouts.integration.test.js';

console.log('\n🧪 Running Hangouts Integration Tests...\n');
console.log('Test file:', testFile);
console.log('=' .repeat(60));
console.log();

const jest = spawn('npx', ['jest', testFile, '--verbose', '--colors', '--detectOpenHandles']);

jest.stdout.on('data', (data) => {
  process.stdout.write(data);
});

jest.stderr.on('data', (data) => {
  process.stderr.write(data);
});

jest.on('close', (code) => {
  console.log();
  console.log('=' .repeat(60));
  if (code === 0) {
    console.log('✅ All tests passed!\n');
  } else {
    console.log(`❌ Tests failed with exit code ${code}\n`);
  }
  process.exit(code);
});
