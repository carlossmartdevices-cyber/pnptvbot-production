const { Telegraf, Markup } = require('telegraf');
const registerOnboardingHandlers = require('../../src/bot/handlers/user/onboarding');
const UserService = require('../../src/bot/services/userService');
const PaymentModel = require('../../src/models/paymentModel');
const PlanModel = require('../../src/models/planModel');
const supportRoutingService = require('../../src/bot/services/supportRoutingService');
const BusinessNotificationService = require('../../src/bot/services/businessNotificationService');
const { getPrimeInviteLink, activateMembership, markCodeUsed, logActivation } = require('../../src/bot/handlers/payments/activation');
const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
const logger = require('../../src/utils/logger');


// Mock external modules
jest.mock('../../src/bot/services/userService');
jest.mock('../../src/models/paymentModel');
jest.mock('../../src/models/planModel');
jest.mock('../../src/bot/services/supportRoutingService');
jest.mock('../../src/bot/services/businessNotificationService');
jest.mock('../../src/bot/handlers/payments/activation', () => ({
  ...jest.requireActual('../../src/bot/handlers/payments/activation'), // Keep actual implementations for utility functions
  getPrimeInviteLink: jest.fn(),
  activateMembership: jest.fn(),
  markCodeUsed: jest.fn(),
  logActivation: jest.fn(),
}));
jest.mock('axios');
jest.mock('fs/promises');
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn(),
}));
// Mock Telegraf to control bot behavior, but ensure core functions are callable
jest.mock('telegraf', () => {
  const actualTelegraf = jest.requireActual('telegraf');
  return {
    Telegraf: jest.fn().mockImplementation((token) => {
      const botInstance = new actualTelegraf.Telegraf(token);
      // Mock methods that are used in the handlers but not explicitly part of the handler registration
      botInstance.telegram = {
        createChatInviteLink: jest.fn().mockResolvedValue({ invite_link: 'https://t.me/prime_invite' }),
      };
      // Keep track of registered handlers
      botInstance.__commandHandlers = {};
      botInstance.command = jest.fn((commandName, handler) => {
        botInstance.__commandHandlers[commandName] = handler;
      });
      botInstance.__actionHandlers = {};
      botInstance.action = jest.fn((actionId, handler) => {
        botInstance.__actionHandlers[actionId] = handler;
      });
      botInstance.__textHandler = jest.fn(); // For 'bot.on('text')'
      botInstance.on = jest.fn((eventType, handler) => {
        if (eventType === 'text') botInstance.__textHandler = handler;
      });
      return botInstance;
    }),
    Markup: actualTelegraf.Markup, // Ensure Markup is accessible
  };
});
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));


describe('Lifetime Pass Activation Flow', () => {
  let bot;
  let mockCtx;

  beforeEach(() => {
    jest.clearAllMocks();

    bot = new Telegraf('test_token');
    registerOnboardingHandlers(bot); // Register handlers with the mocked bot

    mockCtx = {
      from: { id: 123, first_name: 'Test', username: 'testuser' },
      chat: { id: 123, type: 'private' },
      message: {},
      session: { temp: {} },
      reply: jest.fn().mockResolvedValue(true),
      answerCbQuery: jest.fn().mockResolvedValue(true),
      editMessageText: jest.fn().mockResolvedValue(true),
      saveSession: jest.fn().mockResolvedValue(true),
      telegram: {
        createChatInviteLink: jest.fn().mockResolvedValue({ invite_link: 'https://t.me/prime_invite' }),
      },
      update: {
        callback_query: {
          data: '',
          from: { id: 123, first_name: 'Test', username: 'testuser' },
          message: { chat: { id: 123, type: 'private' } }
        }
      }
    };

    // Mock getLanguage to always return English for consistency in tests
    // For more robust tests, this could be dynamic
    require('../../src/bot/utils/helpers').getLanguage = jest.fn(() => 'en');

    // Mock path.join to simplify file access in tests
    path.join.mockImplementation((...args) => {
      if (args.includes('lifetime-pass.html')) {
        return '/mock/path/to/public/lifetime-pass.html';
      }
      return jest.requireActual('path').join(...args);
    });

    // Mock fs.readFile to return controlled HTML content
    fs.readFile.mockResolvedValue(`
      <script>
        const meruPaymentLinks = [
            'https://pay.getmeru.com/TESTCODE1',
            'https://pay.getmeru.com/TESTCODE2',
            'https://pay.getmeru.com/PAIDCODE',
            'https://pay.getmeru.com/UNPAIDCODE'
        ];
      </script>
    `);

    // Mock successful activation by default
    activateMembership.mockResolvedValue(true);
    markCodeUsed.mockResolvedValue(true);
    logActivation.mockResolvedValue(true);
    getPrimeInviteLink.mockResolvedValue('https://t.me/prime_channel_link');
    BusinessNotificationService.notifyCodeActivation.mockResolvedValue(true);

    // Mock UserService to ensure user context is always available and onboarding is complete
    UserService.getOrCreateFromContext.mockResolvedValue({
      id: 123,
      telegramId: 123,
      username: 'testuser',
      first_name: 'Test',
      language: 'en', // Default language for most tests
      onboardingComplete: true,
      isPremium: false, // Start as non-premium
    });
    UserService.getById.mockResolvedValue({
      id: 123,
      telegramId: 123,
      username: 'testuser',
      first_name: 'Test',
      language: 'en',
      onboardingComplete: true,
      isPremium: false,
    });
    UserService.updateProfile.mockResolvedValue({ success: true });
    jest.mock('../../src/models/userModel', () => ({
      updateSubscription: jest.fn(),
      getById: jest.fn(),
    }));
    UserModel.updateSubscription.mockResolvedValue(true);
  });

  // Helper to simulate calling the command handler
  const simulateCommand = async (commandText) => {
    mockCtx.message.text = commandText;
    const commandName = commandText.split(' ')[0].replace('/', '');
    const handler = bot.__commandHandlers[commandName];
    if (handler) {
      await handler(mockCtx);
    } else {
      console.warn(`No handler registered for command: ${commandName}`);
    }
  };

  // Helper to simulate calling an action handler
  const simulateAction = async (actionId) => {
    mockCtx.update.callback_query.data = actionId;
    const handler = bot.__actionHandlers[actionId];
    if (handler) {
      await handler(mockCtx);
    } else {
      console.warn(`No handler registered for action: ${actionId}`);
    }
  };

  // Helper to simulate calling the text handler
  const simulateText = async (text) => {
    mockCtx.message.text = text;
    await bot.__textHandler(mockCtx, jest.fn());
  };


  it('should start the lifetime activation flow when /start activate_lifetime is called', async () => {
    await simulateCommand('/start activate_lifetime');

    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Thank you for your purchase!"),
      expect.objectContaining({
        reply_markup: expect.objectContaining({
          inline_keyboard: [[expect.objectContaining({ text: '✉️ Send My Confirmation Code' })]]
        })
      })
    );
    expect(mockCtx.session.temp.waitingForLifetimeCode).toBeUndefined(); // Should not be set yet
  });

  it('should prompt for code when "Send My Confirmation Code" button is pressed', async () => {
    await simulateAction('activate_lifetime_send_code');

    expect(mockCtx.answerCbQuery).toHaveBeenCalled();
    expect(mockCtx.reply).toHaveBeenCalledWith('Please send your payment confirmation code:');
    expect(mockCtx.session.temp.waitingForLifetimeCode).toBe(true);
  });

  it('should handle invalid code format gracefully (empty/spaces)', async () => {
    mockCtx.session.temp.waitingForLifetimeCode = true;
    await simulateText('  '); // Empty code

    expect(mockCtx.reply).toHaveBeenCalledWith('❌ Invalid code format. Please send the code as plain text.');
    expect(mockCtx.session.temp.waitingForLifetimeCode).toBe(false); // Flag should be cleared

    jest.clearAllMocks();
    mockCtx.session.temp.waitingForLifetimeCode = true;
    mockCtx.reply.mockResolvedValue(true);
    await simulateText('CODE WITH SPACES'); // Code with spaces
    expect(mockCtx.reply).toHaveBeenCalledWith('❌ Invalid code format. Please send the code as plain text.');
    expect(mockCtx.session.temp.waitingForLifetimeCode).toBe(false); // Flag should be cleared
  });

  it('should handle code not found in HTML', async () => {
    mockCtx.session.temp.waitingForLifetimeCode = true;
    await simulateText('NONEXISTENTCODE');

    expect(mockCtx.reply).toHaveBeenCalledWith('❌ Code not found or invalid. Please check your code and try again.');
    expect(axios.get).not.toHaveBeenCalled(); // No external call for non-existent code
    expect(mockCtx.session.temp.waitingForLifetimeCode).toBe(false); // Flag should be cleared
  });

  it('should activate lifetime pass for a successfully paid code (English)', async () => {
    mockCtx.session.temp.waitingForLifetimeCode = true;
    const paidCode = 'PAIDCODE';
    const meruUrl = `https://pay.getmeru.com/${paidCode}`;

    axios.get.mockResolvedValueOnce({ data: 'This payment link is expired or already paid. Thank you for your purchase.' });
    getPrimeInviteLink.mockResolvedValueOnce('https://t.me/prime_channel_link');

    await simulateText(paidCode);

    expect(mockCtx.reply).toHaveBeenCalledWith(`Verificando pago para el código: \`${paidCode}\`...`, { parse_mode: 'Markdown' });
    expect(axios.get).toHaveBeenCalledWith(meruUrl);
    expect(activateMembership).toHaveBeenCalledWith(expect.objectContaining({ userId: 123, planId: 'lifetime_pass', product: 'lifetime-pass' }));
    expect(markCodeUsed).toHaveBeenCalledWith(paidCode, 123, 'testuser');
    expect(logActivation).toHaveBeenCalledWith(expect.objectContaining({ code: paidCode, success: true }));
    expect(BusinessNotificationService.notifyCodeActivation).toHaveBeenCalledWith(expect.objectContaining({ code: paidCode }));
    expect(getPrimeInviteLink).toHaveBeenCalledWith(mockCtx, 123);
    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining(`✅ Your Lifetime Pass has been activated! Welcome to PRIME!
🌟 Access the PRIME channel:
👉 https://t.me/prime_channel_link`),
      expect.objectContaining({ parse_mode: 'Markdown', disable_web_page_preview: true })
    );
    expect(mockCtx.session.temp.waitingForLifetimeCode).toBe(false); // Flag should be cleared
    expect(logger.error).not.toHaveBeenCalled(); // Ensure no errors logged
  });

  it('should inform user if payment is not confirmed (English)', async () => {
    mockCtx.session.temp.waitingForLifetimeCode = true;
    const unpaidCode = 'UNPAIDCODE';
    const meruUrl = `https://pay.getmeru.com/${unpaidCode}`;

    axios.get.mockResolvedValueOnce({ data: 'This payment link is active and waiting for payment.' }); // Simulate unpaid response

    await simulateText(unpaidCode);

    expect(mockCtx.reply).toHaveBeenCalledWith(`Verificando pago para el código: \`${unpaidCode}\`...`, { parse_mode: 'Markdown' });
    expect(axios.get).toHaveBeenCalledWith(meruUrl);
    expect(activateMembership).not.toHaveBeenCalled(); // Should not be called for unpaid
    expect(markCodeUsed).not.toHaveBeenCalled();
    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining("⚠️ We could not confirm your payment. Please ensure your payment is complete and try again, or contact support if you believe this is an error.")
    );
    expect(mockCtx.session.temp.waitingForLifetimeCode).toBe(false); // Flag should be cleared
    expect(logger.error).not.toHaveBeenCalled(); // Ensure no errors logged
  });

  it('should handle errors during external Meru API call', async () => {
    mockCtx.session.temp.waitingForLifetimeCode = true;
    const testCode = 'TESTCODE1';

    axios.get.mockRejectedValueOnce(new Error('Network error')); // Simulate network error

    await simulateText(testCode);

    expect(mockCtx.reply).toHaveBeenCalledWith(`Verificando pago para el código: \`${testCode}\`...`, { parse_mode: 'Markdown' });
    expect(axios.get).toHaveBeenCalled();
    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining("❌ An error occurred during activation. Please try again later.")
    );
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error processing lifetime code activation:'), expect.any(Error));
    expect(mockCtx.session.temp.waitingForLifetimeCode).toBe(false); // Flag should be cleared
  });

  // Test for Spanish language
  it('should use Spanish messages when language is es for initial prompt', async () => {
    require('../../src/bot/utils/helpers').getLanguage.mockReturnValue('es'); // Set language to Spanish
    await simulateCommand('/start activate_lifetime');

    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining("¡Muchas gracias por tu compra!"),
      expect.objectContaining({
        reply_markup: expect.objectContaining({
          inline_keyboard: [[expect.objectContaining({ text: '✉️ Enviar mi código de confirmación' })]]
        })
      })
    );
  });

  it('should activate lifetime pass for a successfully paid code (Spanish)', async () => {
    require('../../src/bot/utils/helpers').getLanguage.mockReturnValue('es');
    mockCtx.session.temp.waitingForLifetimeCode = true;
    const paidCode = 'PAIDCODE';
    const meruUrl = `https://pay.getmeru.com/${paidCode}`;

    axios.get.mockResolvedValueOnce({ data: 'El enlace de pago ha caducado o ya ha sido pagado. Gracias por tu compra.' });
    getPrimeInviteLink.mockResolvedValueOnce('https://t.me/prime_channel_link_es');

    await simulateText(paidCode);

    expect(mockCtx.reply).toHaveBeenCalledWith(`Verificando pago para el código: \`${paidCode}\`...`, { parse_mode: 'Markdown' });
    expect(axios.get).toHaveBeenCalledWith(meruUrl);
    expect(activateMembership).toHaveBeenCalledWith(expect.objectContaining({ userId: 123, planId: 'lifetime_pass', product: 'lifetime-pass' }));
    expect(markCodeUsed).toHaveBeenCalledWith(paidCode, 123, 'testuser');
    expect(logActivation).toHaveBeenCalledWith(expect.objectContaining({ code: paidCode, success: true }));
    expect(BusinessNotificationService.notifyCodeActivation).toHaveBeenCalledWith(expect.objectContaining({ code: paidCode }));
    expect(getPrimeInviteLink).toHaveBeenCalledWith(mockCtx, 123);
    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining(`✅ ¡Tu Lifetime Pass ha sido activado! ¡Bienvenido a PRIME!
🌟 Accede al canal PRIME:
👉 https://t.me/prime_channel_link_es`),
      expect.objectContaining({ parse_mode: 'Markdown', disable_web_page_preview: true })
    );
    expect(mockCtx.session.temp.waitingForLifetimeCode).toBe(false);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should inform user if payment is not confirmed (Spanish)', async () => {
    require('../../src/bot/utils/helpers').getLanguage.mockReturnValue('es');
    mockCtx.session.temp.waitingForLifetimeCode = true;
    const unpaidCode = 'UNPAIDCODE';
    const meruUrl = `https://pay.getmeru.com/${unpaidCode}`;

    axios.get.mockResolvedValueOnce({ data: 'Este enlace de pago está activo y esperando pago.' });

    await simulateText(unpaidCode);

    expect(mockCtx.reply).toHaveBeenCalledWith(`Verificando pago para el código: \`${unpaidCode}\`...`, { parse_mode: 'Markdown' });
    expect(axios.get).toHaveBeenCalledWith(meruUrl);
    expect(activateMembership).not.toHaveBeenCalled();
    expect(markCodeUsed).not.toHaveBeenCalled();
    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining("⚠️ No pudimos confirmar tu pago. Por favor, asegúrate de que tu pago esté completo e inténtalo de nuevo, o contacta a soporte si crees que es un error.")
    );
    expect(mockCtx.session.temp.waitingForLifetimeCode).toBe(false);
    expect(logger.error).not.toHaveBeenCalled();
  });

});
