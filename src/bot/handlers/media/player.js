const { Markup } = require('telegraf');
const MediaPlayerModel = require('../../../models/mediaPlayerModel');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage, validateUserInput } = require('../../utils/helpers');

/**
 * Media Player handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerPlayerHandlers = (bot) => {
  // Main player menu
  bot.action(['show_player', 'player_menu'], async (ctx) => {
    try {
      await showPlayerMenu(ctx);
    } catch (error) {
      logger.error('Error showing player menu:', error);
    }
  });

  // Browse music library
  bot.action('player_browse_music', async (ctx) => {
    try {
      await showLibrary(ctx, 'audio');
    } catch (error) {
      logger.error('Error showing music library:', error);
    }
  });

  // Browse video library
  bot.action('player_browse_video', async (ctx) => {
    try {
      await showLibrary(ctx, 'video');
    } catch (error) {
      logger.error('Error showing video library:', error);
    }
  });

  // My playlists
  bot.action('player_my_playlists', async (ctx) => {
    try {
      await showMyPlaylists(ctx);
    } catch (error) {
      logger.error('Error showing playlists:', error);
    }
  });

  // Browse public playlists
  bot.action('player_public_playlists', async (ctx) => {
    try {
      await showPublicPlaylists(ctx);
    } catch (error) {
      logger.error('Error showing public playlists:', error);
    }
  });

  // Now playing
  bot.action('player_now_playing', async (ctx) => {
    try {
      await showNowPlaying(ctx);
    } catch (error) {
      logger.error('Error showing now playing:', error);
    }
  });

  // Trending
  bot.action('player_trending', async (ctx) => {
    try {
      await showTrending(ctx);
    } catch (error) {
      logger.error('Error showing trending:', error);
    }
  });

  // Categories
  bot.action('player_categories', async (ctx) => {
    try {
      await showCategories(ctx);
    } catch (error) {
      logger.error('Error showing categories:', error);
    }
  });

  // Search
  bot.action('player_search', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      // Initialize session temp if needed
      if (!ctx.session.temp) {
        ctx.session.temp = {};
      }

      ctx.session.temp.waitingForMediaSearch = true;
      await ctx.saveSession();

      await ctx.editMessageText(
        t('player.enterSearchQuery', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('cancel', lang), 'player_menu')],
        ]),
      );
    } catch (error) {
      logger.error('Error starting search:', error);
    }
  });

  // Create playlist
  bot.action('player_create_playlist', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      // Initialize session temp if needed
      if (!ctx.session.temp) {
        ctx.session.temp = {};
      }

      ctx.session.temp.waitingForPlaylistName = true;
      await ctx.saveSession();

      await ctx.editMessageText(
        t('player.enterPlaylistName', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('cancel', lang), 'player_my_playlists')],
        ]),
      );
    } catch (error) {
      logger.error('Error starting playlist creation:', error);
    }
  });

  // Play media
  bot.action(/^player_play_(.+)$/, async (ctx) => {
    try {
      const mediaId = ctx.match[1];
      await playMedia(ctx, mediaId);
    } catch (error) {
      logger.error('Error playing media:', error);
    }
  });

  // Pause/Resume
  bot.action('player_toggle_pause', async (ctx) => {
    try {
      await togglePause(ctx);
    } catch (error) {
      logger.error('Error toggling pause:', error);
    }
  });

  // Stop
  bot.action('player_stop', async (ctx) => {
    try {
      await stopPlayback(ctx);
    } catch (error) {
      logger.error('Error stopping playback:', error);
    }
  });

  // Next
  bot.action('player_next', async (ctx) => {
    try {
      await playNext(ctx);
    } catch (error) {
      logger.error('Error playing next:', error);
    }
  });

  // Previous
  bot.action('player_previous', async (ctx) => {
    try {
      await playPrevious(ctx);
    } catch (error) {
      logger.error('Error playing previous:', error);
    }
  });

  // Toggle shuffle
  bot.action('player_toggle_shuffle', async (ctx) => {
    try {
      await toggleShuffle(ctx);
    } catch (error) {
      logger.error('Error toggling shuffle:', error);
    }
  });

  // Toggle repeat
  bot.action('player_toggle_repeat', async (ctx) => {
    try {
      await toggleRepeat(ctx);
    } catch (error) {
      logger.error('Error toggling repeat:', error);
    }
  });

  // Like media
  bot.action(/^player_like_(.+)$/, async (ctx) => {
    try {
      const mediaId = ctx.match[1];
      await likeMedia(ctx, mediaId);
    } catch (error) {
      logger.error('Error liking media:', error);
    }
  });

  // View playlist
  bot.action(/^player_view_playlist_(.+)$/, async (ctx) => {
    try {
      const playlistId = ctx.match[1];
      await viewPlaylist(ctx, playlistId);
    } catch (error) {
      logger.error('Error viewing playlist:', error);
    }
  });

  // Play playlist
  bot.action(/^player_play_playlist_(.+)$/, async (ctx) => {
    try {
      const playlistId = ctx.match[1];
      await playPlaylist(ctx, playlistId);
    } catch (error) {
      logger.error('Error playing playlist:', error);
    }
  });

  // Browse category
  bot.action(/^player_category_(.+)$/, async (ctx) => {
    try {
      const category = ctx.match[1];
      await showCategoryMedia(ctx, category);
    } catch (error) {
      logger.error('Error showing category media:', error);
    }
  });

  // Handle text input for search and playlist creation
  bot.on('text', async (ctx, next) => {
    if (ctx.session.temp?.waitingForMediaSearch) {
      try {
        const lang = getLanguage(ctx);
        const query = validateUserInput(ctx.message.text, 100);

        if (!query) {
          await ctx.reply(t('invalidInput', lang));
          return;
        }

        ctx.session.temp.waitingForMediaSearch = false;
        await ctx.saveSession();

        await searchMedia(ctx, query);
      } catch (error) {
        logger.error('Error processing search:', error);
      }
      return;
    }

    if (ctx.session.temp?.waitingForPlaylistName) {
      try {
        const lang = getLanguage(ctx);
        const name = validateUserInput(ctx.message.text, 100);

        if (!name) {
          await ctx.reply(t('invalidInput', lang));
          return;
        }

        ctx.session.temp.waitingForPlaylistName = false;
        await ctx.saveSession();

        // Create playlist
        const playlist = await MediaPlayerModel.createPlaylist(ctx.from.id, {
          name,
          description: '',
          isPublic: false,
        });

        if (playlist) {
          await ctx.reply(t('player.playlistCreated', lang));
          await showMyPlaylists(ctx);
        } else {
          await ctx.reply(t('error', lang));
        }
      } catch (error) {
        logger.error('Error creating playlist:', error);
      }
      return;
    }

    return next();
  });
};

/**
 * Show main player menu
 */
const showPlayerMenu = async (ctx) => {
  try {
    const lang = getLanguage(ctx);

    let text = `🎵 ${t('player.title', lang)}\n\n`;
    text += `${t('player.description', lang)}\n\n`;

    // Show current playing if any
    const playerState = await MediaPlayerModel.getPlayerState(ctx.from.id);
    if (playerState && playerState.currentMedia) {
      const media = await MediaPlayerModel.getMediaById(playerState.currentMedia);
      if (media) {
        text += `🎧 ${t('nowPlaying', lang)}: ${media.title}`;
        if (media.artist) {
          text += ` - ${media.artist}`;
        }
        text += '\n\n';
      }
    }

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(`🎵 ${t('player.browseMusic', lang)}`, 'player_browse_music'),
        Markup.button.callback(`🎬 ${t('player.browseVideo', lang)}`, 'player_browse_video'),
      ],
      [
        Markup.button.callback(`📁 ${t('player.myPlaylists', lang)}`, 'player_my_playlists'),
        Markup.button.callback(`🌍 ${t('player.publicPlaylists', lang)}`, 'player_public_playlists'),
      ],
      [
        Markup.button.callback(`🔥 ${t('player.trending', lang)}`, 'player_trending'),
        Markup.button.callback(`📂 ${t('player.categories', lang)}`, 'player_categories'),
      ],
      [
        Markup.button.callback(`🔍 ${t('player.search', lang)}`, 'player_search'),
        Markup.button.callback(`🎧 ${t('player.nowPlaying', lang)}`, 'player_now_playing'),
      ],
      [
        Markup.button.url(`✨ Materialious (Web)`, 'https://pnptv.app/materialious'),
      ],
      [Markup.button.callback(t('back', lang), 'back_to_main')],
    ]);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showPlayerMenu:', error);
  }
};

/**
 * Show media library
 */
const showLibrary = async (ctx, type) => {
  try {
    const lang = getLanguage(ctx);
    const media = await MediaPlayerModel.getMediaLibrary(type, 10);

    const typeLabel = type === 'audio' ? t('player.music', lang) : t('player.video', lang);
    let text = `${type === 'audio' ? '🎵' : '🎬'} ${typeLabel} ${t('player.library', lang)}\n\n`;

    if (media && media.length > 0) {
      media.forEach((item, index) => {
        text += `${index + 1}. ${item.title}`;
        if (item.artist) {
          text += ` - ${item.artist}`;
        }
        text += `\n   ▶️ ${item.plays} ${t('player.plays', lang)}`;
        if (item.duration) {
          text += ` | ⏱️ ${item.duration}`;
        }
        text += '\n\n';
      });
    } else {
      text += t('player.noMedia', lang);
    }

    const buttons = [];
    media.forEach((item) => {
      buttons.push([
        Markup.button.callback(
          `▶️ ${item.title.substring(0, 30)}`,
          `player_play_${item.id}`,
        ),
      ]);
    });

    buttons.push([Markup.button.callback(t('back', lang), 'player_menu')]);

    const keyboard = Markup.inlineKeyboard(buttons);
    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showLibrary:', error);
  }
};

/**
 * Show my playlists
 */
const showMyPlaylists = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const playlists = await MediaPlayerModel.getUserPlaylists(ctx.from.id);

    let text = `📁 ${t('player.myPlaylists', lang)}\n\n`;

    if (playlists && playlists.length > 0) {
      playlists.forEach((playlist, index) => {
        text += `${index + 1}. ${playlist.name}\n`;
        text += `   📀 ${playlist.mediaItems.length} ${t('player.tracks', lang)}\n\n`;
      });
    } else {
      text += t('player.noPlaylists', lang);
    }

    const buttons = [];
    playlists.forEach((playlist) => {
      buttons.push([
        Markup.button.callback(
          `📁 ${playlist.name.substring(0, 30)}`,
          `player_view_playlist_${playlist.id}`,
        ),
      ]);
    });

    buttons.push([
      Markup.button.callback(`➕ ${t('player.createPlaylist', lang)}`, 'player_create_playlist'),
    ]);
    buttons.push([Markup.button.callback(t('back', lang), 'player_menu')]);

    const keyboard = Markup.inlineKeyboard(buttons);
    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showMyPlaylists:', error);
  }
};

/**
 * Show public playlists
 */
const showPublicPlaylists = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const playlists = await MediaPlayerModel.getPublicPlaylists(10);

    let text = `🌍 ${t('player.publicPlaylists', lang)}\n\n`;

    if (playlists && playlists.length > 0) {
      playlists.forEach((playlist, index) => {
        text += `${index + 1}. ${playlist.name}\n`;
        text += `   📀 ${playlist.mediaItems.length} ${t('player.tracks', lang)}`;
        text += ` | 👥 ${playlist.followers} ${t('player.followers', lang)}\n\n`;
      });
    } else {
      text += t('player.noPublicPlaylists', lang);
    }

    const buttons = [];
    playlists.forEach((playlist) => {
      buttons.push([
        Markup.button.callback(
          `📁 ${playlist.name.substring(0, 30)}`,
          `player_view_playlist_${playlist.id}`,
        ),
      ]);
    });

    buttons.push([Markup.button.callback(t('back', lang), 'player_menu')]);

    const keyboard = Markup.inlineKeyboard(buttons);
    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showPublicPlaylists:', error);
  }
};

/**
 * Show now playing with controls
 */
const showNowPlaying = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const playerState = await MediaPlayerModel.getPlayerState(ctx.from.id);

    let text = `🎧 ${t('player.nowPlaying', lang)}\n\n`;

    if (playerState && playerState.currentMedia) {
      const media = await MediaPlayerModel.getMediaById(playerState.currentMedia);
      if (media) {
        text += `🎼 ${media.title}\n`;
        if (media.artist) {
          text += `🎤 ${t('radio.artist', lang)}: ${media.artist}\n`;
        }
        if (media.duration) {
          text += `⏱️ ${t('radio.duration', lang)}: ${media.duration}\n`;
        }

        text += `\n📊 ${media.plays} ${t('player.plays', lang)} | ❤️ ${media.likes} ${t('player.likes', lang)}\n\n`;

        // Player controls
        text += `🎚️ ${t('player.controls', lang)}:\n`;
        text += `${playerState.isPlaying ? '▶️' : '⏸️'} ${playerState.isPlaying ? t('player.playing', lang) : t('player.paused', lang)}\n`;
        text += `🔀 ${t('player.shuffle', lang)}: ${playerState.shuffle ? '✅' : '❌'}\n`;
        text += `🔁 ${t('player.repeat', lang)}: ${playerState.repeat ? '✅' : '❌'}\n`;
        text += `🔊 ${t('player.volume', lang)}: ${playerState.volume}%\n`;
      } else {
        text += t('player.nothingPlaying', lang);
      }
    } else {
      text += t('player.nothingPlaying', lang);
    }

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('⏮️', 'player_previous'),
        Markup.button.callback(
          playerState?.isPlaying ? '⏸️' : '▶️',
          'player_toggle_pause',
        ),
        Markup.button.callback('⏭️', 'player_next'),
      ],
      [
        Markup.button.callback(
          `🔀 ${playerState?.shuffle ? '✅' : '❌'}`,
          'player_toggle_shuffle',
        ),
        Markup.button.callback('⏹️', 'player_stop'),
        Markup.button.callback(
          `🔁 ${playerState?.repeat ? '✅' : '❌'}`,
          'player_toggle_repeat',
        ),
      ],
      [
        Markup.button.callback(
          `❤️ ${t('player.like', lang)}`,
          `player_like_${playerState?.currentMedia || 'none'}`,
        ),
      ],
      [Markup.button.callback(t('refresh', lang), 'player_now_playing')],
      [Markup.button.callback(t('back', lang), 'player_menu')],
    ]);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showNowPlaying:', error);
  }
};

/**
 * Show trending media
 */
const showTrending = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const trending = await MediaPlayerModel.getTrendingMedia('all', 10);

    let text = `🔥 ${t('player.trending', lang)}\n\n`;

    if (trending && trending.length > 0) {
      trending.forEach((item, index) => {
        text += `${index + 1}. ${item.title}`;
        if (item.artist) {
          text += ` - ${item.artist}`;
        }
        text += `\n   🔥 ${item.plays} ${t('player.plays', lang)} | ❤️ ${item.likes} ${t('player.likes', lang)}\n\n`;
      });
    } else {
      text += t('player.noTrending', lang);
    }

    const buttons = [];
    trending.forEach((item) => {
      buttons.push([
        Markup.button.callback(
          `▶️ ${item.title.substring(0, 30)}`,
          `player_play_${item.id}`,
        ),
      ]);
    });

    buttons.push([Markup.button.callback(t('back', lang), 'player_menu')]);

    const keyboard = Markup.inlineKeyboard(buttons);
    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showTrending:', error);
  }
};

/**
 * Show categories
 */
const showCategories = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const categories = await MediaPlayerModel.getCategories();

    let text = `📂 ${t('player.categories', lang)}\n\n`;
    text += t('player.selectCategory', lang);

    const buttons = [];
    categories.forEach((category) => {
      buttons.push([
        Markup.button.callback(
          `📂 ${category.charAt(0).toUpperCase() + category.slice(1)}`,
          `player_category_${category}`,
        ),
      ]);
    });

    buttons.push([Markup.button.callback(t('back', lang), 'player_menu')]);

    const keyboard = Markup.inlineKeyboard(buttons);
    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showCategories:', error);
  }
};

/**
 * Show category media
 */
const showCategoryMedia = async (ctx, category) => {
  try {
    const lang = getLanguage(ctx);
    const media = await MediaPlayerModel.getMediaByCategory(category, 10);

    let text = `📂 ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;

    if (media && media.length > 0) {
      media.forEach((item, index) => {
        text += `${index + 1}. ${item.title}`;
        if (item.artist) {
          text += ` - ${item.artist}`;
        }
        text += `\n   ▶️ ${item.plays} ${t('player.plays', lang)}\n\n`;
      });
    } else {
      text += t('player.noCategoryMedia', lang);
    }

    const buttons = [];
    media.forEach((item) => {
      buttons.push([
        Markup.button.callback(
          `▶️ ${item.title.substring(0, 30)}`,
          `player_play_${item.id}`,
        ),
      ]);
    });

    buttons.push([Markup.button.callback(t('back', lang), 'player_categories')]);

    const keyboard = Markup.inlineKeyboard(buttons);
    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showCategoryMedia:', error);
  }
};

/**
 * Search media
 */
const searchMedia = async (ctx, query) => {
  try {
    const lang = getLanguage(ctx);
    const results = await MediaPlayerModel.searchMedia(query, 'all', 10);

    let text = `🔍 ${t('player.searchResults', lang)}: "${query}"\n\n`;

    if (results && results.length > 0) {
      results.forEach((item, index) => {
        text += `${index + 1}. ${item.title}`;
        if (item.artist) {
          text += ` - ${item.artist}`;
        }
        text += `\n   ${item.type === 'audio' ? '🎵' : '🎬'} ${item.type}\n\n`;
      });
    } else {
      text += t('player.noResults', lang);
    }

    const buttons = [];
    results.forEach((item) => {
      buttons.push([
        Markup.button.callback(
          `▶️ ${item.title.substring(0, 30)}`,
          `player_play_${item.id}`,
        ),
      ]);
    });

    buttons.push([Markup.button.callback(t('back', lang), 'player_menu')]);

    const keyboard = Markup.inlineKeyboard(buttons);
    await ctx.reply(text, keyboard);
  } catch (error) {
    logger.error('Error in searchMedia:', error);
  }
};

/**
 * Play media
 */
const playMedia = async (ctx, mediaId) => {
  try {
    const lang = getLanguage(ctx);
    const media = await MediaPlayerModel.getMediaById(mediaId);

    if (!media) {
      await ctx.answerCbQuery(t('player.mediaNotFound', lang));
      return;
    }

    // Update player state
    await MediaPlayerModel.updatePlayerState(ctx.from.id, {
      currentMedia: mediaId,
      isPlaying: true,
    });

    // Increment play count
    await MediaPlayerModel.incrementPlayCount(mediaId);

    // Send media
    let text = `🎧 ${t('player.nowPlaying', lang)}\n\n`;
    text += `${media.title}`;
    if (media.artist) {
      text += ` - ${media.artist}`;
    }

    if (media.type === 'audio') {
      // Send audio
      await ctx.replyWithAudio(media.url, {
        title: media.title,
        performer: media.artist || 'PNP Radio',
        caption: text,
      });
    } else {
      // Send video
      await ctx.replyWithVideo(media.url, {
        caption: text,
      });
    }

    await ctx.answerCbQuery(`▶️ ${t('player.playing', lang)}: ${media.title}`);
    await showNowPlaying(ctx);
  } catch (error) {
    logger.error('Error in playMedia:', error);
    const lang = getLanguage(ctx);
    await ctx.answerCbQuery(t('error', lang));
  }
};

/**
 * Toggle pause/play
 */
const togglePause = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const playerState = await MediaPlayerModel.getPlayerState(ctx.from.id);

    const newState = !playerState.isPlaying;
    await MediaPlayerModel.updatePlayerState(ctx.from.id, {
      isPlaying: newState,
    });

    await ctx.answerCbQuery(
      newState ? `▶️ ${t('player.resumed', lang)}` : `⏸️ ${t('player.paused', lang)}`,
    );
    await showNowPlaying(ctx);
  } catch (error) {
    logger.error('Error in togglePause:', error);
  }
};

/**
 * Stop playback
 */
const stopPlayback = async (ctx) => {
  try {
    const lang = getLanguage(ctx);

    await MediaPlayerModel.updatePlayerState(ctx.from.id, {
      currentMedia: null,
      isPlaying: false,
      position: 0,
    });

    await ctx.answerCbQuery(`⏹️ ${t('player.stopped', lang)}`);
    await showNowPlaying(ctx);
  } catch (error) {
    logger.error('Error in stopPlayback:', error);
  }
};

/**
 * Play next track
 */
const playNext = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const playerState = await MediaPlayerModel.getPlayerState(ctx.from.id);

    if (playerState.queue && playerState.queue.length > 0) {
      const nextIndex = (playerState.position + 1) % playerState.queue.length;
      const nextMediaId = playerState.queue[nextIndex];

      await MediaPlayerModel.updatePlayerState(ctx.from.id, {
        currentMedia: nextMediaId,
        position: nextIndex,
        isPlaying: true,
      });

      await playMedia(ctx, nextMediaId);
    } else {
      await ctx.answerCbQuery(t('player.noQueue', lang));
    }
  } catch (error) {
    logger.error('Error in playNext:', error);
  }
};

/**
 * Play previous track
 */
const playPrevious = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const playerState = await MediaPlayerModel.getPlayerState(ctx.from.id);

    if (playerState.queue && playerState.queue.length > 0) {
      const prevIndex = playerState.position - 1 < 0
        ? playerState.queue.length - 1
        : playerState.position - 1;
      const prevMediaId = playerState.queue[prevIndex];

      await MediaPlayerModel.updatePlayerState(ctx.from.id, {
        currentMedia: prevMediaId,
        position: prevIndex,
        isPlaying: true,
      });

      await playMedia(ctx, prevMediaId);
    } else {
      await ctx.answerCbQuery(t('player.noQueue', lang));
    }
  } catch (error) {
    logger.error('Error in playPrevious:', error);
  }
};

/**
 * Toggle shuffle
 */
const toggleShuffle = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const playerState = await MediaPlayerModel.getPlayerState(ctx.from.id);

    const newState = !playerState.shuffle;
    await MediaPlayerModel.updatePlayerState(ctx.from.id, {
      shuffle: newState,
    });

    await ctx.answerCbQuery(
      `🔀 ${t('player.shuffle', lang)}: ${newState ? '✅' : '❌'}`,
    );
    await showNowPlaying(ctx);
  } catch (error) {
    logger.error('Error in toggleShuffle:', error);
  }
};

/**
 * Toggle repeat
 */
const toggleRepeat = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const playerState = await MediaPlayerModel.getPlayerState(ctx.from.id);

    const newState = !playerState.repeat;
    await MediaPlayerModel.updatePlayerState(ctx.from.id, {
      repeat: newState,
    });

    await ctx.answerCbQuery(
      `🔁 ${t('player.repeat', lang)}: ${newState ? '✅' : '❌'}`,
    );
    await showNowPlaying(ctx);
  } catch (error) {
    logger.error('Error in toggleRepeat:', error);
  }
};

/**
 * Like media
 */
const likeMedia = async (ctx, mediaId) => {
  try {
    const lang = getLanguage(ctx);

    if (mediaId === 'none') {
      await ctx.answerCbQuery(t('player.nothingPlaying', lang));
      return;
    }

    await MediaPlayerModel.toggleLike(mediaId, true);
    await ctx.answerCbQuery(`❤️ ${t('player.liked', lang)}`);
    await showNowPlaying(ctx);
  } catch (error) {
    logger.error('Error in likeMedia:', error);
  }
};

/**
 * View playlist
 */
const viewPlaylist = async (ctx, playlistId) => {
  try {
    const lang = getLanguage(ctx);
    const db = require('../../../config/firebase').getFirestore();
    const playlistDoc = await db.collection('media_playlists').doc(playlistId).get();

    if (!playlistDoc.exists) {
      await ctx.answerCbQuery(t('player.playlistNotFound', lang));
      return;
    }

    const playlist = playlistDoc.data();
    let text = `📁 ${playlist.name}\n\n`;

    if (playlist.description) {
      text += `${playlist.description}\n\n`;
    }

    text += `📀 ${playlist.mediaItems.length} ${t('player.tracks', lang)}\n\n`;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          `▶️ ${t('player.playPlaylist', lang)}`,
          `player_play_playlist_${playlistId}`,
        ),
      ],
      [Markup.button.callback(t('back', lang), 'player_my_playlists')],
    ]);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in viewPlaylist:', error);
  }
};

/**
 * Play playlist
 */
const playPlaylist = async (ctx, playlistId) => {
  try {
    const lang = getLanguage(ctx);
    const db = require('../../../config/firebase').getFirestore();
    const playlistDoc = await db.collection('media_playlists').doc(playlistId).get();

    if (!playlistDoc.exists) {
      await ctx.answerCbQuery(t('player.playlistNotFound', lang));
      return;
    }

    const playlist = playlistDoc.data();

    if (playlist.mediaItems.length === 0) {
      await ctx.answerCbQuery(t('player.emptyPlaylist', lang));
      return;
    }

    // Set playlist as queue
    await MediaPlayerModel.updatePlayerState(ctx.from.id, {
      currentPlaylist: playlistId,
      queue: playlist.mediaItems,
      position: 0,
      currentMedia: playlist.mediaItems[0],
      isPlaying: true,
    });

    await playMedia(ctx, playlist.mediaItems[0]);
    await ctx.answerCbQuery(`▶️ ${t('player.playingPlaylist', lang)}: ${playlist.name}`);
  } catch (error) {
    logger.error('Error in playPlaylist:', error);
  }
};

module.exports = registerPlayerHandlers;
