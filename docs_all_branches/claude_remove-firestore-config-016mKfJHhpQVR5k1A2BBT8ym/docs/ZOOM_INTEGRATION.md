# 🎥 Zoom Integration Documentation

## Overview

This document describes the complete Zoom video conferencing integration for the PNP.tv bot. The system allows Prime users to create and manage professional Zoom meetings directly from Telegram, with advanced host controls and guest access without authentication.

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [User Flows](#user-flows)
6. [Configuration](#configuration)
7. [Deployment](#deployment)
8. [Security](#security)

---

## Features

### For Hosts (Prime Users)

✅ **Instant Room Creation**
- Create Zoom rooms instantly without scheduling
- Unique 7-character room codes (e.g., ABC-1234)
- Automatic meeting URL generation

✅ **Advanced Host Controls**
- Mute/unmute individual participants or all at once
- Turn cameras on/off for participants
- Remove participants from the meeting
- Promote participants to co-host
- Change meeting layout (Gallery/Speaker view)
- Spotlight specific participants
- Lock/unlock the room

✅ **Recording Management**
- Start/stop cloud recording
- Automatic recording upload to cloud storage
- Download links sent via email
- Recording statistics and analytics

✅ **Interactive Features**
- Create live polls during meetings
- Q&A sessions with voting
- In-meeting chat with translation (ES/EN)
- Real-time reactions and emojis
- Breakout rooms for group discussions

✅ **Email Integration**
- Magic link authentication for hosts
- Invitation emails for guests
- Recording ready notifications
- Meeting summaries with statistics

### For Guests

✅ **Zero-Friction Join**
- No authentication required
- Join with just a name
- Access via room code or direct link
- Mobile-friendly interface

✅ **Standard Participant Features**
- Video and audio controls
- Screen sharing (if permitted by host)
- Chat with other participants
- Reactions and hand-raising
- Participate in polls

---

## Architecture

### System Components

```
┌─────────────────┐
│  Telegram Bot   │  ← Prime users create rooms
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Bot Handlers   │  ← Process commands, manage state
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Zoom Service   │  ← Interface with Zoom API
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   Zoom API      │  ← Create/manage meetings
└─────────────────┘

┌─────────────────┐
│  Web Interface  │  ← easybots.store/zoom/*
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  REST API       │  ← /api/zoom/*
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   PostgreSQL    │  ← Room & participant data
└─────────────────┘
```

### Data Flow

1. **Room Creation**
   ```
   User (Telegram) → Bot Handler → Zoom Service → Zoom API
                                                      ↓
   PostgreSQL ← Room Model ← Zoom Service (Meeting Created)
                                                      ↓
   User ← Email Service ← Host Magic Link
   ```

2. **Guest Join**
   ```
   Guest (Browser) → Join Page → API /zoom/join → PostgreSQL
                                                      ↓
   Zoom SDK ← SDK Signature ← Zoom Service
                                                      ↓
   Meeting Joined → Event Logged → PostgreSQL
   ```

3. **Host Control**
   ```
   Host (Browser) → Control Panel → API /zoom/participant/action
                                                      ↓
   Zoom API ← Zoom Service (Execute Action)
                                                      ↓
   PostgreSQL ← Event Logged ← Participant Updated
   ```

---

## Database Schema

### Tables Created

#### `zoom_rooms`
Stores Zoom meeting rooms.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| room_code | VARCHAR(10) | Unique code (ABC-1234) |
| zoom_meeting_id | VARCHAR(255) | Zoom meeting ID |
| zoom_meeting_password | VARCHAR(255) | Meeting password |
| host_user_id | VARCHAR(255) | Telegram user ID of host |
| host_email | VARCHAR(255) | Host email |
| host_name | VARCHAR(255) | Host display name |
| host_auth_token | VARCHAR(500) | JWT for host auth |
| host_join_url | TEXT | Host control panel URL |
| title | VARCHAR(255) | Meeting title |
| description | TEXT | Meeting description |
| scheduled_start_time | TIMESTAMP | Scheduled start |
| scheduled_duration | INTEGER | Duration in minutes |
| actual_start_time | TIMESTAMP | Actual start time |
| actual_end_time | TIMESTAMP | Actual end time |
| settings | JSONB | Meeting settings |
| status | VARCHAR(50) | scheduled/active/ended/cancelled |
| is_public | BOOLEAN | Public or private |
| total_participants | INTEGER | Total participants count |
| peak_participants | INTEGER | Peak simultaneous participants |
| recording_enabled | BOOLEAN | Recording enabled |
| recording_status | VARCHAR(50) | Recording status |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update |

#### `zoom_participants`
Tracks participants in meetings.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| room_id | UUID | FK to zoom_rooms |
| user_id | VARCHAR(255) | Telegram user ID (null for guests) |
| zoom_participant_id | VARCHAR(255) | Zoom participant ID |
| display_name | VARCHAR(255) | Display name |
| email | VARCHAR(255) | Email (optional) |
| is_guest | BOOLEAN | Guest or registered user |
| is_host | BOOLEAN | Is meeting host |
| is_co_host | BOOLEAN | Is co-host |
| join_time | TIMESTAMP | Join timestamp |
| leave_time | TIMESTAMP | Leave timestamp |
| audio_status | VARCHAR(20) | muted/unmuted |
| video_status | VARCHAR(20) | on/off |
| permissions | JSONB | Participant permissions |
| total_talk_time | INTEGER | Total talk time in seconds |
| messages_sent | INTEGER | Chat messages sent |
| reactions_sent | INTEGER | Reactions sent |

#### `zoom_recordings`
Manages meeting recordings.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| room_id | UUID | FK to zoom_rooms |
| zoom_recording_id | VARCHAR(255) | Zoom recording ID |
| recording_type | VARCHAR(50) | cloud/local |
| file_type | VARCHAR(20) | MP4/M4A/CHAT/TRANSCRIPT |
| storage_location | TEXT | URL or file path |
| file_size | BIGINT | File size in bytes |
| duration | INTEGER | Duration in seconds |
| status | VARCHAR(50) | processing/completed/failed |
| is_public | BOOLEAN | Public access |
| view_count | INTEGER | Number of views |
| download_count | INTEGER | Number of downloads |

#### `zoom_events`
Activity log for all Zoom events.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| room_id | UUID | FK to zoom_rooms |
| participant_id | UUID | FK to zoom_participants |
| event_type | VARCHAR(100) | Event type |
| event_category | VARCHAR(50) | meeting/participant/recording |
| event_data | JSONB | Event-specific data |
| description | TEXT | Event description |
| actor_user_id | VARCHAR(255) | Who triggered the event |
| timestamp | TIMESTAMP | Event timestamp |

#### `zoom_polls`
In-meeting polls.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| room_id | UUID | FK to zoom_rooms |
| created_by | VARCHAR(255) | Poll creator |
| title | VARCHAR(255) | Poll title |
| question | TEXT | Poll question |
| options | JSONB | Array of options |
| status | VARCHAR(50) | draft/active/ended |
| total_votes | INTEGER | Total votes |
| results | JSONB | Calculated results |

---

## API Endpoints

### Public Endpoints

#### GET `/api/zoom/room/:roomCode`
Get room information.

**Response:**
```json
{
  "success": true,
  "room": {
    "room_code": "ABC-1234",
    "title": "PNP.tv Meeting",
    "host_name": "John Doe",
    "status": "active",
    "current_participants": 5,
    "settings": { ... }
  }
}
```

#### POST `/api/zoom/join`
Join a meeting as guest.

**Request:**
```json
{
  "roomCode": "ABC-1234",
  "displayName": "Jane Doe"
}
```

**Response:**
```json
{
  "success": true,
  "sdkKey": "...",
  "signature": "...",
  "meetingNumber": "...",
  "password": "...",
  "participantId": "uuid"
}
```

### Host-Only Endpoints

#### POST `/api/zoom/host/join`
Join as host with authentication.

**Request:**
```json
{
  "roomCode": "ABC-1234",
  "token": "auth-token"
}
```

#### POST `/api/zoom/end/:roomCode`
End a meeting.

#### POST `/api/zoom/participant/:participantId/action`
Control a participant.

**Request:**
```json
{
  "action": "mute|unmute|stop_video|remove|make_cohost",
  "value": "optional-value"
}
```

#### POST `/api/zoom/recording/:roomCode`
Toggle recording.

**Request:**
```json
{
  "action": "start|stop"
}
```

### Web Pages

- `/zoom/join/:roomCode` - Guest join page
- `/zoom/host/:roomCode` - Host control panel

---

## User Flows

### 1. Creating a Room (Host)

1. User opens Telegram bot
2. Goes to Zoom menu (`show_zoom`)
3. Clicks "Create Room" (`zoom_create`)
4. Bot verifies Prime subscription
5. Bot creates Zoom meeting via API
6. Bot saves room to database
7. Bot generates host control URL
8. Bot sends magic link to host email
9. Bot displays room code and links

### 2. Joining a Room (Guest)

1. Guest receives room code (ABC-1234)
2. Guest visits `easybots.store/zoom/join/ABC-1234`
3. Page loads room information
4. Guest enters their name
5. Guest clicks "Join Meeting"
6. API generates SDK signature
7. Zoom SDK initializes
8. Guest joins the meeting
9. Event logged to database

### 3. Host Controls

1. Host visits control panel URL
2. Host authenticates with magic link
3. Host joins meeting with elevated privileges
4. Control panel loads participant list
5. Host can:
   - Mute/unmute participants
   - Turn cameras on/off
   - Remove participants
   - Start/stop recording
   - Create polls
   - Change layout

---

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Zoom API Configuration
ZOOM_API_KEY=your_zoom_api_key
ZOOM_API_SECRET=your_zoom_api_secret
ZOOM_SDK_KEY=your_zoom_sdk_key
ZOOM_SDK_SECRET=your_zoom_sdk_secret
ZOOM_WEBHOOK_SECRET=your_webhook_secret
ZOOM_WEB_DOMAIN=https://zoom.us

# Email Configuration (for magic links)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your_sendgrid_api_key
EMAIL_FROM=noreply@easybots.store

# OR use SendGrid directly
SENDGRID_API_KEY=your_sendgrid_api_key

# Application
JWT_SECRET=your_jwt_secret_for_signatures
```

### Getting Zoom Credentials

1. **Create Zoom App**
   - Go to https://marketplace.zoom.us/
   - Click "Develop" → "Build App"
   - Choose "Server-to-Server OAuth" for API
   - Choose "Meeting SDK" for client SDK

2. **Configure OAuth App**
   - Add required scopes:
     - `meeting:write`
     - `meeting:read`
     - `recording:write`
     - `recording:read`
   - Copy API Key and API Secret

3. **Configure SDK App**
   - Get SDK Key and SDK Secret
   - Add allowed domains: `easybots.store`

---

## Deployment

### 1. Apply Database Migrations

```bash
# Run the migration SQL
psql -U pnptvbot -d pnptvbot -f database/migrations/zoom_integration_schema.sql
```

### 2. Install Dependencies

```bash
npm install axios jsonwebtoken nodemailer
```

### 3. Configure Environment

```bash
# Copy and edit .env
cp .env.example .env
nano .env
```

### 4. Restart the Bot

```bash
# With PM2
pm2 restart pnptvbot

# With Docker
docker-compose restart bot

# Manual
npm start
```

### 5. Test the Integration

1. Send `/start` to your bot
2. Navigate to Zoom menu
3. Try creating a room
4. Check logs for any errors

---

## Security

### Authentication

1. **Host Authentication**
   - Magic link sent via email
   - JWT token with expiration
   - SHA-256 hashing for verification

2. **Guest Access**
   - No authentication required
   - Display name only
   - Limited permissions

3. **API Security**
   - Rate limiting on all endpoints
   - Input validation
   - SQL injection prevention (parameterized queries)
   - XSS protection

### Data Privacy

1. **Guest Data**
   - Only display name stored
   - No email required
   - Session-based tracking

2. **Recordings**
   - Optional password protection
   - Public/private access control
   - Automatic expiration (configurable)

3. **Events**
   - Detailed activity logging
   - IP address tracking (optional)
   - Audit trail for compliance

### Best Practices

1. **Environment Variables**
   - Never commit `.env` to git
   - Use different credentials for dev/prod
   - Rotate secrets regularly

2. **Database**
   - Regular backups
   - Encrypted connections (SSL)
   - Access control

3. **API Endpoints**
   - HTTPS only
   - CORS restrictions
   - Request size limits

---

## Troubleshooting

### Common Issues

#### 1. "Failed to create meeting"

**Cause:** Invalid Zoom API credentials

**Solution:**
```bash
# Verify credentials
echo $ZOOM_API_KEY
echo $ZOOM_API_SECRET

# Test API connection
curl -X GET https://api.zoom.us/v2/users/me \
  -H "Authorization: Bearer $(generate_jwt_token)"
```

#### 2. "Room not found"

**Cause:** Room code doesn't exist or was deleted

**Solution:**
```sql
-- Check if room exists
SELECT * FROM zoom_rooms WHERE room_code = 'ABC-1234';

-- Check room status
SELECT room_code, status, deleted_at FROM zoom_rooms;
```

#### 3. "Failed to join meeting"

**Cause:** Invalid SDK signature or meeting ID

**Solution:**
- Verify `ZOOM_SDK_KEY` and `ZOOM_SDK_SECRET`
- Check Zoom meeting hasn't expired
- Ensure meeting is still active

#### 4. Email not sending

**Cause:** SMTP configuration issue

**Solution:**
```bash
# Test email service
node -e "
const emailService = require('./src/services/emailService');
emailService.verifyConnection().then(console.log);
"
```

---

## Additional Features (Future)

### Planned Enhancements

- [ ] Scheduled meetings with calendar integration
- [ ] Recurring meetings
- [ ] Waiting room with music
- [ ] Virtual backgrounds upload
- [ ] Advanced analytics dashboard
- [ ] Integration with Telegram groups
- [ ] Automated meeting summaries
- [ ] AI-powered transcription
- [ ] Multi-language support (beyond ES/EN)
- [ ] Mobile app integration

---

## Support

For questions or issues:
- **Email:** support@easybots.store
- **Telegram:** @PNPtvBot
- **GitHub Issues:** https://github.com/anthropics/pnptvbot/issues

---

## License

This integration is part of the PNP.tv bot project.
© 2025 PNP.tv. All rights reserved.
