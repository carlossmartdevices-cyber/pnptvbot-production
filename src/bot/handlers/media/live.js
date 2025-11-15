const { Markup } = require('telegraf');
const { t } = require('../../../utils/i18n');
const UserService = require('../../services/userService');
const logger = require('../../../utils/logger');
const { getLanguage, validateUserInput } = require('../../utils/helpers');

/**
 * Live streaming handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerLiveHandlers = (bot) => {
  // Show live streams menu
  bot.action('show_live', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      await ctx.editMessageText(
        t('liveTitle', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('startLive', lang), 'live_start')],
          [Markup.button.callback(t('viewStreams', lang), 'live_view')],
          [Markup.button.callback(t('myStreams', lang), 'live_my_streams')],
          [Markup.button.callback(t('back', lang), 'back_to_main')],
        ]),
      );
    } catch (error) {
      logger.error('Error showing live menu:', error);
    }
  });

  // Start live stream
  bot.action('live_start', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const hasSubscription = await UserService.hasActiveSubscription(ctx.from.id);

      if (!hasSubscription) {
        await ctx.editMessageText(
          t('subscriptionRequired', lang),
          Markup.inlineKeyboard([
            [Markup.button.callback(t('subscribe', lang), 'show_subscription_plans')],
            [Markup.button.callback(t('back', lang), 'show_live')],
          ]),
        );
        return;
      }

      ctx.session.temp.creatingLiveStream = true;
      ctx.session.temp.liveStreamStep = 'title';
      await ctx.saveSession();

      await ctx.editMessageText(
        t('enterStreamTitle', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('cancel', lang), 'show_live')],
        ]),
      );
    } catch (error) {
      logger.error('Error starting live stream:', error);
    }
  });

  // View active streams
  bot.action('live_view', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      // In production, fetch from database
      const activeStreams = [
        {
          id: '1', title: 'Music Session', host: 'DJ Alex', viewers: 42, thumbnail: null,
        },
        {
          id: '2', title: 'Talk Show', host: 'Maria', viewers: 28, thumbnail: null,
        },
      ];

      if (activeStreams.length === 0) {
        await ctx.editMessageText(
          t('noActiveStreams', lang),
          Markup.inlineKeyboard([
            [Markup.button.callback(t('back', lang), 'show_live')],
          ]),
        );
        return;
      }

      let message = `${t('viewStreams', lang)}\n\n`;
      const buttons = [];

      activeStreams.forEach((stream) => {
        message += `🎤 ${stream.title}\n👤 ${stream.host}\n👥 ${stream.viewers} viewers\n\n`;
        buttons.push([
          Markup.button.callback(`▶️ ${stream.title}`, `live_join_${stream.id}`),
        ]);
      });

      buttons.push([Markup.button.callback(t('back', lang), 'show_live')]);

      await ctx.editMessageText(message, Markup.inlineKeyboard(buttons));
    } catch (error) {
      logger.error('Error viewing streams:', error);
    }
  });

  // My streams
  bot.action('live_my_streams', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      await ctx.editMessageText(
        `${t('myStreams', lang)}\n\nYour stream history will appear here.`,
        Markup.inlineKeyboard([
          [Markup.button.callback(t('back', lang), 'show_live')],
        ]),
      );
    } catch (error) {
      logger.error('Error showing my streams:', error);
    }
  });

  // Join stream
  bot.action(/^live_join_(.+)$/, async (ctx) => {
    try {
      const streamId = ctx.match[1];
      const lang = getLanguage(ctx);

      // In production, generate Agora token and stream URL
      const streamUrl = `https://stream.pnptv.com/live/${streamId}`;

      await ctx.editMessageText(
        `${t('joinStream', lang)}\n\n🎤 Live Stream\n\n📺 Watch here: ${streamUrl}`,
        Markup.inlineKeyboard([
          [Markup.button.url('📺 Watch Stream', streamUrl)],
          [Markup.button.callback(t('back', lang), 'live_view')],
        ]),
      );
    } catch (error) {
      logger.error('Error joining stream:', error);
    }
  });

  // Handle stream creation text input
  bot.on('text', async (ctx, next) => {
    if (ctx.session.temp?.creatingLiveStream) {
      try {
        const lang = getLanguage(ctx);
        const step = ctx.session.temp.liveStreamStep;

        if (step === 'title') {
          const title = validateUserInput(ctx.message.text, 100);

          if (!title) {
            await ctx.reply(t('invalidInput', lang) + '\n' + t('enterStreamTitle', lang));
            return;
          }

          ctx.session.temp.liveStreamTitle = title;
          ctx.session.temp.liveStreamStep = 'paid';
          await ctx.saveSession();

          await ctx.reply(
            t('streamPaid', lang),
            Markup.inlineKeyboard([
              [
                Markup.button.callback('✅ Yes', 'live_paid_yes'),
                Markup.button.callback('❌ No (Free)', 'live_paid_no'),
              ],
              [Markup.button.callback(t('cancel', lang), 'show_live')],
            ]),
          );
          return;
        }

        if (step === 'price') {
          const price = parseFloat(ctx.message.text);
          if (Number.isNaN(price) || price <= 0) {
            await ctx.reply(t('invalidInput', lang));
            return;
          }

          ctx.session.temp.liveStreamPrice = price;
          await createLiveStream(ctx);
          return;
        }
      } catch (error) {
        logger.error('Error in live stream creation:', error);
      }
      return;
    }

    return next();
  });

  // Handle paid/free selection
  bot.action('live_paid_yes', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.liveStreamIsPaid = true;
      ctx.session.temp.liveStreamStep = 'price';
      await ctx.saveSession();

      await ctx.editMessageText(
        t('streamPrice', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('cancel', lang), 'show_live')],
        ]),
      );
    } catch (error) {
      logger.error('Error in paid stream:', error);
    }
  });

  bot.action('live_paid_no', async (ctx) => {
    try {
      ctx.session.temp.liveStreamIsPaid = false;
      ctx.session.temp.liveStreamPrice = 0;
      await ctx.saveSession();

      await createLiveStream(ctx);
    } catch (error) {
      logger.error('Error in free stream:', error);
    }
  });
};

/**
 * Create live stream
 * @param {Context} ctx - Telegraf context
 */
const createLiveStream = async (ctx) => {
  try {
    const lang = getLanguage(ctx);

    // Validate title exists
    const title = ctx.session.temp?.liveStreamTitle;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      logger.error('Missing or invalid live stream title');
      await ctx.reply(t('error', lang) + '\nPlease try creating the stream again.');
      ctx.session.temp.creatingLiveStream = false;
      await ctx.saveSession();
      return;
    }

    const isPaid = ctx.session.temp.liveStreamIsPaid;
    const price = ctx.session.temp.liveStreamPrice || 0;

    await ctx.editMessageText(t('loading', lang));

    // In production, create stream via Agora API and save to database
    const streamId = Date.now().toString();
    const streamUrl = `https://stream.pnptv.com/live/${streamId}`;

    // Clear session temp data
    ctx.session.temp.creatingLiveStream = false;
    ctx.session.temp.liveStreamTitle = null;
    ctx.session.temp.liveStreamIsPaid = null;
    ctx.session.temp.liveStreamPrice = null;
    await ctx.saveSession();

    await ctx.editMessageText(
      t('streamCreated', lang, { url: streamUrl }),
      Markup.inlineKeyboard([
        [Markup.button.url('📺 Start Streaming', streamUrl)],
        [Markup.button.callback(t('back', lang), 'show_live')],
      ]),
    );

    logger.info('Live stream created', {
      userId: ctx.from.id, streamId, title, isPaid, price,
    });
  } catch (error) {
    logger.error('Error creating live stream:', error);
    const lang = getLanguage(ctx);
    await ctx.reply(t('error', lang));
  }
};

module.exports = registerLiveHandlers;
