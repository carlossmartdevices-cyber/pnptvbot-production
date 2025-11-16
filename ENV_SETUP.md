# Environment Variables Setup Guide

This guide will help you configure the `.env` file for the PNPtv Telegram Bot.

## Quick Start - Minimal Configuration

To get the bot running, you only need these **required** variables:

```env
BOT_TOKEN=your_telegram_bot_token_here
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
```

### How to get these credentials:

1. **BOT_TOKEN**: Create a bot with [@BotFather](https://t.me/BotFather) on Telegram
2. **Firebase Credentials**:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project or select existing
   - Go to Project Settings > Service Accounts
   - Generate new private key
   - Use the values from the downloaded JSON file

## Optional Features

All other environment variables are optional. The bot will work without them, but certain features will be unavailable:

### Payment Processing
```env
# ePayco (Colombian payment gateway)
EPAYCO_PUBLIC_KEY=
EPAYCO_PRIVATE_KEY=
EPAYCO_P_CUST_ID=
EPAYCO_TEST_MODE=true

# Daimo (USDC payments)
DAIMO_API_KEY=
DAIMO_WEBHOOK_SECRET=
```
**If not configured**: Payment features will show an error message when users try to subscribe.

### Video Conferencing
```env
ZOOM_API_KEY=
ZOOM_API_SECRET=
ZOOM_SDK_KEY=
ZOOM_SDK_SECRET=
```
**If not configured**: Zoom room creation will show "not configured" message.

### Live Streaming
```env
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=
```
**If not configured**: Live streaming features will be unavailable.

### AI Chat Support
```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_MAX_TOKENS=500
```
**If not configured**: AI support will fallback to admin forwarding.

### Error Tracking
```env
SENTRY_DSN=
SENTRY_ENVIRONMENT=development
```
**If not configured**: Errors will only be logged locally.

### Caching (Redis)
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TTL=300
```
**If not configured**: Bot will use in-memory session storage (not recommended for production).

### Geolocation
```env
GEOCODER_PROVIDER=openstreetmap
GEOCODER_API_KEY=
```
**If not configured**: Uses OpenStreetMap (no API key required).

## Security Settings

**Important**: Generate strong random strings for these in production!

```env
JWT_SECRET=change_this_to_a_secure_random_string_min_32_chars
ENCRYPTION_KEY=change_this_to_secure_key_32ch
```

Generate secure keys with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Admin Users

Add Telegram user IDs (comma-separated) for admin access:
```env
ADMIN_USER_IDS=123456789,987654321
```

To find your Telegram user ID, message [@userinfobot](https://t.me/userinfobot).

## Production vs Development

### Development
```env
NODE_ENV=development
BOT_WEBHOOK_DOMAIN=
# Bot will run in polling mode
```

### Production
```env
NODE_ENV=production
BOT_WEBHOOK_DOMAIN=https://yourdomain.com
BOT_WEBHOOK_PATH=/pnp/webhook/telegram
# Bot will run in webhook mode
```

## Testing the Configuration

After setting up your `.env` file:

```bash
# Install dependencies
npm install

# Start the bot
npm start

# Or for development with auto-reload
npm run dev
```

If you see these messages, the bot is running correctly:
```
✓ Environment variables validated
✓ Firebase initialized
✓ Redis initialized (or warning if Redis unavailable)
✓ Bot started in polling mode
✓ API server running on port 3000
🚀 PNPtv Telegram Bot is running!
```

## Troubleshooting

### Bot won't start
- Check that all **required** variables are set
- Verify Firebase credentials are correct
- Make sure BOT_TOKEN is valid

### Features not working
- Check if the optional service for that feature is configured
- Look at logs for specific error messages
- Verify API keys are valid and have proper permissions

### Redis connection errors
- The bot will continue working with in-memory sessions
- For production, ensure Redis is running and accessible
- Check REDIS_HOST and REDIS_PORT values

## Need Help?

Check the logs in `./logs` directory for detailed error messages.
