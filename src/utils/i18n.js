/**
 * Internationalization (i18n) utility for PNPtv Telegram Bot
 * Supports English and Spanish
 */

const translations = {
  en: {
        groupRedirect: ({ username, command, botUsername }) =>
          `@${username} I sent you a private message about your request. Please check it out. We do this for privacy reasons and to comply with our Group's anti-spam policy.\n\n[Open in private chat with your request](https://t.me/${botUsername}?start=${command})`,
    // General
    welcome: '👋 Welcome to PNPtv!',
      welcomeScreen: `-----------------------------]
        Welcome to PNPtv! Premium
-------------------------------]

This is your control dashboard.
From here, you can access all your premium features:
open Zoom Rooms, start live streams, watch full videos,
explore Nearby without limits, and join private events.`,
      welcomeScreenFree: `-----------------------------]
            PNPtv!
-------------------------------]

Welcome to PNPtv!  
Enjoy the full experience from here.

Unlock all premium features:
• Full videos  
• Live streams  
• Unlimited Nearby  
• Zoom Rooms  
• Private community events

Tap "Subscribe to PRIME" below to get instant access.`,
    back: '🔙 Back',
    cancel: '❌ Cancel',
    next: '➡️ Next',
    confirm: '✅ Confirm',
    error: '❌ An error occurred. Please try again.',
    success: '✅ Success!',
    loading: '⏳ Loading...',
    days: 'days',

    // Onboarding
    selectLanguage: 'Please select your language:',
    languageSelected: 'Language set to English 🇺🇸',
    ageConfirmation: 'Are you 18 years or older?',
    ageConfirmYes: 'Yes, I am 18+',
    ageConfirmNo: 'No',
    underAge: 'Sorry, you must be 18 or older to use this service.',
    termsAndPrivacy: 'Please read and accept our Terms of Service and Privacy Policy:',
    termsAccepted: 'Terms and Privacy Policy accepted ✅',
    emailPrompt: 'Would you like to provide your email for updates? (Optional)',
    emailReceived: 'Email saved successfully!',
    skipEmail: 'Skip',
    onboardingComplete: '🎉 Welcome aboard! Your profile is all set. Use /menu to get started.',

    // Main Menu
    mainMenuIntro: '🎬 Welcome to PNPtv - Your Entertainment Hub!\n\nWhat would you like to do?',
    subscribe: `Subscribe to PNPtv PRIME\n----------------------------------\n\nJoin the most intense PNP content platform created by and for the community.\n\nPRIME gives you full access to:\n• Full-length PNP videos with real latinos smoking and slamming  \n• Exclusive releases starring Santino (x.com/pnpmethdaddy)  \n• Live streams and Zoom Rooms.\n• Unlimited Nearby to explore users around you  \n• Complete music and podcast library  \n\nChoose the plan that fits you best and complete your payment.\nYour membership will be activated automatically.\n\nPayment methods available: debit/credit card, Crypto, and most popular payment apps.`,
    myProfile: '👤 My Profile',
    nearbyUsers: '🌍 Nearby Users',
    liveStreams: '🎤 Live Streams',
    radioMenu: '📻 Radio',
    playerMenu: '🎵 Media Player',
    zoomRooms: '🎥 Zoom Rooms',
    support: '🤖 Support',
    settings: '⚙️ Settings',
    // Subscription
    subscriptionHeader: `\`\`\`
━━━━━━━━━━━━━━━━━━━━━━━━━━┐
    💎 Unlock PRIME! 💎    
━━━━━━━━━━━━━━━━━━━━━━━━━━┘
\`\`\``,
    subscriptionDivider: '',
    subscriptionDescription: `Unlock the full PNPtv experience and join
the hottest Latino PnP community! 🔥

**PRIME members get instant access to:**

• Full-length videos (Santino + performers)
• Weekly new content drops
• Unlimited Nearby access
• Video Calls & Live Streams
• Member-only events & perks

**Choose your plan below:**

\`\`\`
┌─────────────────────────┐
│  Let's get cloudy! ☁️  │
└─────────────────────────┘
\`\`\``,
    subscriptionPlans: '💎 Choose Your PRIME Plan:',
    planTrial: '🧪 Trial Week',
    planTrialDesc: '7 days to explore the full PNPtv! experience. Perfect to try before you commit.',
    planCrystal: '💠 Crystal PRIME',
    planCrystalDesc: '30 days of complete access to the PNPtv! community with all premium features.',
    planDiamond: '🔥 Diamond PRIME',
    planDiamondDesc: '30 days of the ultimate PNPtv! experience with all premium features and VIP support.',
    planLifetime: '♾️ Lifetime PRIME',
    planLifetimeDesc: 'Permanent, unlimited access forever. One payment, lifetime membership.',
    planMonthly: '💎 Monthly PRIME',
    planMonthlyDesc: '30 days of full access with all premium features. Our most popular plan.',
    planDetails: 'Plan Details:',
    selectPlan: 'Select Plan',
    paymentMethod: 'Choose payment method:',
    payWithEpayco: '💳 Pay with ePayco (USD)',
    payWithDaimo: '💰 Pay with Daimo (USDC)',
    paymentInstructions: '💳 Payment Instructions:\n\n'
      + 'Please click the link below to complete your payment:\n\n{paymentUrl}\n\n'
      + 'Once payment is confirmed, your subscription will be activated automatically.',
    paymentSuccess: '✅ Payment successful! Your PRIME subscription is now active. '
      + 'Enjoy premium features!',
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
    profileViews: 'Profile Views: {views}',
    memberSince: 'Member since: {date}',
    addToFavorites: '⭐ Add to Favorites',
    removeFromFavorites: '❌ Remove from Favorites',
    blockUser: '🚫 Block User',
    unblockUser: '✅ Unblock User',
    userBlocked: 'User has been blocked.',
    userUnblocked: 'User has been unblocked.',
    addedToFavorites: 'User added to your favorites!',
    removedFromFavorites: 'User removed from your favorites.',
    myFavorites: '⭐ My Favorites',
    noFavorites: 'You have no favorites yet.',
    blockedUsers: '🚫 Blocked Users',
      welcomeScreenPrime: `-----------------------------]
       Welcome to PNPtv PRIME!
-------------------------------]

This is your PRIME dashboard.
From here you can access all your premium features:
open Zoom Rooms, start live streams, watch full videos,
explore Nearby without limits, and join private events.`,
    noBlockedUsers: 'You have no blocked users.',
    shareProfile: '📤 Share Profile',
    profileShared: 'Profile card created! Tap to share it.',
    shareProfileCard: 'Share My Profile Card',
    privacyTitle: '🔒 Privacy Settings',
    showLocation: '📍 Show my location',
    showInterests: '🎯 Show my interests',
    showBio: '📝 Show my bio',
    allowMessages: '💬 Allow messages from others',
    showOnline: '🟢 Show when I\'m online',
    privacyUpdated: 'Privacy settings updated successfully!',
    viewUserProfile: 'View Profile',
    userNotFound: 'User not found.',
    cannotViewProfile: 'You cannot view this profile.',
    badges: {
      verified: '✅ Verified',
      premium: '💎 Premium',
      vip: '👑 VIP',
      moderator: '🛡️ Moderator',
      admin: '👨‍💼 Admin',
    },

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
    streamCreated: '✅ Live stream created successfully!',
    noActiveStreams: 'No active streams at the moment.',
    noStreamsYet: 'You haven\'t created any streams yet.',
    joinStream: '▶️ Join Stream',
    joinedStream: '✅ You joined the stream!',
    leftStream: '👋 You left the stream',
    streamEnded: '🛑 Stream Ended',
    streamNotFound: 'Stream not found',
    streamNotActive: 'This stream is not active',
    streamFull: 'This stream has reached maximum viewers',
    streamLiked: '❤️ Liked!',
    manageStream: 'Manage Stream',
    liveNow: 'Live Now',
    streamHostInstructions: 'Click "Start Broadcasting" to go live. Share your stream link with viewers!',
    streamInstructions: 'Click "Watch Stream" to start viewing. Enjoy!',
    paidStreamNotice: '💰 This is a paid stream',
    paymentIntegrationPending: 'Payment integration coming soon. Free access for now!',
    selectStreamCategory: '📁 Select a category for your stream:',
    browseByCategory: '📁 Browse streams by category:',
    noStreamsInCategory: 'No streams found in this category',
    streamsInCategory: 'Streams',
    streamComments: 'Stream Comments',
    noCommentsYet: 'No comments yet. Be the first to comment!',
    enterComment: 'Type your comment (max 500 characters):',
    commentAdded: 'Comment added successfully!',
    bannedFromCommenting: 'You are banned from commenting on this stream',
    commentsDisabled: 'Comments are disabled for this stream',

    // VOD (Video on Demand)
    availableVODs: 'Available Recordings',
    noVODsAvailable: 'No recordings available yet',
    watchVOD: 'Watch Recording',
    vodNotFound: 'Recording not found',

    // Share
    shareStream: 'Share Stream',
    shareLinkCopied: 'Share link ready!',
    shareInstructions: 'Share this link with your friends or post it on Telegram!',
    shareToTelegram: 'Share to Telegram',

    // Subscribe/Follow
    subscribedToStreamer: '🔔 You will be notified when this streamer goes live!',
    unsubscribedFromStreamer: '🔕 You won\'t receive notifications from this streamer anymore',

    // Emotes
    availableEmotes: 'Available Emotes',
    defaultEmotes: 'Default Emotes',
    customEmotes: 'Custom Emotes',
    useEmotesInComment: 'You can use emotes in your comment! Click "Show Emotes" to see available emotes.',
    emoteUsageInstructions: 'Type emote codes like :smile: or :fire: in your message!',
    emotesUsed: 'Emotes used',
    myEmotes: 'My Custom Emotes',
    noCustomEmotes: 'You have no custom emotes yet. Create one to get started!',
    enterEmoteCode: 'Enter a code for your emote (3-20 alphanumeric characters):\n\n'
      + 'Example: MyEmote, PogChamp, LUL',
    enterEmoteImage: 'Send the URL of your emote image:\n\n'
      + 'Example: https://example.com/emote.png\n\n'
      + 'Supported formats: PNG, JPG, GIF, WEBP',
    invalidEmoteCode: '❌ Invalid emote code. Use 3-20 alphanumeric characters only.',
    invalidImageUrl: '❌ Invalid image URL. '
      + 'Please provide a valid URL ending in .png, .jpg, .jpeg, .gif, or .webp',
    emoteCreated: 'Custom emote created!',
    emoteAwaitingApproval: 'Your emote is pending admin approval',
    emoteNotFound: 'Emote not found',
    emoteDeleted: 'Emote deleted successfully',
    emoteActivated: 'Emote activated',
    emoteDeactivated: 'Emote deactivated',
    manageEmotes: 'Manage Emotes',
    selectEmoteToEdit: 'Select an emote to view or edit:',
    stats: 'Statistics',
    approved: 'Approved',
    pending: 'Pending',
    rejected: 'Rejected',
    totalUsage: 'Total Usage',
    yourEmotes: 'Your Emotes',

    // Radio
    radioTitle: '```\n━━━━━━━━━━━━━━━━━━━━━━━━━━┐\n    📻 PNPtv Radio 24/7   \n━━━━━━━━━━━━━━━━━━━━━━━━━━┘\n```',
    listenNow: '🎧 Listen Now',
    requestSong: '🎵 Request Song',
    nowPlaying: '🎵 Now Playing',
    radioSchedule: '📅 Schedule',
    streamUrl: 'Listen here: {url}',
    songRequested: 'Song request received! We\'ll play it soon.',
    enterSongName: 'Enter song name to request:',
    radio: {
      description: 'Stream beats, chill vibes, and cloudy tunes all day long! 🎵☁️',
      onAir: 'On Air',
      liveNow: 'Live Now',
      tip: 'Tap the button below to open the stream in your favorite player',
      openStream: '🎧 Open Stream',
      artist: 'Artist',
      duration: 'Duration',
      startedAt: 'Started at',
      noSongPlaying: 'No song information available right now.',
      history: '📜 History',
      recentlyPlayed: 'Recently Played',
      noHistory: 'No history available yet.',
      noSchedule: 'No schedule set yet.',
      requestLimitReached: 'You have reached the daily request limit (5 songs).',
      admin: {
        title: 'Radio Management',
        stats: 'Statistics',
        totalRequests: 'Total Requests',
        songsPlayed: 'Songs Played',
        pendingRequests: 'Pending Requests',
        setNowPlaying: '🎵 Set Now Playing',
        viewRequests: '📋 View Song Requests',
        manageSchedule: '📅 Manage Schedule',
        statistics: '📊 Statistics',
        enterSongTitle: 'Enter the song title:',
        enterArtist: 'Enter the artist name:',
        enterDuration: 'Enter the duration (e.g., 3:45):',
        nowPlayingSet: 'Now playing updated successfully!',
        noRequests: 'No pending song requests.',
        requestApproved: 'Request approved!',
        requestRejected: 'Request rejected!',
        scheduleManagement: 'Schedule Management',
        addToSchedule: '➕ Add to Schedule',
        selectDay: 'Select a day:',
        enterTimeSlot: 'Enter time slot (e.g., 14:00-16:00):',
        enterProgramName: 'Enter program name:',
        enterDescription: 'Enter program description (optional):',
        scheduleCreated: 'Schedule entry created successfully!',
        scheduleDeleted: 'Schedule entry deleted!',
        noScheduleEntries: 'No schedule entries yet.',
      },
    },

    // Media Player
    player: {
      title: 'PNP Media Player',
      description: 'Your complete music and video player',
      browseMusic: 'Music',
      browseVideo: 'Videos',
      myPlaylists: 'My Playlists',
      publicPlaylists: 'Public Playlists',
      trending: 'Trending',
      categories: 'Categories',
      search: 'Search',
      nowPlaying: 'Now Playing',
      music: 'Music',
      video: 'Videos',
      library: 'Library',
      plays: 'plays',
      likes: 'likes',
      tracks: 'tracks',
      followers: 'followers',
      noMedia: 'No media available yet.',
      noPlaylists: 'You don\'t have any playlists yet.',
      noPublicPlaylists: 'No public playlists available.',
      noTrending: 'No trending media at the moment.',
      noCategoryMedia: 'No media in this category.',
      noResults: 'No results found.',
      createPlaylist: 'Create Playlist',
      playlistCreated: 'Playlist created successfully!',
      enterPlaylistName: 'Enter a name for your playlist:',
      enterSearchQuery: 'Enter your search query:',
      searchResults: 'Search Results',
      selectCategory: 'Select a category to browse:',
      mediaNotFound: 'Media not found.',
      playlistNotFound: 'Playlist not found.',
      emptyPlaylist: 'This playlist is empty.',
      nothingPlaying: 'Nothing is playing right now.',
      playing: 'Playing',
      paused: 'Paused',
      stopped: 'Stopped',
      resumed: 'Resumed',
      controls: 'Controls',
      shuffle: 'Shuffle',
      repeat: 'Repeat',
      volume: 'Volume',
      like: 'Like',
      liked: 'Liked!',
      playPlaylist: 'Play Playlist',
      playingPlaylist: 'Playing playlist',
      noQueue: 'No queue available.',
    },

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
    cristinaGreeting: 'Hi! I\'m Cristina. How can I help you today?',
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
    searchUser: 'Enter user ID, username, name, or email to search:',
    userFound: 'User found:',
    extendSubscription: '⏰ Extend Subscription',
    deactivateUser: '🚫 Deactivate User',
    broadcastTarget: 'Select broadcast target:',
    allUsers: '👥 All Users',
    premiumOnly: '💎 Premium Only',
    freeOnly: '🆓 Free Users Only',
    enterBroadcast: 'Enter your broadcast message:',
    broadcastSent: 'Broadcast sent to {count} users!',

    // Gamification
    gamification: {
      title: '🎮 Gamification System',
      description: 'Manage user engagement, leaderboards, and badges',
      weeklyLeaderboard: '🏆 Weekly Leaderboard',
      allTimeLeaderboard: '🌟 All-Time Leaderboard',
      statistics: '📊 Activity Statistics',
      badgeManagement: '🏅 Badge Management',
      createBadge: '➕ Create Custom Badge',
      listBadges: '📋 List Custom Badges',
      assignBadge: '🎯 Assign Badge to User',
      enterBadgeName: 'Enter the badge name:',
      enterBadgeDescription: 'Enter the badge description:',
      enterBadgeIcon: 'Enter the badge icon (emoji):',
      badgeCreated: 'Badge "{name}" created successfully!',
      badgeDeleted: 'Badge deleted successfully!',
      enterUserIdForBadge: 'Enter the user ID to assign a badge:',
      selectBadge: 'Select a badge to assign:',
      badgeAssigned: 'Badge assigned!',
      badgeAssignedSuccess: 'Badge assigned to {name}: {badge}',
      badgeRemoved: 'Badge removed!',
      customBadges: 'Custom Badges',
      noBadges: 'No custom badges created yet.',
      badgeDescription: 'Create and manage custom badges for your community',
      noActivityThisWeek: 'No activity recorded this week.',
      noActivity: 'No activity recorded yet.',
      userActivity: 'User Activity Report',
      noUserActivity: 'No activity recorded for this user.',
      refresh: '🔄 Refresh',
    },

    // Errors
    invalidInput: 'Invalid input. Please try again.',
    unauthorized: 'You are not authorized to perform this action.',
    subscriptionRequired: 'This feature requires a PRIME subscription.',
    locationRequired: 'Please share your location first.',
    networkError: 'Network error. Please check your connection and try again.',
    serverError: 'Server error. Please try again later.',

    // Moderation
    moderation: {
      warning: 'Warning',
      user_kicked: 'User Removed',
      group_rules: 'Group Rules',
      no_warnings: 'No Warnings',
      your_warnings: 'Your Warnings',
      username_required: 'Username Required',
      reason: {
        unauthorized_link: 'Unauthorized link detected',
        spam: 'Spam message',
        flooding: 'Sending messages too fast',
        profanity: 'Inappropriate language',
        user_banned: 'User is banned',
        excessive_caps: 'Excessive capital letters',
        excessive_emojis: 'Too many emojis',
        repeated_characters: 'Repeated characters',
        excessive_punctuation: 'Excessive punctuation',
      },
    },
  },
  es: {
        groupRedirect: ({ username, command, botUsername }) =>
          `@${username} Te envié un mensaje privado sobre tu solicitud. Por favor revísalo. Esto es por privacidad y para cumplir con la política anti-spam del grupo.\n\n[Abrir en chat privado con tu solicitud](https://t.me/${botUsername}?start=${command})`,
    // General
    welcome: '👋 ¡Bienvenido a PNPtv!',
    welcomeScreen: `-----------------------------]
      Bienvenido a PNPtv! Premium
-------------------------------]

Este es tu panel de control.
Desde aqui puedes acceder a todas tus funciones premium:
abrir Salas Zoom, iniciar transmisiones en vivo, ver videos completos,
explorar Cercanos sin limites y unirte a eventos privados.`,
    welcomeScreenFree: `-----------------------------]
              PNPtv!
-------------------------------]

Bienvenido a PNPtv!  
Disfruta la experiencia completa desde aqui.

Desbloquea todas las funciones premium:
• Videos completos  
• Transmisiones en vivo  
• Nearby ilimitado  
• Salas Zoom  
• Eventos privados de la comunidad

Toca "Suscribete a PRIME" para obtener acceso inmediato.`,
    back: '🔙 Atrás',
    cancel: '❌ Cancelar',
    next: '➡️ Siguiente',
    confirm: '✅ Confirmar',
    error: '❌ Ocurrió un error. Por favor intenta de nuevo.',
    success: '✅ ¡Éxito!',
    loading: '⏳ Cargando...',
    days: 'días',

    // Onboarding
    selectLanguage: 'Por favor selecciona tu idioma:',
    languageSelected: 'Idioma configurado a Español 🇪🇸',
    ageConfirmation: '¿Tienes 18 años o más?',
    ageConfirmYes: 'Sí, tengo 18+',
    ageConfirmNo: 'No',
    underAge: 'Lo sentimos, debes tener 18 años o más para usar este servicio.',
    termsAndPrivacy: 'Por favor lee y acepta nuestros Términos de Servicio y Política de Privacidad:',
    termsAccepted: 'Términos y Política de Privacidad aceptados ✅',
    emailPrompt: '¿Deseas proporcionar tu correo para actualizaciones? (Opcional)',
    emailReceived: '¡Correo guardado exitosamente!',
    skipEmail: 'Omitir',
    onboardingComplete: '🎉 ¡Bienvenido! Tu perfil está configurado. Usa /menu para comenzar.',

    // Main Menu
    mainMenuIntro: '🎬 Bienvenido a PNPtv - ¡Tu Centro de Entretenimiento!\n\n¿Qué te gustaría hacer?',
    subscribe: `Suscríbete a PNPtv PRIME\n----------------------------------\n\nÚnete a la plataforma de contenido PNP más intensa, creada por y para la comunidad.\n\nPRIME te da acceso total a:\n• Videos PNP completos con latinos reales fumando y slameando  \n• Estrenos exclusivos protagonizados por Santino (x.com/pnpmethdaddy)  \n• Transmisiones en vivo y Salas Zoom.\n• Nearby ilimitado para explorar usuarios cerca de ti  \n• Biblioteca completa de música y podcasts  \n\nElige el plan que mejor se adapte a ti y completa tu pago.\nTu membresía se activará automáticamente.\n\nMétodos de pago disponibles: tarjeta débito/crédito, Crypto y las apps de pago más populares.`,
    myProfile: '👤 Mi Perfil',
    nearbyUsers: '🌍 Usuarios Cercanos',
    liveStreams: '🎤 Transmisiones en Vivo',
    radioMenu: '📻 Radio',
    playerMenu: '🎵 Reproductor',
    zoomRooms: '🎥 Salas Zoom',
    support: '🤖 Soporte',
    settings: '⚙️ Configuración',
    // Subscription
    subscriptionHeader: `\`\`\`
━━━━━━━━━━━━━━━━━━━━━━━━━━┐
   💎 Desbloquea PRIME! 💎  
━━━━━━━━━━━━━━━━━━━━━━━━━━┘
\`\`\``,
    subscriptionDivider: '',
    subscriptionDescription: `Desbloquea la experiencia completa de PNPtv
y únete a la comunidad Latina más hot! 🔥

**Como miembro PRIME obtienes:**

• Videos completos (Santino + performers)
• Contenido nuevo cada semana
• Acceso ilimitado a Cercanos
• Video Llamadas y Transmisiones en Vivo
• Eventos exclusivos y beneficios

**Elige tu plan abajo:**

\`\`\`
┌─────────────────────────┐
│   Vamos a volar! ☁️    │
└─────────────────────────┘
\`\`\``,
    subscriptionPlans: '💎 Elige tu Plan PRIME:',
    planTrial: '🧪 Semana de Prueba',
    planTrialDesc: '7 días para explorar la experiencia completa de PNPtv!. Perfecto para probar antes de comprometerte.',
    planCrystal: '💠 Crystal PRIME',
    planCrystalDesc: '30 días de acceso completo a la comunidad PNPtv! con todas las funciones premium.',
    planDiamond: '🔥 Diamond PRIME',
    planDiamondDesc: '30 días de la experiencia definitiva PNPtv! con todas las funciones premium y soporte VIP.',
    planLifetime: '♾️ Lifetime PRIME',
    planLifetimeDesc: 'Acceso permanente e ilimitado para siempre. Un solo pago, membresía de por vida.',
    planMonthly: '💎 Monthly PRIME',
    planMonthlyDesc: '30 días de acceso completo con todas las funciones premium. Nuestro plan más popular.',
    planDetails: 'Detalles del Plan:',
    selectPlan: 'Seleccionar Plan',
    paymentMethod: 'Elige método de pago:',
    payWithEpayco: '💳 Pagar con ePayco (USD)',
    payWithDaimo: '💰 Pagar con Daimo (USDC)',
    paymentInstructions: '💳 Instrucciones de Pago:\n\n'
      + 'Por favor haz clic en el enlace para completar tu pago:\n\n{paymentUrl}\n\n'
      + 'Una vez confirmado el pago, tu suscripción se activará automáticamente.',
    paymentSuccess: '✅ ¡Pago exitoso! Tu suscripción PRIME está activa. '
      + '¡Disfruta las funciones premium!',
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
    profileViews: 'Visitas al Perfil: {views}',
    memberSince: 'Miembro desde: {date}',
    addToFavorites: '⭐ Agregar a Favoritos',
    removeFromFavorites: '❌ Quitar de Favoritos',
    blockUser: '🚫 Bloquear Usuario',
    unblockUser: '✅ Desbloquear Usuario',
    userBlocked: 'El usuario ha sido bloqueado.',
    userUnblocked: 'El usuario ha sido desbloqueado.',
    addedToFavorites: '¡Usuario agregado a tus favoritos!',
    removedFromFavorites: 'Usuario removido de tus favoritos.',
    myFavorites: '⭐ Mis Favoritos',
    noFavorites: 'Aún no tienes favoritos.',
    blockedUsers: '🚫 Usuarios Bloqueados',
      welcomeScreenPrime: `-----------------------------]
      Bienvenido a PNPtv PRIME!
-------------------------------]

Este es tu panel PRIME.
Desde aqui puedes acceder a todas tus funciones premium:
abrir Salas Zoom, iniciar transmisiones en vivo, ver videos completos,
explorar Cercanos sin limites y unirte a eventos privados.`,
    noBlockedUsers: 'No tienes usuarios bloqueados.',
    shareProfile: '📤 Compartir Perfil',
    profileShared: '¡Tarjeta de perfil creada! Toca para compartirla.',
    shareProfileCard: 'Compartir Mi Tarjeta de Perfil',
    privacyTitle: '🔒 Configuración de Privacidad',
    showLocation: '📍 Mostrar mi ubicación',
    showInterests: '🎯 Mostrar mis intereses',
    showBio: '📝 Mostrar mi biografía',
    allowMessages: '💬 Permitir mensajes de otros',
    showOnline: '🟢 Mostrar cuando estoy en línea',
    privacyUpdated: '¡Configuración de privacidad actualizada exitosamente!',
    viewUserProfile: 'Ver Perfil',
    userNotFound: 'Usuario no encontrado.',
    cannotViewProfile: 'No puedes ver este perfil.',
    badges: {
      verified: '✅ Verificado',
      premium: '💎 Premium',
      vip: '👑 VIP',
      moderator: '🛡️ Moderador',
      admin: '👨‍💼 Admin',
    },

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
    streamCreated: '✅ ¡Transmisión en vivo creada exitosamente!',
    noActiveStreams: 'No hay transmisiones activas en este momento.',
    noStreamsYet: 'Aún no has creado ninguna transmisión.',
    joinStream: '▶️ Unirse a Transmisión',
    joinedStream: '✅ ¡Te uniste a la transmisión!',
    leftStream: '👋 Saliste de la transmisión',
    streamEnded: '🛑 Transmisión Finalizada',
    streamNotFound: 'Transmisión no encontrada',
    streamNotActive: 'Esta transmisión no está activa',
    streamFull: 'Esta transmisión alcanzó el máximo de espectadores',
    streamLiked: '❤️ ¡Me gusta!',
    manageStream: 'Gestionar Transmisión',
    liveNow: 'En Vivo Ahora',
    streamHostInstructions: 'Haz clic en "Iniciar Transmisión" para salir en vivo. '
      + '¡Comparte tu enlace con los espectadores!',
    streamInstructions: 'Haz clic en "Ver Transmisión" para comenzar a ver. ¡Disfruta!',
    paidStreamNotice: '💰 Esta es una transmisión de pago',
    paymentIntegrationPending: 'Integración de pagos próximamente. ¡Acceso gratuito por ahora!',
    selectStreamCategory: '📁 Selecciona una categoría para tu transmisión:',
    browseByCategory: '📁 Explorar transmisiones por categoría:',
    noStreamsInCategory: 'No hay transmisiones en esta categoría',
    streamsInCategory: 'Transmisiones',
    streamComments: 'Comentarios de la Transmisión',
    noCommentsYet: '¡No hay comentarios aún. Sé el primero en comentar!',
    enterComment: 'Escribe tu comentario (máx 500 caracteres):',
    commentAdded: '¡Comentario agregado exitosamente!',
    bannedFromCommenting: 'Estás bloqueado de comentar en esta transmisión',
    commentsDisabled: 'Los comentarios están deshabilitados para esta transmisión',

    // VOD (Video on Demand)
    availableVODs: 'Grabaciones Disponibles',
    noVODsAvailable: 'No hay grabaciones disponibles aún',
    watchVOD: 'Ver Grabación',
    vodNotFound: 'Grabación no encontrada',

    // Share
    shareStream: 'Compartir Transmisión',
    shareLinkCopied: '¡Enlace listo para compartir!',
    shareInstructions: '¡Comparte este enlace con tus amigos o publícalo en Telegram!',
    shareToTelegram: 'Compartir en Telegram',

    // Subscribe/Follow
    subscribedToStreamer: '🔔 ¡Recibirás notificaciones cuando este streamer esté en vivo!',
    unsubscribedFromStreamer: '🔕 Ya no recibirás notificaciones de este streamer',

    // Emotes
    availableEmotes: 'Emotes Disponibles',
    defaultEmotes: 'Emotes Predeterminados',
    customEmotes: 'Emotes Personalizados',
    useEmotesInComment: '¡Puedes usar emotes en tu comentario! '
      + 'Haz clic en "Mostrar Emotes" para ver los emotes disponibles.',
    emoteUsageInstructions: '¡Escribe códigos de emotes como :smile: o :fire: en tu mensaje!',
    emotesUsed: 'Emotes usados',
    myEmotes: 'Mis Emotes Personalizados',
    noCustomEmotes: '¡Aún no tienes emotes personalizados. Crea uno para comenzar!',
    enterEmoteCode: 'Ingresa un código para tu emote (3-20 caracteres alfanuméricos):\n\n'
      + 'Ejemplo: MiEmote, PogChamp, LUL',
    enterEmoteImage: 'Envía la URL de la imagen de tu emote:\n\n'
      + 'Ejemplo: https://ejemplo.com/emote.png\n\n'
      + 'Formatos soportados: PNG, JPG, GIF, WEBP',
    invalidEmoteCode: '❌ Código de emote inválido. '
      + 'Usa solo 3-20 caracteres alfanuméricos.',
    invalidImageUrl: '❌ URL de imagen inválida. '
      + 'Proporciona una URL válida que termine en .png, .jpg, .jpeg, .gif, o .webp',
    emoteCreated: '¡Emote personalizado creado!',
    emoteAwaitingApproval: 'Tu emote está pendiente de aprobación del administrador',
    emoteNotFound: 'Emote no encontrado',
    emoteDeleted: 'Emote eliminado exitosamente',
    emoteActivated: 'Emote activado',
    emoteDeactivated: 'Emote desactivado',
    manageEmotes: 'Gestionar Emotes',
    selectEmoteToEdit: 'Selecciona un emote para ver o editar:',
    stats: 'Estadísticas',
    approved: 'Aprobados',
    pending: 'Pendientes',
    rejected: 'Rechazados',
    totalUsage: 'Uso Total',
    yourEmotes: 'Tus Emotes',

    // Radio
    radioTitle: '```\n━━━━━━━━━━━━━━━━━━━━━━━━━━┐\n   📻 Radio PNPtv 24/7    \n━━━━━━━━━━━━━━━━━━━━━━━━━━┘\n```',
    listenNow: '🎧 Escuchar Ahora',
    requestSong: '🎵 Pedir Canción',
    nowPlaying: '🎵 Sonando Ahora',
    radioSchedule: '📅 Programación',
    streamUrl: 'Escuchar aquí: {url}',
    songRequested: '¡Solicitud de canción recibida! La reproduciremos pronto.',
    enterSongName: 'Ingresa el nombre de la canción:',
    radio: {
      description: '¡Música, vibes relajantes y tonos cloudys todo el día! 🎵☁️',
      onAir: 'Al Aire',
      liveNow: 'En Vivo Ahora',
      tip: 'Toca el botón de abajo para abrir el stream en tu '
        + 'reproductor favorito',
      openStream: '🎧 Abrir Stream',
      artist: 'Artista',
      duration: 'Duración',
      startedAt: 'Comenzó a las',
      noSongPlaying: 'No hay información de canción disponible en este momento.',
      history: '📜 Historial',
      recentlyPlayed: 'Reproducidas Recientemente',
      noHistory: 'Aún no hay historial disponible.',
      noSchedule: 'Aún no hay programación.',
      requestLimitReached: 'Has alcanzado el límite diario de solicitudes (5 canciones).',
      admin: {
        title: 'Gestión de Radio',
        stats: 'Estadísticas',
        totalRequests: 'Solicitudes Totales',
        songsPlayed: 'Canciones Reproducidas',
        pendingRequests: 'Solicitudes Pendientes',
        setNowPlaying: '🎵 Establecer Sonando Ahora',
        viewRequests: '📋 Ver Solicitudes de Canciones',
        manageSchedule: '📅 Gestionar Programación',
        statistics: '📊 Estadísticas',
        enterSongTitle: 'Ingresa el título de la canción:',
        enterArtist: 'Ingresa el nombre del artista:',
        enterDuration: 'Ingresa la duración (ej: 3:45):',
        nowPlayingSet: '¡Sonando ahora actualizado exitosamente!',
        noRequests: 'No hay solicitudes de canciones pendientes.',
        requestApproved: '¡Solicitud aprobada!',
        requestRejected: '¡Solicitud rechazada!',
        scheduleManagement: 'Gestión de Programación',
        addToSchedule: '➕ Agregar a la Programación',
        selectDay: 'Selecciona un día:',
        enterTimeSlot: 'Ingresa el horario (ej: 14:00-16:00):',
        enterProgramName: 'Ingresa el nombre del programa:',
        enterDescription: 'Ingresa la descripción del programa (opcional):',
        scheduleCreated: '¡Entrada de programación creada exitosamente!',
        scheduleDeleted: '¡Entrada de programación eliminada!',
        noScheduleEntries: 'Aún no hay entradas de programación.',
      },
    },

    // Media Player
    player: {
      title: 'Reproductor PNP',
      description: 'Tu reproductor completo de música y video',
      browseMusic: 'Música',
      browseVideo: 'Videos',
      myPlaylists: 'Mis Listas',
      publicPlaylists: 'Listas Públicas',
      trending: 'Tendencias',
      categories: 'Categorías',
      search: 'Buscar',
      nowPlaying: 'Reproduciendo',
      music: 'Música',
      video: 'Videos',
      library: 'Biblioteca',
      plays: 'reproducciones',
      likes: 'me gusta',
      tracks: 'pistas',
      followers: 'seguidores',
      noMedia: 'No hay contenido disponible aún.',
      noPlaylists: 'Aún no tienes listas de reproducción.',
      noPublicPlaylists: 'No hay listas públicas disponibles.',
      noTrending: 'No hay tendencias en este momento.',
      noCategoryMedia: 'No hay contenido en esta categoría.',
      noResults: 'No se encontraron resultados.',
      createPlaylist: 'Crear Lista',
      playlistCreated: '¡Lista creada exitosamente!',
      enterPlaylistName: 'Ingresa un nombre para tu lista:',
      enterSearchQuery: 'Ingresa tu búsqueda:',
      searchResults: 'Resultados de Búsqueda',
      selectCategory: 'Selecciona una categoría para explorar:',
      mediaNotFound: 'Contenido no encontrado.',
      playlistNotFound: 'Lista no encontrada.',
      emptyPlaylist: 'Esta lista está vacía.',
      nothingPlaying: 'No se está reproduciendo nada ahora.',
      playing: 'Reproduciendo',
      paused: 'En Pausa',
      stopped: 'Detenido',
      resumed: 'Reanudado',
      controls: 'Controles',
      shuffle: 'Aleatorio',
      repeat: 'Repetir',
      volume: 'Volumen',
      like: 'Me Gusta',
      liked: '¡Me gusta!',
      playPlaylist: 'Reproducir Lista',
      playingPlaylist: 'Reproduciendo lista',
      noQueue: 'No hay cola disponible.',
    },

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
    roomCreated: '🎥 ¡Tu sala Zoom está lista!\n\n🔗 URL de Ingreso: {url}\n\n'
      + '💡 Comparte este enlace con los participantes.',
    noActiveRooms: 'No hay salas activas disponibles.',

    // Support
    supportTitle: '🤖 Centro de Soporte',
    chatWithCristina: '💬 Chat con Cristina (IA)',
    contactAdmin: '👨‍💼 Contactar Admin',
    faq: '❓ Preguntas Frecuentes',
    cristinaGreeting: '¡Hola! Soy Cristina. ¿Cómo puedo ayudarte hoy?',
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
    searchUser: 'Ingresa ID, usuario, nombre o email para buscar:',
    userFound: 'Usuario encontrado:',
    extendSubscription: '⏰ Extender Suscripción',
    deactivateUser: '🚫 Desactivar Usuario',
    broadcastTarget: 'Selecciona objetivo de difusión:',
    allUsers: '👥 Todos los Usuarios',
    premiumOnly: '💎 Solo Premium',
    freeOnly: '🆓 Solo Usuarios Gratis',
    enterBroadcast: 'Ingresa tu mensaje de difusión:',
    broadcastSent: '¡Difusión enviada a {count} usuarios!',

    // Gamification
    gamification: {
      title: '🎮 Sistema de Gamificación',
      description: 'Gestiona el engagement de usuarios, rankings y badges',
      weeklyLeaderboard: '🏆 Ranking Semanal',
      allTimeLeaderboard: '🌟 Ranking de Todos los Tiempos',
      statistics: '📊 Estadísticas de Actividad',
      badgeManagement: '🏅 Gestión de Badges',
      createBadge: '➕ Crear Badge Personalizado',
      listBadges: '📋 Listar Badges Personalizados',
      assignBadge: '🎯 Asignar Badge a Usuario',
      enterBadgeName: 'Ingresa el nombre del badge:',
      enterBadgeDescription: 'Ingresa la descripción del badge:',
      enterBadgeIcon: 'Ingresa el icono del badge (emoji):',
      badgeCreated: '¡Badge "{name}" creado exitosamente!',
      badgeDeleted: '¡Badge eliminado exitosamente!',
      enterUserIdForBadge: 'Ingresa el ID del usuario para asignar un badge:',
      selectBadge: 'Selecciona un badge para asignar:',
      badgeAssigned: '¡Badge asignado!',
      badgeAssignedSuccess: 'Badge asignado a {name}: {badge}',
      badgeRemoved: '¡Badge removido!',
      customBadges: 'Badges Personalizados',
      noBadges: 'Aún no se han creado badges personalizados.',
      badgeDescription: 'Crea y gestiona badges personalizados para tu comunidad',
      noActivityThisWeek: 'No hay actividad registrada esta semana.',
      noActivity: 'Aún no hay actividad registrada.',
      userActivity: 'Reporte de Actividad del Usuario',
      noUserActivity: 'No hay actividad registrada para este usuario.',
      refresh: '🔄 Actualizar',
    },

    // Errors
    invalidInput: 'Entrada inválida. Por favor intenta de nuevo.',
    unauthorized: 'No estás autorizado para realizar esta acción.',
    subscriptionRequired: 'Esta función requiere una suscripción PRIME.',
    locationRequired: 'Por favor comparte tu ubicación primero.',
    networkError: 'Error de red. Por favor verifica tu conexión e intenta de nuevo.',
    serverError: 'Error del servidor. Por favor intenta más tarde.',

    // Moderation
    moderation: {
      warning: 'Advertencia',
      user_kicked: 'Usuario Eliminado',
      group_rules: 'Reglas del Grupo',
      no_warnings: 'Sin Advertencias',
      your_warnings: 'Tus Advertencias',
      username_required: 'Username Requerido',
      reason: {
        unauthorized_link: 'Enlace no autorizado detectado',
        spam: 'Mensaje de spam',
        flooding: 'Enviando mensajes muy rápido',
        profanity: 'Lenguaje inapropiado',
        user_banned: 'Usuario está baneado',
        excessive_caps: 'Exceso de mayúsculas',
        excessive_emojis: 'Demasiados emojis',
        repeated_characters: 'Caracteres repetidos',
        excessive_punctuation: 'Puntuación excesiva',
      },
    },
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

  // Support nested keys like 'moderation.username_required'
  const getNestedValue = (obj, keyPath) => {
    return keyPath.split('.').reduce((current, k) => current?.[k], obj);
  };

  let text = getNestedValue(translations[language], key)
    || getNestedValue(translations.en, key)
    || key;

  // Replace parameters
  if (typeof text === 'string') {
    Object.keys(params).forEach((param) => {
      text = text.replace(`{${param}}`, params[param]);
    });
  }

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
