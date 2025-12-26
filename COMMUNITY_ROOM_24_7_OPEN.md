# Community Room 24/7 Open Configuration

## Overview
The PNPtv Community Room is now configured to be **completely open 24/7** with no moderator requirement. Anyone can join and start calls at any time.

## Changes Made

### 1. Jitsi Configuration (`config/jitsi-config.js`)
- Added `requireApproval: false` - Anyone can join without moderator approval
- Added `autoDisableModeration: true` - Disables moderation enforcement
- Added `lobbyEnabled: false` - No lobby required for joining
- These settings ensure participants can start calls immediately

### 2. Community Room HTML (`public/community-room.html`)
Updated Jitsi initialization options:
- `lobbyEnabled: false` - Disable lobby functionality
- `restrictedRoomPrefix: null` - No restrictions on room access
- `lockRoomGuestAccessOnStart: false` - Room access stays open when first participant joins
- `moderatedRoomServiceUrl: null` - No moderator enforcement service

Auto-join as guest feature:
- Users who don't have a session automatically join as guests
- No login required to participate

### 3. Community Room Controller (`src/bot/api/controllers/communityRoomController.js`)
- Added graceful fallback for user role lookup (guests allowed if lookup fails)
- Changed user tracking to label non-moderators as 'guest' instead of 'member'
- Added `isOpen24_7: true` flag to response
- Updated description to emphasize "no moderator required"
- Wrapped user lookup in try-catch to prevent blocking guest access

### 4. Community Room Service (`src/bot/services/communityRoomService.js`)
Updated room settings:
- `moderatorRequired: false` - No moderator needed to start
- `moderationEnabled: false` - Room moderation disabled for open access
- `allowGuestAccess: true` - Guests can join without authentication
- `isOpen24_7: true` - Flag indicating 24/7 availability

## How It Works

1. **Guest Access**: Users can join without authentication by clicking "Join as Guest"
2. **Auto-Join**: If no session exists, users automatically join as guests
3. **No Moderator Required**: Calls can start with any number of participants (even 1)
4. **Persistent Room**: Room stays open 24/7 across server restarts (Jitsi backend persistence)
5. **Full Features**: All features (chat, screen share, recording) available to all participants

## Access Points

- Direct link: `https://pnptv.app/community-room`
- Via Telegram bot menu: "👥 24/7 Community Room" / "👥 Sala Comunitaria 24/7"
- Via radio page quick access link

## API Endpoints

All endpoints are accessible without authentication:

```
POST   /api/community-room/join              (Get access token and room info)
GET    /api/community-room/occupancy         (See active users)
POST   /api/community-room/message           (Send chat message)
GET    /api/community-room/chat-history      (Get past messages)
GET    /api/community-room/stats             (Room statistics)
GET    /api/community-room/leaderboard       (Top active users)
```

Moderation endpoints (admin/superadmin only):
```
POST   /api/community-room/moderation/mute
POST   /api/community-room/moderation/remove
POST   /api/community-room/moderation/clear-chat
```

## Technical Details

- **Room ID**: `pnptv-community-24-7`
- **Room Name**: `pnptv-community`
- **Max Participants**: 1000
- **Domain**: 8x8.vc (JaaS)
- **Persistence**: Enabled (room persists across sessions)
- **Moderation Mode**: Disabled (anyone can control their own audio/video, only admins can mute/kick others)

## Testing

To test the community room:

1. Visit `https://pnptv.app/community-room`
2. Click "Join as Guest" without entering any information
3. You should immediately be joined to the video room
4. No moderator should be online or required
5. Your audio/video should automatically start
6. You can chat, share screen, etc.

## Notes

- Users are marked as 'guest' unless they're database-authenticated admins/superadmins
- If user database is unavailable, users are still allowed guest access
- Room settings default to allowing all features for all participants
- Only admins/superadmins can perform moderation actions (mute, remove, clear chat)
