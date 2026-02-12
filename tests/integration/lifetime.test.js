// ALL jest.mock calls FIRST
jest.mock('../../src/bot/services/userService');
jest.mock('../../src/bot/handlers/payments/activation'); // Simplified mock for automatic mocking
jest.mock('axios');
jest.mock('fs/promises');
jest.mock('path');
jest.mock('../../src/utils/logger');
jest.mock('../../src/bot/services/businessNotificationService');
jest.mock('../../src/bot/utils/helpers'); // Ensure this is also hoisted

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
const registerOnboardingHandlers = require('../../src/bot/handlers/user/onboarding'); // This will now get the mocked dependencies
const UserService = require('../../src/bot/services/userService'); // This is actually mocked globally above
const { getLanguage } = require('../../src/bot/utils/helpers'); // This will get the mocked helper
const activation = require('../../src/bot/handlers/payments/activation'); // This will get the automatically mocked activation module


describe('Lifetime Pass Activation Flow', () => {
  let bot;
  let mockCtx;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Explicitly set mock implementations for activation module functions
    // Jest will have automatically mocked them to jest.fn() already
    activation.activateMembership.mockResolvedValue(true);
    activation.getPrimeInviteLink.mockResolvedValue('https://t.me/prime_channel_link');
    activation.markCodeUsed.mockResolvedValue(true);
    activation.logActivation.mockResolvedValue(true);


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
    path.join.mockReturnValue('/fake/path/to/lifetime-pass.html');
    fs.readFile.mockResolvedValue(`<script>const meruPaymentLinks = ['https://pay.getmeru.com/PAIDCODE'];</script>`);
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
    axios.get.mockResolvedValue({ data: 'This payment link is expired or already paid.' });
    // Mocks for activation are set in beforeEach

    // Act
    await simulateText('PAIDCODE');

    // Assert
    expect(axios.get).toHaveBeenCalledWith('https://pay.getmeru.com/PAIDCODE');
    expect(activation.activateMembership).toHaveBeenCalled();
    expect(activation.markCodeUsed).toHaveBeenCalledWith('PAIDCODE', 123, 'testuser');
    expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Your Lifetime Pass has been activated!'));
  });

  it('should activate successfully with a valid code in Spanish @lifetime100', async () => {
    // Arrange
    getLanguage.mockReturnValue('es');
    mockCtx.session.temp.waitingForLifetimeCode = true;
    axios.get.mockResolvedValue({ data: 'El enlace de pago ha caducado o ya ha sido pagado.' });
    // Mocks for activation are set in beforeEach

    // Act
    await simulateText('PAIDCODE');

    // Assert
    expect(axios.get).toHaveBeenCalledWith('https://pay.getmeru.com/PAIDCODE');
    expect(activation.activateMembership).toHaveBeenCalled();
    expect(activation.markCodeUsed).toHaveBeenCalledWith('PAIDCODE', 123, 'testuser');
    expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('¡Tu Lifetime Pass ha sido activado!'));
  });
});
