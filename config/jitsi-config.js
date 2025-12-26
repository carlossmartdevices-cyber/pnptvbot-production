/**
 * Optimized Jitsi (8x8 JaaS) Configuration
 * For 24/7 community room with high-traffic optimization
 */

module.exports = {
  // Room Configuration
  room: {
    persistent: true,
    name: 'pnptv-community',
    maxParticipants: 1000,
    tier: 'unlimited'
  },

  // Performance Optimization
  performance: {
    // Connection settings
    connectionRetryTimes: 3,
    connectionRetryDelay: 5000,
    iceTransportPolicy: 'all', // Use both host and relay candidates

    // Audio settings
    audio: {
      enableNoiseSuppression: true,
      enableAutoGainControl: true,
      enableEchoCancellation: true,
      stereo: true,
      bitrate: 16000 // 16 kbps minimum
    },

    // Video settings (adaptive bitrate)
    video: {
      startBitrate: 800, // Start at 800 kbps
      preferredCodec: 'vp9', // VP9 for better compression
      resizeTimeout: 5000,
      // Simulcast layers for bandwidth adaptation
      simulcast: {
        enabled: true,
        layers: [
          { resolution: 640, bandwidth: 500 },   // Low quality
          { resolution: 960, bandwidth: 1200 },  // Medium quality
          { resolution: 1280, bandwidth: 2500 }  // High quality
        ]
      }
    },

    // Network optimization
    network: {
      enableAdaptiveQuality: true,
      enableCongestionControl: true,
      p2pMode: false, // Always use server since we have many participants
      dtlsTransport: true // Use DTLS for encryption
    }
  },

  // UI Configuration for Community Room
  ui: {
    // Toolbar
    toolbar: {
      microphone: true,
      camera: true,
      desktop: true,
      fullscreen: true,
      profile: false,
      chat: false,
      settings: true,
      sharedvideo: true,
      etherpad: false,
      filmstrip: true
    },

    // Interface settings
    interface: {
      filmstripOnly: false,
      filmstripMinHeight: 100,
      largeVideoElement: 'jitsi-meet',
      inhibitSSLCert: true // Allow self-signed certs in dev
    }
  },

  // Moderator Settings
  moderator: {
    // Moderator can control the room
    canMuteOthers: true,
    canKickOthers: true,
    canLockRoom: false,

    // Access control
    passwordRequired: false,
    startLocked: false,
    requireApproval: false, // Allow anyone to join without moderator approval
    autoDisableModeration: true, // Disable moderation enforcement
    lobbyEnabled: false // Don't require lobby for joining
  },

  // Feature Flags
  features: {
    // Recording
    recording: {
      enabled: true,
      type: 'jibri' // Jitsi Broadcast Infrastructure
    },

    // Chat
    chat: {
      enabled: true,
      persistentHistory: true,
      displayTimeout: 5000
    },

    // Presence
    presence: {
      enabled: true,
      updateInterval: 5000
    },

    // Analytics
    analytics: {
      enabled: true,
      reportInterval: 60000 // Report every minute
    },

    // Screen sharing
    desktopSharing: {
      enabled: true,
      requiresExtension: false,
      disableAudio: false,
      disableVideo: false,
      minChromeExtensionVersion: '0.1'
    }
  },

  // Stats and Monitoring
  stats: {
    // WebRTC stats collection
    rtcStats: {
      enabled: true,
      interval: 5000, // Collect every 5 seconds
      persistInterval: 60000, // Persist every minute
      sanitizePattern: /([a-z0-9]{20,})/gi
    },

    // Bandwidth stats
    bandwidth: {
      enabled: true,
      thresholds: {
        critical: 100, // kbps
        low: 500,
        medium: 2000,
        high: 5000
      }
    },

    // CPU/Thermal stats
    cpuStats: {
      enabled: true,
      interval: 5000
    }
  },

  // Security Settings
  security: {
    // CORS
    cors: {
      allowedOrigins: [
        'https://pnptv.app',
        'https://www.pnptv.app',
        'https://videorooms.pnptv.app'
      ]
    },

    // JWT validation
    jwt: {
      required: true,
      checkAudience: true
    },

    // Rate limiting
    rateLimit: {
      enabled: true,
      windowMs: 60000,
      maxRequests: 100
    }
  },

  // Server Configuration
  server: {
    // Jitsi Meet Server
    focus: 'focus.8x8.vc',
    muc: 'conference.8x8.vc',
    mucNickname: 'PNPtv Bot',

    // Transcription (optional)
    transcription: {
      enabled: false,
      languages: ['en', 'es']
    },

    // Recording server
    recordingServer: 'jibri.8x8.vc',
    recordingFormat: 'mp4'
  },

  // Room Event Handlers
  events: {
    // Video conference events to track
    trackEvents: [
      'videoConferenceJoined',
      'videoConferenceLeft',
      'participantJoined',
      'participantLeft',
      'readyToClose',
      'errorOccurred',
      'connectionFailed'
    ]
  },

  // Logging
  logging: {
    enabled: true,
    level: 'debug', // 'debug', 'info', 'warn', 'error'
    flushInterval: 60000
  },

  // Bandwidth Requirements
  bandwidth: {
    audioBandwidth: 32,     // kbps per audio stream
    videoBandwidth: 2500,   // kbps per video stream (max)
    screenShareBandwidth: 5000 // kbps for screen share
  }
};
