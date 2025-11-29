const { getPlansMenu, getPaymentMethodMenu } = require('../../utils/menus');
const { requirePrivateChat } = require('../../utils/notifications');
const { getFirestore, Collections } = require('../../config/firebase');
const paymentService = require('../../services/paymentService');
const userService = require('../../services/userService');
const i18n = require('../../utils/i18n');
const logger = require('../../../utils/logger');

/**
 * Handle subscribe command
 */
async function handleSubscribe(ctx) {
  try {
    const userId = ctx.from.id;
    const user = await userService.getUser(userId);
    const language = user?.language || 'en';

    // Check if command is in group chat
    const isPrivate = await requirePrivateChat(
      ctx,
      'Subscribe to PRIME',
      i18n.t('subscription_plans', language)
    );

    if (!isPrivate) {
      return;
    }

    // Check current subscription status
    const isActive = await userService.isSubscriptionActive(userId);
    if (isActive) {
      await ctx.reply(
        i18n.t('subscription_active', language),
        { reply_markup: getPlansMenu(language) }
      );
      return;
    }

    // Show subscription plans
    await ctx.reply(
      i18n.t('subscription_plans', language),
      { reply_markup: getPlansMenu(language) }
    );

    logger.info(`User ${userId} viewed subscription plans`);
  } catch (error) {
    logger.error('Error in subscribe command:', error);
    await ctx.reply(i18n.t('error_occurred', 'en'));
  }
}

/**
 * Handle plan selection
 */
async function handlePlanSelection(ctx) {
  try {
    const userId = ctx.from.id;
    const planId = ctx.callbackQuery.data.split('_')[1]; // 'plan_basic' -> 'basic'
    const user = await userService.getUser(userId);
    const language = user?.language || 'en';

    // Get plan details from Firestore
    const db = getFirestore();
    const planDoc = await db.collection(Collections.PLANS).doc(planId).get();

    if (!planDoc.exists) {
      await ctx.answerCbQuery('Plan not found');
      return;
    }

    const plan = planDoc.data();

    // Show plan details and payment options
    const planDetails = i18n.t(`plan_${planId}`, language);

    await ctx.editMessageText(
      `${planDetails}\n\n${i18n.t('select_payment_method', language)}`,
      { reply_markup: getPaymentMethodMenu(planId, language) }
    );

    logger.info(`User ${userId} selected plan: ${planId}`);
  } catch (error) {
    logger.error('Error in plan selection:', error);
    await ctx.answerCbQuery(i18n.t('error_occurred', 'en'));
  }
}

/**
 * Handle payment method selection
 */
async function handlePaymentMethod(ctx) {
  try {
    const userId = ctx.from.id;
    const callbackData = ctx.callbackQuery.data; // 'pay_epayco_basic'
    const [, provider, planId] = callbackData.split('_');

    const user = await userService.getUser(userId);
    const language = user?.language || 'en';

    // Get plan details
    const db = getFirestore();
    const planDoc = await db.collection(Collections.PLANS).doc(planId).get();

    if (!planDoc.exists) {
      await ctx.answerCbQuery('Plan not found');
      return;
    }

    const plan = planDoc.data();

    // Generate payment link
    let paymentUrl;
    if (provider === 'epayco') {
      paymentUrl = await paymentService.createEPaycoLink(userId, planId, plan);
    } else if (provider === 'daimo') {
      paymentUrl = await paymentService.createDaimoPayLink(userId, planId, plan);
    }

    // Send payment link
    await ctx.editMessageText(
      `${i18n.t('payment_link_generated', language)}\n\n${paymentUrl}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: language === 'es' ? '💳 Pagar Ahora' : '💳 Pay Now', url: paymentUrl }],
          ],
        },
      }
    );

    logger.info(`Payment link generated for user ${userId}, plan ${planId}, provider ${provider}`);
  } catch (error) {
    logger.error('Error in payment method selection:', error);
    await ctx.answerCbQuery(i18n.t('error_occurred', 'en'));
  }
}

module.exports = {
  handleSubscribe,
  handlePlanSelection,
  handlePaymentMethod,
};
