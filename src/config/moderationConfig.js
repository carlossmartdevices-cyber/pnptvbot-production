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
      '🔗 **No Links Allowed:** All external links are prohibited - admins only exception',
      '📸 **No Unsolicited Content:** Don\'t share explicit content in the main chat',
      '👤 **Appropriate Usernames:** Keep usernames appropriate and non-offensive',
      '⚠️ **Follow Warnings:** Respect moderator warnings - 3 strikes and you\'re out',
      '💬 **Stay On Topic:** Keep conversations relevant to the community',
      '🤖 **No Bots:** Only the official PNPtv bot is allowed in this group',
    ],
    es: [
      '🔞 **Requisito de Edad:** Debes tener más de 18 años para participar',
      '🤝 **Respeto:** Trata a todos los miembros con respeto - sin acoso, discurso de odio o discriminación',
      '🚫 **Sin Spam:** No inundes el chat ni publiques contenido repetitivo',
      '🔗 **Sin Enlaces Permitidos:** Todos los enlaces externos están prohibidos - solo excepción para admins',
      '📸 **Sin Contenido No Solicitado:** No compartas contenido explícito en el chat principal',
      '👤 **Nombres de Usuario Apropiados:** Mantén nombres de usuario apropiados y no ofensivos',
      '⚠️ **Sigue las Advertencias:** Respeta las advertencias de los moderadores - 3 strikes y estás fuera',
      '💬 **Mantente en el Tema:** Mantén las conversaciones relevantes para la comunidad',
      '🤖 **Sin Bots:** Solo se permite el bot oficial de PNPtv en este grupo',
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
    // Only admins are exempt (checked in middleware, not here)
    LINKS: {
      enabled: true,
      allowedDomains: [],
    },

    // Profanity Filter (basic - can be expanded)
    PROFANITY: {
      enabled: false, // Disabled by default - this is an adult community
      blacklist: [
        // Add prohibited words here if needed
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
