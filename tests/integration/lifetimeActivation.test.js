const { Telegraf, Markup } = require('telegraf');
const registerOnboardingHandlers = require('../../src/bot/handlers/user/onboarding');
const UserService = require('../../src/bot/services/userService');
const PaymentModel = require('../../src/models/paymentModel');
const PlanModel = require('../../src/models/planModel');
const supportRoutingService = require('../../src/bot/services/supportRoutingService');
const BusinessNotificationService = require('../../src/bot/services/businessNotificationService');
const { getPrimeInviteLink, activateMembership, markCodeUsed, logActivation } = require('../../src/bot/handlers/payments/activation');
const logger = require('../../src/utils/logger');
const meruPaymentService = require('../../src/services/meruPaymentService');
const meruLinkService = require('../../src/services/meruLinkService');


// Mock external modules
jest.mock('../../src/services/meruPaymentService');
jest.mock('../../src/services/meruLinkService');
jest.mock('../../src/services/paymentHistoryService');
jest.mock('../../src/bot/services/userService');
jest.mock('../../src/models/paymentModel');
jest.mock('../../src/models/planModel');
jest.mock('../../src/bot/services/supportRoutingService');
jest.mock('../../src/bot/services/businessNotificationService');
jest.mock('../../src/bot/handlers/payments/activation', () => ({
  ...jest.requireActual('../../src/bot/handlers/payments/activation'),
  getPrimeInviteLink: jest.fn(),
  activateMembership: jest.fn(),
  markCodeUsed: jest.fn(),
  logActivation: jest.fn(),
}));
jest.mock('../../src/bot/utils/helpers', () => ({
  ...jest.requireActual('../../src/bot/utils/helpers'),
  getLanguage: jest.fn(() => 'en'),
}));
jest.mock('../../src/bot/handlers/user/menu', () => ({
  showMainMenu: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../src/bot/handlers/user/profile', () => ({
  showEditProfileOverview: jest.fn().mockResolvedValue(true),
}));
// Mock Telegraf to control bot behavior
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
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));


describe('Lifetime Pass Activation Flow', () => {
  let bot;
  let mockCtx;

  // Known test codes returned from DB
  const testAvailableLinks = [
    { code: 'TESTCODE1', meru_link: 'https://pay.getmeru.com/TESTCODE1' },
    { code: 'TESTCODE2', meru_link: 'https://pay.getmeru.com/TESTCODE2' },
    { code: 'PAIDCODE', meru_link: 'https://pay.getmeru.com/PAIDCODE' },
    { code: 'UNPAIDCODE', meru_link: 'https://pay.getmeru.com/UNPAIDCODE' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    bot = new Telegraf('test_token');
    registerOnboardingHandlers(bot);

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

    // Mock getLanguage to return English by default
    require('../../src/bot/utils/helpers').getLanguage.mockReturnValue('en');

    // Mock meruLinkService to return available links from DB
    meruLinkService.getAvailableLinks.mockResolvedValue(testAvailableLinks);
    meruLinkService.invalidateLinkAfterActivation.mockResolvedValue({ success: true });

    // Mock successful activation by default
    activateMembership.mockResolvedValue(true);
    markCodeUsed.mockResolvedValue(true);
    logActivation.mockResolvedValue(true);
    getPrimeInviteLink.mockResolvedValue('https://t.me/prime_channel_link');
    BusinessNotificationService.notifyCodeActivation.mockResolvedValue(true);

    // Mock meruPaymentService.verifyPayment - default to paid
    meruPaymentService.verifyPayment.mockResolvedValue({ isPaid: true });

    // Mock UserService
    UserService.getOrCreateFromContext.mockResolvedValue({
      id: 123,
      telegramId: 123,
      username: 'testuser',
      first_name: 'Test',
      language: 'en',
      onboardingComplete: true,
      isPremium: false,
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
    expect(mockCtx.session.temp.waitingForLifetimeCode).toBeUndefined();
  });

  it('should prompt for code when "Send My Confirmation Code" button is pressed', async () => {
    await simulateAction('activate_lifetime_send_code');

    expect(mockCtx.answerCbQuery).toHaveBeenCalled();
    expect(mockCtx.reply).toHaveBeenCalledWith('Please send your payment confirmation code:');
    expect(mockCtx.session.temp.waitingForLifetimeCode).toBe(true);
  });

  it('should handle invalid code format gracefully (empty/spaces)', async () => {
    mockCtx.session.temp.waitingForLifetimeCode = true;
    await simulateText('  ');

    expect(mockCtx.reply).toHaveBeenCalledWith('❌ Invalid code format. Please send the code as plain text.');
    expect(mockCtx.session.temp.waitingForLifetimeCode).toBe(false);

    jest.clearAllMocks();
    mockCtx.session.temp.waitingForLifetimeCode = true;
    mockCtx.reply.mockResolvedValue(true);
    mockCtx.saveSession.mockResolvedValue(true);
    require('../../src/bot/utils/helpers').getLanguage.mockReturnValue('en');
    await simulateText('CODE WITH SPACES');
    expect(mockCtx.reply).toHaveBeenCalledWith('❌ Invalid code format. Please send the code as plain text.');
    expect(mockCtx.session.temp.waitingForLifetimeCode).toBe(false);
  });

  it('should handle code not found in DB', async () => {
    mockCtx.session.temp.waitingForLifetimeCode = true;
    await simulateText('NONEXISTENTCODE');

    expect(meruLinkService.getAvailableLinks).toHaveBeenCalledWith('lifetime-pass');
    expect(mockCtx.reply).toHaveBeenCalledWith('❌ Code not found or invalid. Please check your code and try again.');
    expect(meruPaymentService.verifyPayment).not.toHaveBeenCalled();
    expect(mockCtx.session.temp.waitingForLifetimeCode).toBe(false);
  });

  it('should activate lifetime pass for a successfully paid code (English)', async () => {
    mockCtx.session.temp.waitingForLifetimeCode = true;
    const paidCode = 'PAIDCODE';

    meruPaymentService.verifyPayment.mockResolvedValueOnce({ isPaid: true });
    getPrimeInviteLink.mockResolvedValueOnce('https://t.me/prime_channel_link');
    activateMembership.mockResolvedValueOnce(true);

    await simulateText(paidCode);

    expect(meruLinkService.getAvailableLinks).toHaveBeenCalledWith('lifetime-pass');
    expect(mockCtx.reply).toHaveBeenCalledWith(`Verificando pago para el código: \`${paidCode}\`...`, { parse_mode: 'Markdown' });
    expect(meruPaymentService.verifyPayment).toHaveBeenCalledWith(paidCode, 'en');
    expect(activateMembership).toHaveBeenCalledWith(expect.objectContaining({ userId: 123, planId: 'lifetime_pass', product: 'lifetime-pass' }));
    expect(markCodeUsed).toHaveBeenCalledWith(paidCode, 123, 'testuser');
    expect(logActivation).toHaveBeenCalledWith(expect.objectContaining({ code: paidCode, success: true }));
    expect(BusinessNotificationService.notifyCodeActivation).toHaveBeenCalledWith(expect.objectContaining({ code: paidCode }));
    expect(getPrimeInviteLink).toHaveBeenCalledWith(mockCtx, 123);
    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('✅ Your Lifetime Pass has been activated! Welcome to PRIME!\n\n🌟 Access the PRIME channel:\n👉 https://t.me/prime_channel_link'),
      expect.objectContaining({ parse_mode: 'Markdown', disable_web_page_preview: true })
    );
    expect(mockCtx.session.temp.waitingForLifetimeCode).toBe(false);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should inform user if payment is not confirmed (English)', async () => {
    mockCtx.session.temp.waitingForLifetimeCode = true;
    const unpaidCode = 'UNPAIDCODE';

    meruPaymentService.verifyPayment.mockResolvedValueOnce({ isPaid: false });

    await simulateText(unpaidCode);

    expect(meruLinkService.getAvailableLinks).toHaveBeenCalledWith('lifetime-pass');
    expect(mockCtx.reply).toHaveBeenCalledWith(`Verificando pago para el código: \`${unpaidCode}\`...`, { parse_mode: 'Markdown' });
    expect(meruPaymentService.verifyPayment).toHaveBeenCalledWith(unpaidCode, 'en');
    expect(activateMembership).not.toHaveBeenCalled();
    expect(markCodeUsed).not.toHaveBeenCalled();
    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining("⚠️ We could not confirm your payment. Please ensure your payment is complete and try again, or contact support if you believe this is an error.")
    );
    expect(mockCtx.session.temp.waitingForLifetimeCode).toBe(false);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should handle errors during Meru payment verification', async () => {
    mockCtx.session.temp.waitingForLifetimeCode = true;
    const testCode = 'TESTCODE1';

    meruPaymentService.verifyPayment.mockRejectedValueOnce(new Error('Network error'));

    await simulateText(testCode);

    expect(meruLinkService.getAvailableLinks).toHaveBeenCalledWith('lifetime-pass');
    expect(mockCtx.reply).toHaveBeenCalledWith(`Verificando pago para el código: \`${testCode}\`...`, { parse_mode: 'Markdown' });
    expect(meruPaymentService.verifyPayment).toHaveBeenCalled();
    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining("❌ An error occurred during activation. Please try again later.")
    );
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error processing lifetime code activation:'), expect.any(Error));
    expect(mockCtx.session.temp.waitingForLifetimeCode).toBe(false);
  });

  // Test for Spanish language
  it('should use Spanish messages when language is es for initial prompt', async () => {
    require('../../src/bot/utils/helpers').getLanguage.mockReturnValue('es');
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

    meruPaymentService.verifyPayment.mockResolvedValueOnce({ isPaid: true });
    getPrimeInviteLink.mockResolvedValueOnce('https://t.me/prime_channel_link_es');

    await simulateText(paidCode);

    expect(meruLinkService.getAvailableLinks).toHaveBeenCalledWith('lifetime-pass');
    expect(mockCtx.reply).toHaveBeenCalledWith(`Verificando pago para el código: \`${paidCode}\`...`, { parse_mode: 'Markdown' });
    expect(meruPaymentService.verifyPayment).toHaveBeenCalledWith(paidCode, 'es');
    expect(activateMembership).toHaveBeenCalledWith(expect.objectContaining({ userId: 123, planId: 'lifetime_pass', product: 'lifetime-pass' }));
    expect(markCodeUsed).toHaveBeenCalledWith(paidCode, 123, 'testuser');
    expect(logActivation).toHaveBeenCalledWith(expect.objectContaining({ code: paidCode, success: true }));
    expect(BusinessNotificationService.notifyCodeActivation).toHaveBeenCalledWith(expect.objectContaining({ code: paidCode }));
    expect(getPrimeInviteLink).toHaveBeenCalledWith(mockCtx, 123);
    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('✅ ¡Tu Lifetime Pass ha sido activado! ¡Bienvenido a PRIME!\n\n🌟 Accede al canal PRIME:\n👉 https://t.me/prime_channel_link_es'),
      expect.objectContaining({ parse_mode: 'Markdown', disable_web_page_preview: true })
    );
    expect(mockCtx.session.temp.waitingForLifetimeCode).toBe(false);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should inform user if payment is not confirmed (Spanish)', async () => {
    require('../../src/bot/utils/helpers').getLanguage.mockReturnValue('es');
    mockCtx.session.temp.waitingForLifetimeCode = true;
    const unpaidCode = 'UNPAIDCODE';

    meruPaymentService.verifyPayment.mockResolvedValueOnce({ isPaid: false });

    await simulateText(unpaidCode);

    expect(meruLinkService.getAvailableLinks).toHaveBeenCalledWith('lifetime-pass');
    expect(mockCtx.reply).toHaveBeenCalledWith(`Verificando pago para el código: \`${unpaidCode}\`...`, { parse_mode: 'Markdown' });
    expect(meruPaymentService.verifyPayment).toHaveBeenCalledWith(unpaidCode, 'es');
    expect(activateMembership).not.toHaveBeenCalled();
    expect(markCodeUsed).not.toHaveBeenCalled();
    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining("⚠️ No pudimos confirmar tu pago. Por favor, asegúrate de que tu pago esté completo e inténtalo de nuevo, o contacta a soporte si crees que es un error.")
    );
    expect(mockCtx.session.temp.waitingForLifetimeCode).toBe(false);
    expect(logger.error).not.toHaveBeenCalled();
  });

});
