# Live Streaming Setup Guide

This guide will help you set up live streaming with JaaS (Jitsi as a Service) for your PNPtv Bot.

## Overview

The live streaming feature allows you and your team to:
- **Create live streams** for your subscribers
- **Interactive chat** - viewers can send messages in real-time
- **High quality video** - powered by Jitsi
- **Unlimited viewers** - no viewer limits
- **Simple interface** - easy to use for hosts and viewers

## Why JaaS (Jitsi as a Service)?

We're using **JaaS** instead of self-hosting because:
- ✅ No need to run your own Jitsi Videobridge servers
- ✅ Fully managed and maintained by 8x8
- ✅ Scalable infrastructure
- ✅ JWT authentication for security
- ✅ Built-in features (live streaming, recording, etc.)

**Note:** The link you shared (https://github.com/jitsi/jitsi-videobridge) is for self-hosting Jitsi. We're using the managed JaaS service instead, which is simpler and more scalable.

## Prerequisites

1. JaaS Account at https://jaas.8x8.vc/
2. PostgreSQL database (for storing stream data)
3. Your bot must be running

## Step 1: Get JaaS Credentials

1. Go to https://jaas.8x8.vc/#/apikeys
2. Create a new API key
3. You'll get:
   - **App ID** (format: `vpaas-magic-cookie-xxxxxxxx`)
   - **API Key ID** (kid)
   - **Private Key** (RSA private key)

## Step 2: Configure Environment Variables

Add these variables to your `.env` file:

```bash
# JaaS (Jitsi as a Service) Configuration
JAAS_APP_ID=vpaas-magic-cookie-your-app-id-here
JAAS_API_KEY_ID=your-api-key-id-here
JAAS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
Your private key here (multiple lines)
-----END PRIVATE KEY-----"
```

**Important Notes:**
- The Private Key should include the entire key with BEGIN and END markers
- Use double quotes around the private key to preserve newlines
- Make sure there are no extra spaces or characters

## Step 3: Run Database Migrations

Run the live streams schema migration:

```bash
psql -U your_user -d pnptvbot -f database/migrations/live_streams_schema.sql
```

This creates the necessary tables for:
- Live streams
- Stream viewers
- Chat messages
- Analytics
- Moderators

## Step 4: Restart Your Bot

```bash
npm start
```

Or if using PM2:

```bash
pm2 restart pnptvbot
```

## Step 5: Test the Feature

### For Hosts (Creating a Stream):

1. Open your Telegram bot
2. Send `/livestream` or select "Live Streaming" from the menu
3. Click "🎥 Create Stream"
4. Enter a title for your stream
5. Enter a description (or skip)
6. Click "🎥 Start Streaming" to open the streaming interface
7. Allow camera/microphone permissions
8. You're live!

### For Viewers (Watching a Stream):

1. Open your Telegram bot
2. Send `/livestream` or select "Live Streaming" from the menu
3. Click "📺 Watch Streams"
4. Select a live stream
5. Click "🎥 Watch Stream"
6. You can watch and chat in real-time!

## Features

### For Hosts:
- **Full moderator controls** - mute, kick, ban viewers
- **Chat moderation** - delete messages, enable slow mode
- **Live statistics** - see current viewers, peak viewers, total views
- **Recording** - optionally record your stream (configure in JaaS dashboard)
- **Screen sharing** - share your screen with viewers
- **Multiple hosts** - add co-hosts to your stream

### For Viewers:
- **High-quality video** - adaptive bitrate streaming
- **Real-time chat** - message the host and other viewers
- **Reactions** - react with emojis
- **Raise hand** - signal the host you have a question
- **Mobile & Desktop** - works on all devices

## Chat Integration

The chat is built into the Jitsi interface, so viewers can:
- Send messages visible to everyone
- See who sent each message
- React to messages
- The host can moderate (delete messages, mute users)

All chat messages are also stored in the database for analytics and moderation.

## Access Control

You can configure who can watch your streams:

### Public Streams (Default):
```javascript
isSubscribersOnly: false
```
Anyone can watch.

### Subscribers Only:
```javascript
isSubscribersOnly: true
```
Only users with active subscriptions can watch.

### Plan-Specific Streams:
```javascript
isSubscribersOnly: true,
allowedPlanTiers: ['PNP', 'Crystal', 'Diamond']
```
Only users with specific plan tiers can watch.

## Customization

### Modify Stream Settings:

Edit `/home/user/pnptvbot-production/src/bot/services/streamingService.js`:

```javascript
// Change max viewers
maxViewers: 10000, // Default

// Enable recording
recordStream: true, // Enable recording

// Change category
category: 'music', // Options: music, gaming, talk_show, education, etc.
```

### Modify UI Text:

Edit `/home/user/pnptvbot-production/src/bot/handlers/media/livestream.js` to change button labels and messages.

## Troubleshooting

### "JaaS is not configured" Error
- Check that all three environment variables are set correctly
- Verify the private key format (must include BEGIN/END markers)
- Restart the bot after changing environment variables

### "Stream not found" Error
- The stream may have ended
- Database connection issue - check PostgreSQL is running
- Check logs: `tail -f logs/combined.log`

### Video Not Loading
- Check browser console for errors
- Verify the JaaS credentials are correct
- Test your credentials at https://jwt.io/

### Chat Not Working
- Chat is integrated into Jitsi - make sure allowComments is true
- Check database permissions for stream_chat_messages table
- Verify viewers have joined the stream successfully

## Monitoring

### View Active Streams:
```sql
SELECT * FROM live_streams WHERE status = 'live';
```

### View Stream Statistics:
```sql
SELECT
    title,
    current_viewers,
    peak_viewers,
    total_views,
    total_messages,
    duration
FROM live_streams
WHERE host_user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 10;
```

### View Chat Messages:
```sql
SELECT
    display_name,
    message_text,
    sent_at
FROM stream_chat_messages
WHERE stream_id = 'YOUR_STREAM_ID'
AND is_deleted = false
ORDER BY sent_at DESC
LIMIT 50;
```

## API Endpoints

You can integrate the live streaming feature with your own frontend:

### Create Stream
```javascript
POST /api/streams/create
{
  "hostId": "user_id",
  "title": "My Stream",
  "description": "Description here"
}
```

### Join Stream
```javascript
POST /api/streams/:streamId/join
{
  "viewerId": "user_id",
  "viewerName": "John Doe"
}
```

### Get Active Streams
```javascript
GET /api/streams/active
```

## Security Best Practices

1. **Keep your private key secure**
   - Never commit it to Git
   - Use environment variables
   - Rotate keys periodically

2. **Use JWT expiration**
   - Tokens expire after 2-4 hours (configured in jaasService.js)
   - This prevents unauthorized long-term access

3. **Moderate your streams**
   - Add trusted moderators
   - Use the ban feature for problematic users
   - Enable slow mode if chat is too fast

4. **Monitor usage**
   - Check JaaS dashboard for usage statistics
   - Set up alerts for high usage
   - Monitor costs (JaaS has usage-based pricing)

## Cost Considerations

JaaS pricing is based on:
- **Minutes used** (per participant)
- **Recording storage** (if enabled)
- **Concurrent streams**

Check current pricing at: https://jaas.8x8.vc/pricing

**Tip:** Start with small streams and scale up as needed.

## Support

- **JaaS Documentation:** https://developer.8x8.com/jaas/docs
- **Jitsi Community:** https://community.jitsi.org/
- **Bot Issues:** Check logs and create GitHub issue

## Next Steps

1. ✅ Configure JaaS credentials
2. ✅ Run database migrations
3. ✅ Test creating a stream
4. ✅ Test viewing a stream
5. ✅ Test chat functionality
6. Configure stream settings (optional)
7. Add menu button for easy access
8. Promote the feature to your users!

## Example Usage

### Quick Start for Hosts:
```
/livestream → Create Stream → "Weekly Q&A" → Start Streaming
```

### Quick Start for Viewers:
```
/livestream → Watch Streams → Select stream → Watch
```

That's it! You're ready to go live! 🎥
