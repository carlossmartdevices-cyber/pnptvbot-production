const { Markup } = require('telegraf');
const UserService = require('../../services/userService');
const UserModel = require('../../../models/userModel');
const { t } = require('../../../utils/i18n');
const { isValidEmail } = require('../../../utils/validation');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');
const { showMainMenu } = require('./menu');
const { showEditProfileOverview } = require('./profile');
const paymentHandlers = require('../payments');
const { showNearbyMenu } = require('./nearbyUnified');
const supportRoutingService = require('../../services/supportRoutingService');
const { handlePromoDeepLink } = require('../promo/promoHandler');

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
        await ctx.reply('❌ Error: User context missing. Please try again.');
        return;
      }

      logger.info(`[START] User ${ctx.from.id} triggered /start command in ${ctx.chat?.type} chat`);

      const user = await UserService.getOrCreateFromContext(ctx);

      // Validate user was created/fetched successfully
      if (!user) {
        logger.error('[START] Failed to get or create user - database may be unavailable', { userId: ctx.from.id });
        await ctx.reply('⚠️ We are experiencing technical difficulties. Please try again in a few moments.');
        return;
      }

      logger.info(`[START] User ${ctx.from.id} retrieved successfully, onboardingComplete: ${user.onboardingComplete}`);

      // If user is stuck with a duplicate email conflict, show resolution prompt
      if (ctx.session?.temp?.emailConflict) {
        const lang = getLanguage(ctx);
        const conflictEmail = ctx.session.temp.emailConflict.email;
        const conflictMessage = lang === 'es'
          ? `⚠️ *Email ya vinculado*\n\nEl email \`${conflictEmail}\` ya está asociado a otra cuenta.\n\nPuedes intentar con otro email o contactar soporte.`
          : `⚠️ *Email Already Linked*\n\nThe email \`${conflictEmail}\` is already linked to another account.\n\nYou can try another email or contact support.`;

        await ctx.reply(
          conflictMessage,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback(lang === 'es' ? '✏️ Usar otro email' : '✏️ Use another email', 'onboarding_retry_email')],
              [Markup.button.url(lang === 'es' ? '🆘 Soporte' : '🆘 Support', 'https://t.me/pnptv_support')],
            ]),
          }
        );
        return;
      }

      // Check for deep link parameters
      const startParam = ctx.message?.text?.split(' ')[1];

      // Handle lifetime pass activation request
      if (startParam === 'activate_lifetime') {
        const lang = getLanguage(ctx);
        const userId = ctx.from.id;
        const escapeMarkdown = (text = '') => String(text).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
        const username = ctx.from.username ? `@${escapeMarkdown(ctx.from.username)}` : 'No username';
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

        // Send notification to support group using centralized method
        try {
          const user = ctx.from;
          const supportMessage = `💎 *Plan:* Lifetime Pass ($100 USD)\n\n⚠️ Verificar pago en Meru y activar manualmente.`;
          const supportTopic = await supportRoutingService.sendToSupportGroup(supportMessage, 'activation', user, 'text', ctx);
          logger.info(`Lifetime activation request sent to support group`, { userId, username, threadId: supportTopic?.thread_id });
        } catch (err) {
          logger.error('Failed to send activation request to support group:', err);
        }

        return;
      }

      if (startParam) {
        const lang = getLanguage(ctx);

        if (startParam.startsWith('promo_')) {
          const promoCode = startParam.replace('promo_', '');
          return await handlePromoDeepLink(ctx, promoCode);
        }

        if (startParam === 'plans' || startParam === 'show_subscription_plans') {
          await paymentHandlers.showSubscriptionPlans(ctx, { forceReply: true });
          return;
        }

        if (startParam === 'nearby' || startParam === 'show_nearby' || startParam === 'show_nearby_unified') {
          await showNearbyMenu(ctx, { isNewMessage: true });
          return;
        }

        if (startParam === 'edit_profile') {
          await showEditProfileOverview(ctx, lang);
          return;
        }

        // Deep link for PNP Live booking
        if (startParam === 'pnp_live') {
          // Trigger the PNP Live start action
          const fakeCtx = {
            ...ctx,
            callbackQuery: { data: 'PNP_LIVE_START' },
            answerCbQuery: async () => {},
            editMessageText: async (text, opts) => ctx.reply(text, opts),
          };
          // Import and trigger PNP Live handler
          try {
            const { Markup } = require('telegraf');
            const message = lang === 'es'
              ? `📹 *PNP Live - Shows Privados*\n\n` +
                `🔥 Conecta con nuestros performers para shows privados exclusivos.\n\n` +
                `🟢 *Online Ahora* | ⚪ *Disponibles*\n\n` +
                `Selecciona una opción para continuar:`
              : `📹 *PNP Live - Private Shows*\n\n` +
                `🔥 Connect with our performers for exclusive private shows.\n\n` +
                `🟢 *Online Now* | ⚪ *Available*\n\n` +
                `Select an option to continue:`;

            await ctx.reply(message, {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.callback(lang === 'es' ? '🎭 Ver Performers' : '🎭 View Performers', 'PNP_LIVE_START')],
                [Markup.button.callback(lang === 'es' ? '💰 Ver Precios' : '💰 View Pricing', 'pnp_show_pricing')],
                [Markup.button.callback(lang === 'es' ? '🔙 Menú Principal' : '🔙 Main Menu', 'back_to_main')],
              ]),
            });
          } catch (err) {
            logger.error('Error showing PNP Live from deep link:', err);
          }
          return;
        }
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
        // User already onboarded, show main menu (same as /menu command)
        // This ensures consistent experience across /start, /menu, and after onboarding
        await showMainMenu(ctx);
        return;
      }

      // Start onboarding - language selection
      await showLanguageSelection(ctx);
    } catch (error) {
      logger.error('[START] Error in /start command:', error);
      
      // Handle database connection errors
      if (error.message && (error.message.includes('connection refused') || error.message.includes('ECONNREFUSED') || error.message.includes('timeout') || error.message.includes('network'))) {
        logger.error('[START] Database connection error in /start command', {
          error: error.message,
          userId: ctx.from?.id,
          chatId: ctx.chat?.id
        });
        try {
          await ctx.reply('⚠️ We are experiencing database connectivity issues. Please try again in a few minutes.');
        } catch (dbError) {
          logger.error('[START] Failed to send database error message:', dbError.message);
        }
        return;
      }

      // Handle Telegram API errors gracefully
      if (error.message && error.message.includes('chat not found')) {
        logger.warn('[START] Chat not found in /start command - user may have blocked bot or deleted chat', {
          userId: ctx.from?.id,
          chatId: ctx.chat?.id
        });
        return; // Don't try to send message to non-existent chat
      }

      // Handle other Telegram API errors (Bad Request, Forbidden, etc.)
      if (error.message && (error.message.includes('Bad Request') || error.message.includes('Forbidden') || error.message.includes('message is not modified'))) {
        logger.warn('[START] Telegram API error in /start command', {
          error: error.message,
          userId: ctx.from?.id,
          chatId: ctx.chat?.id
        });
        return; // Don't try to send message if Telegram API is having issues
      }

      // Generic error handling
      try {
        await ctx.reply('❌ An error occurred. Please try /start again.');
      } catch (replyError) {
        if (replyError.message && replyError.message.includes('chat not found')) {
          logger.warn('[START] Cannot send error message - chat not found', {
            userId: ctx.from?.id,
            chatId: ctx.chat?.id
          });
        } else {
          logger.error('[START] Failed to send error message in /start:', replyError);
        }
      }
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

  // Location sharing actions
  bot.action('share_location_yes', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      
      // Set location sharing preference
      if (ctx.from?.id) {
        await UserService.updateProfile(ctx.from.id, {
          locationSharingEnabled: true
        });
      }
      
      await ctx.editMessageText(t('locationSharingEnabled', lang));
      await completeOnboarding(ctx);
    } catch (error) {
      logger.error('Error enabling location sharing:', error);
    }
  });

  bot.action('share_location_no', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      
      // Set location sharing preference
      if (ctx.from?.id) {
        await UserService.updateProfile(ctx.from.id, {
          locationSharingEnabled: false
        });
      }
      
      await ctx.editMessageText(t('locationSharingDisabled', lang));
      await completeOnboarding(ctx);
    } catch (error) {
      logger.error('Error disabling location sharing:', error);
    }
  });

  bot.action('provide_email', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      // Ensure temp object exists
      if (!ctx.session.temp) {
        ctx.session.temp = {};
      }
      ctx.session.temp.waitingForEmail = true;
      ctx.session.temp.emailConflict = null;
      await ctx.saveSession();
      logger.info('Email input mode activated', { userId: ctx.from?.id });

      await ctx.editMessageText(
        '📧 Please send your email address:',
      );
    } catch (error) {
      logger.error('Error in provide email:', error);
    }
  });

  bot.action('onboarding_retry_email', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      if (!ctx.session.temp) ctx.session.temp = {};
      ctx.session.temp.emailConflict = null;
      ctx.session.temp.waitingForEmail = true;
      await ctx.saveSession();
      await ctx.reply('📧 Please send your email address:');
    } catch (error) {
      logger.error('Error in onboarding_retry_email:', error);
    }
  });

  // Listen for email input
  bot.on('text', async (ctx, next) => {
    logger.info('Onboarding text handler checking for email', {
      userId: ctx.from?.id,
      waitingForEmail: ctx.session?.temp?.waitingForEmail,
      text: ctx.message?.text?.substring(0, 50)
    });

    if (ctx.session?.temp?.waitingForEmail) {
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
        const existingUser = typeof UserService.getByEmail === 'function'
          ? await UserService.getByEmail(rawEmail)
          : await UserModel.getByEmail(rawEmail);

        if (existingUser) {
          if (String(existingUser.id) === String(ctx.from.id)) {
            // Same user, fuse and complete
            await UserService.updateProfile(ctx.from.id, {
              email: rawEmail,
              onboardingComplete: true,
            });
            ctx.session.temp.waitingForEmail = false;
            await ctx.saveSession();
            await ctx.reply(t('emailReceived', lang));
            await completeOnboarding(ctx);
          } else {
            // Different user, notify admin and inform user to provide a different email
            const adminNotification = `⚠️ *Alerta de Email Duplicado*\n\n` +
              `Un usuario se ha registrado con un email que ya existe en la base de datos.\n\n` +
              `📧 **Email:** \`${rawEmail}\`\n` +
              `👤 **ID de Telegram Existente:** \`${existingUser.id}\`\n` +
              `🆕 **ID de Telegram Nuevo:** \`${ctx.from.id}\`\n\n` +
              `El nuevo usuario no podrá proceder con este email. Por favor, revisa manualmente la situación.`;

            await supportRoutingService.sendToSupportGroup(adminNotification, 'escalation', {
              id: 'SYSTEM',
              first_name: 'System Alert',
              username: 'system'
            });

            logger.warn('Duplicate email detected during onboarding for different user', {
              newUserId: ctx.from.id,
              existingUserId: existingUser.id,
              email: rawEmail
            });

            ctx.session.temp.waitingForEmail = false;
            ctx.session.temp.emailConflict = { email: rawEmail, existingUserId: existingUser.id };
            await ctx.saveSession();

            await ctx.reply(
              lang === 'es'
                ? `❌ Este email ya está en uso por otra cuenta.`
                : `❌ This email is already in use by another account.`,
              {
                ...Markup.inlineKeyboard([
                  [Markup.button.callback(lang === 'es' ? '✏️ Usar otro email' : '✏️ Use another email', 'onboarding_retry_email')],
                  [Markup.button.url(lang === 'es' ? '🆘 Soporte' : '🆘 Support', 'https://t.me/pnptv_support')],
                ]),
              }
            );
          }
        } else {
          // New email, proceed normally
          ctx.session.temp.email = rawEmail;
          ctx.session.temp.waitingForEmail = false;
          await ctx.saveSession();

          await ctx.reply(t('emailReceived', lang));
          await showLocationSharingPrompt(ctx);
        }
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
  const isSpanish = lang === 'es';

  // Combine prompt and required note in one message with button
  const message = `${t('emailPrompt', lang)}\n\n${t('emailRequiredNote', lang)}`;
  const buttonText = isSpanish ? '📧 Enviar Email' : '📧 Provide Email';

  await ctx.reply(
    message,
    Markup.inlineKeyboard([
      [Markup.button.callback(buttonText, 'provide_email')],
    ]),
  );
};

/**
 * Show location sharing prompt
 * @param {Context} ctx - Telegraf context
 */
const showLocationSharingPrompt = async (ctx) => {
  const lang = getLanguage(ctx);

  const locationText = lang === 'es'
    ? `📍 *Compartir Ubicación (Opcional)*

¿Quieres que otros miembros te encuentren en el mapa de *¿Quién está Cercano?*?

💡 *Esto es completamente opcional* y puedes cambiarlo más tarde en tu perfil.

🔒 *Tu privacidad está protegida*: Solo mostrará tu ubicación aproximada a otros miembros que también hayan activado esta función.

👥 *Beneficios*:
• Conecta con otros papis cloudy cerca de ti
• Encuentra slam buddies en tu área
• Descubre la escena local de PNP

🌍 *¿Cómo funciona?*:
• Solo compartes tu ubicación cuando usas la función *¿Quién está Cercano?*
• Puedes desactivarlo en cualquier momento
• Solo es visible para otros miembros verificados`
    : `📍 *Share Location (Optional)*

Want other members to find you on the *Who is Nearby?* map?

💡 *This is completely optional* and you can change it later in your profile.

🔒 *Your privacy is protected*: It will only show your approximate location to other members who have also enabled this feature.

👥 *Benefits*:
• Connect with other cloudy papis near you
• Find slam buddies in your area
• Discover the local PNP scene

🌍 *How it works*:
• You only share your location when using the *Who is Nearby?* feature
• You can turn it off anytime
• Only visible to other verified members`;

  await ctx.reply(
    locationText,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📍 Yes, Share My Location', 'share_location_yes')],
        [Markup.button.callback('🚫 No Thanks', 'share_location_no')],
      ]),
    }
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
    // Double-check that onboarding is not already complete to prevent duplicates
    const userCheck = await UserService.getById(userId);
    if (userCheck && userCheck.onboardingComplete) {
      logger.warn('Onboarding completion attempted for already completed user', { userId });
      await ctx.reply('You have already completed onboarding. Enjoy the platform!');
      await showMainMenu(ctx);
      return;
    }

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

    // Log onboarding completion
    logger.info('User completed onboarding', { userId, language: lang });

    // Clear temp session data
    ctx.session.temp = {};
    await ctx.saveSession();

    // Check if user is PRIME to send appropriate onboarding completion message
    const user = await UserService.getById(userId);
    const isPrime = user && user.isPremium;
    
    const messageKey = isPrime 
      ? (lang === 'es' ? 'pnpLatinoPrimeOnboardingComplete' : 'pnpLatinoPrimeOnboardingComplete')
      : (lang === 'es' ? 'pnpLatinoFreeOnboardingComplete' : 'pnpLatinoFreeOnboardingComplete');
    
    await ctx.reply(t(messageKey, lang));

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
        ? `🎉 ¡Estás listo!\n\nTe damos la bienvenida a la comunidad PNPtv. Aquí está tu enlace exclusivo de acceso único para el grupo gratuito:\n\n🔗 [Únete al grupo](${inviteLink.invite_link})\n\n⏰ Este enlace expira en 24 horas.\n📱 Únete ahora para acceder a todo el contenido.`
        : `🎉 You're all set!\n\nWelcome to the PNPtv community. Here's your exclusive one-time use link to access the free group:\n\n🔗 [Join the group](${inviteLink.invite_link})\n\n⏰ This link expires in 24 hours.\n📱 Join now to access all content.`;

      await ctx.reply(message, { parse_mode: 'Markdown', disable_web_page_preview: true });

      logger.info('Telegram group invite sent to user', {
        userId,
        groupId,
        inviteLinkId: inviteLink.invite_link,
      });
    } catch (telegramInviteError) {
      logger.error('Failed to create Telegram group invite link:', telegramInviteError);

      // Fallback to customer support if invite link generation fails
      const fallbackMessage = lang === 'es'
        ? `⚠️ Hubo un problema al generar tu enlace de acceso.\n\nNo te preocupes, nuestro equipo de soporte te ayudará. Por favor contacta a:\n\n🔗 https://t.me/pnptv_support\n\n📞 Nuestro equipo te dará acceso manual al grupo en menos de 5 minutos.`
        : `⚠️ There was an issue generating your access link.\n\nDon't worry, our support team will help you. Please contact:\n\n🔗 https://t.me/pnptv_support\n\n📞 Our team will give you manual access to the group within 5 minutes.`;

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
