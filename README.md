# PNPtv Telegram Bot - Production Ready

A comprehensive, production-ready Telegram bot for PNPtv featuring live streaming, radio, Zoom rooms, subscription payments, and more.

## 🌟 Features

### Core Functionality
- ✅ **User Onboarding**: Multi-step onboarding with language selection, age verification, and terms acceptance
- 👤 **Profile Management**: Customizable profiles with photos, bios, locations, and interests
- 🌍 **Nearby Users**: Geolocation-based user discovery with radius filtering
- 💎 **Subscription System**: Premium plans with ePayco (USD) and Daimo (USDC) payment integration
- 📻 **Radio Streaming**: 24/7 radio with song requests and now playing info
- 🎥 **Zoom Rooms**: Create and join video conference rooms
- 🎤 **Live Streaming**: Start and view live streams (premium feature)
- 🤖 **AI Support**: Cristina AI assistant powered by OpenAI GPT-4
- 👨‍💼 **Admin Panel**: User management, broadcasts, analytics, and plan management

### Technical Features
- 🔒 **Security**: Input validation, rate limiting, Helmet.js, secure sessions
- 🌐 **i18n**: Full English/Spanish support with dynamic language switching
- 📊 **Analytics**: User statistics, revenue tracking, and insights
- 🚨 **Error Tracking**: Sentry integration for production monitoring
- ⚡ **Performance**: Redis caching, optimized Firestore queries
- 🐳 **Containerization**: Docker and Docker Compose ready
- 🔄 **CI/CD**: GitHub Actions workflow for automated testing and deployment
- 📝 **Logging**: Structured logging with Winston and daily log rotation
- ✅ **Testing**: Jest unit tests with coverage reporting

## 📋 Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- Redis 7.x
- Firebase/Firestore account
- Telegram Bot Token (from @BotFather)
- (Optional) Sentry account for error tracking
- (Optional) OpenAI API key for AI support
- (Optional) Zoom API credentials
- (Optional) ePayco and Daimo payment provider accounts

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/pnptv-bot.git
cd pnptv-bot
npm install
```

### 2. Environment Configuration

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Edit `.env` with your credentials (see Environment Variables section below).

### 3. Seed Database

Initialize default subscription plans:

```bash
npm run seed
```

### 4. Run Development Server

```bash
npm run dev
```

### 5. Run with Docker

```bash
docker-compose up -d
```

## 🔧 Environment Variables

### Required Variables

```env
BOT_TOKEN=your_telegram_bot_token
NODE_ENV=development
PORT=3000

# Firebase
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Optional Variables

See `.env.example` for the complete list of configuration options including:
- Payment providers (ePayco, Daimo)
- Zoom API credentials
- OpenAI API key
- Sentry DSN
- Admin user IDs
- Rate limiting settings

## 📁 Project Structure

```
pnptvbot-production/
├── src/
│   ├── bot/
│   │   ├── core/              # Bot initialization and middleware
│   │   │   ├── bot.js         # Main bot entry point
│   │   │   ├── middleware/    # Session, rate limiting, error handling
│   │   │   └── plugins/       # Sentry integration
│   │   ├── handlers/          # Command and callback handlers
│   │   │   ├── admin/         # Admin panel
│   │   │   ├── user/          # User commands (onboarding, profile, menu)
│   │   │   ├── payments/      # Payment processing
│   │   │   └── media/         # Radio, Zoom, live streams, support
│   │   ├── services/          # Business logic layer
│   │   │   ├── userService.js
│   │   │   └── paymentService.js
│   │   └── api/               # REST API and webhooks
│   │       ├── routes.js
│   │       └── controllers/
│   ├── models/                # Data models (Firestore)
│   │   ├── userModel.js
│   │   ├── planModel.js
│   │   └── paymentModel.js
│   ├── utils/                 # Utilities
│   │   ├── i18n.js           # Internationalization
│   │   ├── validation.js     # Input validation
│   │   └── logger.js         # Logging
│   └── config/                # Configuration
│       ├── firebase.js
│       └── redis.js
├── scripts/                   # Utility scripts
│   ├── cron.js               # Scheduled tasks
│   └── seed.js               # Database seeding
├── tests/                     # Test files
│   ├── unit/
│   └── integration/
├── logs/                      # Application logs
├── docs/                      # Documentation
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

## 🎮 Bot Commands

### User Commands
- `/start` - Start the bot and begin onboarding
- `/menu` - Show main menu
- `/language` - Change language
- `/support` - Access support center

### Admin Commands
- `/admin` - Access admin panel (requires admin privileges)

## 📱 Main Menu Options

1. **💎 Subscribe to PRIME** - View and purchase subscription plans
2. **👤 My Profile** - Manage profile, photos, bio, location
3. **🌍 Nearby Users** - Find users within selected radius
4. **🎤 Live Streams** - Start or view live streams
5. **📻 Radio** - Listen to radio, request songs
6. **🎥 Zoom Rooms** - Create or join video rooms
7. **🤖 Support** - AI chat, contact admin, FAQs
8. **⚙️ Settings** - Language, notifications, privacy

## 🔐 Security Features

- **Input Sanitization**: All user inputs are sanitized to prevent XSS and injection attacks
- **Rate Limiting**: Protection against spam and abuse
- **Session Management**: Secure Redis-based sessions with TTL
- **Payment Verification**: Webhook signature verification for payments
- **Admin Authorization**: Role-based access control
- **Environment Variables**: Sensitive data stored securely
- **Helmet.js**: Security headers for API endpoints

## 🧪 Testing

Run tests:

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Integration tests
npm run test:integration

# Coverage
npm test -- --coverage
```

## 📊 Monitoring and Logging

### Logging

Logs are stored in the `logs/` directory:
- `combined-YYYY-MM-DD.log` - All logs
- `error-YYYY-MM-DD.log` - Error logs only

Logs rotate daily and are kept for 14 days.

### Error Tracking

Sentry integration provides:
- Real-time error tracking
- User context (ID, username, action)
- Stack traces and breadcrumbs
- Performance monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

## 🚢 Deployment

### Docker Deployment

1. Build and run with Docker Compose:

```bash
docker-compose up -d
```

2. View logs:

```bash
docker-compose logs -f bot
```

3. Stop:

```bash
docker-compose down
```

### Production Deployment

1. Set environment to production in `.env`:

```env
NODE_ENV=production
BOT_WEBHOOK_DOMAIN=https://yourdomain.com
BOT_WEBHOOK_PATH=/webhook/telegram
```

2. Configure webhook mode in production for better performance

3. Set up GitHub Actions secrets for CI/CD:
   - `DOCKER_USERNAME`
   - `DOCKER_PASSWORD`
   - `PRODUCTION_HOST`
   - `PRODUCTION_USER`
   - `PRODUCTION_SSH_KEY`

4. Push to main branch to trigger deployment

### Firestore Setup

1. Create indexes:

```bash
npm run migrate
```

Or manually create indexes in Firebase Console as defined in `src/config/firebase.js`.

2. Set up Firestore security rules to restrict access.

## 📈 Scaling Considerations

- **Redis Cluster**: For high availability and horizontal scaling
- **Load Balancer**: Distribute traffic across multiple bot instances
- **Firestore Optimization**: Use composite indexes and pagination
- **CDN**: Serve static assets (images, media) via CDN
- **Caching Strategy**: Cache frequently accessed data with appropriate TTLs
- **Queue System**: Implement message queue for broadcasts and background jobs

## 🛠️ Maintenance

### Cron Jobs

The bot includes automated cron jobs (configured in `scripts/cron.js`):

- **Subscription Expiry Check**: Runs daily at midnight
- Processes expired subscriptions and updates user status

### Database Maintenance

- Regularly review and optimize Firestore indexes
- Monitor storage usage and implement data retention policies
- Backup Firestore data periodically

## 🐛 Troubleshooting

### Bot Not Responding

1. Check logs: `docker-compose logs -f bot`
2. Verify bot token is correct
3. Check Redis connection
4. Verify webhook is set correctly (production)

### Payment Issues

1. Check webhook configuration and URLs
2. Verify payment provider credentials
3. Review payment logs in Firestore
4. Check webhook signature verification

### Performance Issues

1. Monitor Redis cache hit rate
2. Review Firestore query performance
3. Check for memory leaks
4. Analyze error rates in Sentry

## 📝 API Documentation

### Webhooks

#### ePayco Webhook
```
POST /api/webhooks/epayco
```

Receives payment confirmation from ePayco.

#### Daimo Webhook
```
POST /api/webhooks/daimo
```

Receives payment confirmation from Daimo.

### Public Endpoints

#### Health Check
```
GET /health
```

Returns bot health status.

#### Statistics
```
GET /api/stats
```

Returns user statistics (public).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 👥 Support

For support and questions:
- Email: support@pnptv.com
- Telegram: @pnptv_support
- Documentation: https://docs.pnptv.com

## 🙏 Acknowledgments

- Telegraf.js - Modern Telegram Bot Framework
- Firebase - Backend and database
- Redis - Caching and sessions
- OpenAI - AI assistant
- Sentry - Error tracking

---

Built with ❤️ for PNPtv
