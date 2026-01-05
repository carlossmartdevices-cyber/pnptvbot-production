const { Markup } = require('telegraf');
const UserService = require('../../services/userService');
const { t } = require('../../../utils/i18n');
const { isValidEmail } = require('../../../utils/validation');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');
const { showMainMenu } = require('./menu');

/**
 * Onboarding handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerOnboardingHandlers = (bot) => {
  // Onboard command - restart onboarding for testing
  bot.command('onboard', async (ctx) => {
    try {
      const user = await UserService.getOrCreateFromContext(ctx);

      if (!user) {
        logger.error('/onboard command: Failed to get or create user', { userId: ctx.from.id });
        await ctx.reply('An error occurred. Please try again in a few moments.');
        return;
      }

      // Reset onboarding status for testing
      await UserService.updateProfile(ctx.from.id, {
        onboardingComplete: false,
      });

      logger.info('Onboarding restarted for testing', { userId: ctx.from.id });

      // Start fresh onboarding - language selection
      await showLanguageSelection(ctx);
    } catch (error) {
      logger.error('Error in /onboard command:', error);
      await ctx.reply('An error occurred. Please try again.');
    }
  });

  // Start command - begin onboarding or show main menu
  bot.command('start', async (ctx) => {
    try {
      // Validate context has required data
      if (!ctx.from?.id) {
        logger.error('/start command called without user context');
        await ctx.reply('An error occurred. Please try again.');
        return;
      }

      const user = await UserService.getOrCreateFromContext(ctx);

      // Validate user was created/fetched successfully
      if (!user) {
        logger.error('/start command: Failed to get or create user', { userId: ctx.from.id });
        await ctx.reply('An error occurred. Please try again in a few moments.');
        return;
      }

      // Check for deep link parameters
      const startParam = ctx.message?.text?.split(' ')[1];

      // Handle lifetime pass activation request
      if (startParam === 'activate_lifetime') {
        const lang = getLanguage(ctx);
        const userId = ctx.from.id;
        const username = ctx.from.username ? `@${ctx.from.username}` : 'No username';
        const firstName = ctx.from.first_name || 'Unknown';

        // Send confirmation to user
        const userMessage = lang === 'es'
          ? `✅ *Solicitud de Activación Recibida*

Hemos recibido tu solicitud para activar el *Lifetime Pass*.

📋 *Detalles:*
• Plan: Lifetime Pass ($100 USD)
• Usuario: ${username}

⏱️ Tu suscripción será activada en menos de 24 horas.

Te enviaremos un mensaje de confirmación cuando esté lista.

Si tienes alguna pregunta, usa /support para contactarnos.`
          : `✅ *Activation Request Received*

We have received your request to activate the *Lifetime Pass*.

📋 *Details:*
• Plan: Lifetime Pass ($100 USD)
• User: ${username}

⏱️ Your subscription will be activated within 24 hours.

We will send you a confirmation message when it's ready.

If you have any questions, use /support to contact us.`;

        await ctx.reply(userMessage, { parse_mode: 'Markdown' });

        // Send notification to support group
        const supportGroupId = process.env.SUPPORT_GROUP_ID;
        if (supportGroupId) {
          const supportMessage = `🔔 *SOLICITUD DE ACTIVACIÓN LIFETIME*

👤 *Usuario:* ${firstName}
🆔 *Telegram:* ${username}
🔢 *User ID:* \`${userId}\`
💎 *Plan:* Lifetime Pass ($100 USD)
📅 *Fecha:* ${new Date().toLocaleString('es-ES')}

⚠️ Verificar pago en Meru y activar manualmente.`;

          try {
            await ctx.telegram.sendMessage(supportGroupId, supportMessage, { parse_mode: 'Markdown' });
            logger.info(`Lifetime activation request sent to support group`, { userId, username });
          } catch (err) {
            logger.error('Failed to send activation request to support group:', err);
          }
        }

        return;
      }

      if (startParam && startParam.startsWith('viewprofile_')) {
        const targetUserId = startParam.replace('viewprofile_', '');
        // Import profile handler and show the profile
        const UserModel = require('../../../models/userModel');
        const targetUser = await UserModel.getById(targetUserId);

        if (targetUser) {
          const { showProfile } = require('./profile');
          await showProfile(ctx, targetUserId, false, targetUserId === ctx.from.id.toString());
          return;
        }
      }

      if (user.onboardingComplete) {
        // User already onboarded, show main menu
        return ctx.scene?.enter ? ctx.scene.enter('main_menu') : showMainMenu(ctx);
      }

      // Start onboarding - language selection
      await showLanguageSelection(ctx);
    } catch (error) {
      logger.error('Error in /start command:', error);
      await ctx.reply('An error occurred. Please try again.');
    }
  });

  // Language selection
  bot.action(/^set_lang_(.+)$/, async (ctx) => {
    try {
      // Validate match result exists
      if (!ctx.match || !ctx.match[1]) {
        logger.error('Invalid language selection format');
        await ctx.reply('An error occurred. Please try /start again.');
        return;
      }

      const lang = ctx.match[1];
      ctx.session.language = lang;
      await ctx.saveSession();

      await ctx.editMessageText(
        t('languageSelected', lang),
        { parse_mode: 'Markdown' },
      );

      // Move to age confirmation
      await showAgeConfirmation(ctx);
    } catch (error) {
      logger.error('Error setting language:', error);
    }
  });

  // Age confirmation
  bot.action('age_confirm_yes', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.ageConfirmed = true;

      await ctx.editMessageText(t('termsAccepted', lang));

      // Move to terms acceptance
      await showTermsAndPrivacy(ctx);
    } catch (error) {
      logger.error('Error in age confirmation:', error);
    }
  });

  bot.action('age_confirm_no', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      await ctx.editMessageText(t('underAge', lang));
    } catch (error) {
      logger.error('Error in age rejection:', error);
    }
  });

  // Terms acceptance
  bot.action('accept_terms', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.termsAccepted = true;

      await ctx.editMessageText(t('termsAccepted', lang));

      // Move to email prompt
      await showEmailPrompt(ctx);
    } catch (error) {
      logger.error('Error accepting terms:', error);
    }
  });

  // Email prompt actions
  bot.action('skip_email', async (ctx) => {
    try {
      await completeOnboarding(ctx);
    } catch (error) {
      logger.error('Error skipping email:', error);
    }
  });

  bot.action('provide_email', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.waitingForEmail = true;
      await ctx.saveSession();

      await ctx.editMessageText(
        '📧 Please send your email address:',
      );
    } catch (error) {
      logger.error('Error in provide email:', error);
    }
  });

  // Listen for email input
  bot.on('text', async (ctx, next) => {
    if (ctx.session.temp?.waitingForEmail) {
      const lang = getLanguage(ctx);

      // Validate message text exists
      if (!ctx.message?.text) {
        logger.warn('Email handler received message without text');
        await ctx.reply(`${t('invalidInput', lang)}\nPlease send a valid email address.`);
        return;
      }

      // Normalize email: trim, lowercase, check length
      const rawEmail = ctx.message.text.trim().toLowerCase();

      // Check email length (emails shouldn't exceed 254 characters per RFC)
      if (rawEmail.length > 254 || rawEmail.length < 5) {
        await ctx.reply(`${t('invalidInput', lang)}\nEmail must be between 5 and 254 characters.`);
        return;
      }

      if (isValidEmail(rawEmail)) {
        ctx.session.temp.email = rawEmail;
        ctx.session.temp.waitingForEmail = false;
        await ctx.saveSession();

        await ctx.reply(t('emailReceived', lang));
        await completeOnboarding(ctx);
      } else {
        await ctx.reply(`${t('invalidInput', lang)}\nPlease send a valid email address (e.g., user@example.com).`);
      }
      return;
    }

    return next();
  });
};

/**
 * Show language selection
 * @param {Context} ctx - Telegraf context
 */
const showLanguageSelection = async (ctx) => {
  await ctx.reply(
    '👋 Welcome to PNPtv!\n\nPlease select your language / Por favor selecciona tu idioma:',
    Markup.inlineKeyboard([
      [
        Markup.button.callback('🇺🇸 English', 'set_lang_en'),
        Markup.button.callback('🇪🇸 Español', 'set_lang_es'),
      ],
    ]),
  );
};

/**
 * Show age confirmation
 * @param {Context} ctx - Telegraf context
 */
const showAgeConfirmation = async (ctx) => {
  const lang = getLanguage(ctx);

  // Import age verification handler
  const { showAgeVerificationOptions } = require('./ageVerificationHandler');

  // Show new AI-based age verification options
  await showAgeVerificationOptions(ctx);
};

/**
 * Show terms and privacy
 * @param {Context} ctx - Telegraf context
 */
const showTermsAndPrivacy = async (ctx) => {
  const lang = getLanguage(ctx);

  await ctx.reply(
    `${t('termsAndPrivacy', lang)}\n\n📄 Terms: https://pnptv.app/terms\n🔒 Privacy: https://pnptv.app/privacy`,
    Markup.inlineKeyboard([
      [Markup.button.callback(`✅ ${t('confirm', lang)}`, 'accept_terms')],
    ]),
  );
};

/**
 * Show email prompt
 * @param {Context} ctx - Telegraf context
 */
const showEmailPrompt = async (ctx) => {
  const lang = getLanguage(ctx);

  await ctx.reply(
    t('emailPrompt', lang),
    Markup.inlineKeyboard([
      [Markup.button.callback('📧 Provide Email', 'provide_email')],
      [Markup.button.callback(t('skipEmail', lang), 'skip_email')],
    ]),
  );
};

/**
 * Complete onboarding
 * @param {Context} ctx - Telegraf context
 */
const completeOnboarding = async (ctx) => {
  try {
    const lang = getLanguage(ctx);

    // Validate user context exists
    if (!ctx.from?.id) {
      logger.error('Missing user context in onboarding completion');
      await ctx.reply('An error occurred. Please try /start again.');
      return;
    }

    const userId = ctx.from.id;

    // Update user profile
    const result = await UserService.updateProfile(userId, {
      language: lang,
      email: ctx.session.temp?.email || null,
      onboardingComplete: true,
    });

    if (!result.success) {
      logger.error('Failed to update user profile:', result.error);
      await ctx.reply('An error occurred. Please try /start again.');
      return;
    }

    // Clear temp session data
    ctx.session.temp = {};
    await ctx.saveSession();

    await ctx.reply(t('onboardingComplete', lang));

    // Send Telegram group invite via API
    try {
      const groupId = process.env.GROUP_ID;
      if (!groupId) {
        throw new Error('GROUP_ID environment variable not configured');
      }

      // Create a one-time use invite link via Telegram API
      const inviteLink = await ctx.telegram.createChatInviteLink(
        groupId,
        {
          expire_date: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours from now
          member_limit: 1, // One-time use
          name: `Onboarding-${userId}-${Date.now()}`,
        }
      );

      const message = lang === 'es'
        ? `🎉 ¡Estás listo!\n\nTe damos la bienvenida a la comunidad PNPtv. Aquí está tu enlace exclusivo de acceso único para el grupo gratuito:\n\n🔗 ${inviteLink.invite_link}\n\n⏰ Este enlace expira en 24 horas.\n📱 Únete ahora para acceder a todo el contenido.`
        : `🎉 You're all set!\n\nWelcome to the PNPtv community. Here's your exclusive one-time use link to access the free group:\n\n🔗 ${inviteLink.invite_link}\n\n⏰ This link expires in 24 hours.\n📱 Join now to access all content.`;

      await ctx.reply(message, { parse_mode: 'Markdown' });

      logger.info('Telegram group invite sent to user', {
        userId,
        groupId,
        inviteLinkId: inviteLink.invite_link,
      });
    } catch (telegramInviteError) {
      logger.error('Failed to create Telegram group invite link:', telegramInviteError);

      // Fallback to static Telegram group link
      const fallbackMessage = lang === 'es'
        ? `🎉 ¡Estás listo!\n\nTe damos la bienvenida a la comunidad PNPtv. Únete al grupo gratuito:\n\n🔗 https://t.me/pnptv_community\n\n📱 Haz clic para unirte ahora.`
        : `🎉 You're all set!\n\nWelcome to the PNPtv community. Join the free group:\n\n🔗 https://t.me/pnptv_community\n\n📱 Click to join now.`;

      await ctx.reply(fallbackMessage);
    }

    // Show main menu
    await showMainMenu(ctx);
  } catch (error) {
    logger.error('Error completing onboarding:', error);
    await ctx.reply('An error occurred. Please try /start again.');
  }
};

module.exports = registerOnboardingHandlers;
module.exports.showTermsAndPrivacy = showTermsAndPrivacy;
