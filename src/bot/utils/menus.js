/**
 * Inline keyboard menu templates
 */

/**
 * Main menu for users
 */
const getMainMenu = (language = 'en') => {
  const labels = {
    en: {
      profile: '👤 My Profile',
      subscribe: '💎 Subscribe to PRIME',
      nearby: '📍 Nearby Users',
      streams: '🎥 Live Streams',
      radio: '📻 Radio',
      zoom: '🎥 Zoom Rooms',
      support: '💬 Support',
      settings: '⚙️ Settings',
    },
    es: {
      profile: '👤 Mi Perfil',
      subscribe: '💎 Suscribirse a PRIME',
      nearby: '📍 Usuarios Cercanos',
      streams: '🎥 Transmisiones en Vivo',
      radio: '📻 Radio',
      zoom: '🎥 Salas Zoom',
      support: '💬 Soporte',
      settings: '⚙️ Configuración',
    },
  };

  const l = labels[language] || labels.en;

  return {
    inline_keyboard: [
      [{ text: l.profile, callback_data: 'menu_profile' }],
      [{ text: l.subscribe, callback_data: 'menu_subscribe' }],
      [{ text: l.nearby, callback_data: 'menu_nearby' }],
      [{ text: l.streams, callback_data: 'menu_streams' }],
      [{ text: l.radio, callback_data: 'menu_radio' }],
      [{ text: l.zoom, callback_data: 'menu_zoom' }],
      [{ text: l.support, callback_data: 'menu_support' }],
      [{ text: l.settings, callback_data: 'menu_settings' }],
    ],
  };
};

/**
 * Language selection menu
 */
const getLanguageMenu = () => {
  return {
    inline_keyboard: [
      [{ text: '🇬🇧 English', callback_data: 'lang_en' }],
      [{ text: '🇪🇸 Español', callback_data: 'lang_es' }],
    ],
  };
};

/**
 * Subscription plans menu
 */
const getPlansMenu = (language = 'en') => {
  const labels = {
    en: {
      basic: '🥉 Basic - $9.99/mo',
      premium: '🥈 Premium - $19.99/mo',
      gold: '🥇 Gold - $49.99/mo',
      enterprise: '💼 Enterprise - Custom',
      back: '🔙 Back',
    },
    es: {
      basic: '🥉 Básico - $9.99/mes',
      premium: '🥈 Premium - $19.99/mes',
      gold: '🥇 Oro - $49.99/mes',
      enterprise: '💼 Empresarial - Personalizado',
      back: '🔙 Volver',
    },
  };

  const l = labels[language] || labels.en;

  return {
    inline_keyboard: [
      [{ text: l.basic, callback_data: 'plan_basic' }],
      [{ text: l.premium, callback_data: 'plan_premium' }],
      [{ text: l.gold, callback_data: 'plan_gold' }],
      [{ text: l.enterprise, callback_data: 'plan_enterprise' }],
      [{ text: l.back, callback_data: 'back_main' }],
    ],
  };
};

/**
 * Payment method menu
 */
const getPaymentMethodMenu = (planId, language = 'en') => {
  const labels = {
    en: {
      credit: '💳 Credit Card (ePayco)',
      crypto: '₿ Crypto/Digital Wallet (Daimo)',
      back: '🔙 Back to Plans',
    },
    es: {
      credit: '💳 Tarjeta de Crédito (ePayco)',
      crypto: '₿ Cripto/Billetera Digital (Daimo)',
      back: '🔙 Volver a Planes',
    },
  };

  const l = labels[language] || labels.en;

  return {
    inline_keyboard: [
      [{ text: l.credit, callback_data: `pay_epayco_${planId}` }],
      [{ text: l.crypto, callback_data: `pay_daimo_${planId}` }],
      [{ text: l.back, callback_data: 'back_plans' }],
    ],
  };
};

/**
 * Admin menu
 */
const getAdminMenu = () => {
  return {
    inline_keyboard: [
      [{ text: '📢 Broadcast Messages', callback_data: 'admin_broadcast' }],
      [{ text: '👥 User Management', callback_data: 'admin_users' }],
      [{ text: '📊 Analytics', callback_data: 'admin_analytics' }],
      [{ text: '💰 Plan Management', callback_data: 'admin_plans' }],
      [{ text: '⚙️ Settings', callback_data: 'admin_settings' }],
    ],
  };
};

/**
 * Broadcast type menu
 */
const getBroadcastTypeMenu = () => {
  return {
    inline_keyboard: [
      [{ text: '💬 Text Message', callback_data: 'broadcast_text' }],
      [{ text: '📷 Photo with Caption', callback_data: 'broadcast_photo' }],
      [{ text: '🎥 Video with Caption', callback_data: 'broadcast_video' }],
      [{ text: '🔙 Back to Admin', callback_data: 'back_admin' }],
    ],
  };
};

/**
 * Confirmation menu
 */
const getConfirmationMenu = (action, language = 'en') => {
  const labels = {
    en: {
      confirm: '✅ Confirm',
      cancel: '❌ Cancel',
    },
    es: {
      confirm: '✅ Confirmar',
      cancel: '❌ Cancelar',
    },
  };

  const l = labels[language] || labels.en;

  return {
    inline_keyboard: [
      [
        { text: l.confirm, callback_data: `confirm_${action}` },
        { text: l.cancel, callback_data: `cancel_${action}` },
      ],
    ],
  };
};

/**
 * Back button
 */
const getBackButton = (destination, language = 'en') => {
  const label = language === 'es' ? '🔙 Volver' : '🔙 Back';
  return {
    inline_keyboard: [[{ text: label, callback_data: `back_${destination}` }]],
  };
};

/**
 * Settings menu
 */
const getSettingsMenu = (language = 'en') => {
  const labels = {
    en: {
      language: '🌐 Change Language',
      notifications: '🔔 Notifications',
      privacy: '🔒 Privacy Settings',
      back: '🔙 Back to Main Menu',
    },
    es: {
      language: '🌐 Cambiar Idioma',
      notifications: '🔔 Notificaciones',
      privacy: '🔒 Configuración de Privacidad',
      back: '🔙 Volver al Menú Principal',
    },
  };

  const l = labels[language] || labels.en;

  return {
    inline_keyboard: [
      [{ text: l.language, callback_data: 'settings_language' }],
      [{ text: l.notifications, callback_data: 'settings_notifications' }],
      [{ text: l.privacy, callback_data: 'settings_privacy' }],
      [{ text: l.back, callback_data: 'back_main' }],
    ],
  };
};

module.exports = {
  getMainMenu,
  getLanguageMenu,
  getPlansMenu,
  getPaymentMethodMenu,
  getAdminMenu,
  getBroadcastTypeMenu,
  getConfirmationMenu,
  getBackButton,
  getSettingsMenu,
};
