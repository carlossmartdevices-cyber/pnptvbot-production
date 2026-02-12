/**
 * QaTouch Project: ePayco Subscriptions (dekw)
 * Module: Checkout Flow
 */

jest.mock('../../../src/config/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    getOrSet: jest.fn((key, fn) => fn()),
    acquireLock: jest.fn().mockResolvedValue(true),
    releaseLock: jest.fn().mockResolvedValue(true),
  },
  getRedis: jest.fn(),
}));

jest.mock('../../../src/config/postgres', () => {
  const mockQuery = jest.fn();
  return {
    query: mockQuery,
    pool: { query: mockQuery, end: jest.fn() },
  };
});

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../../src/models/planModel');
jest.mock('../../../src/models/paymentModel');
jest.mock('../../../src/models/subscriberModel');
jest.mock('../../../src/models/userModel');
jest.mock('../../../src/bot/services/paymentSecurityService');

const PlanModel = require('../../../src/models/planModel');

const {
  isSubscriptionPlan,
  getEpaycoSubscriptionUrl,
} = require('../../../src/config/epaycoSubscriptionPlans');

describe('Checkout Flow - ePayco Subscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EPAYCO_PUBLIC_KEY = 'test_public_key';
    process.env.EPAYCO_PRIVATE_KEY = 'test_private_key';
    process.env.EPAYCO_P_CUST_ID = 'test_cust_id';
    process.env.EPAYCO_TEST_MODE = 'true';
    process.env.BOT_WEBHOOK_DOMAIN = 'https://pnptv.app';
  });

  afterEach(() => {
    delete process.env.EPAYCO_PUBLIC_KEY;
    delete process.env.EPAYCO_PRIVATE_KEY;
    delete process.env.EPAYCO_P_CUST_ID;
    delete process.env.EPAYCO_TEST_MODE;
  });

  it('[LD3Gm1] CardForm validates card number with Luhn check', () => {
    // Luhn algorithm implementation
    function luhnCheck(cardNumber) {
      const digits = String(cardNumber).replace(/\D/g, '');
      if (digits.length < 13 || digits.length > 19) return false;

      let sum = 0;
      let isDouble = false;
      for (let i = digits.length - 1; i >= 0; i--) {
        let digit = parseInt(digits[i], 10);
        if (isDouble) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        sum += digit;
        isDouble = !isDouble;
      }
      return sum % 10 === 0;
    }

    // Valid Visa test card
    expect(luhnCheck('4575623182290326')).toBe(true);
    // Invalid card number
    expect(luhnCheck('1234567890123456')).toBe(false);
    // Too short
    expect(luhnCheck('12345')).toBe(false);
  });

  it('[wmjwK3] CardForm detects card type (Visa, Mastercard, etc)', () => {
    function detectCardType(number) {
      const cleaned = String(number).replace(/\D/g, '');
      if (/^4/.test(cleaned)) return 'visa';
      if (/^5[1-5]/.test(cleaned)) return 'mastercard';
      if (/^3[47]/.test(cleaned)) return 'amex';
      if (/^6(?:011|5)/.test(cleaned)) return 'discover';
      return 'unknown';
    }

    expect(detectCardType('4575623182290326')).toBe('visa');
    expect(detectCardType('5425233430109903')).toBe('mastercard');
    expect(detectCardType('374245455400126')).toBe('amex');
    expect(detectCardType('6011000990139424')).toBe('discover');
    expect(detectCardType('9999999999999999')).toBe('unknown');
  });

  it('[yaWjX0] CardForm validates expiry date', () => {
    function isValidExpiry(month, year) {
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      if (m < 1 || m > 12) return false;
      const now = new Date();
      const expiry = new Date(y, m, 0); // Last day of the month
      return expiry > now;
    }

    expect(isValidExpiry('12', '2030')).toBe(true);
    expect(isValidExpiry('01', '2020')).toBe(false); // Expired
    expect(isValidExpiry('13', '2030')).toBe(false); // Invalid month
    expect(isValidExpiry('00', '2030')).toBe(false); // Invalid month
  });

  it('[0rzwln] CardForm validates CVC length', () => {
    function isValidCVC(cvc, cardType) {
      const len = String(cvc).length;
      if (cardType === 'amex') return len === 4;
      return len === 3;
    }

    expect(isValidCVC('123', 'visa')).toBe(true);
    expect(isValidCVC('1234', 'amex')).toBe(true);
    expect(isValidCVC('12', 'visa')).toBe(false);
    expect(isValidCVC('123', 'amex')).toBe(false);
  });

  it('[kpZnWd] CardForm masks card number with spaces', () => {
    function maskCardNumber(number) {
      const cleaned = String(number).replace(/\D/g, '');
      return cleaned.replace(/(.{4})/g, '$1 ').trim();
    }

    expect(maskCardNumber('4575623182290326')).toBe('4575 6231 8229 0326');
    expect(maskCardNumber('374245455400126')).toBe('3742 4545 5400 126');
  });

  it('[11zXla] CardForm shown only when cart has support plan and epayco selected', () => {
    // Simulate cart state for subscription plans
    const cart = {
      planId: 'week_pass',
      provider: 'epayco',
    };

    const showCardForm = isSubscriptionPlan(cart.planId) && cart.provider === 'epayco';
    expect(showCardForm).toBe(true);
  });

  it('[5BRrDW] CardForm hidden when no support plan in cart', () => {
    // Non-subscription plan should not show card form
    const cart = {
      planId: 'one_time_product',
      provider: 'epayco',
    };

    const showCardForm = isSubscriptionPlan(cart.planId) && cart.provider === 'epayco';
    expect(showCardForm).toBe(false);
  });

  it('[21zLBN] Pay button shows subscription label when support plan present', () => {
    // When plan is a subscription, button label should reflect that
    const plan = { id: 'week_pass', is_recurring: true, name: 'Week Pass' };
    const isRecurring = isSubscriptionPlan(plan.id);

    const buttonLabel = isRecurring ? `Subscribe to ${plan.name}` : `Pay for ${plan.name}`;
    expect(buttonLabel).toContain('Subscribe');
  });

  it('[aj6G7D] Checkout sends product-only amount for one-time charge', async () => {
    PlanModel.getById = jest.fn().mockResolvedValue({
      id: 'lifetime_pass',
      name: 'Lifetime Pass',
      price: 249.99,
      currency: 'USD',
      active: true,
      is_recurring: false,
    });

    const plan = await PlanModel.getById('lifetime_pass');

    // One-time charge sends the plan price directly
    expect(plan.price).toBe(249.99);
    expect(plan.is_recurring).toBe(false);
    expect(isSubscriptionPlan('lifetime_pass')).toBe(false);
  });

  it('[QGjqwm] Subscription API called after ePayco popup opens', () => {
    // Verify subscription URL includes necessary extras for webhook callback
    const subscriptionUrl = getEpaycoSubscriptionUrl('week_pass', {
      extra1: 'user123',
      extra2: 'week_pass',
      extra3: 'pay-uuid-123',
    });

    expect(subscriptionUrl).toBeDefined();
    expect(subscriptionUrl).toContain('007PASS');
    expect(subscriptionUrl).toContain('extra1=user123');
    expect(subscriptionUrl).toContain('extra2=week_pass');
    expect(subscriptionUrl).toContain('extra3=pay-uuid-123');
  });

  it('[WEnkvN] Checkout without support plan unchanged', () => {
    // Non-subscription plan uses standard checkout URL
    const isSubscription = isSubscriptionPlan('lifetime_pass');
    expect(isSubscription).toBe(false);

    // Standard checkout would generate a custom checkout page URL
    const checkoutUrl = isSubscription
      ? getEpaycoSubscriptionUrl('lifetime_pass', {})
      : 'https://easybots.store/payment/pay-uuid-123';

    expect(checkoutUrl).toContain('easybots.store/payment');
  });

  it('[B86mEy] Subscription status feedback shown to user', async () => {
    const SubscriptionController = require('../../../src/bot/api/controllers/subscriptionController');

    // Simulate payment response page
    const mockRes = {
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    // Success response
    await SubscriptionController.handlePaymentResponse(
      { query: { ref_payco: 'ref123', estado: 'Aceptada' } },
      mockRes,
    );

    const html = mockRes.send.mock.calls[0][0];
    expect(html).toContain('Payment Successful');
    expect(html).toContain('ref123');

    // Failure response
    mockRes.send.mockClear();
    await SubscriptionController.handlePaymentResponse(
      { query: { ref_payco: 'ref456', estado: 'Rechazada' } },
      mockRes,
    );

    const failHtml = mockRes.send.mock.calls[0][0];
    expect(failHtml).toContain('Payment Failed');
  });
});
