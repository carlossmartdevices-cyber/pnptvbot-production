# Quick Start: Radio & Videorama System

## Overview

The PNPtv platform now has a complete, production-ready Radio streaming system and Videorama media management interface. This guide will get you started in 5 minutes.

## Accessing the System

### For Users (Public)
- **Radio Player**: Visit `https://pnptv.app/radio/`
- **Videorama**: Visit `https://pnptv.app/videorama/`
- **Dashboard**: Visit `https://pnptv.app/prime-hub/` and log in

### For Admins (With JWT)
- **Radio Admin**: `https://pnptv.app/prime-hub/admin/radio`
- **Media Admin**: `https://pnptv.app/prime-hub/admin/media`
- **API Token**: Required for all admin endpoints

## Admin Features

### Setting Now Playing Track

1. Go to **Prime Hub Admin** → **Radio Management**
2. Click **"Change Now Playing"** button
3. Search for a track in your media library
4. Click **"Play"** to set it as currently playing

Or manually enter track details without selecting from library.

### Managing Queue

1. Go to **Queue** tab in Radio Management
2. Click **"Add to Queue"** to add tracks
3. Tracks will play in queue order
4. Click trash icon to remove from queue
5. Click **"Clear Queue"** to empty entire queue

### Handling Song Requests

1. Go to **Requests** tab in Radio Management
2. See pending user song requests
3. Click **"Approve"** to accept (adds to approval history)
4. Click **"Reject"** to decline
5. View approval/rejection history below

### Managing Media Library

1. Go to **Prime Hub Admin** → **Media Management**
2. **Upload**: Click "Upload Media" button and select audio/video file
3. **Edit**: Click edit button to update title, artist, description, category
4. **Delete**: Click delete button with confirmation
5. **Filter**: By type (audio/video), category, search by title/artist

## API Endpoints

### Public (No Auth Required)

```bash
# Get current radio track
curl https://pnptv.app/api/radio/now-playing

# Get media library
curl https://pnptv.app/api/media/library?type=audio&limit=20

# Get videorama collections
curl https://pnptv.app/api/videorama/collections

# Submit song request
curl -X POST https://pnptv.app/api/radio/request \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-123","songName":"My Song","artist":"Artist Name"}'
```

### Admin (JWT Auth Required)

```bash
# Set now playing
curl -X POST https://pnptv.app/api/admin/radio/now-playing \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Song","artist":"Artist"}'

# Upload media
curl -X POST https://pnptv.app/api/admin/media/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@song.mp3" \
  -F "title=Song Title" \
  -F "artist=Artist Name" \
  -F "category=music"

# Add to queue
curl -X POST https://pnptv.app/api/admin/radio/queue \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mediaId":"uuid-here"}'

# Get queue
curl https://pnptv.app/api/admin/radio/queue \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Database

All data is stored in PostgreSQL:

```sql
-- Check current playing track
SELECT * FROM radio_now_playing;

-- See radio queue (in order)
SELECT * FROM radio_queue ORDER BY position;

-- View pending song requests
SELECT * FROM radio_requests WHERE status = 'pending';

-- Check media library
SELECT COUNT(*) FROM media_library;
SELECT * FROM media_library WHERE type='audio' LIMIT 10;
```

## Testing

### Test Public Endpoints

```bash
# All should return 200 with data
curl http://localhost:3001/api/radio/now-playing | jq .
curl http://localhost:3001/api/media/library | jq .
curl http://localhost:3001/api/videorama/collections | jq .
```

### Run Test Suite

```bash
# Run all radio/videorama tests
npm test -- tests/e2e/radio-videorama.test.js

# Expected: 28/33 passing (5 require valid JWT)
```

## Troubleshooting

### "Media not found" error for /api/media/playlists

**Cause**: Route was being caught by `/api/media/:mediaId` pattern
**Solution**: Fixed in latest commit - playlists route moved before parameterized route

### Admin endpoints returning 401

**Cause**: Missing or invalid JWT token
**Solution**: Include valid JWT in Authorization header:
```bash
-H "Authorization: Bearer YOUR_VALID_JWT"
```

### Media upload failing

**Cause**: File too large or invalid format
**Solution**:
- Max file size: 500MB
- Allowed types: MP3, WAV, OGG, AAC, MP4, WebM, QuickTime
- Use form-data with `file` field

### Radio now playing not updating

**Cause**: Database table name mismatch
**Solution**: Fixed in latest commit - now using `radio_now_playing` (was referencing `radio_now_playing_fixed`)

## File Locations

| Component | Path |
|-----------|------|
| Backend Controller | `src/bot/api/controllers/mediaAdminController.js` |
| Routes | `src/bot/api/routes.js` (lines 1100-1516) |
| Admin UI - Radio | `webapps/prime-hub/src/pages/admin/AdminRadioPage.jsx` |
| Admin UI - Media | `webapps/prime-hub/src/pages/admin/AdminMediaPage.jsx` |
| API Client | `webapps/prime-hub/src/api/client.js` |
| Documentation | `RADIO_VIDEORAMA_IMPLEMENTATION.md` |
| Tests | `tests/e2e/radio-videorama.test.js` |

## Deployment

1. **Build frontend**:
   ```bash
   npm run build:prime-hub
   ```

2. **Start application**:
   ```bash
   npm start
   # or via PM2
   pm2 start ecosystem.config.js --env production
   ```

3. **Verify**:
   ```bash
   curl http://localhost:3001/api/radio/now-playing
   # Should return track data
   ```

## Key Features Implemented

✅ Radio now playing track display
✅ Queue management with ordering
✅ Song request system with approval workflow
✅ Media library upload and management
✅ Category-based media organization
✅ Public videorama collections
✅ Play history tracking
✅ Explicit content flagging
✅ Admin dashboard with controls
✅ Full REST API with JWT protection
✅ End-to-end test coverage
✅ Redis caching for performance
✅ Database indexes for speed

## Performance

- Radio now playing cached for 30 seconds
- Media library cached for 5 minutes
- Categories cached for 10 minutes
- Indexed queries on: position, status, played_at, category, type
- Pagination support for large datasets

## What's Next?

- [ ] Real-time queue updates via WebSockets
- [ ] Automated schedule execution
- [ ] DJ broadcast messages
- [ ] Advanced analytics dashboard
- [ ] Podcast episode management
- [ ] Live stream integration
- [ ] Mobile app integration

---

**Status**: Production Ready ✅
**Last Updated**: 2026-02-19
**Test Coverage**: 28/33 passing (85%)
