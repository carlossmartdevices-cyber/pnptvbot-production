const PaymentService = require('../../src/bot/services/paymentService');
const PlanModel = require('../../src/models/planModel');
const PaymentModel = require('../../src/models/paymentModel');
const UserModel = require('../../src/models/userModel');
const MessageTemplates = require('../../src/bot/services/messageTemplates');

// Mock all external dependencies BEFORE importing PaymentService
jest.mock('../../src/models/planModel');
jest.mock('../../src/models/paymentModel');
jest.mock('../../src/models/userModel');

// Mock Telegram bot
const mockTelegraf = {
  telegram: {
    createChatInviteLink: jest.fn().mockResolvedValue({
      invite_link: 'https://t.me/test_invite_link',
    }),
    sendMessage: jest.fn().mockResolvedValue({}),
  },
};

jest.mock('telegraf', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockTelegraf),
  };
});

describe('Payment Notification Integration Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Set environment variables for testing
    process.env.BOT_TOKEN = 'test_bot_token';
    process.env.PRIME_CHANNEL_ID = '-1002997324714';
  });

  describe('Payment Confirmation Notifications', () => {
    it('should send Telegram notification for ePayco payment', async () => {
      // Mock UserModel.getById
      UserModel.getById.mockResolvedValue({
        id: 'user_123',
        first_name: 'Test',
        language: 'es',
      });

      // Mock PlanModel.getById
      PlanModel.getById.mockResolvedValue({
        id: 'plan_123',
        name: 'Premium',
        display_name: 'PRIME Monthly',
        price: 10,
        duration: 30,
      });

      const result = await PaymentService.sendPaymentConfirmationNotification({
        userId: 'user_123',
        plan: {
          id: 'plan_123',
          display_name: 'PRIME Monthly',
          name: 'Premium',
        },
        transactionId: 'txn_123',
        amount: 10.00,
        expiryDate: new Date('2026-02-06'),
        language: 'es',
      });

      expect(result).toBe(true);

      // Verify that Telegram bot was used to send the message
      const Telegraf = require('telegraf');
      expect(Telegraf).toHaveBeenCalledWith('test_bot_token');

      // Verify that sendMessage was called
      expect(mockTelegraf.telegram.sendMessage).toHaveBeenCalled();

      // Verify the message content
      const callArgs = mockTelegraf.telegram.sendMessage.mock.calls[0];
      expect(callArgs[0]).toBe('user_123'); // User ID
      expect(callArgs[1]).toContain('🎉 *¡Pago Confirmado!*'); // Spanish confirmation
      expect(callArgs[1]).toContain('PRIME Monthly'); // Plan name
      expect(callArgs[1]).toContain('$10.00 USD'); // Amount
      expect(callArgs[1]).toContain('txn_123'); // Transaction ID
      expect(callArgs[1]).toContain('https://t.me/test_invite_link'); // Invite link
    });

    it('should send Telegram notification for Daimo payment', async () => {
      // Mock UserModel.getById
      UserModel.getById.mockResolvedValue({
        id: 'user_789',
        first_name: 'Crypto',
        language: 'es',
      });

      const result = await PaymentService.sendPaymentConfirmationNotification({
        userId: 'user_789',
        plan: {
          id: 'plan_789',
          display_name: 'PRIME Crypto',
          name: 'Crypto Premium',
        },
        transactionId: '0x123abc',
        amount: 15.50,
        expiryDate: new Date('2026-03-15'),
        language: 'es',
      });

      expect(result).toBe(true);

      // Verify that Telegram bot was used to send the message
      const Telegraf = require('telegraf');
      expect(Telegraf).toHaveBeenCalledWith('test_bot_token');

      // Verify that sendMessage was called
      expect(mockTelegraf.telegram.sendMessage).toHaveBeenCalled();

      // Verify the message content
      const callArgs = mockTelegraf.telegram.sendMessage.mock.calls[0];
      expect(callArgs[0]).toBe('user_789'); // User ID
      expect(callArgs[1]).toContain('🎉 *¡Pago Confirmado!*'); // Spanish confirmation
      expect(callArgs[1]).toContain('PRIME Crypto'); // Plan name
      expect(callArgs[1]).toContain('$15.50 USD'); // Amount
      expect(callArgs[1]).toContain('0x123abc'); // Transaction ID (blockchain tx)
    });

    it('should handle Telegram notification errors gracefully', async () => {
      // Mock Telegram bot to fail
      const Telegraf = require('telegraf');
      mockTelegraf.telegram.sendMessage.mockRejectedValue(new Error('Telegram API error'));

      const result = await PaymentService.sendPaymentConfirmationNotification({
        userId: 'user_error',
        plan: {
          id: 'plan_error',
          display_name: 'Test Plan',
          name: 'Test',
        },
        transactionId: 'error_txn',
        amount: 5.00,
        expiryDate: new Date('2026-01-01'),
        language: 'es',
      });

      // Should return false when notification fails
      expect(result).toBe(false);

      // Should still call sendMessage but it fails
      expect(mockBot.telegram.sendMessage).toHaveBeenCalled();
    });

    it('should create unique invite link for PRIME channel', async () => {
      const { Telegraf } = require('telegraf');
      const mockBot = Telegraf();

      const result = await PaymentService.sendPaymentConfirmationNotification({
        userId: 'user_123',
        plan: {
          id: 'plan_123',
          display_name: 'Test Plan',
          name: 'Test',
        },
        transactionId: 'test_txn',
        amount: 10.00,
        expiryDate: new Date('2026-01-01'),
        language: 'es',
      });

      expect(result).toBe(true);

      // Verify that createChatInviteLink was called
      expect(mockTelegraf.telegram.createChatInviteLink).toHaveBeenCalledWith(
        '-1002997324714',
        expect.objectContaining({
          member_limit: 1,
          name: 'Subscription test_txn',
        })
      );
    });

    it('should use fallback invite link when Telegram API fails', async () => {
      // Mock Telegram bot to fail on createChatInviteLink
      const Telegraf = require('telegraf');
      mockTelegraf.telegram.createChatInviteLink.mockRejectedValue(new Error('Telegram API error'));

      const result = await PaymentService.sendPaymentConfirmationNotification({
        userId: 'user_123',
        plan: {
          id: 'plan_123',
          display_name: 'Test Plan',
          name: 'Test',
        },
        transactionId: 'test_txn',
        amount: 10.00,
        expiryDate: new Date('2026-01-01'),
        language: 'es',
      });

      expect(result).toBe(true);

      // Verify that sendMessage was still called with fallback link
      const callArgs = mockTelegraf.telegram.sendMessage.mock.calls[0];
      expect(callArgs[1]).toContain('https://t.me/PNPTV_PRIME'); // Fallback link
    });
  });

  describe('Message Template Validation', () => {
    it('should build correct Spanish message template', () => {
      const message = MessageTemplates.buildPrimeActivationMessage({
        planName: 'PRIME Mensual',
        amount: 10.00,
        expiryDate: new Date('2026-02-06'),
        transactionId: 'TXN123',
        inviteLink: 'https://t.me/test',
        language: 'es',
      });

      expect(message).toContain('🎉 *¡Pago Confirmado!*');
      expect(message).toContain('✅ Tu suscripción ha sido activada exitosamente.');
      expect(message).toContain('PRIME Mensual');
      expect(message).toContain('$10.00 USD');
      expect(message).toContain('6 de febrero de 2026'); // Spanish date format
      expect(message).toContain('TXN123');
      expect(message).toContain('https://t.me/test');
      expect(message).toContain('🌟 *¡Bienvenido a PRIME!*');
    });

    it('should build correct English message template', () => {
      const message = MessageTemplates.buildPrimeActivationMessage({
        planName: 'PRIME Monthly',
        amount: 15.99,
        expiryDate: new Date('2026-12-31'),
        transactionId: 'TXN456',
        inviteLink: 'https://t.me/test',
        language: 'en',
      });

      expect(message).toContain('🎉 *Payment Confirmed!*');
      expect(message).toContain('✅ Your subscription has been activated successfully.');
      expect(message).toContain('PRIME Monthly');
      expect(message).toContain('$15.99 USD');
      expect(message).toContain('December 31, 2026'); // English date format
      expect(message).toContain('TXN456');
      expect(message).toContain('https://t.me/test');
      expect(message).toContain('🌟 *Welcome to PRIME!*');
    });

    it('should handle null amount for manual activations', () => {
      const message = MessageTemplates.buildPrimeActivationMessage({
        planName: 'Lifetime Pass',
        amount: null,
        expiryDate: null,
        transactionId: 'MANUAL123',
        inviteLink: 'https://t.me/test',
        language: 'es',
      });

      expect(message).toContain('Lifetime Pass');
      expect(message).toContain('Permanente ♾️'); // Permanent instead of date
      expect(message).toContain('MANUAL123');
      // Should NOT contain amount line
      expect(message).not.toContain('$');
    });
  });

  describe('Payment Notification in Webhook Processing', () => {
    it('should send notification during ePayco webhook processing', async () => {
      // Mock PaymentModel.getById
      PaymentModel.getById.mockResolvedValue({
        id: 'pay_123',
        userId: 'user_123',
        planId: 'plan_123',
        status: 'pending',
      });

      // Mock PlanModel.getById
      PlanModel.getById.mockResolvedValue({
        id: 'plan_123',
        name: 'Premium',
        price: 10,
        duration: 30,
      });

      // Mock UserModel.getById
      UserModel.getById.mockResolvedValue({
        id: 'user_123',
        first_name: 'Test',
        language: 'es',
      });

      // Mock UserModel.updateSubscription
      UserModel.updateSubscription.mockResolvedValue(true);

      // Mock PaymentModel.updateStatus
      PaymentModel.updateStatus.mockResolvedValue(true);

      const webhookData = {
        x_ref_payco: 'ref_123',
        x_transaction_id: 'txn_123',
        x_transaction_state: 'Aceptada',
        x_approval_code: 'app_123',
        x_amount: '10.00',
        x_extra1: 'user_123',
        x_extra2: 'plan_123',
        x_extra3: 'pay_123',
        x_customer_email: 'test@example.com',
        x_customer_name: 'Test User',
      };

      const result = await PaymentService.processEpaycoWebhook(webhookData);

      expect(result.success).toBe(true);

      // Verify that Telegram notification was sent
      const Telegraf = require('telegraf');
      expect(mockTelegraf.telegram.sendMessage).toHaveBeenCalled();

      // Verify notification content
      const callArgs = mockTelegraf.telegram.sendMessage.mock.calls[0];
      expect(callArgs[0]).toBe('user_123');
      expect(callArgs[1]).toContain('🎉 *¡Pago Confirmado!*');
    });

    it('should send notification during Daimo webhook processing', async () => {
      // Mock PaymentModel.getById
      PaymentModel.getById.mockResolvedValue({
        id: 'pay_123',
        userId: 'user_123',
        planId: 'plan_123',
        status: 'pending',
      });

      // Mock PlanModel.getById
      PlanModel.getById.mockResolvedValue({
        id: 'plan_123',
        name: 'Premium',
        price: 10,
        duration: 30,
      });

      // Mock UserModel.getById
      UserModel.getById.mockResolvedValue({
        id: 'user_123',
        first_name: 'Test',
        language: 'es',
      });

      // Mock UserModel.updateSubscription
      UserModel.updateSubscription.mockResolvedValue(true);

      // Mock PaymentModel.updateStatus
      PaymentModel.updateStatus.mockResolvedValue(true);

      const webhookData = {
        id: 'event_123',
        status: 'payment_completed',
        source: {
          txHash: 'txn_123',
          payerAddress: '0x123',
          chainId: 10,
          amountUnits: '10000000',
        },
        metadata: {
          paymentId: 'pay_123',
          userId: 'user_123',
          planId: 'plan_123',
        },
      };

      const result = await PaymentService.processDaimoWebhook(webhookData);

      expect(result.success).toBe(true);

      // Verify that Telegram notification was sent
      const Telegraf = require('telegraf');
      expect(mockTelegraf.telegram.sendMessage).toHaveBeenCalled();

      // Verify notification content
      const callArgs = mockTelegraf.telegram.sendMessage.mock.calls[0];
      expect(callArgs[0]).toBe('user_123');
      expect(callArgs[1]).toContain('🎉 *¡Pago Confirmado!*');
    });
  });
});