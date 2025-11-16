/**
 * Internationalization (i18n) utility for PNPtv Telegram Bot
 * Supports English and Spanish
 */

const translations = {
  en: {
    // General
    welcome: '👋 Welcome to PNPtv!',
    back: '🔙 Back',
    cancel: '❌ Cancel',
    next: '➡️ Next',
    confirm: '✅ Confirm',
    error: '❌ An error occurred. Please try again.',
    success: '✅ Success!',
    loading: '⏳ Loading...',

    // Onboarding
    selectLanguage: 'Please select your language:',
    languageSelected: 'Language set to English 🇺🇸',
    ageVerification: '🔞 Age Verification Required\n\nYou must be 18 or older to use this service.\n\nAre you 18 years or older?',
    confirmAge: 'Yes, I am 18+',
    ageVerificationSuccess: '✅ Age verified successfully!',
    ageVerificationReminder: '🔄 Age Re-Verification Required\n\nFor security purposes, please confirm your age again (required every 7 days).',
    underAge: 'Sorry, you must be 18 or older to use this service.',

    // Terms and Privacy
    terms: '📄 Terms & Conditions\n\nPlease read and accept our Terms of Service to continue:',
    termsAccepted: '✅ Terms of Service accepted!',
    termsDeclined: '❌ You must accept the Terms of Service to use this bot.',
    privacy: '🔒 Privacy Policy\n\nPlease read and accept our Privacy Policy to continue:',
    privacyAccepted: '✅ Privacy Policy accepted!',
    privacyDeclined: '❌ You must accept the Privacy Policy to use this bot.',
    accept: 'Accept & Continue',
    decline: 'Decline',

    // Email Collection
    emailPrompt: '📧 Email Address (Optional)\n\nWould you like to provide your email for updates and notifications?',
    emailInstructions: 'Please send your email address or click Skip to continue.',
    emailConfirmed: '✅ Email saved successfully!',
    emailInvalid: '❌ Invalid email format. Please try again.',
    skipEmail: 'Skip',

    // Free Channel Invite
    freeChannelInvite: '🎉 Welcome to PNPtv!\n\nJoin our free community:',
    freeChannel: 'Free Channel',
    freeGroup: 'Free Group',
    freeChannelInviteFailed: '✅ Onboarding complete! You can now access all features.',

    // Profile Creation
    profileCreated: '🎉 Your profile has been created successfully!',
    onboardingComplete: '🎉 Welcome aboard! Your profile is all set. Use /menu to get started.',

    // Main Menu
    mainMenuIntro: '🎬 Welcome to PNPtv - Your Entertainment Hub!\n\nWhat would you like to do?',
    subscribe: '💎 Subscribe to PRIME',
    myProfile: '👤 My Profile',
    nearbyUsers: '🌍 Nearby Users',
    liveStreams: '🎤 Live Streams',
    radio: '📻 Radio',
    zoomRooms: '🎥 Zoom Rooms',
    support: '🤖 Support',
    settings: '⚙️ Settings',

    // Subscription
    subscriptionPlans: '💎 Choose Your PRIME Plan:',
    planBasic: '⭐ Basic - $9.99/month',
    planPremium: '🌟 Premium - $19.99/month',
    planGold: '👑 Gold - $29.99/month',
    planDetails: 'Plan Details:',
    selectPlan: 'Select Plan',
    paymentMethod: 'Choose payment method:',
    payWithEpayco: '💳 Pay with ePayco (USD)',
    payWithDaimo: '💰 Pay with Daimo (USDC)',
    paymentInstructions: '💳 Payment Instructions:\n\nPlease click the link below to complete your payment:\n\n{paymentUrl}\n\nOnce payment is confirmed, your subscription will be activated automatically.',
    paymentSuccess: '✅ Payment successful! Your PRIME subscription is now active. Enjoy premium features!',
    paymentFailed: '❌ Payment failed. Please try again or contact support.',
    subscriptionActive: 'Your subscription is active until {expiry}',
    subscriptionExpired: 'Your subscription has expired. Please renew to continue enjoying PRIME features.',

    // Profile
    profileTitle: '👤 Your Profile',
    editProfile: '✏️ Edit Profile',
    editPhoto: '📸 Change Photo',
    editBio: '📝 Edit Bio',
    editLocation: '📍 Update Location',
    editInterests: '🎯 Edit Interests',
    privacySettings: '🔒 Privacy Settings',
    sendPhoto: 'Please send your new profile photo:',
    photoUpdated: 'Profile photo updated successfully!',
    sendBio: 'Please send your new bio (max 500 characters):',
    bioUpdated: 'Bio updated successfully!',
    sendLocation: 'Please share your location:',
    locationUpdated: 'Location updated successfully!',
    sendInterests: 'Please send your interests (comma-separated, max 10):',
    interestsUpdated: 'Interests updated successfully!',

    // Nearby Users
    nearbyTitle: '🌍 Find Nearby Users',
    selectRadius: 'Select search radius:',
    radius5km: '📍 5 km',
    radius10km: '📍 10 km',
    radius25km: '📍 25 km',
    noNearbyUsers: 'No users found nearby. Try expanding your search radius.',
    nearbyUsersFound: 'Found {count} users nearby:',
    viewProfile: '👁️ View Profile',
    sendMessage: '💬 Send Message',
    distance: 'Distance: {distance} km',

    // Live Streams
    liveTitle: '🎤 Live Streams',
    startLive: '▶️ Start Live Stream',
    viewStreams: '👁️ View Active Streams',
    myStreams: '📹 My Streams',
    enterStreamTitle: 'Enter your stream title:',
    enterStreamDescription: 'Enter stream description (optional):',
    streamPaid: 'Is this a paid stream?',
    streamPrice: 'Enter stream price (USD):',
    streamCreated: '🎉 Your live stream is ready!\n\n🔗 Stream URL: {url}\n\nShare this with your audience!',
    noActiveStreams: 'No active streams at the moment.',
    joinStream: '▶️ Join Stream',
    streamEnded: 'Stream has ended.',

    // Radio
    radioTitle: '📻 PNPtv Radio - 24/7',
    listenNow: '🎧 Listen Now',
    requestSong: '🎵 Request Song',
    nowPlaying: '🎵 Now Playing',
    radioSchedule: '📅 Schedule',
    streamUrl: 'Listen here: {url}',
    songRequested: 'Song request received! We\'ll play it soon.',
    enterSongName: 'Enter song name to request:',

    // Zoom Rooms
    zoomTitle: '🎥 Zoom Rooms',
    createRoom: '➕ Create Room',
    joinRoom: '▶️ Join Room',
    myRooms: '📋 My Rooms',
    enterRoomName: 'Enter room name:',
    roomPrivacy: 'Room privacy:',
    publicRoom: '🌐 Public',
    privateRoom: '🔒 Private',
    roomDuration: 'Select duration:',
    duration30: '30 minutes',
    duration60: '60 minutes',
    duration120: '2 hours',
    roomCreated: '🎥 Your Zoom room is ready!\n\n🔗 Join URL: {url}\n\n💡 Share this link with participants.',
    noActiveRooms: 'No active rooms available.',

    // Support
    supportTitle: '🤖 Support Center',
    chatWithCristina: '💬 Chat with Cristina (AI)',
    contactAdmin: '👨‍💼 Contact Admin',
    faq: '❓ FAQ',
    cristinaGreeting: 'Hi! I\'m Cristina, your AI assistant. How can I help you today?',
    adminMessage: 'Please type your message for our support team:',
    messageSent: 'Your message has been sent to our support team. We\'ll get back to you soon!',

    // Settings
    settingsTitle: '⚙️ Settings',
    changeLanguage: '🌐 Change Language',
    notifications: '🔔 Notifications',
    privacy: '🔒 Privacy',
    about: 'ℹ️ About',
    languageChanged: 'Language changed successfully!',

    // Admin
    adminPanel: '👨‍💼 Admin Panel',
    userManagement: '👥 User Management',
    broadcast: '📢 Broadcast Message',
    planManagement: '💎 Plan Management',
    analytics: '📊 Analytics',
    searchUser: 'Enter user ID or username to search:',
    userFound: 'User found:',
    userNotFound: 'User not found.',
    extendSubscription: '⏰ Extend Subscription',
    deactivateUser: '🚫 Deactivate User',
    broadcastTarget: 'Select broadcast target:',
    allUsers: '👥 All Users',
    premiumOnly: '💎 Premium Only',
    freeOnly: '🆓 Free Users Only',
    enterBroadcast: 'Enter your broadcast message:',
    broadcastSent: 'Broadcast sent to {count} users!',

    // Errors
    invalidInput: 'Invalid input. Please try again.',
    unauthorized: 'You are not authorized to perform this action.',
    subscriptionRequired: 'This feature requires a PRIME subscription.',
    locationRequired: 'Please share your location first.',
    networkError: 'Network error. Please check your connection and try again.',
    serverError: 'Server error. Please try again later.',
  },
  es: {
    // General
    welcome: '👋 ¡Bienvenido a PNPtv!',
    back: '🔙 Atrás',
    cancel: '❌ Cancelar',
    next: '➡️ Siguiente',
    confirm: '✅ Confirmar',
    error: '❌ Ocurrió un error. Por favor intenta de nuevo.',
    success: '✅ ¡Éxito!',
    loading: '⏳ Cargando...',

    // Onboarding
    selectLanguage: 'Por favor selecciona tu idioma:',
    languageSelected: 'Idioma configurado a Español 🇪🇸',
    ageVerification: '🔞 Verificación de Edad Requerida\n\nDebes tener 18 años o más para usar este servicio.\n\n¿Tienes 18 años o más?',
    confirmAge: 'Sí, tengo 18+',
    ageVerificationSuccess: '✅ ¡Edad verificada exitosamente!',
    ageVerificationReminder: '🔄 Re-Verificación de Edad Requerida\n\nPor seguridad, por favor confirma tu edad nuevamente (requerido cada 7 días).',
    underAge: 'Lo sentimos, debes tener 18 años o más para usar este servicio.',

    // Terms and Privacy
    terms: '📄 Términos y Condiciones\n\nPor favor lee y acepta nuestros Términos de Servicio para continuar:',
    termsAccepted: '✅ ¡Términos de Servicio aceptados!',
    termsDeclined: '❌ Debes aceptar los Términos de Servicio para usar este bot.',
    privacy: '🔒 Política de Privacidad\n\nPor favor lee y acepta nuestra Política de Privacidad para continuar:',
    privacyAccepted: '✅ ¡Política de Privacidad aceptada!',
    privacyDeclined: '❌ Debes aceptar la Política de Privacidad para usar este bot.',
    accept: 'Aceptar y Continuar',
    decline: 'Rechazar',

    // Email Collection
    emailPrompt: '📧 Correo Electrónico (Opcional)\n\n¿Deseas proporcionar tu correo para actualizaciones y notificaciones?',
    emailInstructions: 'Por favor envía tu dirección de correo o haz clic en Omitir para continuar.',
    emailConfirmed: '✅ ¡Correo guardado exitosamente!',
    emailInvalid: '❌ Formato de correo inválido. Por favor intenta de nuevo.',
    skipEmail: 'Omitir',

    // Free Channel Invite
    freeChannelInvite: '🎉 ¡Bienvenido a PNPtv!\n\nÚnete a nuestra comunidad gratuita:',
    freeChannel: 'Canal Gratuito',
    freeGroup: 'Grupo Gratuito',
    freeChannelInviteFailed: '✅ ¡Onboarding completado! Ahora puedes acceder a todas las funciones.',

    // Profile Creation
    profileCreated: '🎉 ¡Tu perfil ha sido creado exitosamente!',
    onboardingComplete: '🎉 ¡Bienvenido! Tu perfil está configurado. Usa /menu para comenzar.',

    // Main Menu
    mainMenuIntro: '🎬 Bienvenido a PNPtv - ¡Tu Centro de Entretenimiento!\n\n¿Qué te gustaría hacer?',
    subscribe: '💎 Suscríbete a PRIME',
    myProfile: '👤 Mi Perfil',
    nearbyUsers: '🌍 Usuarios Cercanos',
    liveStreams: '🎤 Transmisiones en Vivo',
    radio: '📻 Radio',
    zoomRooms: '🎥 Salas Zoom',
    support: '🤖 Soporte',
    settings: '⚙️ Configuración',

    // Subscription
    subscriptionPlans: '💎 Elige tu Plan PRIME:',
    planBasic: '⭐ Básico - $9.99/mes',
    planPremium: '🌟 Premium - $19.99/mes',
    planGold: '👑 Gold - $29.99/mes',
    planDetails: 'Detalles del Plan:',
    selectPlan: 'Seleccionar Plan',
    paymentMethod: 'Elige método de pago:',
    payWithEpayco: '💳 Pagar con ePayco (USD)',
    payWithDaimo: '💰 Pagar con Daimo (USDC)',
    paymentInstructions: '💳 Instrucciones de Pago:\n\nPor favor haz clic en el enlace para completar tu pago:\n\n{paymentUrl}\n\nUna vez confirmado el pago, tu suscripción se activará automáticamente.',
    paymentSuccess: '✅ ¡Pago exitoso! Tu suscripción PRIME está activa. ¡Disfruta las funciones premium!',
    paymentFailed: '❌ Pago fallido. Por favor intenta de nuevo o contacta soporte.',
    subscriptionActive: 'Tu suscripción está activa hasta {expiry}',
    subscriptionExpired: 'Tu suscripción ha expirado. Por favor renueva para continuar disfrutando PRIME.',

    // Profile
    profileTitle: '👤 Tu Perfil',
    editProfile: '✏️ Editar Perfil',
    editPhoto: '📸 Cambiar Foto',
    editBio: '📝 Editar Bio',
    editLocation: '📍 Actualizar Ubicación',
    editInterests: '🎯 Editar Intereses',
    privacySettings: '🔒 Configuración de Privacidad',
    sendPhoto: 'Por favor envía tu nueva foto de perfil:',
    photoUpdated: '¡Foto de perfil actualizada exitosamente!',
    sendBio: 'Por favor envía tu nueva biografía (máx 500 caracteres):',
    bioUpdated: '¡Biografía actualizada exitosamente!',
    sendLocation: 'Por favor comparte tu ubicación:',
    locationUpdated: '¡Ubicación actualizada exitosamente!',
    sendInterests: 'Por favor envía tus intereses (separados por comas, máx 10):',
    interestsUpdated: '¡Intereses actualizados exitosamente!',

    // Nearby Users
    nearbyTitle: '🌍 Encontrar Usuarios Cercanos',
    selectRadius: 'Selecciona radio de búsqueda:',
    radius5km: '📍 5 km',
    radius10km: '📍 10 km',
    radius25km: '📍 25 km',
    noNearbyUsers: 'No se encontraron usuarios cercanos. Intenta expandir tu radio de búsqueda.',
    nearbyUsersFound: 'Se encontraron {count} usuarios cercanos:',
    viewProfile: '👁️ Ver Perfil',
    sendMessage: '💬 Enviar Mensaje',
    distance: 'Distancia: {distance} km',

    // Live Streams
    liveTitle: '🎤 Transmisiones en Vivo',
    startLive: '▶️ Iniciar Transmisión',
    viewStreams: '👁️ Ver Transmisiones Activas',
    myStreams: '📹 Mis Transmisiones',
    enterStreamTitle: 'Ingresa el título de tu transmisión:',
    enterStreamDescription: 'Ingresa descripción de transmisión (opcional):',
    streamPaid: '¿Es una transmisión de pago?',
    streamPrice: 'Ingresa el precio de la transmisión (USD):',
    streamCreated: '🎉 ¡Tu transmisión en vivo está lista!\n\n🔗 URL de Transmisión: {url}\n\n¡Compártela con tu audiencia!',
    noActiveStreams: 'No hay transmisiones activas en este momento.',
    joinStream: '▶️ Unirse a Transmisión',
    streamEnded: 'La transmisión ha terminado.',

    // Radio
    radioTitle: '📻 Radio PNPtv - 24/7',
    listenNow: '🎧 Escuchar Ahora',
    requestSong: '🎵 Pedir Canción',
    nowPlaying: '🎵 Sonando Ahora',
    radioSchedule: '📅 Programación',
    streamUrl: 'Escuchar aquí: {url}',
    songRequested: '¡Solicitud de canción recibida! La reproduciremos pronto.',
    enterSongName: 'Ingresa el nombre de la canción:',

    // Zoom Rooms
    zoomTitle: '🎥 Salas Zoom',
    createRoom: '➕ Crear Sala',
    joinRoom: '▶️ Unirse a Sala',
    myRooms: '📋 Mis Salas',
    enterRoomName: 'Ingresa el nombre de la sala:',
    roomPrivacy: 'Privacidad de la sala:',
    publicRoom: '🌐 Pública',
    privateRoom: '🔒 Privada',
    roomDuration: 'Selecciona duración:',
    duration30: '30 minutos',
    duration60: '60 minutos',
    duration120: '2 horas',
    roomCreated: '🎥 ¡Tu sala Zoom está lista!\n\n🔗 URL de Ingreso: {url}\n\n💡 Comparte este enlace con los participantes.',
    noActiveRooms: 'No hay salas activas disponibles.',

    // Support
    supportTitle: '🤖 Centro de Soporte',
    chatWithCristina: '💬 Chat con Cristina (IA)',
    contactAdmin: '👨‍💼 Contactar Admin',
    faq: '❓ Preguntas Frecuentes',
    cristinaGreeting: '¡Hola! Soy Cristina, tu asistente IA. ¿Cómo puedo ayudarte hoy?',
    adminMessage: 'Por favor escribe tu mensaje para nuestro equipo de soporte:',
    messageSent: '¡Tu mensaje ha sido enviado a nuestro equipo de soporte! Te responderemos pronto.',

    // Settings
    settingsTitle: '⚙️ Configuración',
    changeLanguage: '🌐 Cambiar Idioma',
    notifications: '🔔 Notificaciones',
    privacy: '🔒 Privacidad',
    about: 'ℹ️ Acerca de',
    languageChanged: '¡Idioma cambiado exitosamente!',

    // Admin
    adminPanel: '👨‍💼 Panel de Administración',
    userManagement: '👥 Gestión de Usuarios',
    broadcast: '📢 Mensaje de Difusión',
    planManagement: '💎 Gestión de Planes',
    analytics: '📊 Analíticas',
    searchUser: 'Ingresa ID o nombre de usuario para buscar:',
    userFound: 'Usuario encontrado:',
    userNotFound: 'Usuario no encontrado.',
    extendSubscription: '⏰ Extender Suscripción',
    deactivateUser: '🚫 Desactivar Usuario',
    broadcastTarget: 'Selecciona objetivo de difusión:',
    allUsers: '👥 Todos los Usuarios',
    premiumOnly: '💎 Solo Premium',
    freeOnly: '🆓 Solo Usuarios Gratis',
    enterBroadcast: 'Ingresa tu mensaje de difusión:',
    broadcastSent: '¡Difusión enviada a {count} usuarios!',

    // Errors
    invalidInput: 'Entrada inválida. Por favor intenta de nuevo.',
    unauthorized: 'No estás autorizado para realizar esta acción.',
    subscriptionRequired: 'Esta función requiere una suscripción PRIME.',
    locationRequired: 'Por favor comparte tu ubicación primero.',
    networkError: 'Error de red. Por favor verifica tu conexión e intenta de nuevo.',
    serverError: 'Error del servidor. Por favor intenta más tarde.',
  },
};

/**
 * Get translated text
 * @param {string} key - Translation key
 * @param {string} lang - Language code ('en' or 'es')
 * @param {Object} params - Parameters to replace in text
 * @returns {string} Translated text
 */
const t = (key, lang = 'en', params = {}) => {
  const language = lang || 'en';
  let text = translations[language]?.[key] || translations.en[key] || key;

  // Replace parameters
  Object.keys(params).forEach((param) => {
    text = text.replace(`{${param}}`, params[param]);
  });

  return text;
};

/**
 * Get all translations for a language
 * @param {string} lang - Language code
 * @returns {Object} All translations
 */
const getTranslations = (lang = 'en') => translations[lang] || translations.en;

/**
 * Check if language is supported
 * @param {string} lang - Language code
 * @returns {boolean} Support status
 */
const isLanguageSupported = (lang) => Object.prototype.hasOwnProperty.call(translations, lang);

/**
 * Get supported languages
 * @returns {Array<string>} Language codes
 */
const getSupportedLanguages = () => Object.keys(translations);

module.exports = {
  t,
  getTranslations,
  isLanguageSupported,
  getSupportedLanguages,
  translations,
};
