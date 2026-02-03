const { Markup } = require('telegraf');
const PermissionService = require('../../services/permissionService');
const XPostService = require('../../services/xPostService');
const XOAuthService = require('../../services/xOAuthService');
const logger = require('../../../utils/logger');
const sanitize = require('../../../utils/sanitizer');

const SESSION_KEY = 'xPostWizard';
const X_MAX_TEXT_LENGTH = 280;

// Wizard steps
const STEPS = {
  MENU: 'menu',
  SELECT_ACCOUNT: 'select_account',
  COMPOSE_TEXT: 'compose_text',
  ADD_MEDIA: 'add_media',
  PREVIEW: 'preview',
  SCHEDULE: 'schedule',
  VIEW_SCHEDULED: 'view_scheduled',
  VIEW_HISTORY: 'view_history',
};

const getSession = (ctx) => {
  if (!ctx.session) ctx.session = {};
  if (!ctx.session.temp) ctx.session.temp = {};
  if (!ctx.session.temp[SESSION_KEY]) {
    ctx.session.temp[SESSION_KEY] = {
      step: STEPS.MENU,
      accountId: null,
      accountHandle: null,
      text: null,
      mediaUrl: null,
      mediaType: null,
      scheduledAt: null,
    };
  }
  return ctx.session.temp[SESSION_KEY];
};

const clearSession = (ctx) => {
  if (ctx.session?.temp) {
    ctx.session.temp[SESSION_KEY] = null;
  }
};

const safeAnswer = async (ctx, text, options = {}) => {
  if (!ctx?.answerCbQuery) return;
  try {
    if (text) {
      await ctx.answerCbQuery(text, options);
    } else {
      await ctx.answerCbQuery();
    }
  } catch (error) {
    const desc = error?.response?.description || error?.message || '';
    if (desc.includes('query is too old') || desc.includes('query ID is invalid')) {
      return;
    }
    logger.debug('Callback query answer failed', { desc });
  }
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getStatusEmoji = (status) => {
  switch (status) {
    case 'scheduled': return '🕐';
    case 'sending': return '📤';
    case 'sent': return '✅';
    case 'failed': return '❌';
    default: return '❓';
  }
};

// ==================== MENU ====================

const showXPostMenu = async (ctx, edit = false) => {
  const session = getSession(ctx);
  session.step = STEPS.MENU;
  await ctx.saveSession?.();

  const accounts = await XPostService.listActiveAccounts();
  const scheduledPosts = await XPostService.getScheduledPosts();
  const recentPosts = await XPostService.getRecentPosts(5);

  let message = '🐦 **Panel de Publicación en X**\n\n';

  if (accounts.length === 0) {
    message += '⚠️ No hay cuentas de X configuradas.\n';
    message += 'Conecta una cuenta para empezar a publicar.\n\n';
  } else {
    message += `📊 **Cuentas activas:** ${accounts.length}\n`;
    accounts.forEach(acc => {
      message += `  • @${acc.handle}\n`;
    });
    message += '\n';
  }

  if (scheduledPosts.length > 0) {
    message += `🕐 **Posts programados:** ${scheduledPosts.length}\n\n`;
  }

  if (recentPosts.length > 0) {
    message += '📜 **Últimos posts:**\n';
    recentPosts.forEach(post => {
      const status = getStatusEmoji(post.status);
      const date = formatDate(post.sent_at || post.scheduled_at);
      const textPreview = (post.text || '').substring(0, 30) + (post.text?.length > 30 ? '...' : '');
      message += `  ${status} ${date} - ${textPreview}\n`;
    });
  }

  const buttons = [
    [Markup.button.callback('✍️ Crear Nuevo Post', 'xpost_new')],
    [Markup.button.callback('🕐 Ver Programados', 'xpost_view_scheduled')],
    [Markup.button.callback('📜 Historial', 'xpost_view_history')],
    [Markup.button.callback('⚙️ Gestionar Cuentas', 'admin_x_accounts_configure')],
    [Markup.button.callback('◀️ Volver al Panel', 'admin_cancel')],
  ];

  const options = {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons),
  };

  if (edit && ctx.callbackQuery) {
    await ctx.editMessageText(message, options).catch(() => ctx.reply(message, options));
  } else {
    await ctx.reply(message, options);
  }
};

// ==================== SELECT ACCOUNT ====================

const showAccountSelection = async (ctx, edit = false) => {
  const session = getSession(ctx);
  session.step = STEPS.SELECT_ACCOUNT;
  await ctx.saveSession?.();

  const accounts = await XPostService.listActiveAccounts();

  if (accounts.length === 0) {
    const message = '🐦 **Seleccionar Cuenta**\n\n'
      + '⚠️ No hay cuentas de X configuradas.\n\n'
      + 'Primero debes conectar una cuenta.';

    const buttons = [
      [Markup.button.callback('➕ Conectar cuenta X', 'xpost_connect_account')],
      [Markup.button.callback('◀️ Volver', 'xpost_menu')],
    ];

    const options = { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) };
    if (edit && ctx.callbackQuery) {
      await ctx.editMessageText(message, options).catch(() => ctx.reply(message, options));
    } else {
      await ctx.reply(message, options);
    }
    return;
  }

  let message = '🐦 **Seleccionar Cuenta**\n\n';
  message += 'Elige la cuenta desde la cual publicar:\n\n';

  const buttons = accounts.map(acc => {
    const selected = session.accountId === acc.account_id;
    const label = `${selected ? '✅' : '⬜'} @${acc.handle}`;
    return [Markup.button.callback(label, `xpost_select_account_${acc.account_id}`)];
  });

  buttons.push([Markup.button.callback('➕ Conectar nueva cuenta', 'xpost_connect_account')]);
  buttons.push([Markup.button.callback('◀️ Volver', 'xpost_menu')]);

  const options = { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) };
  if (edit && ctx.callbackQuery) {
    await ctx.editMessageText(message, options).catch(() => ctx.reply(message, options));
  } else {
    await ctx.reply(message, options);
  }
};

// ==================== COMPOSE TEXT ====================

const showComposeText = async (ctx, edit = false) => {
  const session = getSession(ctx);
  session.step = STEPS.COMPOSE_TEXT;
  await ctx.saveSession?.();

  let message = '✍️ **Redactar Post**\n\n';

  if (session.accountHandle) {
    message += `📤 Publicando como: @${session.accountHandle}\n\n`;
  }

  if (session.text) {
    const charCount = session.text.length;
    const charStatus = charCount <= X_MAX_TEXT_LENGTH ? '✅' : '⚠️';
    message += `📝 **Texto actual** (${charCount}/${X_MAX_TEXT_LENGTH} ${charStatus}):\n`;
    message += `\`\`\`\n${session.text}\n\`\`\`\n\n`;
    message += 'Envía un nuevo mensaje para reemplazar el texto.\n';
  } else {
    message += '📝 Envía el texto que deseas publicar.\n';
    message += `⚠️ Máximo ${X_MAX_TEXT_LENGTH} caracteres.\n`;
  }

  const buttons = [];

  if (session.text) {
    buttons.push([Markup.button.callback('▶️ Continuar', 'xpost_add_media')]);
    buttons.push([Markup.button.callback('🗑️ Borrar texto', 'xpost_clear_text')]);
  }

  buttons.push([Markup.button.callback('◀️ Volver', 'xpost_select_account')]);
  buttons.push([Markup.button.callback('❌ Cancelar', 'xpost_menu')]);

  const options = { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) };
  if (edit && ctx.callbackQuery) {
    await ctx.editMessageText(message, options).catch(() => ctx.reply(message, options));
  } else {
    await ctx.reply(message, options);
  }
};

// ==================== ADD MEDIA ====================

const showAddMedia = async (ctx, edit = false) => {
  const session = getSession(ctx);
  session.step = STEPS.ADD_MEDIA;
  await ctx.saveSession?.();

  let message = '🖼️ **Agregar Media (Opcional)**\n\n';

  if (session.mediaUrl) {
    message += `✅ Media agregada: ${session.mediaType || 'imagen'}\n\n`;
    message += '📤 Envía otra imagen para reemplazar o continúa.\n';
  } else {
    message += '📤 Envía una imagen para agregar al post.\n';
    message += 'O presiona "Continuar sin media" para omitir.\n';
  }

  const buttons = [];

  buttons.push([Markup.button.callback('▶️ Continuar sin media', 'xpost_preview')]);

  if (session.mediaUrl) {
    buttons.push([Markup.button.callback('🗑️ Eliminar media', 'xpost_clear_media')]);
  }

  buttons.push([Markup.button.callback('◀️ Volver', 'xpost_compose')]);
  buttons.push([Markup.button.callback('❌ Cancelar', 'xpost_menu')]);

  const options = { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) };
  if (edit && ctx.callbackQuery) {
    await ctx.editMessageText(message, options).catch(() => ctx.reply(message, options));
  } else {
    await ctx.reply(message, options);
  }
};

// ==================== PREVIEW ====================

const showPreview = async (ctx, edit = false) => {
  const session = getSession(ctx);
  session.step = STEPS.PREVIEW;
  await ctx.saveSession?.();

  const charCount = (session.text || '').length;
  const charStatus = charCount <= X_MAX_TEXT_LENGTH ? '✅' : '⚠️';
  const willTruncate = charCount > X_MAX_TEXT_LENGTH;

  let message = '👁️ **Vista Previa del Post**\n\n';
  message += `📤 Cuenta: @${session.accountHandle || 'No seleccionada'}\n`;
  message += `📊 Caracteres: ${charCount}/${X_MAX_TEXT_LENGTH} ${charStatus}\n`;

  if (willTruncate) {
    message += `⚠️ El texto será truncado a ${X_MAX_TEXT_LENGTH} caracteres.\n`;
  }

  if (session.mediaUrl) {
    message += `🖼️ Media: Incluida\n`;
  }

  message += '\n━━━━━━━━━━━━━━━━━━━━\n';
  message += session.text || '(Sin texto)';
  message += '\n━━━━━━━━━━━━━━━━━━━━\n\n';

  message += '¿Qué deseas hacer?';

  const buttons = [
    [
      Markup.button.callback('📤 Publicar Ahora', 'xpost_send_now'),
      Markup.button.callback('🕐 Programar', 'xpost_schedule'),
    ],
    [Markup.button.callback('✏️ Editar Texto', 'xpost_compose')],
    [Markup.button.callback('◀️ Volver', 'xpost_add_media')],
    [Markup.button.callback('❌ Cancelar', 'xpost_menu')],
  ];

  const options = { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) };
  if (edit && ctx.callbackQuery) {
    await ctx.editMessageText(message, options).catch(() => ctx.reply(message, options));
  } else {
    await ctx.reply(message, options);
  }
};

// ==================== SCHEDULE ====================

const showSchedule = async (ctx, edit = false) => {
  const session = getSession(ctx);
  session.step = STEPS.SCHEDULE;
  await ctx.saveSession?.();

  let message = '🕐 **Programar Publicación**\n\n';
  message += 'Selecciona cuándo deseas publicar:\n\n';

  // Quick schedule options
  const buttons = [
    [
      Markup.button.callback('⏰ En 30 min', 'xpost_schedule_30m'),
      Markup.button.callback('⏰ En 1 hora', 'xpost_schedule_1h'),
    ],
    [
      Markup.button.callback('⏰ En 2 horas', 'xpost_schedule_2h'),
      Markup.button.callback('⏰ En 4 horas', 'xpost_schedule_4h'),
    ],
    [
      Markup.button.callback('📅 Mañana 9:00', 'xpost_schedule_tomorrow_9'),
      Markup.button.callback('📅 Mañana 18:00', 'xpost_schedule_tomorrow_18'),
    ],
    [Markup.button.callback('🗓️ Fecha personalizada', 'xpost_schedule_custom')],
    [Markup.button.callback('◀️ Volver', 'xpost_preview')],
    [Markup.button.callback('❌ Cancelar', 'xpost_menu')],
  ];

  const options = { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) };
  if (edit && ctx.callbackQuery) {
    await ctx.editMessageText(message, options).catch(() => ctx.reply(message, options));
  } else {
    await ctx.reply(message, options);
  }
};

const showCustomSchedule = async (ctx) => {
  const session = getSession(ctx);
  session.step = 'schedule_custom';
  await ctx.saveSession?.();

  const message = '🗓️ **Programar Fecha Personalizada**\n\n'
    + 'Envía la fecha y hora en formato:\n'
    + '`DD/MM/YYYY HH:MM`\n\n'
    + 'Ejemplo: `25/12/2024 15:30`\n\n'
    + '⚠️ La hora debe ser en formato 24h (UTC-5).';

  const buttons = [
    [Markup.button.callback('◀️ Volver', 'xpost_schedule')],
    [Markup.button.callback('❌ Cancelar', 'xpost_menu')],
  ];

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons),
  });
};

// ==================== VIEW SCHEDULED ====================

const showScheduledPosts = async (ctx, edit = false, page = 0) => {
  const session = getSession(ctx);
  session.step = STEPS.VIEW_SCHEDULED;
  await ctx.saveSession?.();

  const posts = await XPostService.getScheduledPosts();
  const pageSize = 5;
  const totalPages = Math.ceil(posts.length / pageSize);
  const pagePosts = posts.slice(page * pageSize, (page + 1) * pageSize);

  let message = '🕐 **Posts Programados**\n\n';

  if (posts.length === 0) {
    message += '📭 No hay posts programados.\n';
  } else {
    message += `📊 Total: ${posts.length} posts\n\n`;

    pagePosts.forEach((post, idx) => {
      const num = page * pageSize + idx + 1;
      const date = formatDate(post.scheduled_at);
      const handle = post.handle || 'desconocido';
      const textPreview = (post.text || '').substring(0, 40) + (post.text?.length > 40 ? '...' : '');

      message += `**${num}.** @${handle}\n`;
      message += `   📅 ${date}\n`;
      message += `   📝 ${textPreview}\n\n`;
    });

    if (totalPages > 1) {
      message += `\nPágina ${page + 1} de ${totalPages}`;
    }
  }

  const buttons = [];

  // Pagination
  if (totalPages > 1) {
    const navButtons = [];
    if (page > 0) {
      navButtons.push(Markup.button.callback('◀️ Anterior', `xpost_scheduled_page_${page - 1}`));
    }
    if (page < totalPages - 1) {
      navButtons.push(Markup.button.callback('Siguiente ▶️', `xpost_scheduled_page_${page + 1}`));
    }
    if (navButtons.length > 0) {
      buttons.push(navButtons);
    }
  }

  // Cancel buttons for each post on current page
  if (pagePosts.length > 0) {
    pagePosts.forEach((post, idx) => {
      const num = page * pageSize + idx + 1;
      buttons.push([
        Markup.button.callback(`🗑️ Cancelar #${num}`, `xpost_cancel_${post.post_id}`),
      ]);
    });
  }

  buttons.push([Markup.button.callback('🔄 Actualizar', 'xpost_view_scheduled')]);
  buttons.push([Markup.button.callback('◀️ Volver', 'xpost_menu')]);

  const options = { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) };
  if (edit && ctx.callbackQuery) {
    await ctx.editMessageText(message, options).catch(() => ctx.reply(message, options));
  } else {
    await ctx.reply(message, options);
  }
};

// ==================== VIEW HISTORY ====================

const showHistory = async (ctx, edit = false, page = 0) => {
  const session = getSession(ctx);
  session.step = STEPS.VIEW_HISTORY;
  await ctx.saveSession?.();

  const posts = await XPostService.getPostHistory(20);
  const pageSize = 5;
  const totalPages = Math.ceil(posts.length / pageSize);
  const pagePosts = posts.slice(page * pageSize, (page + 1) * pageSize);

  let message = '📜 **Historial de Posts**\n\n';

  if (posts.length === 0) {
    message += '📭 No hay posts en el historial.\n';
  } else {
    pagePosts.forEach((post, idx) => {
      const num = page * pageSize + idx + 1;
      const status = getStatusEmoji(post.status);
      const date = formatDate(post.sent_at || post.scheduled_at || post.created_at);
      const handle = post.handle || 'desconocido';
      const textPreview = (post.text || '').substring(0, 40) + (post.text?.length > 40 ? '...' : '');

      message += `**${num}.** ${status} @${handle}\n`;
      message += `   📅 ${date}\n`;
      message += `   📝 ${textPreview}\n`;

      if (post.status === 'failed' && post.error_message) {
        const errorPreview = post.error_message.substring(0, 50);
        message += `   ❌ ${errorPreview}\n`;
      }

      message += '\n';
    });

    if (totalPages > 1) {
      message += `\nPágina ${page + 1} de ${totalPages}`;
    }
  }

  const buttons = [];

  // Pagination
  if (totalPages > 1) {
    const navButtons = [];
    if (page > 0) {
      navButtons.push(Markup.button.callback('◀️ Anterior', `xpost_history_page_${page - 1}`));
    }
    if (page < totalPages - 1) {
      navButtons.push(Markup.button.callback('Siguiente ▶️', `xpost_history_page_${page + 1}`));
    }
    if (navButtons.length > 0) {
      buttons.push(navButtons);
    }
  }

  buttons.push([Markup.button.callback('🔄 Actualizar', 'xpost_view_history')]);
  buttons.push([Markup.button.callback('◀️ Volver', 'xpost_menu')]);

  const options = { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) };
  if (edit && ctx.callbackQuery) {
    await ctx.editMessageText(message, options).catch(() => ctx.reply(message, options));
  } else {
    await ctx.reply(message, options);
  }
};

// ==================== ACTIONS ====================

const sendNow = async (ctx) => {
  const session = getSession(ctx);

  if (!session.accountId || !session.text) {
    await ctx.reply('❌ Faltan datos. Por favor, completa el proceso.');
    return showXPostMenu(ctx);
  }

  await safeAnswer(ctx, '📤 Publicando...');

  try {
    const result = await XPostService.sendPostNow({
      accountId: session.accountId,
      adminId: ctx.from.id,
      adminUsername: ctx.from.username,
      text: session.text,
      mediaUrl: session.mediaUrl,
    });

    const tweetId = result.response?.data?.id;
    const tweetUrl = tweetId ? `https://x.com/i/status/${tweetId}` : null;

    let message = '✅ **Post Publicado Exitosamente**\n\n';
    message += `📤 Cuenta: @${session.accountHandle}\n`;

    if (result.truncated) {
      message += '⚠️ El texto fue truncado a 280 caracteres.\n';
    }

    if (tweetUrl) {
      message += `\n🔗 [Ver en X](${tweetUrl})`;
    }

    clearSession(ctx);

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✍️ Crear otro post', 'xpost_new')],
        [Markup.button.callback('◀️ Volver al menú', 'xpost_menu')],
      ]),
    });

    logger.info('X post sent successfully via wizard', {
      adminId: ctx.from.id,
      accountHandle: session.accountHandle,
      tweetId,
    });
  } catch (error) {
    logger.error('Error sending X post via wizard:', error);

    let errorMsg = '❌ **Error al Publicar**\n\n';
    errorMsg += `Cuenta: @${session.accountHandle}\n`;
    errorMsg += `Error: ${error.message || 'Error desconocido'}\n\n`;
    errorMsg += 'Por favor, intenta de nuevo más tarde.';

    await ctx.editMessageText(errorMsg, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Reintentar', 'xpost_send_now')],
        [Markup.button.callback('◀️ Volver', 'xpost_preview')],
      ]),
    });
  }
};

const schedulePost = async (ctx, minutes) => {
  const session = getSession(ctx);

  if (!session.accountId || !session.text) {
    await ctx.reply('❌ Faltan datos. Por favor, completa el proceso.');
    return showXPostMenu(ctx);
  }

  const scheduledAt = new Date(Date.now() + minutes * 60 * 1000);

  await safeAnswer(ctx, '🕐 Programando...');

  try {
    const postId = await XPostService.createPostJob({
      accountId: session.accountId,
      adminId: ctx.from.id,
      adminUsername: ctx.from.username,
      text: session.text,
      mediaUrl: session.mediaUrl,
      scheduledAt,
      status: 'scheduled',
    });

    let message = '✅ **Post Programado Exitosamente**\n\n';
    message += `📤 Cuenta: @${session.accountHandle}\n`;
    message += `📅 Fecha: ${formatDate(scheduledAt)}\n`;
    message += `🆔 ID: ${postId.substring(0, 8)}...\n\n`;
    message += 'El post se publicará automáticamente en la fecha indicada.';

    clearSession(ctx);

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🕐 Ver programados', 'xpost_view_scheduled')],
        [Markup.button.callback('✍️ Crear otro post', 'xpost_new')],
        [Markup.button.callback('◀️ Volver al menú', 'xpost_menu')],
      ]),
    });

    logger.info('X post scheduled via wizard', {
      adminId: ctx.from.id,
      accountHandle: session.accountHandle,
      scheduledAt,
      postId,
    });
  } catch (error) {
    logger.error('Error scheduling X post via wizard:', error);

    await ctx.editMessageText(
      `❌ **Error al Programar**\n\n${error.message || 'Error desconocido'}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Reintentar', 'xpost_schedule')],
          [Markup.button.callback('◀️ Volver', 'xpost_preview')],
        ]),
      },
    );
  }
};

const scheduleForTomorrow = async (ctx, hour) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(hour, 0, 0, 0);

  const minutesUntil = Math.round((tomorrow.getTime() - Date.now()) / 60000);
  await schedulePost(ctx, minutesUntil);
};

const cancelScheduledPost = async (ctx, postId) => {
  await safeAnswer(ctx, '🗑️ Cancelando...');

  try {
    await XPostService.cancelScheduledPost(postId);

    await ctx.editMessageText(
      '✅ **Post Cancelado**\n\nEl post programado ha sido eliminado.',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('◀️ Volver', 'xpost_view_scheduled')],
        ]),
      },
    );

    logger.info('Scheduled X post cancelled', { postId, adminId: ctx.from.id });
  } catch (error) {
    logger.error('Error cancelling scheduled X post:', error);
    await ctx.answerCbQuery('❌ Error al cancelar').catch(() => {});
  }
};

// ==================== TEXT HANDLER ====================

const handleTextInput = async (ctx, next) => {
  const session = getSession(ctx);

  if (!session.step) {
    return next();
  }

  // Only handle text in compose step
  if (session.step === STEPS.COMPOSE_TEXT) {
    const text = ctx.message?.text;
    if (!text) return next();

    session.text = text;
    await ctx.saveSession?.();

    const charCount = text.length;
    const status = charCount <= X_MAX_TEXT_LENGTH ? '✅' : '⚠️';

    await ctx.reply(
      `${status} Texto guardado (${charCount}/${X_MAX_TEXT_LENGTH} caracteres)`,
    );

    return showComposeText(ctx);
  }

  // Handle custom schedule date input
  if (session.step === 'schedule_custom') {
    const text = ctx.message?.text?.trim();
    if (!text) return next();

    // Parse DD/MM/YYYY HH:MM
    const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
    if (!match) {
      await ctx.reply(
        '❌ Formato inválido.\n\nUsa: `DD/MM/YYYY HH:MM`\nEjemplo: `25/12/2024 15:30`',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const [, day, month, year, hour, minute] = match.map(Number);
    const scheduledAt = new Date(year, month - 1, day, hour, minute);

    if (scheduledAt <= new Date()) {
      await ctx.reply('❌ La fecha debe ser en el futuro.');
      return;
    }

    const minutesUntil = Math.round((scheduledAt.getTime() - Date.now()) / 60000);
    session.step = STEPS.PREVIEW;
    await ctx.saveSession?.();

    return schedulePost(ctx, minutesUntil);
  }

  return next();
};

// ==================== REGISTER HANDLERS ====================

const registerXPostWizardHandlers = (bot) => {
  // Menu
  bot.action('xpost_menu', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    await safeAnswer(ctx);
    await showXPostMenu(ctx, true);
  });

  // New post flow
  bot.action('xpost_new', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    clearSession(ctx);
    await safeAnswer(ctx);
    await showAccountSelection(ctx, true);
  });

  // Account selection
  bot.action('xpost_select_account', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    await safeAnswer(ctx);
    await showAccountSelection(ctx, true);
  });

  bot.action(/^xpost_select_account_(.+)$/, async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');

    const accountId = ctx.match[1];
    const accounts = await XPostService.listActiveAccounts();
    const account = accounts.find(a => a.account_id === accountId);

    if (!account) {
      await ctx.answerCbQuery('❌ Cuenta no encontrada');
      return;
    }

    const session = getSession(ctx);
    session.accountId = account.account_id;
    session.accountHandle = account.handle;
    await ctx.saveSession?.();

    await safeAnswer(ctx, `✅ @${account.handle}`);
    await showComposeText(ctx, true);
  });

  bot.action('xpost_connect_account', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');

    try {
      const authUrl = await XOAuthService.createAuthUrl({
        adminId: ctx.from.id,
        adminUsername: ctx.from.username || null,
      });
      await safeAnswer(ctx);
      await ctx.reply(
        '🔗 **Conectar cuenta de X**\n\n'
        + '1) Abre el enlace de abajo.\n'
        + '2) Autoriza la cuenta.\n'
        + '3) Regresa y selecciona la cuenta.\n\n'
        + authUrl,
        { parse_mode: 'Markdown' },
      );
    } catch (error) {
      logger.error('Error starting X OAuth from wizard:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // Compose text
  bot.action('xpost_compose', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    await safeAnswer(ctx);
    await showComposeText(ctx, true);
  });

  bot.action('xpost_clear_text', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');

    const session = getSession(ctx);
    session.text = null;
    await ctx.saveSession?.();

    await safeAnswer(ctx, '🗑️ Texto eliminado');
    await showComposeText(ctx, true);
  });

  // Add media
  bot.action('xpost_add_media', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    await safeAnswer(ctx);
    await showAddMedia(ctx, true);
  });

  bot.action('xpost_clear_media', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');

    const session = getSession(ctx);
    session.mediaUrl = null;
    session.mediaType = null;
    await ctx.saveSession?.();

    await safeAnswer(ctx, '🗑️ Media eliminada');
    await showAddMedia(ctx, true);
  });

  // Preview
  bot.action('xpost_preview', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    await safeAnswer(ctx);
    await showPreview(ctx, true);
  });

  // Send now
  bot.action('xpost_send_now', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    await sendNow(ctx);
  });

  // Schedule
  bot.action('xpost_schedule', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    await safeAnswer(ctx);
    await showSchedule(ctx, true);
  });

  bot.action('xpost_schedule_30m', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    await schedulePost(ctx, 30);
  });

  bot.action('xpost_schedule_1h', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    await schedulePost(ctx, 60);
  });

  bot.action('xpost_schedule_2h', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    await schedulePost(ctx, 120);
  });

  bot.action('xpost_schedule_4h', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    await schedulePost(ctx, 240);
  });

  bot.action('xpost_schedule_tomorrow_9', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    await scheduleForTomorrow(ctx, 9);
  });

  bot.action('xpost_schedule_tomorrow_18', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    await scheduleForTomorrow(ctx, 18);
  });

  bot.action('xpost_schedule_custom', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    await safeAnswer(ctx);
    await showCustomSchedule(ctx);
  });

  // View scheduled
  bot.action('xpost_view_scheduled', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    await safeAnswer(ctx);
    await showScheduledPosts(ctx, true);
  });

  bot.action(/^xpost_scheduled_page_(\d+)$/, async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    const page = parseInt(ctx.match[1], 10);
    await safeAnswer(ctx);
    await showScheduledPosts(ctx, true, page);
  });

  bot.action(/^xpost_cancel_(.+)$/, async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    const postId = ctx.match[1];
    await cancelScheduledPost(ctx, postId);
  });

  // View history
  bot.action('xpost_view_history', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    await safeAnswer(ctx);
    await showHistory(ctx, true);
  });

  bot.action(/^xpost_history_page_(\d+)$/, async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    const page = parseInt(ctx.match[1], 10);
    await safeAnswer(ctx);
    await showHistory(ctx, true, page);
  });

  logger.info('X post wizard handlers registered');
};

module.exports = {
  registerXPostWizardHandlers,
  showXPostMenu,
  handleTextInput,
  getSession,
  STEPS,
};
