Optimize PNPtv Web Apps Architecture Guide

  Overview

  All webapps are React 18 + Vite SPAs that integrate with
  the PNPtv backend via JWT tokens. They're launched from
  Telegram bot commands and use Telegram WebApp SDK for
  seamless Telegram integration.

  ---
  1. HANGOUTS (Video Conferencing)

  Purpose: HD video rooms for group calls and hangouts

  Data Flow:
  User → Telegram (/hangout) → Backend generates Agora
  token
    ↓
  Web URL params: room=ID, token=XXX, uid=user,
  username=John, appId=XXX
    ↓
  React app joins Agora channel → Video RTC stream
    ↓
  Participants list synced via backend API

  User Journey:
  1. User types /hangout in Telegram
  2. Bot validates membership, generates Agora token
  3. Bot sends link with embedded params:
  pnptv.app/hangouts?room=...&token=...
  4. User clicks → Opens hangouts app
  5. Auto-joins Agora channel with camera/mic
  6. Can invite others, see participant list, mute/unmute,
  share screen

  UX/UI Components Needed:
  - Main Container: Dark theme (PNPtv brand colors)
  - Video Grid: RTCView components for each participant
  - Controls Bar (bottom):
    - Mute/Unmute audio
    - Camera on/off
    - Screen share button
    - End call button
    - Leave button
  - Participant List: Shows who's in the call
  - Spotlight Feature: Focus on one speaker
  - Settings: Camera/mic selection, video quality

  Tech Stack:
  - Agora RTC SDK for video/audio
  - Real-time: Direct RTCPeerConnection
  - State: React hooks (useState, useEffect)
  - Styling: CSS (dark, modern design)

  Database Integration:
  - MainRoom model: Main public room (always exists)
  - VideoCall model: Private calls created by users
  - Call events logged to backend

  ---
  2. VIDEORAMA (Video Streaming & Uploads)

  Purpose: YouTube links + user video uploads with
  mobile-first UI

  Data Flow:
  User → Telegram (/videorama) → Backend prepares session
    ↓
  Web app loads with JWT token in URL params
    ↓
  User can:
    a) Paste YouTube URL → Display inline player
    b) Upload video → POST /api/videorama/upload → Store in
   Navidrome
    ↓
  Display library of all user's videos

  User Journey:
  1. User types /videorama or /portal
  2. Backend generates JWT token
  3. User sees video library interface
  4. Can paste YouTube URL → App fetches & embeds
  5. Can upload local video → Backend stores, shows in
  library
  6. Can play videos in-app with controls

  UX/UI Components Needed:
  - Header: App title, back button
  - Input Section:
    - YouTube URL input field (with validation)
    - Upload video button (drag-drop or file picker)
  - Video Grid/List: Display all videos
    - Thumbnail
    - Title
    - Duration
    - Upload date
    - Delete option
  - Video Player Modal:
    - Fullscreen toggle
    - Volume control
    - Progress bar
    - Subtitle support
  - No Videos State: Friendly message when empty

  Tech Stack:
  - YouTube iFrame embed for links
  - HTML5 <video> tag for uploads
  - Multer/Express backend for file handling
  - Navidrome integration for storage

  Database Integration:
  - Video metadata stored in PostgreSQL
  - Files stored in Navidrome or local storage
  - Track user's video library

  ---
  3. RADIO (Live Audio Streaming)

  Purpose: 24/7 radio stream with now-playing info

  Data Flow:
  Backend Navidrome server (streaming audio)
    ↓
  User → Telegram (/radio) → Backend prepares session
    ↓
  Web URL:
  pnptv.app/radio?room=pnptv_radio&token=XXX&appId=XXX
    ↓
  React app connects to Navidrome stream
    ↓
  Display now-playing song + controls

  User Journey:
  1. User types /radio in Telegram
  2. Bot sends link with params
  3. User clicks → Radio app opens
  4. Page automatically plays stream
  5. User sees current song playing
  6. Can adjust volume, see listener count
  7. Can request songs (optional)

  UX/UI Components Needed:
  - Header: "PNPtv Radio" title with icon
  - Album Art: Large display of current song cover
  - Now Playing:
    - Song title
    - Artist name
    - Album name
    - Duration/progress
  - Player Controls (bottom):
    - Play/pause button
    - Volume slider
    - Volume icon
    - Fullscreen button (optional)
  - Listener Count: Badge showing live listeners
  - Playlist/Queue (optional): Show upcoming songs
  - Song Request Button (optional): If enabled

  Tech Stack:
  - HTML5 <audio> tag for streaming
  - Navidrome API for metadata
  - WebSocket for real-time now-playing updates
  - Beautiful gradient background (PNPtv brand)

  Database Integration:
  - Radio stream comes from Navidrome
  - Track listener count in Redis
  - Log song plays for analytics

  ---
  4. LIVE (Live Broadcasting)

  Purpose: Stream video to audience with real-time chat

  Data Flow:
  User (Host) → Telegram (/live) → Backend validates,
  creates stream
    ↓
  Backend generates Agora token + stream ID
    ↓
  Web URL: pnptv.app/live?stream=ID&role=host&token=XXX
    ↓
  Host joins Agora as broadcaster
    ↓
  Audience can join as viewers
    ↓
  Real-time chat synced via WebSocket or polling

  User Journey:
  1. User types /live → Creates livestream session
  2. Bot sends host link with role=host
  3. Host opens live app, camera auto-activates
  4. Host clicks "Go Live" → Starts broadcast
  5. Viewers receive notifications, click to watch
  6. Viewers see video stream + live chat
  7. Host can see viewer list, read chat
  8. Host controls: mute/unmute, camera on/off, end stream

  UX/UI Components Needed:

  For Hosts:
  - Video Preview: Large camera feed
  - Controls:
    - Camera on/off
    - Microphone on/off
    - "Go Live" button (starts broadcast)
    - "End Stream" button
    - Settings (video quality, bitrate)
  - Chat Panel (right side): View/respond to messages
  - Viewer Count: Live badge with number
  - Broadcast Status: Indicator when live

  For Viewers:
  - Video Player: Full-screen broadcast
  - Chat Input: Send live messages
  - Chat History: See recent messages
  - Viewer List: See who's watching
  - Like/React Button (optional): Engage with host
  - Leave Button: Exit stream

  Tech Stack:
  - Agora RTC for video broadcast
  - WebSocket for real-time chat
  - React state for UI updates
  - Responsive layout (works on mobile)

  Database Integration:
  - LiveStream model: Stores stream info
  - Call events: Log participant joins/leaves
  - Chat messages: Store in PostgreSQL + Redis cache

  ---
  5. NEARBY (Geolocation Discovery)

  Purpose: Find nearby users with privacy controls

  Data Flow:
  User phone GPS → LocationCapture component
    ↓
  Captures coords + accuracy →
  locationService.updateLocation()
    ↓
  Sends to backend: POST /api/nearby/location
    ↓
  Backend stores in:
    - Redis GEO (online users, 5min TTL) for speed
    - PostgreSQL PostGIS (persistent) for accuracy
    ↓
  User searches nearby → Query backend
    ↓
  Backend applies privacy:
    - Rounds coordinates (3 decimals = ~111m precision)
    - Adds random noise (±50-900m)
    - Filters blocked users
    ↓
  Returns list with distance + map

  User Journey:
  1. User opens /nearby app
  2. App requests GPS permission
  3. User enables location tracking
  4. Location captured every 5 seconds (rate limited)
  5. Shows nearby users in:
    - List view (name, distance, last seen)
    - Map view (pins of nearby users)
  6. User can click a person → See profile, message, or
  block
  7. Location stops when app closes (privacy)

  UX/UI Components Needed:

  LocationCapture Component:
  - GPS Status: Indicator (acquiring, ready, error)
  - Permission Dialog: Request location access
  - Accuracy Badge: "Excellent / Good / Fair / Poor"
  - Start/Stop Button: Control tracking
  - Current Coordinates Display: Lat/lon/altitude (debug)
  - Accuracy Radius: Show on map
  - Error Messages: Permission denied, timeout, unavailable

  NearbyList Component:
  - Search Filters:
    - Distance radius (1km, 5km, 10km, 25km)
    - Online/offline toggle
    - Gender filter (optional)
    - Age range (optional)
  - User Cards:
    - Avatar
    - Name
    - Distance (e.g., "2.3 km away")
    - Last seen timestamp
    - Status (online/offline)
    - Quick actions (message, block, profile)

  NearbyMap Component:
  - Map Display: (Google Maps or Leaflet)
  - User Pins: Show nearby users as markers
  - Current Location Pin: Different color
  - Click Pin: Show user profile popup
  - Zoom/Pan: Standard map controls
  - Heat Map (optional): Show density of users

  Tech Stack:
  - Navigator.geolocation API for GPS
  - Redis GEO for real-time queries
  - PostGIS for persistent location data
  - Google Maps or Leaflet for visualization
  - WebSocket for location updates

  Privacy Features:
  - Location shared with rounds (3 decimals)
  - Random noise added to coordinates
  - Can't track exact location
  - Location data never exposed to other users
  - 7-day retention policy
  - Blocked users can't see you

  ---
  COMMON ACROSS ALL WEBAPPS

  Authentication Flow:

  1. Telegram WebApp SDK provides initData JWT token
  2. Backend validates token (confirms real Telegram user)
  3. App gets user context: user_id, username, premium,
  etc.
  4. All API calls include JWT in Authorization header
  5. Backend returns 401 if token invalid

  URL Parameters:

  ?room=ID          # Room/channel identifier
  &token=JWT        # Authentication token
  &uid=123          # Agora/user ID
  &username=John    # Display name
  &type=main        # Room type (main, private, etc.)
  &appId=XXX        # Agora App ID
  &role=host        # Role (host, viewer, participant)

  Design System (PNPtv Branding):

  - Primary Colors: Vibrant purple/pink gradient
  - Background: Dark (near-black) for eye comfort
  - Accent: Bright neon colors for buttons
  - Typography: Clean, modern sans-serif (Segoe UI, Arial)
  - Mobile-first: All apps must work on phones (80% of
  users)
  - Animations: Smooth transitions, no jank
  - Accessibility: High contrast, large touch targets

  Backend API Endpoints:

  - POST /api/rooms - Create main room
  - POST /api/rooms/:id/join - Join room
  - POST /api/calls - Create private call
  - GET /api/nearby/search - Search nearby users
  - POST /api/nearby/location - Update location
  - POST /api/live/start - Create livestream
  - POST /api/videorama/upload - Upload video

  ---
  For Your AI Instructions

  When instructing AI agents on UX/UI, specify:

  1. App Purpose: What is the core use case?
  2. User Journey: Step-by-step flow (how users use it)
  3. Components Needed: Breakdown of UI elements
  4. Data Flow: Where does data come from?
  5. Device Support: Desktop, tablet, mobile
  6. Accessibility: Keyboard, screen readers, colors
  7. Performance: Animations smooth, no lag
  8. Error States: What if GPS fails? Connection drops?
  9. Mobile Optimization: Touch-friendly buttons, swipe
  gestures
  10. Branding: Use PNPtv colors, modern dark theme