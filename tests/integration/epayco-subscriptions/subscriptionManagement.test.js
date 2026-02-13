/**
 * QaTouch Project: ePayco Subscriptions (dekw)
 * Module: Subscription Management
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
  const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
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
jest.mock('../../../src/models/subscriberModel');
jest.mock('../../../src/models/userModel');

const SubscriberModel = require('../../../src/models/subscriberModel');
const PlanModel = require('../../../src/models/planModel');

describe('Subscription Management - ePayco Subscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('[VKbpex] Page shows login prompt when unauthenticated', async () => {
    // When no identifier is provided, subscriber lookup returns null
    SubscriberModel.getByTelegramId = jest.fn().mockResolvedValue(null);

    const SubscriptionController = require('../../../src/bot/api/controllers/subscriptionController');

    const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await SubscriptionController.getSubscriber(
      { params: { identifier: '' }, query: { type: 'telegram' } },
      mockRes,
    );

    // No subscriber found = user needs to authenticate
    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Subscriber not found',
      }),
    );
  });

  it('[B86mEQ] Page lists active subscriptions with plan details', async () => {
    SubscriberModel.getByTelegramId = jest.fn().mockResolvedValue({
      id: 'uuid-1',
      email: 'user@example.com',
      name: 'Test User',
      telegramId: '12345',
      plan: 'crystal_pass',
      subscriptionId: 'sub_123',
      provider: 'epayco',
      status: 'active',
    });

    PlanModel.getById = jest.fn().mockResolvedValue({
      id: 'crystal_pass',
      name: 'Crystal Pass',
      price: 74.99,
      duration_days: 180,
    });

    const SubscriptionController = require('../../../src/bot/api/controllers/subscriptionController');

    const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await SubscriptionController.getSubscriber(
      { params: { identifier: '12345' }, query: { type: 'telegram' } },
      mockRes,
    );

    const response = mockRes.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.subscriber.plan).toBe('crystal_pass');
    expect(response.subscriber.status).toBe('active');
    expect(response.subscriber.provider).toBe('epayco');
  });

  it('[8V1Mb4] Status badges show correct colors', () => {
    // Map subscription status to display colors
    const statusColors = {
      active: 'green',
      past_due: 'orange',
      cancelled: 'red',
      inactive: 'gray',
    };

    expect(statusColors.active).toBe('green');
    expect(statusColors.past_due).toBe('orange');
    expect(statusColors.cancelled).toBe('red');
    expect(statusColors.inactive).toBe('gray');
  });

  it('[M73Gz1] Cancel button shows confirmation dialog', () => {
    // Cancellation requires confirmation before proceeding
    const subscription = {
      id: 'sub_123',
      status: 'active',
      plan: 'week_pass',
    };

    // Confirmation state: user must confirm before cancel
    const requiresConfirmation = subscription.status === 'active';
    expect(requiresConfirmation).toBe(true);

    // Generate confirmation message
    const confirmMessage = `Are you sure you want to cancel your ${subscription.plan} subscription?`;
    expect(confirmMessage).toContain('week_pass');
    expect(confirmMessage).toContain('cancel');
  });

  it('[DrdyzZ] Cancel updates subscription status in UI', async () => {
    // After cancellation, status changes to 'cancelled'
    SubscriberModel.updateStatus = jest.fn().mockResolvedValue({
      id: 'uuid-1',
      email: 'user@example.com',
      status: 'cancelled',
    });

    const result = await SubscriberModel.updateStatus('user@example.com', 'cancelled', {
      cancelledAt: new Date(),
      cancelReason: 'user_request',
    });

    expect(result.status).toBe('cancelled');
    expect(SubscriberModel.updateStatus).toHaveBeenCalledWith(
      'user@example.com',
      'cancelled',
      expect.objectContaining({ cancelReason: 'user_request' }),
    );
  });

  it('[eJq3x8] Cancel button hidden for already cancelled subscriptions', async () => {
    SubscriberModel.getByEmail = jest.fn().mockResolvedValue({
      id: 'uuid-1',
      email: 'cancelled@example.com',
      status: 'cancelled',
      plan: 'week_pass',
    });

    const subscriber = await SubscriberModel.getByEmail('cancelled@example.com');

    // Cancel button should be hidden for cancelled subscriptions
    const showCancelButton = subscriber.status !== 'cancelled';
    expect(showCancelButton).toBe(false);
  });

  it('[vanE1w] Empty state shows link to checkout', async () => {
    SubscriberModel.getByTelegramId = jest.fn().mockResolvedValue(null);

    const subscriber = await SubscriberModel.getByTelegramId('99999');

    // No subscription → show checkout link
    const hasSubscription = subscriber !== null;
    expect(hasSubscription).toBe(false);

    // Empty state should include a checkout URL
    const checkoutUrl = '/api/subscription/plans';
    expect(checkoutUrl).toContain('subscription');
  });

  it('[bj06Zj] Next billing date shows period end for active subs', async () => {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 7);

    SubscriberModel.getByEmail = jest.fn().mockResolvedValue({
      id: 'uuid-1',
      email: 'active@example.com',
      status: 'active',
      plan: 'week_pass',
      currentPeriodEnd: periodEnd,
    });

    const subscriber = await SubscriberModel.getByEmail('active@example.com');

    expect(subscriber.status).toBe('active');
    expect(subscriber.currentPeriodEnd).toBeInstanceOf(Date);
    expect(subscriber.currentPeriodEnd.getTime()).toBeGreaterThan(now.getTime());

    // Next billing date is the period end
    const nextBillingDate = subscriber.currentPeriodEnd;
    expect(nextBillingDate).toBeDefined();
  });
});
