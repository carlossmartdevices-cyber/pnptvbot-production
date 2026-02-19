# Radio & Videorama Implementation Status

## Overview
The PNPtv platform includes a complete Radio streaming system and Videorama media management interface. This document outlines the complete implementation, endpoints, and functionality.

## Architecture

### Components

#### 1. Backend API (Node.js/Express)
- **Location**: `/src/bot/api/controllers/mediaAdminController.js`
- **Routes**: `/src/bot/api/routes.js` (lines 1100-1516)
- **Database**: PostgreSQL with Redis caching

#### 2. Admin Interface (React)
- **Location**: `/webapps/prime-hub/src/pages/admin/`
- **Pages**:
  - `AdminRadioPage.jsx` - Radio management interface
  - `AdminMediaPage.jsx` - Media library management

#### 3. Database Tables
- `radio_now_playing` - Current playing track (singleton)
- `radio_queue` - Queue of upcoming tracks
- `radio_requests` - User song requests
- `radio_history` - Historical played tracks
- `radio_schedule` - Weekly programming schedule
- `media_library` - All media items (audio/video)
- `media_playlists` - User playlists
- `playlist_items` - Items in playlists

## API Endpoints

### Public Endpoints (No Auth Required)

#### GET /api/radio/now-playing
Returns current radio track information
```json
{
  "track": {
    "title": "Song Title",
    "artist": "Artist Name",
    "thumbnailUrl": "https://...",
    "duration": "180",
    "startedAt": "2026-02-19T10:00:00Z"
  },
  "listenerCount": 42
}
```

#### GET /api/radio/history
Returns radio play history
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Song Title",
      "artist": "Artist Name",
      "duration": "180",
      "cover_url": "https://...",
      "played_at": "2026-02-19T10:00:00Z"
    }
  ]
}
```

#### GET /api/radio/schedule
Returns weekly radio schedule
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "day_of_week": 0,
      "time_slot": "08:00-10:00",
      "program_name": "Morning Show",
      "description": "..."
    }
  ]
}
```

#### POST /api/radio/request
Submit a song request
```json
Request:
{
  "userId": "user-id",
  "songName": "Song Title",
  "artist": "Artist Name"
}

Response:
{
  "success": true,
  "requestId": "uuid"
}
```

#### GET /api/media/library
Get media library with filters
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Title",
      "artist": "Artist",
      "type": "audio|video",
      "category": "music",
      "url": "https://...",
      "cover_url": "https://...",
      "duration": 180,
      "plays": 42,
      "likes": 10
    }
  ],
  "count": 50
}
```

Query Parameters:
- `type`: `all|audio|video` (default: `all`)
- `category`: Filter by category
- `limit`: Number of items (default: 50)

#### GET /api/media/:mediaId
Get single media item details

#### GET /api/media/categories
Get available media categories

#### GET /api/videorama/collections
Get videorama collections (playlists + categories)

#### GET /api/videorama/collections/:collectionId
Get items in a collection

### Admin Endpoints (JWT Auth Required)

#### Media Management

**GET /api/admin/media/library**
- Query params: `page`, `limit`, `type`, `category`, `search`
- Returns: Paginated media list with admin controls

**GET /api/admin/media/categories**
- Returns: All available categories

**POST /api/admin/media/upload**
- Content-Type: `multipart/form-data`
- Fields:
  - `file` (required) - Audio or video file
  - `title` (required) - Media title
  - `artist` - Artist/uploader name
  - `description` - Media description
  - `category` - Category (default: general)
  - `type` - `audio|video` (auto-detected from file)
  - `isExplicit` - Boolean flag

**PUT /api/admin/media/:mediaId**
- Update media metadata
- Fields: `title`, `artist`, `description`, `category`, `isExplicit`

**DELETE /api/admin/media/:mediaId**
- Delete media and associated files

#### Radio Management

**GET /api/admin/radio/now-playing**
- Returns current radio track

**POST /api/admin/radio/now-playing**
- Set current radio track
- Body: `{ mediaId?: "uuid", title?: "...", artist?: "...", duration?: "...", coverUrl?: "..." }`
- Either `mediaId` or manual metadata required

**GET /api/admin/radio/queue**
- Get radio queue (ordered)

**POST /api/admin/radio/queue**
- Add media to queue
- Body: `{ mediaId: "uuid" }`

**DELETE /api/admin/radio/queue/:queueId**
- Remove specific item from queue

**POST /api/admin/radio/queue/clear**
- Clear entire queue

**GET /api/admin/radio/requests**
- Get song requests
- Query param: `status` (pending|approved|rejected)

**PUT /api/admin/radio/requests/:requestId**
- Approve or reject request
- Body: `{ status: "pending|approved|rejected" }`

## Frontend Features

### AdminRadioPage.jsx
Tab-based interface for radio management:
- **Now Playing Tab**:
  - Display current track with cover, artist, duration
  - Change now playing track from media library
  - Search and quick selection

- **Queue Tab**:
  - Display upcoming tracks in order
  - Add tracks to queue
  - Remove tracks from queue
  - Clear entire queue

- **Requests Tab**:
  - List pending song requests
  - Approve/reject individual requests
  - View request history

### AdminMediaPage.jsx
Media library management:
- **Upload**:
  - File upload with metadata entry
  - Auto-detection of audio/video
  - Category and explicit content flagging

- **Library**:
  - Paginated list of all media
  - Filter by type (audio/video)
  - Filter by category
  - Search by title/artist

- **Edit**:
  - Inline editing of metadata
  - Update title, artist, description, category

- **Delete**:
  - Confirmation dialogs
  - Physical file cleanup

## Usage Examples

### Set Now Playing Track
```bash
# From media library
curl -X POST http://localhost:3001/api/admin/radio/now-playing \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "mediaId": "uuid-here" }'

# Manual track
curl -X POST http://localhost:3001/api/admin/radio/now-playing \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Song Name",
    "artist": "Artist Name",
    "duration": "180",
    "coverUrl": "https://..."
  }'
```

### Upload Media
```bash
curl -X POST http://localhost:3001/api/admin/media/upload \
  -H "Authorization: Bearer JWT_TOKEN" \
  -F "file=@/path/to/music.mp3" \
  -F "title=My Song" \
  -F "artist=Artist Name" \
  -F "category=music" \
  -F "type=audio" \
  -F "isExplicit=false"
```

### Add to Queue
```bash
curl -X POST http://localhost:3001/api/admin/radio/queue \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "mediaId": "uuid-here" }'
```

### Get Media Library
```bash
curl http://localhost:3001/api/media/library?type=audio&category=music&limit=20
```

### Get Radio Now Playing
```bash
curl http://localhost:3001/api/radio/now-playing
```

## WebApps Deployment

### Build Admin Interface
```bash
npm run build:prime-hub
```

This builds:
- React SPA with all admin pages
- Outputs to `/public/prime-hub/`
- Accessible at `https://pnptv.app/prime-hub/`

### Access Points
- **Radio Admin**: `/prime-hub/admin/radio`
- **Media Admin**: `/prime-hub/admin/media`
- **Radio Player**: `/radio/` (public)
- **Videorama**: `/videorama/` (public)

## Key Features

### Radio System
- Real-time now playing updates
- Queue management with ordering
- Song request system with approval workflow
- Play history tracking
- Weekly schedule support
- Listener count display

### Media Management
- Support for audio and video files
- Category-based organization
- Explicit content flagging
- Cover image support
- Uploader tracking
- Play count statistics
- Like/favorite system

### Videorama
- Collection-based browsing (playlists + categories)
- Multi-format media support
- Featured content collections
- Search capabilities

## Database Migrations

All required tables are created via migrations in `/database/migrations/`:
- `media_library_schema.sql` - Media and playlist tables
- `radio_feature_migration.sql` - Radio core tables
- `radio_queue_table.sql` - Queue management

Run migrations during deployment:
```bash
# Database migrations are auto-applied on startup via ecosystem.config.js
npm start
```

## Testing

### Test APIs with curl
```bash
# Test public endpoints
curl http://localhost:3001/api/radio/now-playing
curl http://localhost:3001/api/media/library
curl http://localhost:3001/api/videorama/collections

# Test admin endpoints (requires JWT)
curl -H "Authorization: Bearer YOUR_JWT" \
  http://localhost:3001/api/admin/media/library
```

### Database Verification
```bash
# Connect to PostgreSQL
psql -U postgres -d pnptv_db

# Check tables
\dt radio_*
\dt media_*
\dt playlist_*

# Sample queries
SELECT * FROM radio_now_playing;
SELECT COUNT(*) FROM media_library;
SELECT * FROM radio_queue ORDER BY position;
```

## Configuration

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/pnptv_db

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key

# Upload settings
UPLOAD_DIR=/uploads

# Admin settings
ADMIN_USERS=user@example.com,admin@example.com
```

## Performance Optimizations

- Redis caching for media library (5 min TTL)
- Cached categories (10 min TTL)
- Radio now playing cached (30 sec TTL)
- Pagination for large media lists
- Indexed database queries on:
  - radio_queue.position
  - radio_requests.status
  - radio_history.played_at
  - media_library.category
  - media_library.type

## Error Handling

All endpoints return structured error responses:
```json
{
  "success": false,
  "error": "Descriptive error message"
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad request (validation error)
- `401` - Not authenticated
- `403` - Not authorized (insufficient permissions)
- `404` - Resource not found
- `500` - Server error

## Deployment Checklist

- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] Redis running and connected
- [ ] App started via PM2
- [ ] Webapps built (`npm run build:prime-hub`)
- [ ] Public radio endpoint accessible
- [ ] Admin routes protected by JWT
- [ ] File uploads working
- [ ] Radio queue persisting
- [ ] Media library searchable

## Future Enhancements

- [ ] Real-time queue updates via WebSockets
- [ ] Automated radio schedule execution
- [ ] Multi-language metadata
- [ ] Advanced media filtering (tags, duration range)
- [ ] Media recommendations based on plays
- [ ] Broadcast message system for DJ communications
- [ ] Analytics dashboard (plays by hour, popular tracks)
- [ ] Podcast episode support
- [ ] Live stream integration

---

**Last Updated**: 2026-02-19
**Status**: Production Ready
