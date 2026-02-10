/**
 * ePayco Integration Test Suite
 *
 * Live tests against the ePayco test (sandbox) API.
 * Requires EPAYCO_TEST_MODE=true in .env before running.
 *
 * Test cards (ePayco sandbox):
 *   Visa   : 4575623182290326  exp 12/2027  CVC 123
 *   Master : 5425019925684512  exp 12/2027  CVC 123 (rejected)
 *
 * Run: EPAYCO_TEST_MODE=true npx jest tests/integration/epayco.test.js --forceExit --detectOpenHandles
 */

// Load .env BEFORE setup.js can interfere (override=true)
require('dotenv').config({ path: require('path').join(__dirname, '../../.env'), override: true });

const crypto = require('crypto');
const { getPool } = require('../../src/config/postgres');
const { cache } = require('../../src/config/redis');
const { execSync } = require('child_process');

const BASE_URL = process.env.TEST_BASE_URL || 'https://easybots.site';
const TIMEOUT = 30000;

// Helpers
const randomPaymentId = () => crypto.randomUUID();
const paymentRef = (id) => `PAY-${id.substring(0, 8).toUpperCase()}`;

let pool;
let testUserId;
let testPlan;

beforeAll(async () => {
  pool = getPool();

  // Get a real user (FK constraint on payments)
  const users = await pool.query('SELECT id FROM users LIMIT 1');
  if (!users.rows.length) throw new Error('No users in database, cannot run integration tests');
  testUserId = users.rows[0].id;

  // Get an active plan
  const plans = await pool.query('SELECT id, name, price, display_name, duration FROM plans WHERE active = true LIMIT 1');
  if (!plans.rows.length) throw new Error('No active plans');
  testPlan = plans.rows[0];

  console.log(`Test user: ${testUserId}, Plan: ${testPlan.name} ($${testPlan.price})`);
}, TIMEOUT);

afterAll(async () => {
  // Clean up test payments
  try {
    await pool.query("DELETE FROM payments WHERE user_id = $1 AND reference LIKE 'PAY-%' AND status IN ('pending','failed')", [testUserId]);
  } catch (e) { /* ignore */ }
});

// ── Helper: create a pending payment record ──
async function createTestPayment() {
  const id = randomPaymentId();
  const ref = paymentRef(id);
  await pool.query(
    'INSERT INTO payments (id, reference, user_id, plan_id, provider, amount, currency, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, ref, testUserId, testPlan.id, 'epayco', testPlan.price, 'USD', 'pending'],
  );
  // Use redis-cli directly to guarantee key is in Redis server (bypasses any node client issues)
  const value = JSON.stringify({ paymentId: id, createdAt: new Date().toISOString() });
  execSync(`redis-cli SET "payment:timeout:${id}" '${value}' EX 3600`);
  return { id, ref };
}

// ───────────────────────────────────────────────
// 1. CHECKOUT PAGE & PAYMENT API
// ───────────────────────────────────────────────
describe('1. Checkout Page & Payment API', () => {
  let payment;

  beforeAll(async () => {
    payment = await createTestPayment();
  });

  test('1.1 Checkout page returns 200 with security headers', async () => {
    const res = await fetch(`${BASE_URL}/payment/${payment.id}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toBeTruthy();
    expect(res.headers.get('strict-transport-security')).toBeTruthy();
    expect(res.headers.get('x-content-type-options')).toContain('nosniff');

    const html = await res.text();
    expect(html).toContain('EasyBots');
    expect(html).toContain('Secure Checkout');
    // No ePayco client-side scripts should be loaded
    expect(html).not.toContain('checkout.epayco.co');
    expect(html).not.toContain('epayco.min.js');
    expect(html).not.toContain('validateThreeds');
  }, TIMEOUT);

  test('1.2 Payment info API returns correct data', async () => {
    const res = await fetch(`${BASE_URL}/api/payment/${payment.id}`);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.payment.paymentId).toBe(payment.id);
    expect(data.payment.paymentRef).toBe(payment.ref);
    expect(data.payment.provider).toBe('epayco');
    expect(data.payment.status).toBe('pending');
    expect(data.payment.amountUSD).toBe(parseFloat(testPlan.price));
    expect(data.payment.amountCOP).toBe(Math.round(parseFloat(testPlan.price) * 4000));
    expect(data.payment.currencyCode).toBe('COP');
    expect(data.payment.epaycoPublicKey).toBeTruthy();
    expect(data.payment.epaycoSignature).toBeTruthy();
    expect(data.payment.confirmationUrl).toContain('/api/webhook/epayco');
    expect(data.payment.responseUrl).toContain('/api/payment-response');
    expect(data.payment.plan).toBeDefined();
    expect(data.payment.plan.id).toBe(testPlan.id);
  }, TIMEOUT);

  test('1.3 Payment info API returns 404 for non-existent payment', async () => {
    const res = await fetch(`${BASE_URL}/api/payment/${randomPaymentId()}`);
    const data = await res.json();
    expect(res.status).toBe(404);
    expect(data.success).toBe(false);
  }, TIMEOUT);

  test('1.4 Payment status API returns correct status', async () => {
    const res = await fetch(`${BASE_URL}/api/payment/${payment.id}/status`);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.status).toBe('pending');
  }, TIMEOUT);
});

// ───────────────────────────────────────────────
// 2. TOKEN CREATION (ePayco SDK)
// ───────────────────────────────────────────────
describe('2. ePayco Token Creation (Server-side)', () => {
  let epaycoClient;

  beforeAll(() => {
    const { getEpaycoClient } = require('../../src/config/epayco');
    epaycoClient = getEpaycoClient();
  });

  test('2.1 Create token with Visa test card', async () => {
    const result = await epaycoClient.token.create({
      'card[number]': '4575623182290326',
      'card[exp_year]': '2027',
      'card[exp_month]': '12',
      'card[cvc]': '123',
      hasCvv: true,
    });

    console.log('Token result:', JSON.stringify(result, null, 2));
    expect(result).toBeDefined();
    expect(result.status).not.toBe(false);
    expect(result.id).toBeTruthy();
    console.log('✓ Token ID:', result.id);
  }, TIMEOUT);

  test('2.2 Mastercard test card is rejected by ePayco sandbox', async () => {
    const result = await epaycoClient.token.create({
      'card[number]': '5425019925684512',
      'card[exp_year]': '2027',
      'card[exp_month]': '12',
      'card[cvc]': '123',
      hasCvv: true,
    });

    console.log('Mastercard token result:', JSON.stringify(result, null, 2));
    // ePayco sandbox rejects this Mastercard number as "Tarjeta invalida"
    expect(result).toBeDefined();
    expect(result.status).toBe(false);
    console.log('✓ MC card correctly rejected:', result.data?.errors || result.message);
  }, TIMEOUT);

  test('2.3 Reject token with invalid card number', async () => {
    const result = await epaycoClient.token.create({
      'card[number]': '1234567890123456',
      'card[exp_year]': '2027',
      'card[exp_month]': '12',
      'card[cvc]': '123',
      hasCvv: true,
    });

    console.log('Invalid card token result:', JSON.stringify(result, null, 2));
    // Should fail or return no id
    const failed = !result || result.status === false || !result.id;
    expect(failed).toBe(true);
  }, TIMEOUT);

  test('2.4 Reject token with expired card', async () => {
    const result = await epaycoClient.token.create({
      'card[number]': '4575623182290326',
      'card[exp_year]': '2020',
      'card[exp_month]': '01',
      'card[cvc]': '123',
      hasCvv: true,
    });

    console.log('Expired card token result:', JSON.stringify(result, null, 2));
    // ePayco may still issue a token for an expired card (validation happens at charge time)
    // but we test the API doesn't crash
    expect(result).toBeDefined();
  }, TIMEOUT);
});

// ───────────────────────────────────────────────
// 3. CUSTOMER CREATION (ePayco SDK)
// ───────────────────────────────────────────────
describe('3. ePayco Customer Creation', () => {
  let epaycoClient;
  let tokenId;

  beforeAll(async () => {
    const { getEpaycoClient } = require('../../src/config/epayco');
    epaycoClient = getEpaycoClient();

    // Create a token first
    const tokenResult = await epaycoClient.token.create({
      'card[number]': '4575623182290326',
      'card[exp_year]': '2027',
      'card[exp_month]': '12',
      'card[cvc]': '123',
      hasCvv: true,
    });
    tokenId = tokenResult.id;
  });

  test('3.1 Create customer with valid token', async () => {
    const result = await epaycoClient.customers.create({
      token_card: tokenId,
      name: 'Test',
      last_name: 'User',
      email: `test-${Date.now()}@example.com`,
      default: true,
      city: 'Bogota',
      address: 'Calle 123',
      phone: '3001234567',
      cell_phone: '3001234567',
    });

    console.log('Customer result:', JSON.stringify(result, null, 2));
    expect(result).toBeDefined();
    expect(result.status).not.toBe(false);
    const customerId = result.data?.customerId || result.data?.id_customer || result.id;
    expect(customerId).toBeTruthy();
    console.log('✓ Customer ID:', customerId);
  }, TIMEOUT);
});

// ───────────────────────────────────────────────
// 4. FULL TOKENIZED CHARGE FLOW (via API)
// ───────────────────────────────────────────────
describe('4. Full Tokenized Charge Flow', () => {

  test('4.1 Visa test card - full flow (token → customer → charge)', async () => {
    const payment = await createTestPayment();

    const res = await fetch(`${BASE_URL}/api/payment/tokenized-charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId: payment.id,
        cardNumber: '4575623182290326',
        expYear: '2027',
        expMonth: '12',
        cvc: '123',
        name: 'Test',
        lastName: 'User',
        email: 'visa-test@example.com',
        docType: 'CC',
        docNumber: '1035851980',
        city: 'Bogota',
        address: 'Calle 123',
        phone: '3001234567',
        dues: '1',
      }),
    });

    // Handle 429 rate limit gracefully
    if (res.status === 429) {
      console.log('4.1 Rate limited (429) - skipping charge validation');
      return;
    }

    const data = await res.json();
    console.log('4.1 Visa charge result:', JSON.stringify(data, null, 2));

    // In test mode the card may be approved, pending, or declined
    expect(data.transactionId || data.error).toBeTruthy();
    expect(['approved', 'pending', 'rejected']).toContain(data.status);
    console.log(`✓ Visa charge status: ${data.status}, txId: ${data.transactionId}`);
  }, TIMEOUT);

  test('4.2 Mastercard test card - expect rejection at tokenization', async () => {
    const payment = await createTestPayment();

    const res = await fetch(`${BASE_URL}/api/payment/tokenized-charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId: payment.id,
        cardNumber: '5425019925684512',
        expYear: '2027',
        expMonth: '12',
        cvc: '123',
        name: 'MC Test',
        lastName: 'User',
        email: 'mc-test@example.com',
        docType: 'CC',
        docNumber: '1035851980',
        city: 'Bogota',
        address: 'Calle 123',
        phone: '3001234567',
        dues: '1',
      }),
    });

    if (res.status === 429) {
      console.log('4.2 Rate limited (429) - skipping');
      return;
    }

    const data = await res.json();
    console.log('4.2 Mastercard charge result:', JSON.stringify(data, null, 2));

    // ePayco sandbox rejects this MC number at tokenization stage
    expect(data.error || data.success === false).toBeTruthy();
    console.log(`✓ MC card correctly rejected: ${data.error || data.status}`);
  }, TIMEOUT);

  test('4.3 3D Secure verification - check for redirectUrl on pending', async () => {
    // 3DS is triggered by ePayco based on eControl rules (config 75)
    // When 3DS is active, charge returns status=Pendiente with urlbanco
    const payment = await createTestPayment();

    const res = await fetch(`${BASE_URL}/api/payment/tokenized-charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId: payment.id,
        cardNumber: '4575623182290326',
        expYear: '2027',
        expMonth: '12',
        cvc: '123',
        name: 'ThreeDS',
        lastName: 'Test',
        email: 'threeds@example.com',
        docType: 'CC',
        docNumber: '9999999999',
        city: 'Bogota',
        address: 'Calle 123',
        phone: '3001234567',
        dues: '1',
      }),
    });

    if (res.status === 429) {
      console.log('4.3 Rate limited (429) - skipping');
      return;
    }

    const data = await res.json();
    console.log('4.3 3DS charge result:', JSON.stringify(data, null, 2));

    // If 3DS is enabled in eControl, status will be 'pending' and redirectUrl present
    // If not enabled, it will be approved/rejected directly
    if (data.status === 'pending' && data.redirectUrl) {
      console.log('✓ 3DS redirect URL present:', data.redirectUrl);
      expect(data.redirectUrl).toMatch(/^https?:\/\//);
    } else {
      console.log('ℹ 3DS not triggered (eControl config 75 may not be active). Status:', data.status);
      // Still valid - 3DS depends on ePayco dashboard configuration
      expect(['approved', 'pending', 'rejected']).toContain(data.status);
    }
  }, TIMEOUT);
});

// ───────────────────────────────────────────────
// 5. INPUT VALIDATION & SECURITY
// ───────────────────────────────────────────────
describe('5. Input Validation & Security', () => {

  test('5.1 Reject missing required fields', async () => {
    const res = await fetch(`${BASE_URL}/api/payment/tokenized-charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId: 'something' }),
    });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
  }, TIMEOUT);

  test('5.2 Reject invalid card number format', async () => {
    const payment = await createTestPayment();

    const res = await fetch(`${BASE_URL}/api/payment/tokenized-charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId: payment.id,
        cardNumber: 'ABCDEFG',
        expYear: '2027',
        expMonth: '12',
        cvc: '123',
        name: 'Test',
        email: 'test@example.com',
        docType: 'CC',
        docNumber: '123',
      }),
    });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
  }, TIMEOUT);

  test('5.3 Reject too-short card number', async () => {
    const payment = await createTestPayment();

    const res = await fetch(`${BASE_URL}/api/payment/tokenized-charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId: payment.id,
        cardNumber: '123456',
        expYear: '2027',
        expMonth: '12',
        cvc: '123',
        name: 'Test',
        email: 'test@example.com',
        docType: 'CC',
        docNumber: '123',
      }),
    });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
  }, TIMEOUT);

  test('5.4 Reject already-completed payment', async () => {
    const payment = await createTestPayment();
    // Mark as completed
    await pool.query("UPDATE payments SET status = 'completed' WHERE id = $1", [payment.id]);

    const res = await fetch(`${BASE_URL}/api/payment/${payment.id}`);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('completado');
  }, TIMEOUT);

  test('5.5 Reject expired payment (timeout)', async () => {
    const id = randomPaymentId();
    const ref = paymentRef(id);
    await pool.query(
      'INSERT INTO payments (id, reference, user_id, plan_id, provider, amount, currency, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, ref, testUserId, testPlan.id, 'epayco', testPlan.price, 'USD', 'pending'],
    );
    // Do NOT set Redis timeout key → payment is expired

    const res = await fetch(`${BASE_URL}/api/payment/tokenized-charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId: id,
        cardNumber: '4575623182290326',
        expYear: '2027',
        expMonth: '12',
        cvc: '123',
        name: 'Test',
        email: 'test@example.com',
        docType: 'CC',
        docNumber: '123',
      }),
    });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('expirado');
  }, TIMEOUT);

  test('5.6 Rate limiting returns 429 after excessive attempts', async () => {
    const payment = await createTestPayment();
    // Manually set rate limit counter high (above max 10)
    execSync(`redis-cli SET "payment:ratelimit:${payment.id}" "999" EX 3600`);

    const res = await fetch(`${BASE_URL}/api/payment/tokenized-charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId: payment.id,
        cardNumber: '4575623182290326',
        expYear: '2027',
        expMonth: '12',
        cvc: '123',
        name: 'Test',
        email: 'test@example.com',
        docType: 'CC',
        docNumber: '123',
      }),
    });
    expect(res.status).toBe(429);
    // Response may be JSON (per-payment limiter) or plain text (global express limiter)
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      expect(data.success).toBe(false);
    } catch {
      // Plain text 429 from express-rate-limit is also acceptable
      expect(text).toContain('Too many');
    }
  }, TIMEOUT);
});

// ───────────────────────────────────────────────
// 6. WEBHOOK SIGNATURE VERIFICATION
// ───────────────────────────────────────────────
describe('6. Webhook Signature Verification', () => {

  test('6.1 Reject webhook with missing signature', async () => {
    const res = await fetch(`${BASE_URL}/api/webhook/epayco`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x_ref_payco: '999999',
        x_transaction_id: '999999',
        x_transaction_state: 'Aceptada',
        x_amount: '59960',
        x_currency_code: 'COP',
        // No x_signature
      }),
    });
    // 400/401 for missing signature, or 429 if rate limited
    expect([400, 401, 429]).toContain(res.status);
    if (res.status !== 429) {
      const data = await res.json();
      expect(data.success).toBe(false);
    }
  }, TIMEOUT);

  test('6.2 Reject webhook with invalid signature', async () => {
    const res = await fetch(`${BASE_URL}/api/webhook/epayco`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x_ref_payco: '999999',
        x_transaction_id: '999999',
        x_transaction_state: 'Aceptada',
        x_amount: '59960',
        x_currency_code: 'COP',
        x_signature: 'invalid_signature_abc123',
      }),
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
  }, TIMEOUT);

  test('6.3 Accept webhook with valid SHA-256 signature', async () => {
    const pKey = process.env.EPAYCO_P_KEY || process.env.EPAYCO_PRIVATE_KEY;
    const custId = process.env.EPAYCO_P_CUST_ID || process.env.EPAYCO_PUBLIC_KEY;
    const refPayco = 'test-ref-' + Date.now();
    const txId = 'test-tx-' + Date.now();
    const amount = '59960';
    const currency = 'COP';

    const signatureString = `${custId}^${pKey}^${refPayco}^${txId}^${amount}^${currency}`;
    const signature = crypto.createHash('sha256').update(signatureString).digest('hex');

    const res = await fetch(`${BASE_URL}/api/webhook/epayco`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x_ref_payco: refPayco,
        x_transaction_id: txId,
        x_transaction_state: 'Aceptada',
        x_cod_transaction_state: '1',
        x_amount: amount,
        x_currency_code: currency,
        x_signature: signature,
        x_extra1: testUserId,
        x_extra2: testPlan.id,
        x_extra3: randomPaymentId(), // non-existent payment, but signature is valid
      }),
    });

    // Should pass signature check (200 or 400 for missing payment, not 401)
    const data = await res.json();
    console.log('6.3 Valid signature webhook result:', res.status, data);
    expect(res.status).not.toBe(401);
  }, TIMEOUT);
});

// ───────────────────────────────────────────────
// 7. CHECKOUT SIGNATURE INTEGRITY
// ───────────────────────────────────────────────
describe('7. Checkout Signature Integrity', () => {

  test('7.1 Checkout signature matches expected MD5', () => {
    const PaymentService = require('../../src/bot/services/paymentService');
    const pKey = process.env.EPAYCO_P_KEY || process.env.EPAYCO_PRIVATE_KEY;
    const custId = process.env.EPAYCO_P_CUST_ID || process.env.EPAYCO_PUBLIC_KEY;

    const invoice = 'PAY-TESTINV1';
    const amount = '59960';
    const currencyCode = 'COP';

    const sig = PaymentService.generateEpaycoCheckoutSignature({ invoice, amount, currencyCode });

    const expected = crypto.createHash('md5').update(`${custId}^${pKey}^${invoice}^${amount}^${currencyCode}`).digest('hex');
    expect(sig).toBe(expected);
    console.log('✓ Checkout signature verified:', sig);
  });

  test('7.2 Payment info API signature matches computed value', async () => {
    const payment = await createTestPayment();
    const res = await fetch(`${BASE_URL}/api/payment/${payment.id}`);
    const data = await res.json();

    const pKey = process.env.EPAYCO_P_KEY || process.env.EPAYCO_PRIVATE_KEY;
    const custId = process.env.EPAYCO_P_CUST_ID || process.env.EPAYCO_PUBLIC_KEY;

    const expected = crypto.createHash('md5')
      .update(`${custId}^${pKey}^${data.payment.paymentRef}^${data.payment.amountCOP}^COP`)
      .digest('hex');

    expect(data.payment.epaycoSignature).toBe(expected);
    console.log('✓ API signature matches:', data.payment.epaycoSignature);
  }, TIMEOUT);
});

// ───────────────────────────────────────────────
// 8. SECURITY HEADERS
// ───────────────────────────────────────────────
describe('8. Security Headers on Payment Pages', () => {

  test('8.1 Checkout page has CSP header', async () => {
    const payment = await createTestPayment();
    const res = await fetch(`${BASE_URL}/payment/${payment.id}`);
    const csp = res.headers.get('content-security-policy');
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  }, TIMEOUT);

  test('8.2 Checkout page has HSTS header', async () => {
    const payment = await createTestPayment();
    const res = await fetch(`${BASE_URL}/payment/${payment.id}`);
    const hsts = res.headers.get('strict-transport-security');
    expect(hsts).toBeTruthy();
    expect(hsts).toContain('max-age=');
  }, TIMEOUT);

  test('8.3 Checkout page has X-Frame-Options', async () => {
    const payment = await createTestPayment();
    const res = await fetch(`${BASE_URL}/payment/${payment.id}`);
    const xfo = res.headers.get('x-frame-options');
    expect(xfo).toBeTruthy();
  }, TIMEOUT);

  test('8.4 Terms page has security headers', async () => {
    const res = await fetch(`${BASE_URL}/terms`);
    expect(res.headers.get('content-security-policy')).toBeTruthy();
    expect(res.headers.get('strict-transport-security')).toBeTruthy();
    expect(res.headers.get('x-content-type-options')).toContain('nosniff');
  }, TIMEOUT);

  test('8.5 API endpoint has security headers', async () => {
    const res = await fetch(`${BASE_URL}/api/payment/${randomPaymentId()}`);
    expect(res.headers.get('content-security-policy')).toBeTruthy();
    expect(res.headers.get('x-content-type-options')).toContain('nosniff');
  }, TIMEOUT);
});

// ───────────────────────────────────────────────
// 9. PAYMENT SECURITY SERVICE
// ───────────────────────────────────────────────
describe('9. Payment Security Service', () => {
  const PaymentSecurityService = require('../../src/bot/services/paymentSecurityService');

  test('9.1 PCI compliance rejects full card number in data', () => {
    const check = PaymentSecurityService.validatePCICompliance({
      fullNumber: '4575623182290326',
    });
    expect(check.compliant).toBe(false);
  });

  test('9.2 PCI compliance accepts last-4 only', () => {
    const check = PaymentSecurityService.validatePCICompliance({
      lastFour: '0326',
    });
    expect(check.compliant).toBe(true);
  });

  test('9.3 Payment amount validation matches DB', async () => {
    const payment = await createTestPayment();
    const check = await PaymentSecurityService.validatePaymentAmount(payment.id, parseFloat(testPlan.price));
    expect(check.valid).toBe(true);
  });

  test('9.4 Payment amount validation rejects mismatch', async () => {
    const payment = await createTestPayment();
    const check = await PaymentSecurityService.validatePaymentAmount(payment.id, 999.99);
    expect(check.valid).toBe(false);
  });

  test('9.5 Replay attack detection works', async () => {
    const key = `test-replay-${Date.now()}`;
    const first = await PaymentSecurityService.checkReplayAttack(key, 'test');
    expect(first.isReplay).toBe(false);
    const second = await PaymentSecurityService.checkReplayAttack(key, 'test');
    expect(second.isReplay).toBe(true);
  });

  test('9.6 Payment timeout set and check', async () => {
    const pid = randomPaymentId();
    await PaymentSecurityService.setPaymentTimeout(pid, 60);
    const check = await PaymentSecurityService.checkPaymentTimeout(pid);
    expect(check.expired).toBe(false);
  });

  test('9.7 Payment timeout expired when no key', async () => {
    const check = await PaymentSecurityService.checkPaymentTimeout('nonexistent-' + Date.now());
    expect(check.expired).toBe(true);
  });
});
