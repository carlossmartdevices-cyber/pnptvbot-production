# PNPtv Telegram Bot - Setup Guide

Complete setup guide for the PNPtv Telegram Bot.

## Prerequisites

- Node.js 16+ installed
- Firebase project created
- Telegram Bot Token (from @BotFather)
- Your Telegram User ID (get from @userinfobot)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Firebase Project

1. Go to https://console.firebase.google.com
2. Create a new project named "PNPtv Bot" (or use existing: `pnptv--bot`)
3. Enable **Firestore Database**:
   - Go to Firestore Database
   - Create database in production mode
   - Choose your region
4. Generate Service Account Key:
   - Go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save the JSON file

### 3. Create Telegram Bot

1. Open Telegram and search for @BotFather
2. Send `/newbot` command
3. Follow instructions to create your bot
4. Save the **Bot Token** provided
5. Get your **Telegram User ID**:
   - Search for @userinfobot in Telegram
   - Start the bot and it will show your user ID

### 4. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in the required values in `.env`:

```env
# Bot Configuration
BOT_TOKEN=YOUR_BOT_TOKEN_FROM_BOTFATHER
BOT_USERNAME=your_bot_username

# Admin Configuration (Your Telegram User ID)
ADMIN_IDS=YOUR_USER_ID

# Firebase Configuration
FIREBASE_PROJECT_ID=pnptv--bot
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@pnptv--bot.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nPASTE_YOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----"
```

**To get Firebase Private Key:**
- Open the downloaded JSON file from Step 2
- Copy the value of `private_key` field
- Paste it in the `.env` file (keep the quotes and newlines as `\n`)

### 5. Seed the Database

Run the seed script to populate Firestore with subscription plans:

```bash
node scripts/seedDatabase.js
```

This will create:
- 4 subscription plans (Basic, Premium, Gold, Enterprise)
- Sample live stream
- Sample Zoom room

### 6. Run the Bot

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

You should see:
```
✅ PNPtv Bot is running!
Bot username: @your_bot_username
✅ All systems operational!
```

### 7. Test the Bot

1. Open Telegram
2. Search for your bot username
3. Send `/start` command
4. Follow the onboarding flow

### 8. Add Bot to a Group (Optional)

1. Create a Telegram group
2. Add your bot to the group
3. Make the bot an admin (optional, for better functionality)
4. Test group commands:
   - Type "Live Streams"
   - Type "Radio"
   - Type "Zoom Rooms"

## Payment Gateway Setup (Optional)

### ePayco Setup

1. Sign up at https://epayco.com
2. Get your public and private keys
3. Add to `.env`:
   ```env
   EPAYCO_PUBLIC_KEY=your_public_key
   EPAYCO_PRIVATE_KEY=your_private_key
   EPAYCO_TEST_MODE=true
   ```

### Daimo Pay Setup

1. Contact Daimo Pay for API access
2. Get your API key
3. Add to `.env`:
   ```env
   DAIMO_PAY_API_KEY=your_api_key
   DAIMO_PAY_WEBHOOK_SECRET=your_webhook_secret
   ```

## Webhook Configuration

For payment webhooks to work, you need a public URL:

1. **For Development:** Use ngrok
   ```bash
   npm install -g ngrok
   ngrok http 3000
   ```

2. **For Production:** Deploy to a server with a domain

3. Update webhook URLs in payment gateway settings:
   - ePayco: `https://your-domain.com/webhook/epayco`
   - Daimo: `https://your-domain.com/webhook/daimo`

## Deployment

### Using Docker

1. Build the image:
   ```bash
   docker build -t pnptv-bot .
   ```

2. Run the container:
   ```bash
   docker-compose up -d
   ```

### Manual Deployment

1. Set up a VPS (e.g., DigitalOcean, AWS, GCP)
2. Install Node.js 16+
3. Clone your repository
4. Install dependencies: `npm ci --only=production`
5. Set environment variables
6. Run with PM2:
   ```bash
   npm install -g pm2
   pm2 start src/start.js --name pnptv-bot
   pm2 save
   pm2 startup
   ```

## Admin Commands

As an admin, you can use:

- `/admin` - Open admin dashboard
- Broadcast messages to all users
- View user statistics
- Manage subscriptions
- View analytics

## Troubleshooting

### Bot doesn't respond

1. Check if bot is running: `pm2 status` or check console logs
2. Verify BOT_TOKEN is correct
3. Check Firebase credentials are valid

### "Firebase not initialized" error

1. Verify Firebase credentials in `.env`
2. Make sure FIREBASE_PRIVATE_KEY has proper newlines (`\n`)
3. Run seed script again: `node scripts/seedDatabase.js`

### Webhook not receiving payments

1. Check webhook URL is publicly accessible
2. Verify payment gateway webhook settings
3. Check API server logs for errors

### Group commands not working

1. Make sure bot is added to the group
2. Check bot has necessary permissions
3. Try making bot an admin in the group

## Support

For issues or questions:
- Check logs in `logs/` directory
- Review Firebase console for errors
- Contact support at support@pnptv.com

## Security Notes

- Never commit `.env` file to git
- Keep your bot token secret
- Regularly rotate API keys
- Use HTTPS for webhooks in production
- Enable 2FA on Firebase account

## Next Steps

1. Customize subscription plans in Firestore
2. Add your actual live stream URLs
3. Configure Zoom API integration
4. Set up monitoring with Sentry
5. Add analytics tracking
6. Customize messages in `locales/` folder

Enjoy your PNPtv Telegram Bot! 🎉
