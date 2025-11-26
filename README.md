# PNPtv Telegram Bot

A comprehensive Telegram bot for PNPtv platform featuring user management, subscriptions, live streams, radio, Zoom rooms, and admin controls.

## Features

### User Features
- **Onboarding**: Language selection, age verification, profile setup
- **Subscriptions**: Multiple plans (Basic, Premium, Gold, Enterprise)
- **Live Streams**: Browse and join active streams
- **Radio Player**: Listen to PNPtv radio with inline controls
- **Zoom Rooms**: Access community video rooms
- **Nearby Users**: Find users by location
- **Support**: AI and human support chat

### Admin Features
- **Dashboard**: Comprehensive admin control panel
- **Broadcast Messages**: Send announcements to all users
- **User Management**: Search, edit, and manage user subscriptions
- **Analytics**: User growth, revenue, and engagement metrics
- **Plan Management**: Create and edit subscription plans

## Setup

### Prerequisites
- Node.js 16+
- Firebase project with Firestore enabled
- Telegram Bot Token (from @BotFather)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Fill in required values:
     - `BOT_TOKEN`: From @BotFather
     - `BOT_USERNAME`: Your bot's username
     - `ADMIN_IDS`: Your Telegram user ID
     - `FIREBASE_PRIVATE_KEY`: From Firebase Console

4. Start the bot:
   ```bash
   npm run dev
   ```

### Getting Firebase Credentials

1. Go to https://console.firebase.google.com
2. Select project: **PNPtv! Bot**
3. Project Settings → Service Accounts
4. Generate new private key
5. Copy the `private_key` value to `.env`

## Project Structure

```
src/
├── bot/
│   ├── core/           # Bot initialization and middleware
│   ├── handlers/       # Command handlers (user, group, admin)
│   ├── utils/          # Utilities (menus, notifications, validation)
│   ├── services/       # Business logic (users, payments, zoom)
│   └── config/         # Configuration files
├── tests/              # Unit and integration tests
└── public/             # Static assets
```

## Command Routing

- **Private Chat Commands**: `/start`, Subscribe, Profile, Settings
- **Group Chat Commands**: Live Streams, Radio, Zoom Rooms
- **Admin Commands**: `/admin` (restricted to ADMIN_IDS)

## Payment Integration

- **ePayco**: Credit cards (Colombia/LATAM)
- **Daimo Pay**: Crypto (USDC) and digital wallets

## Testing

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration
```

## Deployment

### Docker
```bash
docker build -t pnptv-bot .
docker run -p 3000:3000 --env-file .env pnptv-bot
```

### Manual Deployment
1. Set `NODE_ENV=production` in `.env`
2. Run `npm start`

## Support

For issues or questions, contact the admin team.

## License

MIT
