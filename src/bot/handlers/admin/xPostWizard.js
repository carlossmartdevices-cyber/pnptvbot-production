const { Markup } = require('telegraf');
const PermissionService = require('../../services/permissionService');
const XPostService = require('../../services/xPostService');
const XOAuthService = require('../../services/xOAuthService');
const GrokService = require('../../services/grokService');
const logger = require('../../../utils/logger');
const sanitize = require('../../../utils/sanitizer');

const SESSION_KEY = 'xPostWizard';
const X_MAX_TEXT_LENGTH = 280;
const X_REQUIRED_LINKS = ['t.me/pnplatinotv_bot', 'pnptv.app/lifetime100'];

// Wizard steps
const STEPS = {
  MENU: 'menu',
  SELECT_ACCOUNT: 'select_account',
  POST_TYPE: 'post_type',
  AI_OPTIONS: 'ai_options',
  TEMPLATES: 'templates',
  COMPOSE_TEXT: 'compose_text',
  AI_PROMPT: 'ai_prompt',
  AI_PROMPT_EN: 'ai_prompt_en',
  AI_PROMPT_ES: 'ai_prompt_es',
  ADD_MEDIA: 'add_media',
  PREVIEW: 'preview',
  SCHEDULE: 'schedule',
  VIEW_SCHEDULED: 'view_scheduled',
  VIEW_HISTORY: 'view_history',
};

// Post types
const POST_TYPES = {
  REGULAR: 'regular',
  SALES: 'sales',
  VIDEO: 'video',
};

// AI Language options
const AI_LANGUAGES = {
  EN: 'en',
  ES: 'es',
  BOTH: 'both',
};

// Post templates
const POST_TEMPLATES = {
  LIVE_SHOW: {
    id: 'live_show',
    label: '🔴 Live Show',
    promptEn: 'Announce a live show happening now on PNP Latino TV. Intense energy, invite viewers to join.',
    promptEs: 'Anuncia un show en vivo ahora en PNP Latino TV. Energía intensa, invita a los viewers a unirse.',
  },
  LIFETIME_PROMO: {
    id: 'lifetime_promo',
    label: '💎 Lifetime Promo',
    promptEn: 'Promote the lifetime membership at $100. Emphasize unlimited access, exclusive content, and urgency.',
    promptEs: 'Promociona la membresía lifetime a $100. Enfatiza acceso ilimitado, contenido exclusivo y urgencia.',
  },
  COMMUNITY_UPDATE: {
    id: 'community_update',
    label: '📢 Community Update',
    promptEn: 'Share an exciting community update. New features, upcoming events, or milestones.',
    promptEs: 'Comparte una actualización emocionante de la comunidad. Nuevas funciones, eventos o logros.',
  },
  NEW_CONTENT: {
    id: 'new_content',
    label: '🎬 New Content',
    promptEn: 'Announce new exclusive content just uploaded. Tease what viewers will see, create curiosity.',
    promptEs: 'Anuncia nuevo contenido exclusivo recién subido. Adelanta lo que verán, crea curiosidad.',
  },
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
      textEn: null,
      textEs: null,
      mediaUrl: null,
      mediaFileId: null,
      mediaType: null,
      scheduledAt: null,
      // New properties
      postType: POST_TYPES.REGULAR,
      aiLanguage: AI_LANGUAGES.BOTH,
      includeLex: false,
      includeSantino: true,
      lastAiPrompt: null,
      selectedTemplate: null,
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
    [Markup.button.callback('⚙️ Gestionar Cuentas', 'admin_x_accounts_configure_x')],
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

// ==================== POST TYPE SELECTION ====================

const showPostTypeSelection = async (ctx, edit = false) => {
  const session = getSession(ctx);
  session.step = STEPS.POST_TYPE;
  await ctx.saveSession?.();

  let message = '📝 **Tipo de Post**\n\n';
  message += `📤 Publicando como: @${session.accountHandle || 'No seleccionada'}\n\n`;
  message += 'Selecciona el tipo de contenido que deseas crear:\n';

  const getTypeIcon = (type) => {
    if (session.postType === type) return '✅';
    return '⬜';
  };

  const buttons = [
    [Markup.button.callback(`${getTypeIcon(POST_TYPES.REGULAR)} 🐦 Post Regular`, 'xpost_type_regular')],
    [Markup.button.callback(`${getTypeIcon(POST_TYPES.SALES)} 💰 Post de Ventas`, 'xpost_type_sales')],
    [Markup.button.callback(`${getTypeIcon(POST_TYPES.VIDEO)} 🎬 Descripción de Video`, 'xpost_type_video')],
    [Markup.button.callback('▶️ Continuar', 'xpost_ai_options')],
    [Markup.button.callback('◀️ Volver', 'xpost_select_account')],
    [Markup.button.callback('❌ Cancelar', 'xpost_menu')],
  ];

  const options = { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) };
  if (edit && ctx.callbackQuery) {
    await ctx.editMessageText(message, options).catch(() => ctx.reply(message, options));
  } else {
    await ctx.reply(message, options);
  }
};

// ==================== AI OPTIONS ====================

const showAIOptions = async (ctx, edit = false) => {
  const session = getSession(ctx);
  session.step = STEPS.AI_OPTIONS;
  await ctx.saveSession?.();

  const postTypeLabel = {
    [POST_TYPES.REGULAR]: '🐦 Post Regular',
    [POST_TYPES.SALES]: '💰 Post de Ventas',
    [POST_TYPES.VIDEO]: '🎬 Descripción de Video',
  }[session.postType] || '🐦 Post';

  let message = '🤖 **Opciones de AI**\n\n';
  message += `📤 Cuenta: @${session.accountHandle || 'No seleccionada'}\n`;
  message += `📝 Tipo: ${postTypeLabel}\n\n`;
  message += '**Idioma del contenido:**\n';

  const getLangIcon = (lang) => session.aiLanguage === lang ? '✅' : '⬜';
  const getPersonaIcon = (enabled) => enabled ? '✅' : '⬜';

  message += '\n**Personas a incluir:**\n';
  message += `${getPersonaIcon(session.includeLex)} Lex - Leather master dominante\n`;
  message += `${getPersonaIcon(session.includeSantino)} Santino - Meth Daddy satánico\n`;

  const buttons = [
    // Language selection
    [
      Markup.button.callback(`${getLangIcon(AI_LANGUAGES.EN)} 🇬🇧 EN`, 'xpost_lang_en'),
      Markup.button.callback(`${getLangIcon(AI_LANGUAGES.ES)} 🇪🇸 ES`, 'xpost_lang_es'),
      Markup.button.callback(`${getLangIcon(AI_LANGUAGES.BOTH)} 🌎 Ambos`, 'xpost_lang_both'),
    ],
    // Persona toggles
    [
      Markup.button.callback(`${getPersonaIcon(session.includeLex)} Lex`, 'xpost_toggle_lex'),
      Markup.button.callback(`${getPersonaIcon(session.includeSantino)} Santino`, 'xpost_toggle_santino'),
    ],
    // Templates
    [Markup.button.callback('📋 Usar Plantilla', 'xpost_templates')],
    // Continue to compose
    [Markup.button.callback('✍️ Escribir Prompt', 'xpost_compose')],
    [Markup.button.callback('◀️ Volver', 'xpost_post_type')],
    [Markup.button.callback('❌ Cancelar', 'xpost_menu')],
  ];

  const options = { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) };
  if (edit && ctx.callbackQuery) {
    await ctx.editMessageText(message, options).catch(() => ctx.reply(message, options));
  } else {
    await ctx.reply(message, options);
  }
};

// ==================== TEMPLATES ====================

const showTemplates = async (ctx, edit = false) => {
  const session = getSession(ctx);
  session.step = STEPS.TEMPLATES;
  await ctx.saveSession?.();

  let message = '📋 **Plantillas Rápidas**\n\n';
  message += 'Selecciona una plantilla para generar contenido automáticamente:\n\n';

  Object.values(POST_TEMPLATES).forEach(tpl => {
    message += `${tpl.label}\n`;
  });

  const buttons = Object.values(POST_TEMPLATES).map(tpl => [
    Markup.button.callback(tpl.label, `xpost_template_${tpl.id}`),
  ]);

  buttons.push([Markup.button.callback('◀️ Volver', 'xpost_ai_options')]);
  buttons.push([Markup.button.callback('❌ Cancelar', 'xpost_menu')]);

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

  const postTypeLabel = {
    [POST_TYPES.REGULAR]: '🐦 Post Regular',
    [POST_TYPES.SALES]: '💰 Post de Ventas',
    [POST_TYPES.VIDEO]: '🎬 Descripción de Video',
  }[session.postType] || '🐦 Post';

  let message = '✍️ **Redactar Post**\n\n';
  message += `📤 Cuenta: @${session.accountHandle || 'No seleccionada'}\n`;
  message += `📝 Tipo: ${postTypeLabel}\n`;

  // Show AI config if set
  const langLabel = {
    [AI_LANGUAGES.EN]: '🇬🇧 Inglés',
    [AI_LANGUAGES.ES]: '🇪🇸 Español',
    [AI_LANGUAGES.BOTH]: '🌎 Ambos',
  }[session.aiLanguage] || '🌎 Ambos';
  message += `🌐 Idioma AI: ${langLabel}\n`;

  const personas = [];
  if (session.includeLex) personas.push('Lex');
  if (session.includeSantino) personas.push('Santino');
  if (personas.length > 0) {
    message += `👤 Personas: ${personas.join(', ')}\n`;
  }

  message += '\n';

  // Show bilingual text if both languages
  if (session.aiLanguage === AI_LANGUAGES.BOTH && (session.textEn || session.textEs)) {
    if (session.textEn) {
      const charCountEn = session.textEn.length;
      const charStatusEn = charCountEn <= X_MAX_TEXT_LENGTH ? '✅' : '⚠️';
      message += `🇬🇧 **English** (${charCountEn}/${X_MAX_TEXT_LENGTH} ${charStatusEn}):\n`;
      message += `\`\`\`\n${session.textEn}\n\`\`\`\n\n`;
    }
    if (session.textEs) {
      const charCountEs = session.textEs.length;
      const charStatusEs = charCountEs <= X_MAX_TEXT_LENGTH ? '✅' : '⚠️';
      message += `🇪🇸 **Español** (${charCountEs}/${X_MAX_TEXT_LENGTH} ${charStatusEs}):\n`;
      message += `\`\`\`\n${session.textEs}\n\`\`\`\n\n`;
    }
    message += '💡 Selecciona qué versión publicar o edita manualmente.\n';
  } else if (session.text) {
    const charCount = session.text.length;
    const charStatus = charCount <= X_MAX_TEXT_LENGTH ? '✅' : '⚠️';
    message += `📝 **Texto actual** (${charCount}/${X_MAX_TEXT_LENGTH} ${charStatus}):\n`;
    message += `\`\`\`\n${session.text}\n\`\`\`\n\n`;
    if (charCount > X_MAX_TEXT_LENGTH) {
      message += `🚨 **¡ATENCIÓN!** El texto excede el límite de ${X_MAX_TEXT_LENGTH} caracteres por ${charCount - X_MAX_TEXT_LENGTH} chars.\n`;
      message += 'Será truncado al publicar.\n\n';
    }
    message += 'Envía un nuevo mensaje para reemplazar el texto.\n';
  } else {
    message += '📝 Envía el texto que deseas publicar o usa AI para generarlo.\n';
    message += `⚠️ Máximo ${X_MAX_TEXT_LENGTH} caracteres.\n`;
  }

  const buttons = [];

  // AI generation button
  buttons.push([Markup.button.callback('🤖 Generar con AI', 'xpost_ai_generate')]);

  // If we have AI-generated text, show regenerate option
  if (session.lastAiPrompt) {
    buttons.push([Markup.button.callback('🔄 Regenerar AI', 'xpost_ai_regenerate')]);
  }

  // If bilingual, show language selection buttons
  if (session.aiLanguage === AI_LANGUAGES.BOTH && (session.textEn || session.textEs)) {
    buttons.push([
      Markup.button.callback('🇬🇧 Usar EN', 'xpost_use_en'),
      Markup.button.callback('🇪🇸 Usar ES', 'xpost_use_es'),
    ]);
  }

  // Legacy single language AI buttons
  buttons.push([
    Markup.button.callback('🤖 AI (EN)', 'xpost_ai_en'),
    Markup.button.callback('🤖 AI (ES)', 'xpost_ai_es'),
  ]);

  if (session.text) {
    buttons.push([Markup.button.callback('▶️ Continuar a Media', 'xpost_add_media')]);
    buttons.push([Markup.button.callback('🗑️ Borrar texto', 'xpost_clear_text')]);
  }

  buttons.push([Markup.button.callback('◀️ Volver', 'xpost_ai_options')]);
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
    message += '📤 Envía otra media para reemplazar o continúa.\n';
    message += 'ℹ️ La media se subirá a X al publicar.\n';
  } else {
    message += '📤 Envía una imagen o video para agregar al post.\n';
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
  const charStatus = charCount <= X_MAX_TEXT_LENGTH ? '✅' : '🚨';
  const willTruncate = charCount > X_MAX_TEXT_LENGTH;
  const excessChars = charCount - X_MAX_TEXT_LENGTH;

  const postTypeLabel = {
    [POST_TYPES.REGULAR]: '🐦 Post Regular',
    [POST_TYPES.SALES]: '💰 Post de Ventas',
    [POST_TYPES.VIDEO]: '🎬 Descripción de Video',
  }[session.postType] || '🐦 Post';

  let message = '👁️ **Vista Previa del Post**\n\n';
  message += `📤 Cuenta: @${session.accountHandle || 'No seleccionada'}\n`;
  message += `📝 Tipo: ${postTypeLabel}\n`;

  // Character count with warning
  if (willTruncate) {
    message += `\n🚨🚨🚨 **¡LÍMITE EXCEDIDO!** 🚨🚨🚨\n`;
    message += `📊 Caracteres: ${charCount}/${X_MAX_TEXT_LENGTH} (${excessChars} chars de más)\n`;
    message += `⚠️ El texto será TRUNCADO automáticamente.\n`;
  } else {
    const remaining = X_MAX_TEXT_LENGTH - charCount;
    message += `📊 Caracteres: ${charCount}/${X_MAX_TEXT_LENGTH} ${charStatus}`;
    if (remaining <= 20) {
      message += ` (⚠️ solo ${remaining} restantes)`;
    }
    message += '\n';
  }

  // Media indicator with more detail
  if (session.mediaUrl) {
    const mediaTypeEmoji = {
      'photo': '🖼️ Imagen',
      'video': '🎥 Video',
      'animation': '🎞️ GIF',
      'image': '🖼️ Imagen',
    }[session.mediaType] || '📎 Media';
    message += `${mediaTypeEmoji}: Incluida ✅\n`;
  } else {
    message += `📎 Media: Sin media\n`;
  }

  message += '\n━━━━━━━━━━━━━━━━━━━━\n';
  message += session.text || '(Sin texto)';
  message += '\n━━━━━━━━━━━━━━━━━━━━\n\n';

  if (willTruncate) {
    message += '⚠️ **Texto truncado se verá así:**\n';
    const truncatedPreview = (session.text || '').slice(0, X_MAX_TEXT_LENGTH - 1) + '…';
    message += `\`${truncatedPreview}\`\n\n`;
  }

  message += '¿Qué deseas hacer?';

  const buttons = [
    [
      Markup.button.callback('📤 Publicar Ahora', 'xpost_send_now'),
      Markup.button.callback('🕐 Programar', 'xpost_schedule'),
    ],
    [Markup.button.callback('✏️ Editar Texto', 'xpost_compose')],
    [Markup.button.callback('🖼️ Editar Media', 'xpost_add_media')],
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
    message += '💡 **Acciones:** 🔄 Reintentar fallidos | 📋 Copiar texto\n\n';

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

  // Add retry and copy buttons for each post
  pagePosts.forEach((post, idx) => {
    const num = page * pageSize + idx + 1;
    const postButtons = [];

    // Retry button only for failed posts
    if (post.status === 'failed') {
      postButtons.push(Markup.button.callback(`🔄 #${num}`, `xpost_retry_${post.post_id}`));
    }

    // Copy button for all posts
    postButtons.push(Markup.button.callback(`📋 #${num}`, `xpost_copy_${post.post_id}`));

    if (postButtons.length > 0) {
      buttons.push(postButtons);
    }
  });

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

// ==================== AI GENERATION HELPERS ====================

const generateAIContent = async (ctx, prompt, isRegenerate = false) => {
  const session = getSession(ctx);

  session.lastAiPrompt = prompt;
  await ctx.saveSession?.();

  await ctx.reply('⏳ Generando contenido con Grok AI...');

  try {
    const postType = session.postType || POST_TYPES.REGULAR;
    const aiLanguage = session.aiLanguage || AI_LANGUAGES.BOTH;
    const includeLex = session.includeLex || false;
    const includeSantino = session.includeSantino !== false; // default true

    // Determine which generation function to use based on post type
    if (postType === POST_TYPES.SALES) {
      const result = await GrokService.generateSalesPost({
        prompt,
        includeLex,
        includeSantino,
      });

      if (aiLanguage === AI_LANGUAGES.BOTH) {
        session.textEn = result.en;
        session.textEs = result.es;
        session.text = result.en; // Default to English
      } else if (aiLanguage === AI_LANGUAGES.EN) {
        session.text = result.en;
        session.textEn = result.en;
        session.textEs = null;
      } else {
        session.text = result.es;
        session.textEs = result.es;
        session.textEn = null;
      }
    } else if (postType === POST_TYPES.VIDEO) {
      const result = await GrokService.generateVideoDescription({
        prompt,
        includeLex,
        includeSantino,
      });

      if (aiLanguage === AI_LANGUAGES.BOTH) {
        session.textEn = result.en;
        session.textEs = result.es;
        session.text = result.en;
      } else if (aiLanguage === AI_LANGUAGES.EN) {
        session.text = result.en;
        session.textEn = result.en;
        session.textEs = null;
      } else {
        session.text = result.es;
        session.textEs = result.es;
        session.textEn = null;
      }
    } else {
      // Regular X post - use xPost mode with ensureRequiredLinks
      if (aiLanguage === AI_LANGUAGES.BOTH) {
        // Generate both languages
        const [enResult, esResult] = await Promise.all([
          GrokService.chat({
            mode: 'xPost',
            language: 'English',
            prompt: `User request: ${prompt}`,
            maxTokens: 180,
          }),
          GrokService.chat({
            mode: 'xPost',
            language: 'Spanish',
            prompt: `Solicitud del usuario: ${prompt}`,
            maxTokens: 180,
          }),
        ]);

        const enNormalized = XPostService.ensureRequiredLinks(enResult, X_REQUIRED_LINKS, X_MAX_TEXT_LENGTH);
        const esNormalized = XPostService.ensureRequiredLinks(esResult, X_REQUIRED_LINKS, X_MAX_TEXT_LENGTH);

        session.textEn = enNormalized.text;
        session.textEs = esNormalized.text;
        session.text = enNormalized.text; // Default to English
      } else {
        const language = aiLanguage === AI_LANGUAGES.EN ? 'English' : 'Spanish';
        const promptText = aiLanguage === AI_LANGUAGES.EN
          ? `User request: ${prompt}`
          : `Solicitud del usuario: ${prompt}`;

        const aiText = await GrokService.chat({
          mode: 'xPost',
          language,
          prompt: promptText,
          maxTokens: 180,
        });

        const normalized = XPostService.ensureRequiredLinks(aiText, X_REQUIRED_LINKS, X_MAX_TEXT_LENGTH);
        session.text = normalized.text;

        if (aiLanguage === AI_LANGUAGES.EN) {
          session.textEn = normalized.text;
          session.textEs = null;
        } else {
          session.textEs = normalized.text;
          session.textEn = null;
        }
      }
    }

    session.step = STEPS.COMPOSE_TEXT;
    await ctx.saveSession?.();

    const genLabel = isRegenerate ? 'regenerado' : 'generado';
    if (aiLanguage === AI_LANGUAGES.BOTH) {
      await ctx.reply(`✅ Contenido ${genLabel} en ambos idiomas. Selecciona cuál usar.`);
    } else {
      await ctx.reply(`✅ Contenido ${genLabel} exitosamente.`);
    }

    return showComposeText(ctx);
  } catch (error) {
    logger.error('Error generating AI content:', error);
    await ctx.reply(`❌ Error generando contenido: ${error.message || 'desconocido'}`);
    return showComposeText(ctx);
  }
};

// ==================== TEXT HANDLER ====================

const handleTextInput = async (ctx, next) => {
  const session = getSession(ctx);

  if (!session.step) {
    return next();
  }

  // Handle new AI prompt step
  if (session.step === STEPS.AI_PROMPT) {
    const prompt = ctx.message?.text?.trim();
    if (!prompt) return next();
    return generateAIContent(ctx, prompt);
  }

  // Legacy: handle single language AI prompts
  if (session.step === STEPS.AI_PROMPT_EN || session.step === STEPS.AI_PROMPT_ES) {
    const prompt = ctx.message?.text?.trim();
    if (!prompt) return next();

    const language = session.step === STEPS.AI_PROMPT_EN ? 'English' : 'Spanish';
    try {
      await ctx.reply('⏳ Generando texto con Grok...');

      const aiText = await GrokService.chat({
        mode: 'xPost',
        language,
        prompt: `Solicitud del usuario: ${prompt}`,
        maxTokens: 180,
      });

      const normalized = XPostService.ensureRequiredLinks(
        aiText,
        X_REQUIRED_LINKS,
        X_MAX_TEXT_LENGTH,
      );
      session.text = normalized.text;
      session.lastAiPrompt = prompt;
      session.step = STEPS.COMPOSE_TEXT;
      await ctx.saveSession?.();

      const notice = normalized.truncated
        ? '✅ Texto generado con Grok. ⚠️ Se truncó a 280 caracteres para incluir links.'
        : '✅ Texto generado con Grok (links incluidos).';
      await ctx.reply(notice);
      return showComposeText(ctx);
    } catch (error) {
      logger.error('Error generating X post with Grok:', error);
      await ctx.reply(`❌ Error generando texto con Grok: ${error.message || 'desconocido'}`);
      return;
    }
  }

  if (session.step === STEPS.COMPOSE_TEXT) {
    const text = ctx.message?.text;
    if (!text) return next();

    session.text = text;
    // Clear bilingual texts if user manually inputs text
    session.textEn = null;
    session.textEs = null;
    await ctx.saveSession?.();

    const charCount = text.length;
    const status = charCount <= X_MAX_TEXT_LENGTH ? '✅' : '⚠️';
    let response = `${status} Texto guardado (${charCount}/${X_MAX_TEXT_LENGTH} caracteres)`;

    if (charCount > X_MAX_TEXT_LENGTH) {
      response += `\n🚨 ¡Excede el límite por ${charCount - X_MAX_TEXT_LENGTH} caracteres!`;
    }

    await ctx.reply(response);

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

const handleMediaInput = async (ctx, media) => {
  const session = getSession(ctx);

  if (session.step !== STEPS.ADD_MEDIA) {
    return false;
  }

  const fileId = media?.file_id;
  if (!fileId) {
    await ctx.reply('❌ Media inválida. Intenta de nuevo.');
    return true;
  }

  try {
    let downloadUrl = null;
    if (process.env.BOT_TOKEN) {
      const filePath = await ctx.telegram.getFile(fileId);
      if (filePath?.file_path) {
        downloadUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath.file_path}`;
      }
    }

    session.mediaType = media.type || 'media';
    session.mediaFileId = fileId;
    session.mediaUrl = downloadUrl || fileId;
    await ctx.saveSession?.();

    logger.info('X post media saved', {
      userId: ctx.from?.id,
      type: session.mediaType,
      hasUrl: !!downloadUrl,
    });

    await ctx.reply('✅ Media guardada correctamente');
    await showAddMedia(ctx);
    return true;
  } catch (error) {
    logger.error('Error handling X post media:', error);
    await ctx.reply('❌ Error al procesar la media. Intenta de nuevo.');
    return true;
  }
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
    await showPostTypeSelection(ctx, true);
  });

  // Post type selection
  bot.action('xpost_post_type', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    await safeAnswer(ctx);
    await showPostTypeSelection(ctx, true);
  });

  bot.action('xpost_type_regular', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    const session = getSession(ctx);
    session.postType = POST_TYPES.REGULAR;
    await ctx.saveSession?.();
    await safeAnswer(ctx, '✅ Post Regular');
    await showPostTypeSelection(ctx, true);
  });

  bot.action('xpost_type_sales', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    const session = getSession(ctx);
    session.postType = POST_TYPES.SALES;
    await ctx.saveSession?.();
    await safeAnswer(ctx, '✅ Post de Ventas');
    await showPostTypeSelection(ctx, true);
  });

  bot.action('xpost_type_video', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    const session = getSession(ctx);
    session.postType = POST_TYPES.VIDEO;
    await ctx.saveSession?.();
    await safeAnswer(ctx, '✅ Descripción de Video');
    await showPostTypeSelection(ctx, true);
  });

  // AI Options
  bot.action('xpost_ai_options', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    await safeAnswer(ctx);
    await showAIOptions(ctx, true);
  });

  bot.action('xpost_lang_en', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    const session = getSession(ctx);
    session.aiLanguage = AI_LANGUAGES.EN;
    await ctx.saveSession?.();
    await safeAnswer(ctx, '✅ Inglés');
    await showAIOptions(ctx, true);
  });

  bot.action('xpost_lang_es', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    const session = getSession(ctx);
    session.aiLanguage = AI_LANGUAGES.ES;
    await ctx.saveSession?.();
    await safeAnswer(ctx, '✅ Español');
    await showAIOptions(ctx, true);
  });

  bot.action('xpost_lang_both', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    const session = getSession(ctx);
    session.aiLanguage = AI_LANGUAGES.BOTH;
    await ctx.saveSession?.();
    await safeAnswer(ctx, '✅ Ambos idiomas');
    await showAIOptions(ctx, true);
  });

  bot.action('xpost_toggle_lex', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    const session = getSession(ctx);
    session.includeLex = !session.includeLex;
    await ctx.saveSession?.();
    await safeAnswer(ctx, session.includeLex ? '✅ Lex incluido' : '❌ Lex removido');
    await showAIOptions(ctx, true);
  });

  bot.action('xpost_toggle_santino', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    const session = getSession(ctx);
    session.includeSantino = !session.includeSantino;
    await ctx.saveSession?.();
    await safeAnswer(ctx, session.includeSantino ? '✅ Santino incluido' : '❌ Santino removido');
    await showAIOptions(ctx, true);
  });

  // Templates
  bot.action('xpost_templates', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    await safeAnswer(ctx);
    await showTemplates(ctx, true);
  });

  // Handle template selection
  Object.values(POST_TEMPLATES).forEach(template => {
    bot.action(`xpost_template_${template.id}`, async (ctx) => {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');

      const session = getSession(ctx);
      session.selectedTemplate = template.id;
      await ctx.saveSession?.();

      await safeAnswer(ctx, `✅ ${template.label}`);

      // Use the appropriate prompt based on language setting
      const prompt = session.aiLanguage === AI_LANGUAGES.ES
        ? template.promptEs
        : template.promptEn;

      await generateAIContent(ctx, prompt);
    });
  });

  // AI Generate button
  bot.action('xpost_ai_generate', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');

    const session = getSession(ctx);
    session.step = STEPS.AI_PROMPT;
    await ctx.saveSession?.();

    const postTypeLabel = {
      [POST_TYPES.REGULAR]: 'Post Regular',
      [POST_TYPES.SALES]: 'Post de Ventas',
      [POST_TYPES.VIDEO]: 'Descripción de Video',
    }[session.postType] || 'Post';

    await safeAnswer(ctx);
    await ctx.reply(
      `🤖 *Generar ${postTypeLabel} con AI*\n\n`
      + 'Describe el contenido que quieres generar.\n\n'
      + '*Ejemplos:*\n'
      + '• `Anuncia show en vivo esta noche`\n'
      + '• `Promo lifetime con urgencia`\n'
      + '• `Nuevo video de clouds subido`',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📋 Usar Plantilla', 'xpost_templates')],
          [Markup.button.callback('◀️ Volver', 'xpost_compose')],
          [Markup.button.callback('❌ Cancelar', 'xpost_menu')],
        ]),
      },
    );
  });

  // Regenerate AI
  bot.action('xpost_ai_regenerate', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');

    const session = getSession(ctx);
    if (!session.lastAiPrompt) {
      await ctx.answerCbQuery('❌ No hay prompt previo');
      return;
    }

    await safeAnswer(ctx, '🔄 Regenerando...');
    await generateAIContent(ctx, session.lastAiPrompt, true);
  });

  // Use EN/ES version
  bot.action('xpost_use_en', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');

    const session = getSession(ctx);
    if (session.textEn) {
      session.text = session.textEn;
      await ctx.saveSession?.();
      await safeAnswer(ctx, '✅ Usando versión en inglés');
      await showComposeText(ctx, true);
    } else {
      await ctx.answerCbQuery('❌ No hay versión en inglés');
    }
  });

  bot.action('xpost_use_es', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');

    const session = getSession(ctx);
    if (session.textEs) {
      session.text = session.textEs;
      await ctx.saveSession?.();
      await safeAnswer(ctx, '✅ Usando versión en español');
      await showComposeText(ctx, true);
    } else {
      await ctx.answerCbQuery('❌ No hay versión en español');
    }
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
        '🔗 *Conectar cuenta de X*\n\n'
        + '1) Abre el enlace de abajo.\n'
        + '2) Autoriza la cuenta.\n'
        + '3) Regresa y selecciona la cuenta.',
        { parse_mode: 'Markdown' },
      );
      await ctx.reply(authUrl, { disable_web_page_preview: true });
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

  bot.action('xpost_ai_en', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    const session = getSession(ctx);
    session.step = STEPS.AI_PROMPT_EN;
    await ctx.saveSession?.();
    await safeAnswer(ctx);
    await ctx.reply(
      '🤖 *AI Write (Grok) - English*\n\n'
      + 'Describe el post que quieres generar.\n'
      + 'Ejemplo:\n`Announce a new live show tonight, bold tone, include CTA to pnptv.app`',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('◀️ Volver', 'xpost_compose')],
          [Markup.button.callback('❌ Cancelar', 'xpost_menu')],
        ]),
      },
    );
  });

  bot.action('xpost_ai_es', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');
    const session = getSession(ctx);
    session.step = STEPS.AI_PROMPT_ES;
    await ctx.saveSession?.();
    await safeAnswer(ctx);
    await ctx.reply(
      '🤖 *AI Write (Grok) - Español*\n\n'
      + 'Describe el post que quieres generar.\n'
      + 'Ejemplo:\n`Anuncia un show en vivo esta noche, tono intenso, incluye CTA a pnptv.app`',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('◀️ Volver', 'xpost_compose')],
          [Markup.button.callback('❌ Cancelar', 'xpost_menu')],
        ]),
      },
    );
  });

  bot.action('xpost_clear_text', async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');

    const session = getSession(ctx);
    session.text = null;
    session.textEn = null;
    session.textEs = null;
    session.lastAiPrompt = null;
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

  // Retry failed post
  bot.action(/^xpost_retry_(.+)$/, async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');

    const postId = ctx.match[1];
    await safeAnswer(ctx, '🔄 Reintentando...');

    try {
      const post = await XPostService.getPostById(postId);
      if (!post) {
        await ctx.reply('❌ Post no encontrado');
        return;
      }

      if (post.status !== 'failed') {
        await ctx.reply('❌ Solo se pueden reintentar posts fallidos');
        return;
      }

      // Get the account
      const account = await XPostService.getAccount(post.account_id);
      if (!account || !account.is_active) {
        await ctx.reply('❌ La cuenta de X no está disponible');
        return;
      }

      // Retry sending the post
      const result = await XPostService.sendPostNow({
        accountId: post.account_id,
        adminId: ctx.from.id,
        adminUsername: ctx.from.username,
        text: post.text,
        mediaUrl: post.media_url,
      });

      const tweetId = result.response?.data?.id;
      const tweetUrl = tweetId ? `https://x.com/i/status/${tweetId}` : null;

      let message = '✅ **Post Reenviado Exitosamente**\n\n';
      message += `📤 Cuenta: @${account.handle}\n`;
      if (tweetUrl) {
        message += `\n🔗 [Ver en X](${tweetUrl})`;
      }

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      });

      logger.info('Failed X post retried successfully', {
        adminId: ctx.from.id,
        originalPostId: postId,
        newPostId: result.postId,
        tweetId,
      });
    } catch (error) {
      logger.error('Error retrying X post:', error);
      await ctx.reply(`❌ Error al reintentar: ${error.message || 'desconocido'}`);
    }
  });

  // Copy post to new
  bot.action(/^xpost_copy_(.+)$/, async (ctx) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) return ctx.answerCbQuery('❌ No autorizado');

    const postId = ctx.match[1];

    try {
      const post = await XPostService.getPostById(postId);
      if (!post) {
        await ctx.answerCbQuery('❌ Post no encontrado');
        return;
      }

      // Initialize a new session with the copied text
      clearSession(ctx);
      const session = getSession(ctx);

      // Pre-fill the text
      session.text = post.text;

      // If we know the account, pre-select it
      if (post.account_id) {
        const accounts = await XPostService.listActiveAccounts();
        const account = accounts.find(a => String(a.account_id) === String(post.account_id));
        if (account) {
          session.accountId = account.account_id;
          session.accountHandle = account.handle;
        }
      }

      await ctx.saveSession?.();

      await safeAnswer(ctx, '📋 Texto copiado');
      await ctx.reply(
        '📋 **Post Copiado**\n\n'
        + 'El texto ha sido copiado. Puedes editarlo antes de publicar.\n\n'
        + `📝 Texto: ${(post.text || '').substring(0, 50)}...`,
        { parse_mode: 'Markdown' },
      );

      // Go to account selection if not pre-selected, otherwise to compose
      if (session.accountId) {
        await showPostTypeSelection(ctx);
      } else {
        await showAccountSelection(ctx);
      }

      logger.info('X post copied for new post', {
        adminId: ctx.from.id,
        sourcePostId: postId,
      });
    } catch (error) {
      logger.error('Error copying X post:', error);
      await ctx.answerCbQuery('❌ Error al copiar').catch(() => {});
    }
  });

  logger.info('X post wizard handlers registered');
};

module.exports = {
  registerXPostWizardHandlers,
  showXPostMenu,
  handleTextInput,
  handleMediaInput,
  getSession,
  STEPS,
  POST_TYPES,
  AI_LANGUAGES,
  POST_TEMPLATES,
};
