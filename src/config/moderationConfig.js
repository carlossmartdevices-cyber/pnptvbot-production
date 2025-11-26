/**
 * Moderation System Configuration
 */

const MODERATION_CONFIG = {
  // Community Rules
  RULES: {
    en: [
      '🔞 **Age Requirement:** You must be 18+ to participate',
      '🤝 **Respect:** Treat all members with respect - no harassment, hate speech, or discrimination',
      '🚫 **No Spam:** Don\'t flood the chat or post repetitive content',
      '🔗 **No Unauthorized Links:** Don\'t share external links without permission',
      '📸 **No Unsolicited Content:** Don\'t share explicit content in the main chat',
      '👤 **Appropriate Usernames:** Keep usernames appropriate and non-offensive',
      '⚠️ **Follow Warnings:** Respect moderator warnings - 3 strikes and you\'re out',
      '💬 **Stay On Topic:** Keep conversations relevant to the community',
    ],
    es: [
      '🔞 **Requisito de Edad:** Debes tener más de 18 años para participar',
      '🤝 **Respeto:** Trata a todos los miembros con respeto - sin acoso, discurso de odio o discriminación',
      '🚫 **Sin Spam:** No inundes el chat ni publiques contenido repetitivo',
      '🔗 **Sin Enlaces No Autorizados:** No compartas enlaces externos sin permiso',
      '📸 **Sin Contenido No Solicitado:** No compartas contenido explícito en el chat principal',
      '👤 **Nombres de Usuario Apropiados:** Mantén nombres de usuario apropiados y no ofensivos',
      '⚠️ **Sigue las Advertencias:** Respeta las advertencias de los moderadores - 3 strikes y estás fuera',
      '💬 **Mantente en el Tema:** Mantén las conversaciones relevantes para la comunidad',
    ],
  },

  // Warning System
  WARNING_SYSTEM: {
    MAX_WARNINGS: 3,
    ACTIONS: {
      1: { type: 'warning', message: '⚠️ First warning - please follow the rules' },
      2: { type: 'mute', duration: 24 * 60 * 60 * 1000, message: '⚠️ Second warning - muted for 24 hours' },
      3: { type: 'ban', message: '🚫 Third warning - you have been banned from the group' },
    },
    // Warning expiration (warnings older than this are ignored)
    WARNING_EXPIRY_DAYS: 30,
  },

  // Auto-Moderation Filters
  FILTERS: {
    // Spam Detection
    SPAM: {
      enabled: true,
      maxDuplicateMessages: 3, // Max duplicate messages before flagging
      duplicateTimeWindow: 60 * 1000, // Time window in ms (1 minute)
    },

    // Flood Detection
    FLOOD: {
      enabled: true,
      maxMessages: 10, // Max messages
      timeWindow: 30 * 1000, // In time window (30 seconds)
    },

    // Link Filtering
    LINKS: {
      enabled: true,
      allowedDomains: [
        // PNPtv official
        'pnptv.com',
        'pnptv.app',
        // Social media (official domains only)
        'x.com',
        'twitter.com',
        'facebook.com',
        'fb.com',
        'instagram.com',
        'tiktok.com',
        // Media platforms
        'youtube.com',
        'youtu.be',
        'spotify.com',
        'soundcloud.com',
        // Note: Only official domains are allowed to prevent scams
        // Shortened URLs and suspicious domains will be blocked
      ],
      // Admins and prime members can post any links
      exemptPrime: true,
    },

    // Profanity Filter - allows adult language but bans illegal activity terms
    PROFANITY: {
      enabled: true, // Enabled to block illegal activity terms
      blacklist: [
        // Illegal activities - zero tolerance
        // Pedophilia related
        'pedophilia', 'pedofilia', 'paedophilia', 'pedophile',
        'child porn', 'childporn', 'child sex', 'childsex',
        'child abuse', 'childabuse',
        'loli', 'lolita', 'lolicon', 'shota', 'shotacon',
        'preteen', 'pre-teen', 'preteens', 'pre teen',
        'underaged', 'under aged', 'underage sex',
        'minor sex', 'teen porn', 'kid sex', 'kids sex',
        'jailbait', 'jail bait', 'kiddie porn', 'kiddies',
        'pthc', 'r@ygold', 'raygold',
        // Zoophilia related
        'zoophilia', 'zoofilia', 'zoophile', 'bestiality', 'beastiality',
        'animal sex', 'animalsex', 'dog sex', 'dogsex',
        'zoosex', 'animal abuse', 'animalabuse',
        'horse sex', 'horsesex',
        // Non-consent / Violence
        'rape porn', 'raping', 'rapist',
        'violacion', 'violar', 'violada',
        'non-consent', 'non consent', 'nonconsent',
        'roofie', 'roofied', 'date rape',
        'forced sex', 'drugged sex',
        // Incest
        'incest', 'incesto', 'incestuous',
        'daughter sex', 'son sex',
        'sister sex', 'brother sex',
        'father daughter', 'mother son',
        // Extreme violence
        'snuff', 'snuff film', 'murder porn',
        'torture porn', 'gore porn',
        'necrophilia', 'necro porn',
        // Trafficking / Slavery
        'human trafficking', 'sex trafficking',
        'sex slave', 'sexslave',
        // Note: Adult language and normal profanity is allowed
        // This list only blocks illegal activities and harmful content
      ],
    },

    // Username Enforcement
    USERNAME: {
      enabled: true,
      blacklist: [
        'admin',
        'moderator',
        'pnptv',
        'official',
        'support',
      ],
      minLength: 3,
      maxLength: 32,
      allowEmojis: true,
    },
  },

  // Exempt Roles (users who bypass auto-moderation)
  EXEMPT_ROLES: ['admin', 'moderator'],

  // Moderation Actions
  ACTIONS: {
    WARN: 'warn',
    MUTE: 'mute',
    KICK: 'kick',
    BAN: 'ban',
    UNMUTE: 'unmute',
  },

  // Auto-delete moderation messages
  AUTO_DELETE_MOD_MESSAGES: true,
  MOD_MESSAGE_DELAY: 2 * 60 * 1000, // 2 minutes
};

module.exports = MODERATION_CONFIG;
