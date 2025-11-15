const { Markup } = require('telegraf');
const PaymentService = require('../../services/paymentService');
const PlanModel = require('../../../models/planModel');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');

/**
 * Payment handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerPaymentHandlers = (bot) => {
  // Show subscription plans
  bot.action('show_subscription_plans', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const plans = await PlanModel.getAll();

      let message = t('subscriptionPlans', lang) + '\n\n';

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
      const planId = ctx.match[1];
      const lang = getLanguage(ctx);
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
      const planId = ctx.match[1];
      const lang = getLanguage(ctx);
      const userId = ctx.from.id;

      await ctx.editMessageText(t('loading', lang));

      const result = await PaymentService.createPayment({
        userId,
        planId,
        provider: 'daimo',
      });

      if (result.success) {
        await ctx.editMessageText(
          t('paymentInstructions', lang, { paymentUrl: result.paymentUrl }),
          Markup.inlineKeyboard([
            [Markup.button.url('💰 Pay with USDC', result.paymentUrl)],
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
      logger.error('Error creating Daimo payment:', error);
    }
  });
};

module.exports = registerPaymentHandlers;
