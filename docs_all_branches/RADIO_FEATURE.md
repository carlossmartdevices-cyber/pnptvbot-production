# Radio 24/7 Feature - PNPtv Bot

## 🌟 Overview

The PNPtv Radio feature provides a complete 24/7 streaming radio experience with song request management, live scheduling, and comprehensive admin controls. Users can listen to the stream, request songs, view what's playing now, and check the radio schedule. Admins have full control over the radio station including managing song requests, setting now playing information, and scheduling programs.

## ✨ Features

### User Features
- **🎧 Listen Now**: Direct access to the live radio stream
- **🎵 Now Playing**: Real-time display of current song with artist and duration
- **🎵 Request Song**: Submit song requests (limited to 5 per day per user)
- **📜 History**: View recently played songs
- **📅 Schedule**: See the weekly radio programming schedule

### Admin Features
- **🎵 Set Now Playing**: Manually update current song information
- **📋 View Song Requests**: Review, approve, or reject user song requests
- **📅 Manage Schedule**: Create, view, edit, and delete scheduled programs
- **📊 Statistics**: View radio performance metrics
- **🔍 Search History**: Find previously played songs
- **🏆 Top 10**: See most requested songs

## 🏗️ Architecture

### File Structure

```
src/
├── bot/handlers/
│   ├── media/
│   │   └── radio.js              # User-facing radio features
│   └── admin/
│       └── radioManagement.js    # Admin radio management
└── models/
    └── radioModel.js             # Data layer with Firebase/Redis
```

### Technology Stack

- **Telegraf**: Telegram bot framework for handlers and UI
- **Firebase/Firestore**: Primary database for radio data
- **Redis**: Caching layer for performance optimization
- **Session Management**: Multi-step flows for admin operations

## 📋 Firebase Collections

### 1. `radio_now_playing` Collection

Stores current song information:

```javascript
{
  id: 'auto-generated-id',
  song: 'Song Title',
  artist: 'Artist Name',
  duration: '3:45',
  startedAt: Timestamp,
  updatedAt: Timestamp,
  updatedBy: 'admin_telegram_id'
}
```

### 2. `radio_requests` Collection

User song requests with status tracking:

```javascript
{
  id: 'auto-generated-id',
  userId: '123456789',           // Telegram user ID
  username: '@username',
  song: 'Requested Song Title',
  requestedAt: Timestamp,
  status: 'pending',             // 'pending', 'approved', 'rejected', 'played'
  processedAt: Timestamp,        // When approved/rejected
  processedBy: 'admin_id',       // Admin who processed
  playedAt: Timestamp            // When marked as played (optional)
}
```

**Status Values:**
- `pending`: Waiting for admin review
- `approved`: Accepted by admin, queued to play
- `rejected`: Declined by admin
- `played`: Song has been played on air

### 3. `radio_history` Collection

Historical record of played songs:

```javascript
{
  id: 'auto-generated-id',
  song: 'Song Title',
  artist: 'Artist Name',
  duration: '3:45',
  playedAt: Timestamp,
  source: 'manual',              // 'manual', 'request', 'scheduled'
  requestedBy: 'user_id'         // If from request (optional)
}
```

### 4. `radio_schedule` Collection

Weekly programming schedule:

```javascript
{
  id: 'auto-generated-id',
  day: 'Monday',                 // 'Monday', 'Tuesday', etc.
  timeSlot: '14:00-16:00',
  programName: 'Rock Classics Hour',
  description: 'The best rock hits from the 70s and 80s',
  host: 'DJ Name',               // Optional
  createdAt: Timestamp,
  createdBy: 'admin_id',
  updatedAt: Timestamp
}
```

## ⚙️ Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Radio Streaming (Optional - configure if needed)
RADIO_STREAM_URL=https://pnp.app/radio/stream
RADIO_API_URL=https://pnp.app/api/radio
```

**Variables:**
- `RADIO_STREAM_URL`: Direct URL to your radio stream (Icecast, Shoutcast, etc.)
- `RADIO_API_URL`: Optional API endpoint for stream metadata (if your streaming server provides it)

### Stream Server Setup

The bot supports any streaming format that works with standard audio players:

**Supported Formats:**
- Icecast (MP3, OGG, AAC)
- Shoutcast
- HLS streams
- Direct MP3/AAC URLs

**Recommended Setup:**
1. Set up an Icecast2 or Shoutcast server
2. Configure your broadcasting software (Mixxx, RadioDJ, SAM Broadcaster, etc.)
3. Add the stream URL to `RADIO_STREAM_URL`
4. Optionally expose metadata API at `RADIO_API_URL`

## 🎯 User Flows

### 1. Accessing Radio Menu

Users access radio via the main menu:

```
/menu → 📻 Radio
```

Radio menu displays:
```
📻 PNPtv Radio - 24/7
Your 24/7 music streaming experience

🎧 Listen Now
🎵 Now Playing
🎵 Request Song
📜 History
📅 Schedule
⬅️ Back to Menu
```

### 2. Listening to Stream

When user clicks "🎧 Listen Now":

```javascript
// Opens stream in Telegram audio player or external app
await ctx.reply(
  `🎧 PNPtv Radio - Live Stream\n\n` +
  `Listen here: ${process.env.RADIO_STREAM_URL}`,
  Markup.inlineKeyboard([
    [Markup.button.url('🎧 Open Stream', process.env.RADIO_STREAM_URL)]
  ])
);
```

### 3. Requesting a Song

Multi-step flow:

1. User clicks "🎵 Request Song"
2. Bot prompts: "Enter song name to request:"
3. User sends song name
4. System checks daily limit (5 requests/day)
5. Request saved to `radio_requests` with status `pending`
6. User receives confirmation

**Daily Limit:**
- Each user can request max 5 songs per day
- Limit resets at midnight (UTC or server timezone)
- Enforced via `RadioModel.getUserRequestCount(userId, date)`

### 4. Viewing Now Playing

Displays current song information:

```
🎵 Now Playing

Song: Sweet Child O' Mine
Artist: Guns N' Roses
Duration: 5:56
Started at: 14:32

🎧 Listening to PNPtv Radio 24/7
```

If no song set:
```
🎵 Now Playing

No song information available right now.
```

### 5. Viewing History

Shows last 10 played songs with timestamps:

```
📜 Recently Played

1. 15:45 - Hotel California - Eagles (6:30)
2. 15:38 - Bohemian Rhapsody - Queen (5:55)
3. 15:30 - Stairway to Heaven - Led Zeppelin (8:02)
...
```

### 6. Viewing Schedule

Displays weekly programming by day:

```
📅 Radio Schedule

Monday
🕐 08:00-12:00 - Morning Show
    Your daily dose of energy

🕐 14:00-16:00 - Rock Classics Hour
    The best rock hits from the 70s and 80s

Tuesday
...
```

## 👨‍💼 Admin Management

### Accessing Radio Management

Admins access via admin panel:

```
/admin → 🎵 Radio Management
```

Admin menu displays:
```
🎵 Radio Management

📊 Statistics
🎵 Set Now Playing
📋 View Song Requests
📅 Manage Schedule
🔍 Search History
🏆 Top 10 Requested
```

### 1. Setting Now Playing

Multi-step flow to update current song:

**Step 1: Enter Song Title**
```
Admin clicks: 🎵 Set Now Playing
Bot: Enter the song title:
Admin: Sweet Child O' Mine
```

**Step 2: Enter Artist**
```
Bot: Enter the artist name:
Admin: Guns N' Roses
```

**Step 3: Enter Duration**
```
Bot: Enter the duration (e.g., 3:45):
Admin: 5:56
```

**Confirmation:**
```
✅ Now playing updated successfully!

🎵 Sweet Child O' Mine
🎤 Guns N' Roses
⏱️ 5:56
```

**Backend Process:**
1. Creates/updates document in `radio_now_playing`
2. Adds entry to `radio_history` with source: 'manual'
3. Invalidates Redis cache
4. Broadcasts to connected clients (if WebSocket enabled)

### 2. Managing Song Requests

View all pending requests with approve/reject actions:

```
📋 Song Requests

Pending: 3

1. 🎵 Don't Stop Believin' - Journey
   👤 @username (ID: 123456789)
   🕐 Requested: 2 hours ago

   [✅ Approve] [❌ Reject]

2. 🎵 Livin' on a Prayer - Bon Jovi
   👤 @another_user
   🕐 Requested: 45 minutes ago

   [✅ Approve] [❌ Reject]
```

**Actions:**

- **Approve**: Changes status to `approved`, records `processedBy` and `processedAt`
- **Reject**: Changes status to `rejected`, records admin and timestamp
- **Mark as Played**: (from approved list) Changes status to `played`, adds to history

**Notifications:**

Optionally notify users when their requests are approved/rejected:

```javascript
// When approved
await bot.telegram.sendMessage(
  userId,
  `✅ Your song request "${song}" has been approved! We'll play it soon.`
);

// When rejected
await bot.telegram.sendMessage(
  userId,
  `❌ Your song request "${song}" was not approved this time. Try another song!`
);
```

### 3. Managing Schedule

Create weekly programming schedule:

**View Schedule:**
```
📅 Schedule Management

[➕ Add to Schedule]

Monday
🕐 08:00-12:00 - Morning Show
    [✏️ Edit] [🗑️ Delete]

🕐 14:00-16:00 - Rock Classics Hour
    [✏️ Edit] [🗑️ Delete]
```

**Add to Schedule Flow:**

1. Admin clicks "➕ Add to Schedule"
2. Select day (Monday-Sunday)
3. Enter time slot (e.g., "14:00-16:00")
4. Enter program name
5. Enter description (optional)
6. Entry created in `radio_schedule` collection

**Edit/Delete:**
- Edit: Re-enter all fields, updates existing document
- Delete: Removes from collection with confirmation

### 4. Statistics Dashboard

Real-time metrics:

```
📊 Radio Statistics

📝 Total Requests: 156
   ✅ Approved: 98 (63%)
   ❌ Rejected: 28 (18%)
   ⏳ Pending: 12 (8%)
   ✓ Played: 18 (12%)

🎵 Songs Played Today: 42
🎵 Total Songs in History: 1,247

📅 Schedule Entries: 14
👥 Active Requesters (7 days): 28
```

### 5. Search History

Search previously played songs:

```
🔍 Search History

Enter search term:
> queen

Results (5):

1. Bohemian Rhapsody - Queen
   Played: Today at 15:38

2. We Are the Champions - Queen
   Played: Yesterday at 18:20

3. Don't Stop Me Now - Queen
   Played: 2 days ago at 14:12
```

### 6. Top 10 Requested Songs

Shows most popular requests:

```
🏆 Top 10 Most Requested Songs

1. 🥇 Sweet Child O' Mine - Guns N' Roses (24 requests)
2. 🥈 Bohemian Rhapsody - Queen (21 requests)
3. 🥉 Hotel California - Eagles (18 requests)
4. Don't Stop Believin' - Journey (15 requests)
5. Stairway to Heaven - Led Zeppelin (14 requests)
...
```

## 🔄 Redis Caching

The RadioModel implements Redis caching for performance:

### Cached Data

1. **Now Playing** (TTL: 60 seconds)
   - Key: `radio:now_playing`
   - Value: Current song JSON

2. **Recent History** (TTL: 300 seconds / 5 minutes)
   - Key: `radio:history:recent`
   - Value: Array of last 10 songs

3. **Schedule** (TTL: 3600 seconds / 1 hour)
   - Key: `radio:schedule`
   - Value: Full weekly schedule

4. **User Request Count** (TTL: 86400 seconds / 24 hours)
   - Key: `radio:requests:count:{userId}:{date}`
   - Value: Number of requests today

### Cache Invalidation

Cache is automatically invalidated when:
- Now playing is updated (clears `radio:now_playing`)
- History is added (clears `radio:history:recent`)
- Schedule is modified (clears `radio:schedule`)
- Song request is submitted (increments user count)

### Performance Impact

Without Redis:
- Every "Now Playing" view = 1 Firestore read
- 100 users/hour = 100 reads

With Redis (60s TTL):
- First view = 1 Firestore read
- Next 60 seconds = 0 Firestore reads
- 100 users/hour ≈ 2 reads (vs 100)

**Cost Savings**: ~98% reduction in database reads for frequently accessed data

## 🧪 Testing

### Manual Testing Checklist

**User Features:**
- [ ] Access radio menu from main menu
- [ ] Click "Listen Now" and verify stream URL opens
- [ ] View "Now Playing" with song set
- [ ] View "Now Playing" with no song (should show message)
- [ ] Request a song (should succeed)
- [ ] Request 6 songs in same day (6th should fail with limit message)
- [ ] View history with songs played
- [ ] View history with empty history
- [ ] View schedule with programs set
- [ ] View schedule with no programs

**Admin Features:**
- [ ] Access radio management from admin panel
- [ ] View statistics
- [ ] Set now playing (complete 3-step flow)
- [ ] View song requests (should show pending)
- [ ] Approve a song request
- [ ] Reject a song request
- [ ] Mark approved request as played
- [ ] Add schedule entry (complete flow)
- [ ] Edit schedule entry
- [ ] Delete schedule entry
- [ ] Search history
- [ ] View top 10 requested songs

### Automated Testing

Create test file: `tests/integration/radio.test.js`

```javascript
const RadioModel = require('../../src/models/radioModel');

describe('Radio Feature', () => {
  describe('Now Playing', () => {
    it('should set current song', async () => {
      const result = await RadioModel.setNowPlaying({
        song: 'Test Song',
        artist: 'Test Artist',
        duration: '3:45',
        updatedBy: 'admin_123'
      });
      expect(result.success).toBe(true);
    });

    it('should get current song', async () => {
      const song = await RadioModel.getNowPlaying();
      expect(song).toHaveProperty('song');
      expect(song).toHaveProperty('artist');
    });
  });

  describe('Song Requests', () => {
    it('should create request', async () => {
      const result = await RadioModel.createRequest({
        userId: 'user_123',
        username: '@testuser',
        song: 'Test Request'
      });
      expect(result.success).toBe(true);
    });

    it('should enforce daily limit', async () => {
      const userId = 'test_limit_user';
      for (let i = 0; i < 5; i++) {
        await RadioModel.createRequest({
          userId,
          username: '@testuser',
          song: `Request ${i}`
        });
      }
      const count = await RadioModel.getUserRequestCount(userId);
      expect(count).toBe(5);
    });
  });
});
```

Run tests:
```bash
npm test -- tests/integration/radio.test.js
```

## 🔍 Monitoring & Logs

### Important Log Events

```javascript
// Now playing updated
logger.info('Radio: Now playing updated', {
  song, artist, duration, updatedBy
});

// Song request created
logger.info('Radio: Song request created', {
  userId, username, song
});

// Request processed
logger.info('Radio: Request processed', {
  requestId, status, processedBy
});

// Schedule entry created
logger.info('Radio: Schedule entry created', {
  day, timeSlot, programName, createdBy
});
```

### Metrics to Monitor

1. **Request Volume**
   - Requests per hour/day
   - Peak request times
   - User engagement

2. **Admin Activity**
   - Songs set manually vs from requests
   - Request approval rate
   - Schedule updates frequency

3. **Cache Hit Rate**
   - Redis cache hits vs misses
   - Firestore read reduction percentage

4. **User Behavior**
   - Most active requesters
   - Most requested songs
   - Schedule viewing patterns

## ⚠️ Troubleshooting

### Stream Not Playing

**Symptoms:** User clicks "Listen Now" but stream doesn't open

**Solutions:**
1. Verify `RADIO_STREAM_URL` is correct in `.env`
2. Test stream URL in browser directly
3. Check streaming server is running
4. Verify URL is accessible (not behind firewall)
5. Check stream format is supported by Telegram

```bash
# Test stream
curl -I $RADIO_STREAM_URL
# Should return 200 OK with audio content-type
```

### Now Playing Not Updating

**Symptoms:** Song shown is old or not updating

**Solutions:**
1. Check Redis connection
2. Verify cache invalidation is working
3. Check admin set the song correctly
4. View Firestore console directly

```bash
# Clear cache manually
redis-cli
> DEL radio:now_playing
```

### Song Requests Not Appearing

**Symptoms:** User submits request but admin doesn't see it

**Solutions:**
1. Check Firestore connection
2. Verify `radio_requests` collection exists
3. Check request status (might be filtered)
4. View Firestore console directly

```javascript
// Debug: List all requests
const requests = await RadioModel.getAllRequests();
console.log('All requests:', requests);
```

### Daily Limit Not Resetting

**Symptoms:** User still blocked after 24 hours

**Solutions:**
1. Check Redis TTL on user count key
2. Verify timezone settings
3. Check date comparison logic

```bash
# Check user request count
redis-cli
> GET radio:requests:count:USER_ID:2025-01-19
> TTL radio:requests:count:USER_ID:2025-01-19
```

### Schedule Not Displaying

**Symptoms:** Schedule shows "No schedule set yet"

**Solutions:**
1. Verify `radio_schedule` collection has entries
2. Check query filters
3. View Firestore console
4. Clear schedule cache

```bash
redis-cli
> DEL radio:schedule
```

## 📚 API Reference

### RadioModel Methods

```javascript
// Now Playing
await RadioModel.setNowPlaying({ song, artist, duration, updatedBy })
await RadioModel.getNowPlaying()

// Requests
await RadioModel.createRequest({ userId, username, song })
await RadioModel.getPendingRequests()
await RadioModel.approveRequest(requestId, adminId)
await RadioModel.rejectRequest(requestId, adminId)
await RadioModel.markRequestAsPlayed(requestId)
await RadioModel.getUserRequestCount(userId, date)

// History
await RadioModel.addToHistory({ song, artist, duration, source, requestedBy })
await RadioModel.getRecentHistory(limit)
await RadioModel.searchHistory(searchTerm)

// Schedule
await RadioModel.createScheduleEntry({ day, timeSlot, programName, description, createdBy })
await RadioModel.getSchedule()
await RadioModel.updateScheduleEntry(entryId, updates)
await RadioModel.deleteScheduleEntry(entryId)

// Statistics
await RadioModel.getStatistics()
await RadioModel.getTopRequested(limit)
```

## 🔗 Integration with Other Features

### Premium Content

Radio can be gated for premium users:

```javascript
bot.action('show_radio', async (ctx) => {
  const user = ctx.session?.user;
  const isPremium = user?.subscriptionStatus === 'active';

  if (!isPremium) {
    return ctx.answerCbQuery(
      '🔒 Radio is for premium users only. Subscribe to listen!',
      { show_alert: true }
    );
  }

  await showRadioMenu(ctx);
});
```

### Activity Tracking

Log radio interactions for analytics:

```javascript
// In radio.js handlers
const ActivityModel = require('../../models/activityModel');

bot.action('radio_listen_now', async (ctx) => {
  await ActivityModel.logActivity({
    userId: ctx.from.id,
    action: 'radio_listen',
    timestamp: new Date()
  });
  // ... show stream
});
```

### Gamification

Award points for radio engagement:

```javascript
// When user requests song
await GamificationModel.awardPoints(userId, 5, 'song_request');

// When request is played
await GamificationModel.awardPoints(userId, 20, 'song_played');
```

## 🚀 Future Enhancements

### Possible Additions

1. **Live DJ Mode**
   - Real-time chat during shows
   - Live request queue visible to listeners
   - DJ can interact with listeners

2. **Playlists**
   - Pre-defined playlists for auto-play
   - User-created playlists
   - Genre-based programming

3. **Voting System**
   - Users vote on pending requests
   - Top-voted songs get priority
   - Community-driven playlist

4. **Request Dedications**
   - Users can dedicate songs to others
   - Shoutouts displayed on now playing
   - Tag other users in requests

5. **Stream Analytics**
   - Listener count
   - Peak listening times
   - Geographic distribution

6. **Multi-Stream Support**
   - Different streams for genres
   - Language-specific streams
   - Quality options (high/low bitrate)

7. **Automated DJ**
   - Integration with streaming software
   - Auto-update now playing via API
   - Scheduled program automation

## 📞 Support

### Getting Help

- **Integration Issues**: Check logs in `/logs` directory
- **Streaming Server**: Consult Icecast/Shoutcast documentation
- **Firebase/Redis**: Verify connection configurations
- **Feature Requests**: Submit to development team

### External Resources

- **Icecast**: https://icecast.org/docs/
- **Firebase Firestore**: https://firebase.google.com/docs/firestore
- **Redis Caching**: https://redis.io/docs/manual/
- **Telegraf**: https://telegraf.js.org/

---

**Last Updated**: 2025-01-19
**Version**: 1.0.0
**Status**: ✅ Complete and Production-Ready
