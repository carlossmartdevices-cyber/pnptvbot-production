const { Markup } = require('telegraf');
const PaymentService = require('../../services/paymentService');
const PlanModel = require('../../../models/planModel');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');
const DaimoConfig = require('../../../config/daimo');
const registerActivationHandlers = require('./activation');

/**
 * Payment handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerPaymentHandlers = (bot) => {
  // Register activation code handlers
  registerActivationHandlers(bot);
  // Show subscription plans
  bot.action('show_subscription_plans', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const plans = await PlanModel.getAll();

      let message = `${t('subscriptionPlans', lang)}\n\n`;

      const buttons = [];
      plans.forEach((plan) => {
        const planName = lang === 'es' ? plan.nameEs : plan.name;
        const features = lang === 'es' ? plan.featuresEs : plan.features;

        message += `${planName} - $${plan.price}/month\n`;
        features.forEach((feature) => {
          message += `  ✓ ${feature}\n`;
        });
        message += '\n';

        buttons.push([
          Markup.button.callback(
            `💎 ${planName}`,
            `select_plan_${plan.id}`,
          ),
        ]);
      });

      buttons.push([Markup.button.callback(t('back', lang), 'back_to_main')]);

      await ctx.editMessageText(message, Markup.inlineKeyboard(buttons));
    } catch (error) {
      logger.error('Error showing subscription plans:', error);
    }
  });

  // Select plan
  bot.action(/^select_plan_(.+)$/, async (ctx) => {
    try {
      // Validate match result exists
      if (!ctx.match || !ctx.match[1]) {
        logger.error('Invalid plan selection action format');
        return;
      }

      const planId = ctx.match[1];
      const lang = getLanguage(ctx);

      ctx.session.temp.selectedPlan = planId;
      await ctx.saveSession();

      await ctx.editMessageText(
        t('paymentMethod', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('payWithEpayco', lang), `pay_epayco_${planId}`)],
          [Markup.button.callback(t('payWithDaimo', lang), `pay_daimo_${planId}`)],
          [Markup.button.callback(t('back', lang), 'show_subscription_plans')],
        ]),
      );
    } catch (error) {
      logger.error('Error selecting plan:', error);
    }
  });

  // Pay with ePayco
  bot.action(/^pay_epayco_(.+)$/, async (ctx) => {
    try {
      // Validate match result exists
      if (!ctx.match || !ctx.match[1]) {
        logger.error('Invalid ePayco payment action format');
        return;
      }

      const planId = ctx.match[1];
      const lang = getLanguage(ctx);

      // Validate user context exists
      if (!ctx.from?.id) {
        logger.error('Missing user context in ePayco payment');
        await ctx.reply(t('error', lang));
        return;
      }

      const userId = ctx.from.id;

      await ctx.editMessageText(t('loading', lang));

      const result = await PaymentService.createPayment({
        userId,
        planId,
        provider: 'epayco',
      });

      if (result.success) {
        await ctx.editMessageText(
          t('paymentInstructions', lang, { paymentUrl: result.paymentUrl }),
          Markup.inlineKeyboard([
            [Markup.button.url('💳 Pay Now', result.paymentUrl)],
            [Markup.button.callback(t('back', lang), 'show_subscription_plans')],
          ]),
        );
      } else {
        await ctx.editMessageText(
          `${t('error', lang)}\n\n${result.error}`,
          Markup.inlineKeyboard([
            [Markup.button.callback(t('back', lang), 'show_subscription_plans')],
          ]),
        );
      }
    } catch (error) {
      logger.error('Error creating ePayco payment:', error);
    }
  });

  // Pay with Daimo
  bot.action(/^pay_daimo_(.+)$/, async (ctx) => {
    try {
      // Validate match result exists
      if (!ctx.match || !ctx.match[1]) {
        logger.error('Invalid Daimo payment action format');
        return;
      }

      const planId = ctx.match[1];
      const lang = getLanguage(ctx);

      // Validate user context exists
      if (!ctx.from?.id) {
        logger.error('Missing user context in Daimo payment');
        await ctx.reply(t('error', lang));
        return;
      }

      const userId = ctx.from.id;
      const chatId = ctx.chat?.id;

      await ctx.editMessageText(t('loading', lang));

      // Get plan details for display
      const plan = await PlanModel.getById(planId);
      if (!plan) {
        await ctx.editMessageText(
          t('error', lang),
          Markup.inlineKeyboard([
            [Markup.button.callback(t('back', lang), 'show_subscription_plans')],
          ]),
        );
        return;
      }

      const result = await PaymentService.createPayment({
        userId,
        planId,
        provider: 'daimo',
        chatId,
      });

      if (result.success) {
        // Get supported payment apps
        const paymentApps = DaimoConfig.SUPPORTED_PAYMENT_APPS.join(', ');

        const message = lang === 'es'
          ? '💳 *Pago con Daimo Pay*\n\n'
            + `Plan: ${plan.nameEs || plan.name}\n`
            + `Precio: $${plan.price} USDC\n\n`
            + '📱 *Puedes pagar usando:*\n'
            + '• Zelle\n'
            + '• CashApp\n'
            + '• Venmo\n'
            + '• Revolut\n'
            + '• Wise\n\n'
            + '💡 *Cómo funciona:*\n'
            + '1. Haz clic en "Pagar Ahora"\n'
            + '2. Elige tu app de pago preferida\n'
            + '3. El pago se convierte automáticamente a USDC\n'
            + '4. Tu suscripción se activa inmediatamente\n\n'
            + '🔒 Seguro y rápido en la red Optimism'
          : '💳 *Pay with Daimo Pay*\n\n'
            + `Plan: ${plan.name}\n`
            + `Price: $${plan.price} USDC\n\n`
            + '📱 *You can pay using:*\n'
            + '• Zelle\n'
            + '• CashApp\n'
            + '• Venmo\n'
            + '• Revolut\n'
            + '• Wise\n\n'
            + '💡 *How it works:*\n'
            + '1. Click "Pay Now"\n'
            + '2. Choose your preferred payment app\n'
            + '3. Payment is automatically converted to USDC\n'
            + '4. Your subscription activates immediately\n\n'
            + '🔒 Secure and fast on Optimism network';

        await ctx.editMessageText(
          message,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.url('💰 Pay Now', result.paymentUrl)],
              [Markup.button.callback(t('back', lang), 'show_subscription_plans')],
            ]),
          },
        );
      } else {
        await ctx.editMessageText(
          `${t('error', lang)}\n\n${result.error}`,
          Markup.inlineKeyboard([
            [Markup.button.callback(t('back', lang), 'show_subscription_plans')],
          ]),
        );
      }
    } catch (error) {
      logger.error('Error creating Daimo payment:', error);
      const lang = getLanguage(ctx);
      await ctx.editMessageText(
        t('error', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('back', lang), 'show_subscription_plans')],
        ]),
      ).catch(() => {});
    }
  });
};

module.exports = registerPaymentHandlers;
