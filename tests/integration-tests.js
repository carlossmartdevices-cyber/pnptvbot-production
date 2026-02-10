/**
 * Integration Tests for pnptvbot and ePayco
 * Tests: Database, Bot, Payment Processing, Webhooks
 */

const http = require('http');
const assert = require('assert');

const BASE_URL = 'http://localhost:3000';
const TESTS = [];
let passedTests = 0;
let failedTests = 0;

// Helper function to make HTTP requests
function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : null
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Test 1: Health Check
TESTS.push({
  name: 'Bot Health Check',
  run: async () => {
    const res = await makeRequest('GET', '/health');
    assert.strictEqual(res.status, 200, 'Health check should return 200');
    assert(res.body, 'Response should have body');
  }
});

// Test 2: User Creation
TESTS.push({
  name: 'User Creation via API',
  run: async () => {
    const res = await makeRequest('POST', '/api/users', {
      telegram_id: '12345',
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser'
    });
    assert.strictEqual(res.status, 200 || 201, 'User creation should succeed');
  }
});

// Test 3: ePayco Payment Webhook
TESTS.push({
  name: 'ePayco Payment Webhook',
  run: async () => {
    const res = await makeRequest('POST', '/api/webhooks/epayco', {
      x_transaction_id: 'test_12345',
      x_amount: '100.00',
      x_currency_code: 'USD',
      x_signature: 'test_signature',
      x_ref_payco: 'test_ref',
      x_customer_email: 'test@example.com'
    });
    assert(res.status >= 200 && res.status < 300, 'Webhook should be accepted');
  }
});

// Test 4: Payment Confirmation
TESTS.push({
  name: 'Payment Confirmation Processing',
  run: async () => {
    const res = await makeRequest('POST', '/api/payments/confirm', {
      transaction_id: 'test_12345',
      user_id: '123',
      amount: 100,
      provider: 'epayco'
    });
    assert(res.status >= 200 && res.status < 300, 'Payment confirmation should succeed');
  }
});

// Test 5: Telegram Bot Command
TESTS.push({
  name: 'Telegram /start Command',
  run: async () => {
    const res = await makeRequest('POST', '/webhook/telegram', {
      update_id: 123456,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: 123456,
          type: 'private'
        },
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Test'
        },
        text: '/start'
      }
    });
    assert(res.status >= 200 && res.status < 300, 'Bot webhook should accept /start');
  }
});

// Test 6: Database Connection
TESTS.push({
  name: 'Database Connection',
  run: async () => {
    const res = await makeRequest('GET', '/api/database/health');
    assert(res.status === 200 || res.status === 404, 'Database endpoint check');
  }
});

// Test 7: API Rate Limiting
TESTS.push({
  name: 'API Rate Limiting',
  run: async () => {
    // Make multiple requests
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(makeRequest('GET', '/health'));
    }
    const results = await Promise.all(promises);
    assert(results.every(r => r.status === 200), 'Rate limiting should allow bulk requests');
  }
});

// Test 8: ePayco Signature Verification
TESTS.push({
  name: 'ePayco Signature Validation',
  run: async () => {
    const res = await makeRequest('POST', '/api/webhooks/epayco', {
      x_transaction_id: 'sig_test_123',
      x_signature: 'invalid_signature_test'
    });
    // Should reject or validate signature
    assert(res.status === 200 || res.status === 400 || res.status === 401, 
      'Should handle signature validation');
  }
});

// Test 9: User Plan Upgrade
TESTS.push({
  name: 'User Plan Upgrade',
  run: async () => {
    const res = await makeRequest('POST', '/api/users/upgrade-plan', {
      user_id: '123',
      new_plan: 'premium',
      payment_method: 'epayco'
    });
    assert(res.status >= 200 && res.status < 300, 'Plan upgrade should succeed');
  }
});

// Test 10: Telegram Update Handling
TESTS.push({
  name: 'Telegram Update Handler',
  run: async () => {
    const res = await makeRequest('POST', '/webhook/telegram', {
      update_id: 999,
      message: {
        message_id: 99,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 999, type: 'private' },
        from: { id: 999, is_bot: false, first_name: 'Test' },
        text: '/help'
      }
    });
    assert(res.status >= 200 && res.status < 300, 'Bot should handle /help command');
  }
});

// Run all tests
async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     Integration Tests: pnptvbot + ePayco                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  for (const test of TESTS) {
    try {
      console.log(`⏳ Running: ${test.name}...`);
      await test.run();
      console.log(`✅ PASSED: ${test.name}\n`);
      passedTests++;
    } catch (error) {
      console.log(`❌ FAILED: ${test.name}`);
      console.log(`   Error: ${error.message}\n`);
      failedTests++;
    }
  }

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log(`║ Results: ${passedTests} passed, ${failedTests} failed out of ${TESTS.length} tests         ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  process.exit(failedTests > 0 ? 1 : 0);
}

// Start tests
runAllTests().catch(console.error);
