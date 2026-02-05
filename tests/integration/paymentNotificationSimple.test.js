// Mock dependencies
jest.mock('../../src/models/planModel');
jest.mock('../../src/models/paymentModel');
jest.mock('../../src/models/userModel');
jest.mock('../../src/bot/services/paymentService'); // Mock PaymentService

const PaymentService = require('../../src/bot/services/paymentService');
const PaymentModel = require('../../src/models/paymentModel');
const PlanModel = require('../../src/models/planModel');
const UserModel = require('../../src/models/userModel');
const MessageTemplates = require('../../src/bot/services/messageTemplates');

// Mock the Telegram bot's methods
const mockSendMessage = jest.fn().mockResolvedValue({});
const mockCreateChatInviteLink = jest.fn().mockResolvedValue({
  invite_link: 'https://t.me/test_invite_link',
});

// Mock the Telegraf constructor (named export)
jest.mock('telegraf', () => ({
  Telegraf: jest.fn().mockImplementation(() => ({
    telegram: {
      createChatInviteLink: mockCreateChatInviteLink,
      sendMessage: mockSendMessage,
    },
  })),
}));

describe('Payment Notification Integration Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    mockSendMessage.mockResolvedValue({});
    mockCreateChatInviteLink.mockResolvedValue({
      invite_link: 'https://t.me/test_invite_link',
    });

    // Mock PaymentService.sendPaymentConfirmationNotification to prevent timeouts in processEpaycoWebhook
    jest.spyOn(PaymentService, 'sendPaymentConfirmationNotification').mockResolvedValue(true);

    // Set environment variables for testing
    process.env.BOT_TOKEN = 'test_bot_token';
    process.env.PRIME_CHANNEL_ID = '-1002997324714';
  });

  describe('Payment Confirmation Notification System', () => {
    it('should send Telegram notification when payment is confirmed', async () => {
      // Mock models
      UserModel.getById.mockResolvedValue({
        id: 'user_123',
        first_name: 'Test',
        language: 'es',
      });
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
      expect(mockSendMessage).toHaveBeenCalled();
      expect(mockCreateChatInviteLink).toHaveBeenCalled();

      // Verify the message content
      const callArgs = mockSendMessage.mock.calls[0];
      expect(callArgs[0]).toBe('user_123'); // User ID
      expect(callArgs[1]).toContain('🎉 *¡Gracias por tu compra y por apoyar a PNPtv!*');
      expect(callArgs[1]).toContain('PRIME Monthly'); // Plan name
      expect(callArgs[1]).toContain('Monto: $10.00 USD'); // Amount
      expect(callArgs[1]).toContain('txn_123'); // Transaction ID
    });

    it('should send English notification when language is English', async () => {
      // Mock models
      UserModel.getById.mockResolvedValue({
        id: 'user_456',
        first_name: 'Crypto',
        language: 'en',
      });
      PlanModel.getById.mockResolvedValue({
        id: 'plan_456',
        name: 'Premium Annual',
        display_name: 'PRIME Annual',
        price: 99.99,
        duration: 365,
      });

      const result = await PaymentService.sendPaymentConfirmationNotification({
        userId: 'user_456',
        plan: {
          id: 'plan_456',
          display_name: 'PRIME Annual',
          name: 'Premium Annual',
        },
        transactionId: 'txn_789',
        amount: 99.99,
        expiryDate: new Date('2026-12-31'),
        language: 'en',
      });

      expect(result).toBe(true);
      expect(mockSendMessage).toHaveBeenCalled();

      // Verify the message content (English version)
      const callArgs = mockSendMessage.mock.calls[0];
      expect(callArgs[0]).toBe('user_456'); // User ID
      expect(callArgs[1]).toContain('🎉 *Thank you for your purchase and for supporting PNPtv!*');
      expect(callArgs[1]).toContain('PRIME Annual'); // Plan name
      expect(callArgs[1]).toContain('Amount: $99.99 USD'); // Amount
    });

    it('should handle notification errors gracefully', async () => {
      // Mock sendMessage to fail
      mockSendMessage.mockRejectedValueOnce(new Error('Telegram API error'));

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
      expect(mockSendMessage).toHaveBeenCalled();
    });

    it('should create unique invite link for PRIME channel', async () => {
      // Mock models
      UserModel.getById.mockResolvedValue({
        id: 'user_123',
        first_name: 'Test',
        language: 'es',
      });
      PlanModel.getById.mockResolvedValue({
        id: 'plan_123',
        name: 'Premium',
        display_name: 'Test Plan',
        price: 10,
        duration: 30,
      });

      await PaymentService.sendPaymentConfirmationNotification({
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

      expect(mockCreateChatInviteLink).toHaveBeenCalledWith(
        '-1002997324714',
        expect.objectContaining({
          member_limit: 1,
          name: 'Subscription test_txn',
        })
      );
    });

    it('should use fallback invite link when Telegram API fails', async () => {
      // Mock models
      UserModel.getById.mockResolvedValue({
        id: 'user_123',
        first_name: 'Test',
        language: 'es',
      });
      PlanModel.getById.mockResolvedValue({
        id: 'plan_123',
        name: 'Premium',
        display_name: 'Test Plan',
        price: 10,
        duration: 30,
      });

      // Mock createChatInviteLink to fail
      mockCreateChatInviteLink.mockRejectedValue(new Error('Telegram API error'));

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
      expect(mockSendMessage).toHaveBeenCalled();

      // Verify that sendMessage was still called with fallback link
      const callArgs = mockSendMessage.mock.calls[0];
      expect(callArgs[1]).toContain('https://t.me/PNPTV_PRIME'); // Fallback link
    });
  });

  describe('Message Template Validation', () => {
    it('should build correct Spanish message template', () => {
      const expiryDate = new Date('2026-02-06');
      const expectedExpiry = expiryDate.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const message = MessageTemplates.buildEnhancedPaymentConfirmation({
        planName: 'PRIME Mensual',
        amount: 10.00,
        expiryDate,
        transactionId: 'TXN123',
        inviteLink: 'https://t.me/test',
        language: 'es',
        provider: 'epayco',
      });

      expect(message).toContain('🎉 *¡Gracias por tu compra y por apoyar a PNPtv!*');
      expect(message).toContain('📋 *Detalles de tu compra:*');
      expect(message).toContain('PRIME Mensual');
      expect(message).toContain('Monto: $10.00 USD');
      expect(message).toContain(`Válido hasta: ${expectedExpiry}`);
      expect(message).toContain('ID de Transacción: TXN123');
      expect(message).toContain('Proveedor: ePayco');
      expect(message).toContain('https://t.me/test');
      expect(message).toContain('🌟 *¡Bienvenido a PRIME!*');
    });

    it('should build correct English message template', () => {
      const expiryDate = new Date('2026-12-31');
      const expectedExpiry = expiryDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const message = MessageTemplates.buildEnhancedPaymentConfirmation({
        planName: 'PRIME Monthly',
        amount: 15.99,
        expiryDate,
        transactionId: 'TXN456',
        inviteLink: 'https://t.me/test',
        language: 'en',
        provider: 'epayco',
      });

      expect(message).toContain('🎉 *Thank you for your purchase and for supporting PNPtv!*');
      expect(message).toContain('📋 *Purchase Details:*');
      expect(message).toContain('PRIME Monthly');
      expect(message).toContain('Amount: $15.99 USD');
      expect(message).toContain(`Valid until: ${expectedExpiry}`);
      expect(message).toContain('Transaction ID: TXN456');
      expect(message).toContain('Provider: ePayco');
      expect(message).toContain('https://t.me/test');
      expect(message).toContain('🌟 *Welcome to PRIME!*');
    });

    it('should handle null amount for manual activations', () => {
      const message = MessageTemplates.buildEnhancedPaymentConfirmation({
        planName: 'Lifetime Pass',
        amount: null,
        expiryDate: null,
        transactionId: 'MANUAL123',
        inviteLink: 'https://t.me/test',
        language: 'es',
        provider: 'epayco',
      });

      expect(message).toContain('Lifetime Pass');
      expect(message).toContain('Permanente ♾️'); // Permanent instead of date
      expect(message).not.toContain('Monto:');
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
      expect(sendPaymentConfirmationNotificationSpy).toHaveBeenCalled();

      // Verify notification content
      const callArgs = sendPaymentConfirmationNotificationSpy.mock.calls[0];
      expect(callArgs[0].userId).toBe('user_123');
      expect(callArgs[0].plan.id).toBe('plan_123');
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
      expect(sendPaymentConfirmationNotificationSpy).toHaveBeenCalled();

      // Verify notification content
      const callArgs = sendPaymentConfirmationNotificationSpy.mock.calls[0];
      expect(callArgs[0].userId).toBe('user_123');
      expect(callArgs[0].plan.id).toBe('plan_123');
    });
  });
});