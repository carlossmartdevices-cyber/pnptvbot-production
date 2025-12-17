# PNPtv Hangouts! + Radio Implementation Guide

## ✅ Completed Components

### 1. Agora Token Service
- **File:** `src/services/agora/agoraTokenService.js`
- **Status:** ✅ Complete
- **Features:**
  - RTC token generation for video/audio
  - RTM token generation for messaging
  - Specialized methods for calls, rooms, webinars, radio
  - Mock tokens for development

### 2. Database Schema
- **File:** `database/migrations/hangouts_radio_schema.sql`
- **Status:** ✅ Complete
- **Tables Created:**
  - `video_calls` - 10-person calls
  - `call_participants` - Participant tracking
  - `main_rooms` - 3 permanent 50-person rooms
  - `room_participants` - Room member tracking
  - `room_events` - Moderation event log
  - `webinars` - Large 200-person events
  - `webinar_registrations` - Attendee tracking
  - `radio_tracks` - Audio library
  - `radio_subscribers` - Notification preferences
  - `radio_listen_history` - Analytics
  - `radio_now_playing` - Current track
  - `agora_channels` - Channel registry

### 3. Models
- **VideoCallModel:** `src/models/videoCallModel.js` ✅
  - Create/join/leave calls
  - Host controls (kick, mute)
  - Participant tracking
  - Guest support

- **MainRoomModel:** `src/models/mainRoomModel.js` ✅
  - Room management
  - Publisher/subscriber roles
  - Moderation (kick, mute, spotlight)
  - Event logging

- **RadioStreamManager:** `src/services/radio/radioStreamManager.js` ✅
  - 24/7 streaming logic
  - Playlist management
  - Auto-playback
  - Listener tracking
  - Notification system

### 4. Environment Configuration
- **File:** `.env.example` ✅
- **Added:**
  - `AGORA_APP_ID=b68ab7b61ea44eabab7f242171311c5e`
  - Hangouts configuration
  - Radio configuration
  - AWS S3 settings

---

## 📋 Next Steps (To Complete Implementation)

### Step 1: Run Database Migration

```bash
# Connect to PostgreSQL
psql -U pnptvbot -d pnptvbot

# Run the migration
\i database/migrations/hangouts_radio_schema.sql

# Verify tables created
\dt

# You should see:
# - video_calls
# - call_participants
# - main_rooms
# - room_participants
# - room_events
# - webinars
# - webinar_registrations
# - radio_tracks
# - radio_subscribers
# - radio_listen_history
# - radio_now_playing
# - radio_playlists
# - playlist_tracks
# - agora_channels
```

### Step 2: Update .env File

Copy settings from `.env.example` to your `.env`:

```bash
# Agora (REQUIRED)
AGORA_APP_ID=b68ab7b61ea44eabab7f242171311c5e
AGORA_APP_CERTIFICATE=your_certificate_here  # Get from Agora Console

# Hangouts
HANGOUTS_WEB_APP_URL=https://hangouts.pnptv.com
MAIN_ROOM_COUNT=3
MAX_CALL_PARTICIPANTS=10
MAX_ROOM_PARTICIPANTS=50
WEBINAR_MAX_ATTENDEES=200

# Radio
RADIO_WEB_APP_URL=https://radio.pnptv.com
RADIO_CHANNEL_NAME=pnptv_radio_247
RADIO_CONTENT_DIR=./media/radio

# AWS S3 (for recordings)
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=pnptv-media
```

### Step 3: Create Bot Handlers

Create `src/bot/handlers/hangouts/index.js`:

```javascript
const { Markup } = require('telegraf');
const VideoCallModel = require('../../../models/videoCallModel');
const MainRoomModel = require('../../../models/mainRoomModel');
const UserService = require('../../services/userService');
const logger = require('../../../utils/logger');

const registerHangoutsHandlers = (bot) => {
  // Main menu
  bot.action('hangouts_menu', async (ctx) => {
    const hasPrime = await UserService.hasActiveSubscription(ctx.from.id);

    await ctx.editMessageText(
      '📞 *PNPtv Hangouts!*\n\n' +
      'Video calls and community rooms!',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            hasPrime ?
              [{ text: '🎥 Create Video Call', callback_data: 'create_video_call' }] :
              [{ text: '🔒 Create Call (PRIME Required)', callback_data: 'show_subscription_plans' }],
            [
              { text: '🏠 Room 1', callback_data: 'join_main_room_1' },
              { text: '🏠 Room 2', callback_data: 'join_main_room_2' },
            ],
            [{ text: '🏠 Room 3', callback_data: 'join_main_room_3' }],
            [{ text: '📅 Webinars', callback_data: 'view_webinars' }],
            [{ text: '🔙 Back', callback_data: 'back_to_main' }],
          ],
        },
      }
    );
  });

  // Create video call
  bot.action('create_video_call', async (ctx) => {
    const hasPrime = await UserService.hasActiveSubscription(ctx.from.id);

    if (!hasPrime) {
      return ctx.answerCbQuery('PRIME membership required! 👑');
    }

    const call = await VideoCallModel.create({
      creatorId: ctx.from.id,
      creatorName: ctx.from.first_name || ctx.from.username,
    });

    const webAppUrl = `${process.env.HANGOUTS_WEB_APP_URL}/call/${call.channelName}?token=${call.rtcToken}`;
    const joinLink = `https://t.me/${ctx.botInfo.username}?start=call_${call.id}`;

    await ctx.editMessageText(
      `✅ *Video Call Created!*\n\n` +
      `👥 Capacity: 0/10\n` +
      `🔗 Share: \`${joinLink}\`\n\n` +
      `Tap "Launch" to start!`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 Launch Call', web_app: { url: webAppUrl } }],
            [{ text: '❌ End Call', callback_data: `end_call_${call.id}` }],
            [{ text: '🔙 Back', callback_data: 'hangouts_menu' }],
          ],
        },
      }
    );
  });

  // Join main room
  bot.action(/^join_main_room_(\d)$/, async (ctx) => {
    const roomId = parseInt(ctx.match[1]);

    const room = await MainRoomModel.getById(roomId);

    if (!room) {
      return ctx.answerCbQuery('Room not found');
    }

    const { rtcToken, rtmToken } = await MainRoomModel.joinRoom(
      roomId,
      ctx.from.id,
      ctx.from.first_name || ctx.from.username,
      false // Start as viewer
    );

    const webAppUrl = `${process.env.HANGOUTS_WEB_APP_URL}/room/${roomId}?rtc=${rtcToken}&rtm=${rtmToken}`;

    await ctx.editMessageText(
      `🏠 *${room.name}*\n\n` +
      `${room.description}\n\n` +
      `👥 ${room.currentParticipants}/50 participants`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 Join Room', web_app: { url: webAppUrl } }],
            [{ text: '🔙 Back', callback_data: 'hangouts_menu' }],
          ],
        },
      }
    );
  });
};

module.exports = registerHangoutsHandlers;
```

Create `src/bot/handlers/radio/index.js`:

```javascript
const { Markup } = require('telegraf');
const radioStreamManager = require('../../../services/radio/radioStreamManager');
const logger = require('../../../utils/logger');

const registerRadioHandlers = (bot) => {
  // Radio menu
  bot.action('radio_menu', async (ctx) => {
    const nowPlaying = await radioStreamManager.getNowPlaying();
    const isSubscribed = await radioStreamManager.isSubscribed(ctx.from.id);

    let nowPlayingText = 'Nothing playing';
    if (nowPlaying) {
      nowPlayingText = `${nowPlaying.track.title}\n${nowPlaying.track.artist || 'Unknown Artist'}`;
    }

    await ctx.editMessageText(
      `🎵 *PNPtv Radio!* - Live 24/7\n\n` +
      `*Now Playing:*\n${nowPlayingText}\n\n` +
      `⏱ ${Math.floor((nowPlaying?.remaining || 0) / 60)} min remaining`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎧 Listen Live', callback_data: 'radio_listen' }],
            [{ text: '📋 Playlist', callback_data: 'radio_playlist' }],
            [{
              text: isSubscribed ? '🔕 Unsubscribe' : '🔔 Subscribe',
              callback_data: isSubscribed ? 'radio_unsubscribe' : 'radio_subscribe'
            }],
            [{ text: '🔙 Back', callback_data: 'back_to_main' }],
          ],
        },
      }
    );
  });

  // Listen to radio
  bot.action('radio_listen', async (ctx) => {
    const tokens = await radioStreamManager.generateListenerToken(ctx.from.id);
    const webAppUrl = `${process.env.RADIO_WEB_APP_URL}?token=${tokens.rtcToken}`;

    await ctx.editMessageText(
      `🎵 *PNPtv Radio!*\n\nOpening player...`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎧 Open Player', web_app: { url: webAppUrl } }],
            [{ text: '🔙 Back', callback_data: 'radio_menu' }],
          ],
        },
      }
    );
  });
};

module.exports = registerRadioHandlers;
```

### Step 4: Register Handlers in Main Bot

Edit `src/bot/index.js` to add:

```javascript
const registerHangoutsHandlers = require('./handlers/hangouts');
const registerRadioHandlers = require('./handlers/radio');

// After other handler registrations:
registerHangoutsHandlers(bot);
registerRadioHandlers(bot);
```

### Step 5: Update Main Menu

Edit `src/bot/handlers/user/menu.js` to add buttons:

```javascript
[
  { text: '📞 PNPtv Hangouts!', callback_data: 'hangouts_menu' },
  { text: '🎵 PNPtv Radio!', callback_data: 'radio_menu' },
],
```

### Step 6: Initialize Radio on Startup

Edit `src/index.js` or bot startup file:

```javascript
const radioStreamManager = require('./services/radio/radioStreamManager');

// After bot initialization:
radioStreamManager.initialize().catch(err => {
  logger.error('Failed to initialize radio:', err);
});
```

---

## 🌐 Web Applications

### Hangouts Web App (React + Agora)

Create `hangouts-web-app/` directory with:

```bash
npm create vite@latest hangouts-web-app -- --template react
cd hangouts-web-app
npm install agora-rtc-sdk-ng agora-rtm-sdk zustand
```

Example `App.jsx`:

```javascript
import { useEffect, useState } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';

function App() {
  const [client] = useState(AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }));
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const channel = window.location.pathname.split('/')[2];

    if (token && channel) {
      joinCall(channel, token);
    }
  }, []);

  async function joinCall(channel, token) {
    await client.join(APP_ID, channel, token, null);

    const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    const videoTrack = await AgoraRTC.createCameraVideoTrack();

    await client.publish([audioTrack, videoTrack]);

    videoTrack.play('local-player');
    setJoined(true);
  }

  return (
    <div>
      <h1>PNPtv Hangouts</h1>
      <div id="local-player" style={{ width: '640px', height: '480px' }}></div>
      {joined && <p>✅ Connected</p>}
    </div>
  );
}
```

### Radio Web App (React + Agora)

Similar setup with audio-only mode.

---

## 📝 Testing Checklist

- [ ] Database migration completed
- [ ] Environment variables configured
- [ ] Agora App Certificate obtained
- [ ] Bot handlers registered
- [ ] Main menu updated
- [ ] Radio stream manager initialized
- [ ] Can create video call (PRIME)
- [ ] Can join main room
- [ ] Radio streaming works
- [ ] Web apps deployed
- [ ] Tokens generated correctly

---

## 🚀 Deployment Commands

```bash
# 1. Run migration
psql -U pnptvbot -d pnptvbot -f database/migrations/hangouts_radio_schema.sql

# 2. Add sample radio tracks (optional)
node scripts/add-sample-radio-tracks.js

# 3. Restart bot
pm2 restart pnptvbot

# 4. Check logs
pm2 logs pnptvbot

# 5. Verify radio started
# Should see: "Initializing PNPtv Radio stream manager"
```

---

## 📊 Admin Commands to Create

```javascript
// Admin: Add radio track
bot.command('addtrack', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;

  // Parse: /addtrack Title | Artist | URL | Duration
  const [title, artist, url, duration] = ctx.message.text
    .split(' ').slice(1).join(' ')
    .split('|').map(s => s.trim());

  await RadioModel.addTrack({
    title,
    artist,
    audioUrl: url,
    durationSeconds: parseInt(duration),
    type: 'music',
  });

  await ctx.reply('✅ Track added to radio!');
});

// Admin: Skip track
bot.command('skip', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;

  await radioStreamManager.skipTrack();
  await ctx.reply('⏭ Skipped to next track');
});
```

---

## 🎯 Success Criteria

✅ Users can create 10-person video calls
✅ 3 main rooms available 24/7
✅ Radio streams continuously
✅ Notifications work
✅ Web apps load and connect
✅ Tokens authenticate properly

---

## 🐛 Troubleshooting

**Issue:** Radio not playing
**Fix:** Check `radio_tracks` table has tracks, verify `is_active = true`

**Issue:** Agora connection fails
**Fix:** Verify `AGORA_APP_CERTIFICATE` in .env matches console

**Issue:** "Room full" error
**Fix:** Check `current_participants` count in database

**Issue:** Web app doesn't load
**Fix:** Verify web app URL environment variables

---

## 📚 Documentation References

- [Agora RTC SDK](https://docs.agora.io/en/video-calling/overview/product-overview)
- [Agora Web SDK Guide](https://docs.agora.io/en/video-calling/get-started/get-started-sdk)
- [Agora Token Generation](https://docs.agora.io/en/video-calling/develop/authentication-workflow)

---

**Implementation Status:** Backend Complete ✅ | Bot Handlers Needed ⏳ | Web Apps Needed ⏳
