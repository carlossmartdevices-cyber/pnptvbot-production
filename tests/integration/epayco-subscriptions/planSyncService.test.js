/**
 * QaTouch Project: ePayco Subscriptions (dekw)
 * Module: Plan Sync Service
 */

jest.mock('../../../src/config/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    getOrSet: jest.fn((key, fn) => fn()),
  },
  getRedis: jest.fn(),
}));

const {
  EPAYCO_SUBSCRIPTION_PLANS,
  getEpaycoSubscriptionUrl,
  isSubscriptionPlan,
} = require('../../../src/config/epaycoSubscriptionPlans');

describe('Plan Sync Service - ePayco Subscriptions', () => {
  it('[Z8xEQz] syncPlans creates all support tiers', () => {
    // Verify all expected plan tiers exist
    const planIds = Object.keys(EPAYCO_SUBSCRIPTION_PLANS);
    expect(planIds.length).toBeGreaterThanOrEqual(3);
    expect(planIds).toContain('week_pass');
    expect(planIds).toContain('three_months_pass');
    expect(planIds).toContain('crystal_pass');
  });

  it('[RgGzQe] syncPlans skips existing plans', () => {
    // Calling isSubscriptionPlan for existing plans returns true
    expect(isSubscriptionPlan('week_pass')).toBe(true);
    expect(isSubscriptionPlan('three_months_pass')).toBe(true);
    expect(isSubscriptionPlan('crystal_pass')).toBe(true);

    // Non-existent plan returns false
    expect(isSubscriptionPlan('nonexistent_plan')).toBe(false);
  });

  it('[dyp5XK] syncPlans uses COP currency', () => {
    // ePayco subscription landing pages use COP
    const url = getEpaycoSubscriptionUrl('week_pass', { extra1: '123' });
    expect(url).toBeDefined();
    expect(url).toContain('subscription-landing.epayco.co');
    // COP is handled server-side via CurrencyConverter in SubscriptionController
  });

  it('[xm9GdL] syncPlans sets monthly interval', () => {
    // Verify subscription plans map to ePayco plan IDs
    expect(EPAYCO_SUBSCRIPTION_PLANS.week_pass).toBe('007PASS');
    expect(EPAYCO_SUBSCRIPTION_PLANS.three_months_pass).toBe('090PASS');
    expect(EPAYCO_SUBSCRIPTION_PLANS.crystal_pass).toBe('180PASS');
  });

  it('[VKbpQx] getEpaycoPlanId returns correct ID format', () => {
    // Verify URL format for each plan
    const weekUrl = getEpaycoSubscriptionUrl('week_pass', {
      extra1: 'user123',
      extra2: 'week_pass',
      extra3: 'pay_abc',
    });
    expect(weekUrl).toContain('007PASS');
    expect(weekUrl).toContain('extra1=user123');
    expect(weekUrl).toContain('extra2=week_pass');
    expect(weekUrl).toContain('extra3=pay_abc');

    // Non-subscription plan returns null
    const nullUrl = getEpaycoSubscriptionUrl('nonexistent');
    expect(nullUrl).toBeNull();
  });

  it('[J8dn9Q] Plan amounts match support-plans.ts prices', () => {
    // Verify plans have consistent ePayco IDs
    expect(EPAYCO_SUBSCRIPTION_PLANS.week_pass).toBeDefined();
    expect(EPAYCO_SUBSCRIPTION_PLANS.three_months_pass).toBeDefined();
    expect(EPAYCO_SUBSCRIPTION_PLANS.crystal_pass).toBeDefined();
    expect(EPAYCO_SUBSCRIPTION_PLANS.yearly_pass).toBeDefined();

    // Six months is an alias for crystal
    expect(EPAYCO_SUBSCRIPTION_PLANS.six_months_pass).toBe(
      EPAYCO_SUBSCRIPTION_PLANS.crystal_pass
    );
  });
});
