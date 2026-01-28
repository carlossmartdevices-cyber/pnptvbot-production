const { Markup } = require('telegraf');
const NearbyPlaceService = require('../../services/nearbyPlaceService');
const UserService = require('../../services/userService');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');

/**
 * Nearby places handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerNearbyPlacesHandlers = (bot) => {
  // ===========================================
  // MAIN NEARBY MENU (Enhanced)
  // ===========================================
  bot.action('show_nearby_menu', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      const menuText = lang === 'es'
        ? '`📍 PNP Nearby`\n\n' +
          '¿Qué te gustaría explorar?\n\n' +
          '👥 Encuentra miembros cerca de ti\n' +
          '🏪 Negocios de la comunidad\n' +
          '📍 Lugares de interés\n\n' +
          '_Selecciona una opción:_'
        : '`📍 PNP Nearby`\n\n' +
          'What would you like to explore?\n\n' +
          '👥 Find members near you\n' +
          '🏪 Community businesses\n' +
          '📍 Places of interest\n\n' +
          '_Select an option:_';

      const buttons = [
        [Markup.button.callback(lang === 'es' ? '👥 Miembros Cerca' : '👥 Members Near You', 'show_nearby')],
        [Markup.button.callback(lang === 'es' ? '🏪 Negocios Comunitarios' : '🏪 Community Businesses', 'nearby_businesses')],
        [Markup.button.callback(lang === 'es' ? '📍 Lugares de Interés' : '📍 Places of Interest', 'nearby_places_categories')],
        [Markup.button.callback(lang === 'es' ? '➕ Proponer un Lugar' : '➕ Suggest a Place', 'submit_place_start')],
        [Markup.button.callback(lang === 'es' ? '📋 Mis Propuestas' : '📋 My Submissions', 'my_place_submissions')],
        [Markup.button.callback('🔙 Back', 'back_to_main')],
      ];

      await ctx.editMessageText(menuText, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error('Error showing nearby menu:', error);
    }
  });

  // ===========================================
  // COMMUNITY BUSINESSES
  // ===========================================
  bot.action('nearby_businesses', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const userId = ctx.from.id.toString();

      await ctx.editMessageText(
        lang === 'es' ? '🔍 _Buscando negocios cerca de ti..._' : '🔍 _Searching for businesses near you..._',
        { parse_mode: 'Markdown' }
      );

      const result = await NearbyPlaceService.getNearbyBusinesses(userId, 50);

      if (!result.success && result.error === 'no_location') {
        await showNoLocationMessage(ctx, lang, 'show_nearby_menu');
        return;
      }

      if (result.places.length === 0) {
        await ctx.editMessageText(
          lang === 'es'
            ? '🏪 *Negocios Comunitarios*\n\n' +
              'No hay negocios cerca de ti aún.\n\n' +
              '¿Conoces alguno? ¡Propónlo!'
            : '🏪 *Community Businesses*\n\n' +
              'No businesses near you yet.\n\n' +
              'Know any? Suggest one!',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback(lang === 'es' ? '➕ Proponer Negocio' : '➕ Suggest Business', 'submit_place_business')],
              [Markup.button.callback('🔙 Back', 'show_nearby_menu')],
            ]),
          }
        );
        return;
      }

      await showPlacesList(ctx, result.places, lang, 'business', null);
    } catch (error) {
      logger.error('Error showing businesses:', error);
    }
  });

  // ===========================================
  // PLACES OF INTEREST - Categories
  // ===========================================
  bot.action('nearby_places_categories', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const categories = await NearbyPlaceService.getCategories(lang);

      // Filter out community_business as it has its own menu
      const placeCategories = categories.filter(c => c.slug !== 'community_business');

      const buttons = placeCategories.map(cat => [
        Markup.button.callback(
          `${cat.emoji} ${cat.name}${cat.requiresAgeVerification ? ' 🔞' : ''}`,
          `nearby_cat_${cat.id}`
        ),
      ]);

      buttons.push([Markup.button.callback('🔙 Back', 'show_nearby_menu')]);

      await ctx.editMessageText(
        lang === 'es'
          ? '📍 *Lugares de Interés*\n\n' +
            'Selecciona una categoría:\n\n' +
            '_🔞 indica que requiere verificación de edad_'
          : '📍 *Places of Interest*\n\n' +
            'Select a category:\n\n' +
            '_🔞 indicates age verification required_',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons),
        }
      );
    } catch (error) {
      logger.error('Error showing place categories:', error);
    }
  });

  // ===========================================
  // PLACES BY CATEGORY
  // ===========================================
  bot.action(/^nearby_cat_(\d+)$/, async (ctx) => {
    try {
      const categoryId = parseInt(ctx.match[1]);
      const lang = getLanguage(ctx);
      const userId = ctx.from.id.toString();

      // Get category info
      const category = await NearbyPlaceService.getCategory(categoryId);

      // Check age verification for adult categories
      if (category?.requiresAgeVerification) {
        const user = await UserService.getOrCreateFromContext(ctx);
        if (!user.ageVerified) {
          await ctx.answerCbQuery(
            lang === 'es' ? '🔞 Requiere verificación de edad' : '🔞 Age verification required',
            { show_alert: true }
          );
          return;
        }
      }

      await ctx.editMessageText(
        lang === 'es' ? '🔍 _Buscando lugares..._' : '🔍 _Searching for places..._',
        { parse_mode: 'Markdown' }
      );

      const result = await NearbyPlaceService.getNearbyPlacesOfInterest(userId, 50, categoryId);

      if (!result.success && result.error === 'no_location') {
        await showNoLocationMessage(ctx, lang, 'nearby_places_categories');
        return;
      }

      const categoryName = lang === 'es' ? category?.nameEs : category?.nameEn;
      const categoryEmoji = category?.emoji || '📍';

      if (result.places.length === 0) {
        await ctx.editMessageText(
          lang === 'es'
            ? `${categoryEmoji} *${categoryName || 'Lugares'}*\n\n` +
              'No hay lugares en esta categoría cerca de ti.\n\n' +
              '¿Conoces alguno? ¡Propónlo!'
            : `${categoryEmoji} *${categoryName || 'Places'}*\n\n` +
              'No places in this category near you.\n\n' +
              'Know any? Suggest one!',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback(
                lang === 'es' ? '➕ Proponer Lugar' : '➕ Suggest Place',
                `submit_place_cat_${categoryId}`
              )],
              [Markup.button.callback('🔙 Back', 'nearby_places_categories')],
            ]),
          }
        );
        return;
      }

      await showPlacesList(ctx, result.places, lang, 'place', categoryId);
    } catch (error) {
      logger.error('Error showing places by category:', error);
    }
  });

  // ===========================================
  // VIEW PLACE DETAILS
  // ===========================================
  bot.action(/^view_place_(\d+)$/, async (ctx) => {
    try {
      const placeId = parseInt(ctx.match[1]);
      const lang = getLanguage(ctx);

      const place = await NearbyPlaceService.getPlaceDetails(placeId, true);

      if (!place) {
        await ctx.answerCbQuery(lang === 'es' ? 'Lugar no encontrado' : 'Place not found');
        return;
      }

      let detailsText = `${place.categoryEmoji || '📍'} *${escapeMarkdown(place.name)}*\n\n`;

      if (place.description) {
        detailsText += `${escapeMarkdown(place.description)}\n\n`;
      }

      if (place.address) {
        detailsText += `📍 ${escapeMarkdown(place.address)}`;
        if (place.city) detailsText += `, ${escapeMarkdown(place.city)}`;
        detailsText += '\n';
      }

      if (place.distance !== undefined) {
        detailsText += `📏 ${place.distance.toFixed(1)} km ${lang === 'es' ? 'de distancia' : 'away'}\n`;
      }

      if (place.priceRange) {
        detailsText += `💰 ${place.priceRange}\n`;
      }

      if (place.phone) {
        detailsText += `📞 ${place.phone}\n`;
      }

      detailsText += `\n👁️ ${place.viewCount} ${lang === 'es' ? 'vistas' : 'views'}`;

      const buttons = [];

      // Contact buttons
      if (place.telegramUsername) {
        buttons.push([Markup.button.url('💬 Telegram', `https://t.me/${place.telegramUsername}`)]);
      }

      if (place.website) {
        buttons.push([Markup.button.url('🌐 Website', place.website)]);
      }

      if (place.instagram) {
        buttons.push([Markup.button.url('📸 Instagram', `https://instagram.com/${place.instagram}`)]);
      }

      // Navigation button
      if (place.location) {
        buttons.push([Markup.button.url(
          '🗺️ Open in Maps',
          `https://www.google.com/maps/search/?api=1&query=${place.location.lat},${place.location.lng}`
        )]);
      }

      // Back button
      const backAction = place.placeType === 'business'
        ? 'nearby_businesses'
        : `nearby_cat_${place.categoryId}`;
      buttons.push([Markup.button.callback('🔙 Back', backAction)]);

      // Send photo if available, otherwise just text
      if (place.photoFileId) {
        try {
          await ctx.deleteMessage().catch(() => {});
          await ctx.replyWithPhoto(place.photoFileId, {
            caption: detailsText,
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons),
          });
        } catch (photoError) {
          logger.error('Error sending photo:', photoError);
          await ctx.editMessageText(detailsText, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons),
          });
        }
      } else {
        await ctx.editMessageText(detailsText, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons),
        });
      }
    } catch (error) {
      logger.error('Error viewing place details:', error);
    }
  });

  // ===========================================
  // SUBMIT PLACE FLOW - Start
  // ===========================================
  bot.action('submit_place_start', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      // Initialize submission session
      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.placeSubmission = {
        step: 'type',
      };
      await ctx.saveSession();

      await ctx.editMessageText(
        lang === 'es'
          ? '➕ *Proponer un Lugar*\n\n' +
            '¿Qué tipo de lugar quieres proponer?'
          : '➕ *Suggest a Place*\n\n' +
            'What type of place do you want to suggest?',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(
              lang === 'es' ? '🏪 Negocio Comunitario' : '🏪 Community Business',
              'submit_type_business'
            )],
            [Markup.button.callback(
              lang === 'es' ? '📍 Lugar de Interés' : '📍 Place of Interest',
              'submit_type_place'
            )],
            [Markup.button.callback('❌ Cancel', 'show_nearby_menu')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error starting place submission:', error);
    }
  });

  // Quick submission for business
  bot.action('submit_place_business', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.placeSubmission = {
        step: 'name',
        placeType: 'business',
        categoryId: null, // Will be set to community_business category
      };
      await ctx.saveSession();

      // Get community business category ID
      const categories = await NearbyPlaceService.getCategories(lang);
      const communityBizCat = categories.find(c => c.slug === 'community_business');
      if (communityBizCat) {
        ctx.session.temp.placeSubmission.categoryId = communityBizCat.id;
        await ctx.saveSession();
      }

      await ctx.editMessageText(
        lang === 'es'
          ? '📝 *Paso 1/5: Nombre*\n\n' +
            'Escribe el nombre del negocio:'
          : '📝 *Step 1/5: Name*\n\n' +
            'Enter the name of the business:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'show_nearby_menu')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error starting business submission:', error);
    }
  });

  // Quick submission for place in category
  bot.action(/^submit_place_cat_(\d+)$/, async (ctx) => {
    try {
      const categoryId = parseInt(ctx.match[1]);
      const lang = getLanguage(ctx);

      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.placeSubmission = {
        step: 'name',
        placeType: 'place_of_interest',
        categoryId: categoryId,
      };
      await ctx.saveSession();

      await ctx.editMessageText(
        lang === 'es'
          ? '📝 *Paso 1/5: Nombre*\n\n' +
            'Escribe el nombre del lugar:'
          : '📝 *Step 1/5: Name*\n\n' +
            'Enter the name of the place:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'show_nearby_menu')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error starting place submission:', error);
    }
  });

  // Select type
  bot.action('submit_type_business', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.placeSubmission = {
        ...ctx.session.temp.placeSubmission,
        step: 'name',
        placeType: 'business',
      };

      // Get community business category
      const categories = await NearbyPlaceService.getCategories(lang);
      const communityBizCat = categories.find(c => c.slug === 'community_business');
      if (communityBizCat) {
        ctx.session.temp.placeSubmission.categoryId = communityBizCat.id;
      }

      await ctx.saveSession();

      await ctx.editMessageText(
        lang === 'es'
          ? '📝 *Paso 1/5: Nombre*\n\n' +
            'Escribe el nombre del negocio:'
          : '📝 *Step 1/5: Name*\n\n' +
            'Enter the name of the business:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'show_nearby_menu')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error selecting business type:', error);
    }
  });

  bot.action('submit_type_place', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.placeSubmission = {
        ...ctx.session.temp.placeSubmission,
        step: 'category',
        placeType: 'place_of_interest',
      };
      await ctx.saveSession();

      // Show category selection
      const categories = await NearbyPlaceService.getCategories(lang);
      const placeCategories = categories.filter(c => c.slug !== 'community_business');

      const buttons = placeCategories.map(cat => [
        Markup.button.callback(
          `${cat.emoji} ${cat.name}`,
          `submit_select_cat_${cat.id}`
        ),
      ]);
      buttons.push([Markup.button.callback('❌ Cancel', 'show_nearby_menu')]);

      await ctx.editMessageText(
        lang === 'es'
          ? '📂 *Selecciona la categoría:*'
          : '📂 *Select the category:*',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons),
        }
      );
    } catch (error) {
      logger.error('Error selecting place type:', error);
    }
  });

  // Select category for place submission
  bot.action(/^submit_select_cat_(\d+)$/, async (ctx) => {
    try {
      const categoryId = parseInt(ctx.match[1]);
      const lang = getLanguage(ctx);

      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.placeSubmission = {
        ...ctx.session.temp.placeSubmission,
        step: 'name',
        categoryId: categoryId,
      };
      await ctx.saveSession();

      await ctx.editMessageText(
        lang === 'es'
          ? '📝 *Paso 1/5: Nombre*\n\n' +
            'Escribe el nombre del lugar:'
          : '📝 *Step 1/5: Name*\n\n' +
            'Enter the name of the place:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'show_nearby_menu')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error selecting category:', error);
    }
  });

  // Skip optional steps
  bot.action('submit_skip_description', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      ctx.session.temp.placeSubmission.step = 'address';
      ctx.session.temp.placeSubmission.description = null;
      await ctx.saveSession();

      await ctx.editMessageText(
        lang === 'es'
          ? '📝 *Paso 3/5: Dirección*\n\n' +
            'Escribe la dirección del lugar:\n\n' +
            '_Ejemplo: Calle 123, Ciudad_'
          : '📝 *Step 3/5: Address*\n\n' +
            'Enter the address of the place:\n\n' +
            '_Example: 123 Main St, City_',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(lang === 'es' ? '⏭️ Omitir' : '⏭️ Skip', 'submit_skip_address')],
            [Markup.button.callback('❌ Cancel', 'show_nearby_menu')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error skipping description:', error);
    }
  });

  bot.action('submit_skip_address', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      ctx.session.temp.placeSubmission.step = 'contact';
      ctx.session.temp.placeSubmission.address = null;
      await ctx.saveSession();

      await ctx.editMessageText(
        lang === 'es'
          ? '📝 *Paso 4/5: Contacto (opcional)*\n\n' +
            'Escribe información de contacto:\n' +
            '- Teléfono\n' +
            '- Website\n' +
            '- @usuario de Telegram\n' +
            '- Instagram\n\n' +
            '_Puedes enviar uno o varios_'
          : '📝 *Step 4/5: Contact (optional)*\n\n' +
            'Enter contact information:\n' +
            '- Phone\n' +
            '- Website\n' +
            '- Telegram @username\n' +
            '- Instagram\n\n' +
            '_You can send one or multiple_',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(lang === 'es' ? '⏭️ Omitir' : '⏭️ Skip', 'submit_skip_contact')],
            [Markup.button.callback('❌ Cancel', 'show_nearby_menu')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error skipping address:', error);
    }
  });

  bot.action('submit_skip_contact', async (ctx) => {
    try {
      await finalizeSubmission(ctx);
    } catch (error) {
      logger.error('Error skipping contact:', error);
    }
  });

  // Confirm submission
  bot.action('submit_confirm', async (ctx) => {
    try {
      await finalizeSubmission(ctx);
    } catch (error) {
      logger.error('Error confirming submission:', error);
    }
  });

  // ===========================================
  // MY SUBMISSIONS
  // ===========================================
  bot.action('my_place_submissions', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const userId = ctx.from.id.toString();

      const submissions = await NearbyPlaceService.getUserSubmissions(userId, 10);

      if (submissions.length === 0) {
        await ctx.editMessageText(
          lang === 'es'
            ? '📋 *Mis Propuestas*\n\n' +
              'No has enviado ninguna propuesta aún.'
            : '📋 *My Submissions*\n\n' +
              'You haven\'t submitted any places yet.',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback(lang === 'es' ? '➕ Proponer Lugar' : '➕ Suggest Place', 'submit_place_start')],
              [Markup.button.callback('🔙 Back', 'show_nearby_menu')],
            ]),
          }
        );
        return;
      }

      let text = lang === 'es'
        ? '📋 *Mis Propuestas*\n\n'
        : '📋 *My Submissions*\n\n';

      submissions.forEach((sub, i) => {
        const statusEmoji = sub.status === 'pending' ? '⏳'
          : sub.status === 'approved' ? '✅'
          : '❌';
        const statusText = sub.status === 'pending'
          ? (lang === 'es' ? 'Pendiente' : 'Pending')
          : sub.status === 'approved'
          ? (lang === 'es' ? 'Aprobado' : 'Approved')
          : (lang === 'es' ? 'Rechazado' : 'Rejected');

        text += `${i + 1}. ${sub.categoryEmoji || '📍'} *${escapeMarkdown(sub.name)}*\n`;
        text += `   ${statusEmoji} ${statusText}\n\n`;
      });

      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(lang === 'es' ? '➕ Nueva Propuesta' : '➕ New Submission', 'submit_place_start')],
          [Markup.button.callback('🔙 Back', 'show_nearby_menu')],
        ]),
      });
    } catch (error) {
      logger.error('Error showing user submissions:', error);
    }
  });

  // ===========================================
  // TEXT HANDLER FOR SUBMISSION FLOW
  // ===========================================
  bot.on('text', async (ctx, next) => {
    try {
      // Check if we're in submission flow
      if (!ctx.session?.temp?.placeSubmission || !ctx.session.temp.placeSubmission.step) {
        return next();
      }

      const submission = ctx.session.temp.placeSubmission;
      const lang = getLanguage(ctx);
      const text = ctx.message.text.trim();

      // Handle different steps
      switch (submission.step) {
        case 'name':
          if (text.length < 2 || text.length > 200) {
            await ctx.reply(
              lang === 'es'
                ? 'El nombre debe tener entre 2 y 200 caracteres.'
                : 'Name must be between 2 and 200 characters.'
            );
            return;
          }
          submission.name = text;
          submission.step = 'description';
          await ctx.saveSession();

          await ctx.reply(
            lang === 'es'
              ? '📝 *Paso 2/5: Descripción*\n\n' +
                'Escribe una descripción del lugar:'
              : '📝 *Step 2/5: Description*\n\n' +
                'Enter a description of the place:',
            {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.callback(lang === 'es' ? '⏭️ Omitir' : '⏭️ Skip', 'submit_skip_description')],
                [Markup.button.callback('❌ Cancel', 'show_nearby_menu')],
              ]),
            }
          );
          break;

        case 'description':
          submission.description = text.length > 0 ? text.substring(0, 1000) : null;
          submission.step = 'address';
          await ctx.saveSession();

          await ctx.reply(
            lang === 'es'
              ? '📝 *Paso 3/5: Dirección*\n\n' +
                'Escribe la dirección del lugar:\n\n' +
                '_Ejemplo: Calle 123, Ciudad, País_'
              : '📝 *Step 3/5: Address*\n\n' +
                'Enter the address of the place:\n\n' +
                '_Example: 123 Main St, City, Country_',
            {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.callback(lang === 'es' ? '⏭️ Omitir' : '⏭️ Skip', 'submit_skip_address')],
                [Markup.button.callback('❌ Cancel', 'show_nearby_menu')],
              ]),
            }
          );
          break;

        case 'address':
          submission.address = text.length > 0 ? text.substring(0, 500) : null;
          // Try to extract city
          const parts = text.split(',');
          if (parts.length >= 2) {
            submission.city = parts[parts.length - 2]?.trim() || null;
            submission.country = parts[parts.length - 1]?.trim() || null;
          }
          submission.step = 'contact';
          await ctx.saveSession();

          await ctx.reply(
            lang === 'es'
              ? '📝 *Paso 4/5: Contacto (opcional)*\n\n' +
                'Escribe información de contacto:\n' +
                '- Teléfono\n' +
                '- Website (https://...)\n' +
                '- @usuario de Telegram\n' +
                '- @instagram\n\n' +
                '_Puedes enviar uno o varios, separados por líneas_'
              : '📝 *Step 4/5: Contact (optional)*\n\n' +
                'Enter contact information:\n' +
                '- Phone\n' +
                '- Website (https://...)\n' +
                '- Telegram @username\n' +
                '- @instagram\n\n' +
                '_You can send one or multiple, separated by lines_',
            {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.callback(lang === 'es' ? '⏭️ Omitir' : '⏭️ Skip', 'submit_skip_contact')],
                [Markup.button.callback('❌ Cancel', 'show_nearby_menu')],
              ]),
            }
          );
          break;

        case 'contact':
          // Parse contact info
          const lines = text.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
              submission.website = trimmed;
            } else if (trimmed.startsWith('@')) {
              // Check if it looks like instagram or telegram
              const username = trimmed.substring(1);
              if (trimmed.toLowerCase().includes('instagram') || trimmed.toLowerCase().includes('ig')) {
                submission.instagram = username;
              } else {
                submission.telegramUsername = username;
              }
            } else if (/^\+?[\d\s\-()]+$/.test(trimmed) && trimmed.length >= 7) {
              submission.phone = trimmed;
            } else if (trimmed.includes('.') && !trimmed.includes(' ')) {
              // Might be a website without protocol
              submission.website = 'https://' + trimmed;
            } else if (trimmed.startsWith('@') === false && trimmed.length > 3) {
              // Could be telegram username or instagram
              submission.telegramUsername = submission.telegramUsername || trimmed;
            }
          }

          await finalizeSubmission(ctx);
          break;

        default:
          return next();
      }
    } catch (error) {
      logger.error('Error handling submission text:', error);
      return next();
    }
  });

  // ===========================================
  // HELPER FUNCTIONS
  // ===========================================
  async function showPlacesList(ctx, places, lang, type, categoryId) {
    try {
      let headerText = type === 'business'
        ? (lang === 'es' ? '🏪 *Negocios Comunitarios*' : '🏪 *Community Businesses*')
        : (lang === 'es' ? '📍 *Lugares Cerca de Ti*' : '📍 *Places Near You*');

      headerText += `\n\n${lang === 'es' ? 'Encontrados:' : 'Found:'} ${places.length}\n\n`;

      // Show top 10 places
      const displayPlaces = places.slice(0, 10);
      displayPlaces.forEach((place, index) => {
        const emoji = place.categoryEmoji || '📍';
        const distance = place.distance !== undefined ? ` (${place.distance.toFixed(1)} km)` : '';
        headerText += `${index + 1}. ${emoji} *${escapeMarkdown(place.name)}*${distance}\n`;
      });

      const buttons = displayPlaces.map(place => [
        Markup.button.callback(
          `${place.categoryEmoji || '📍'} ${place.name.substring(0, 25)}${place.name.length > 25 ? '...' : ''}`,
          `view_place_${place.id}`
        ),
      ]);

      // Add suggest button
      if (type === 'business') {
        buttons.push([Markup.button.callback(
          lang === 'es' ? '➕ Proponer Negocio' : '➕ Suggest Business',
          'submit_place_business'
        )]);
      } else if (categoryId) {
        buttons.push([Markup.button.callback(
          lang === 'es' ? '➕ Proponer Lugar' : '➕ Suggest Place',
          `submit_place_cat_${categoryId}`
        )]);
      }

      // Back button
      const backAction = type === 'business' ? 'show_nearby_menu' : 'nearby_places_categories';
      buttons.push([Markup.button.callback('🔙 Back', backAction)]);

      await ctx.editMessageText(headerText, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error('Error showing places list:', error);
    }
  }

  async function showNoLocationMessage(ctx, lang, backAction) {
    try {
      await ctx.editMessageText(
        lang === 'es'
          ? '📍 *Ubicación Requerida*\n\n' +
            'Necesitas compartir tu ubicación primero.\n\n' +
            'Ve a tu Perfil → Ubicación para compartir tu ubicación.'
          : '📍 *Location Required*\n\n' +
            'You need to share your location first.\n\n' +
            'Go to your Profile → Location to share your location.',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(lang === 'es' ? '📝 Ir al Perfil' : '📝 Go to Profile', 'edit_profile')],
            [Markup.button.callback('🔙 Back', backAction)],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error showing no location message:', error);
    }
  }

  async function finalizeSubmission(ctx) {
    try {
      const lang = getLanguage(ctx);
      const userId = ctx.from.id.toString();
      const submission = ctx.session.temp.placeSubmission;

      // Get user's location for the submission
      const user = await UserService.getOrCreateFromContext(ctx);
      if (user.location) {
        submission.location = {
          lat: user.location.lat,
          lng: user.location.lng,
        };
      }

      // Submit the place
      const result = await NearbyPlaceService.submitPlace(userId, {
        name: submission.name,
        description: submission.description,
        address: submission.address,
        city: submission.city,
        country: submission.country,
        location: submission.location,
        categoryId: submission.categoryId,
        placeType: submission.placeType,
        phone: submission.phone,
        website: submission.website,
        telegramUsername: submission.telegramUsername,
        instagram: submission.instagram,
      });

      // Clear session
      delete ctx.session.temp.placeSubmission;
      await ctx.saveSession();

      if (result.success) {
        await ctx.reply(
          lang === 'es'
            ? '✅ *¡Propuesta Enviada!*\n\n' +
              `Tu propuesta para "${escapeMarkdown(submission.name)}" ha sido enviada.\n\n` +
              'Un administrador la revisará pronto. Te notificaremos cuando sea aprobada.'
            : '✅ *Submission Sent!*\n\n' +
              `Your submission for "${escapeMarkdown(submission.name)}" has been sent.\n\n` +
              'An admin will review it soon. You\'ll be notified when it\'s approved.',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback(lang === 'es' ? '➕ Proponer Otro' : '➕ Suggest Another', 'submit_place_start')],
              [Markup.button.callback('🔙 Back to Nearby', 'show_nearby_menu')],
            ]),
          }
        );
      } else {
        await ctx.reply(
          lang === 'es'
            ? '❌ *Error*\n\n' +
              'Hubo un error al enviar tu propuesta. Por favor intenta de nuevo.'
            : '❌ *Error*\n\n' +
              'There was an error submitting your place. Please try again.',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔄 Try Again', 'submit_place_start')],
              [Markup.button.callback('🔙 Back', 'show_nearby_menu')],
            ]),
          }
        );
      }
    } catch (error) {
      logger.error('Error finalizing submission:', error);
    }
  }

  function escapeMarkdown(text) {
    if (!text) return '';
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }
};

module.exports = registerNearbyPlacesHandlers;
