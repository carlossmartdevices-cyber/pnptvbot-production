// ALL jest.mock calls FIRST
jest.mock('../../src/services/meruPaymentService');
jest.mock('../../src/services/meruLinkService');
jest.mock('../../src/services/paymentHistoryService');
jest.mock('../../src/bot/services/userService');
jest.mock('../../src/bot/handlers/payments/activation'); // Simplified mock for automatic mocking
jest.mock('../../src/utils/logger');
jest.mock('../../src/bot/services/businessNotificationService');
jest.mock('../../src/bot/utils/helpers'); // Ensure this is also hoisted
jest.mock('../../src/bot/handlers/user/menu', () => ({
  showMainMenu: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../src/bot/handlers/user/profile', () => ({
  showEditProfileOverview: jest.fn().mockResolvedValue(true),
}));

jest.mock('telegraf', () => {
    const actualTelegraf = jest.requireActual('telegraf');
    return {
      Telegraf: jest.fn().mockImplementation(() => {
        const botInstance = {
          command: jest.fn(),
          action: jest.fn(),
          on: jest.fn(),
          __commandHandlers: {},
          __actionHandlers: {},
          __textHandler: null,
        };
        botInstance.command = jest.fn((commandName, handler) => {
            botInstance.__commandHandlers[commandName] = handler;
        });
        botInstance.action = jest.fn((actionId, handler) => {
            botInstance.__actionHandlers[actionId] = handler;
        });
        botInstance.on = jest.fn((eventType, handler) => {
            if (eventType === 'text') botInstance.__textHandler = handler;
        });
        return botInstance;
      }),
      Markup: actualTelegraf.Markup,
    };
  });

// THEN other requires/imports
const { Telegraf } = require('telegraf');
const registerOnboardingHandlers = require('../../src/bot/handlers/user/onboarding');
const UserService = require('../../src/bot/services/userService');
const { getLanguage } = require('../../src/bot/utils/helpers');
const activation = require('../../src/bot/handlers/payments/activation');
const meruPaymentService = require('../../src/services/meruPaymentService');
const meruLinkService = require('../../src/services/meruLinkService');


describe('Lifetime Pass Activation Flow', () => {
  let bot;
  let mockCtx;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Explicitly set mock implementations for activation module functions
    activation.activateMembership.mockResolvedValue(true);
    activation.getPrimeInviteLink.mockResolvedValue('https://t.me/prime_channel_link');
    activation.markCodeUsed.mockResolvedValue(true);
    activation.logActivation.mockResolvedValue(true);

    // Mock meruPaymentService - default to paid
    meruPaymentService.verifyPayment.mockResolvedValue({ isPaid: true });

    // Mock meruLinkService - return available links from DB
    meruLinkService.getAvailableLinks.mockResolvedValue([
      { code: 'PAIDCODE', meru_link: 'https://pay.getmeru.com/PAIDCODE' },
    ]);
    meruLinkService.invalidateLinkAfterActivation.mockResolvedValue({ success: true });

    bot = new Telegraf('test_token');
    registerOnboardingHandlers(bot);

    mockCtx = {
      from: { id: 123, first_name: 'Test', username: 'testuser' },
      chat: { id: 123, type: 'private' },
      message: { text: '' },
      session: { temp: {} },
      reply: jest.fn().mockResolvedValue(true),
      answerCbQuery: jest.fn().mockResolvedValue(true),
      saveSession: jest.fn().mockResolvedValue(true),
    };

    UserService.getOrCreateFromContext.mockResolvedValue({ id: 123, language: 'en' });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  const simulateText = async (text) => {
    mockCtx.message.text = text;
    if (bot.__textHandler) {
      await bot.__textHandler(mockCtx, jest.fn());
    }
  };

  it('should activate successfully with a valid code in English @lifetime100', async () => {
    // Arrange
    getLanguage.mockReturnValue('en');
    mockCtx.session.temp.waitingForLifetimeCode = true;
    meruPaymentService.verifyPayment.mockResolvedValue({ isPaid: true });

    // Act
    await simulateText('PAIDCODE');

    // Assert
    expect(meruLinkService.getAvailableLinks).toHaveBeenCalledWith('lifetime-pass');
    expect(meruPaymentService.verifyPayment).toHaveBeenCalledWith('PAIDCODE', 'en');
    expect(activation.activateMembership).toHaveBeenCalled();
    expect(activation.markCodeUsed).toHaveBeenCalledWith('PAIDCODE', 123, 'testuser');
    expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Your Lifetime Pass has been activated!'), expect.anything());
  });

  it('should activate successfully with a valid code in Spanish @lifetime100', async () => {
    // Arrange
    getLanguage.mockReturnValue('es');
    mockCtx.session.temp.waitingForLifetimeCode = true;
    meruPaymentService.verifyPayment.mockResolvedValue({ isPaid: true });

    // Act
    await simulateText('PAIDCODE');

    // Assert
    expect(meruLinkService.getAvailableLinks).toHaveBeenCalledWith('lifetime-pass');
    expect(meruPaymentService.verifyPayment).toHaveBeenCalledWith('PAIDCODE', 'es');
    expect(activation.activateMembership).toHaveBeenCalled();
    expect(activation.markCodeUsed).toHaveBeenCalledWith('PAIDCODE', 123, 'testuser');
    expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('¡Tu Lifetime Pass ha sido activado!'), expect.anything());
  });

  it('should reject an unknown code @lifetime200', async () => {
    // Arrange
    getLanguage.mockReturnValue('en');
    mockCtx.session.temp.waitingForLifetimeCode = true;

    // Act
    await simulateText('UNKNOWNCODE');

    // Assert
    expect(meruLinkService.getAvailableLinks).toHaveBeenCalledWith('lifetime-pass');
    expect(meruPaymentService.verifyPayment).not.toHaveBeenCalled();
    expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('not found or invalid'));
  });

  it('should handle payment not confirmed @lifetime300', async () => {
    // Arrange
    getLanguage.mockReturnValue('en');
    mockCtx.session.temp.waitingForLifetimeCode = true;
    meruPaymentService.verifyPayment.mockResolvedValue({ isPaid: false, message: 'Payment link is still active' });

    // Act
    await simulateText('PAIDCODE');

    // Assert
    expect(meruPaymentService.verifyPayment).toHaveBeenCalledWith('PAIDCODE', 'en');
    expect(activation.activateMembership).not.toHaveBeenCalled();
    expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('could not confirm your payment'));
  });
});
