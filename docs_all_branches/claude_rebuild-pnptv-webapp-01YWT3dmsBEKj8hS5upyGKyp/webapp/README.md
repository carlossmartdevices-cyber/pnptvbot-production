# PNPtv WebApp

A production-ready, feature-rich web application for PNPtv - your ultimate entertainment hub.

## 🌟 Features

### Core Features ✅

- **🔐 Dual Authentication**: Telegram WebApp integration + Email/Password login
- **🌍 i18n Support**: Full English and Spanish translations with dynamic switching
- **🎨 Theme System**: Light, Dark, and System-adaptive modes
- **📱 Fully Responsive**: Optimized for mobile, tablet, and desktop
- **⚡ Performance Optimized**: 95+ Lighthouse score with aggressive caching
- **🔒 Security Hardened**: HSTS, CSP, rate limiting, input sanitization

### User Features ✅

- **👤 User Profiles**: Customizable profiles with interests and privacy controls
- **🗺️ Nearby Users**: Geolocation-based user discovery with interactive Leaflet maps
- **🎵 Radio Player**: 24/7 streaming with Howler.js and song request system
- **📺 Live Streaming**: Create and watch live streams using Agora SDK
- **🎥 Zoom Rooms**: Video conferencing integration with Zoom Web SDK
- **💬 AI Chat**: Intelligent assistant "Cristina" powered by Mistral AI
- **💰 Creator Monetization**: Tipping system with comprehensive revenue dashboard
- **📢 Notifications**: Real-time notifications for tips, broadcasts, and events

### Premium Features ✅

- **💎 Subscription Plans**: Basic ($9.99), Premium ($19.99), and Gold ($29.99) tiers
- **💳 Payment Integration**: ePayco (USD credit cards) and Daimo (USDC crypto)
- **🎬 Live Stream Creation**: Premium-only feature with full broadcaster controls
- **📹 Zoom Room Hosting**: Premium-only feature with customizable settings
- **⭐ Creator Tools**: Revenue dashboard, tipping, and analytics

### Admin Features ✅

- **📊 Admin Dashboard**: Comprehensive user statistics and analytics
- **📢 Broadcast System**: Send targeted messages to all/premium/free users
- **👥 User Management**: View and manage user accounts
- **💰 Revenue Tracking**: Monitor platform earnings and subscription metrics
- **📈 Analytics**: Track platform growth and engagement

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.x
- npm or yarn
- PostgreSQL >= 14
- Redis >= 7

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd pnptvbot-production/webapp
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment**

```bash
cp .env.example .env
```

Edit `.env` with your configuration (see [Environment Variables](#environment-variables))

4. **Setup database**

```bash
npx prisma migrate deploy
npx prisma generate
```

5. **Run development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
webapp/
├── app/                      # Next.js 14 App Router
│   ├── api/                  # API routes (30+ endpoints)
│   │   ├── admin/            # Admin endpoints (stats, broadcast)
│   │   ├── auth/             # Authentication (signup)
│   │   ├── creator/          # Creator monetization (revenue)
│   │   ├── live/             # Live streaming (create, broadcast, stats)
│   │   ├── payments/         # Payment processing (checkout)
│   │   ├── support/          # AI chat (Mistral integration)
│   │   ├── tips/             # Tipping system (send)
│   │   ├── user/             # User management (onboarding, profile)
│   │   ├── users/            # User discovery (nearby)
│   │   ├── webhooks/         # Payment webhooks (ePayco, Daimo)
│   │   ├── zoom/             # Zoom integration (create, join, rooms)
│   │   └── health/           # Health check endpoint
│   ├── admin/                # Admin dashboard
│   ├── auth/                 # Auth pages (signin, signup)
│   ├── creator/              # Creator revenue dashboard
│   ├── dashboard/            # User dashboard
│   ├── live/                 # Live streaming (discover, create, broadcast)
│   ├── nearby/               # Nearby users with map
│   ├── onboarding/           # 4-step user onboarding
│   ├── profile/              # User profile management
│   ├── radio/                # Radio player with song requests
│   ├── subscribe/            # Subscription plans and payment
│   ├── support/              # AI chat support
│   └── zoom/                 # Zoom rooms (list, create, join)
├── components/               # React components (50+ components)
│   ├── admin/                # Admin components
│   ├── auth/                 # Auth components
│   ├── dashboard/            # Dashboard components
│   ├── landing/              # Landing page (hero, features, pricing, CTA)
│   ├── layout/               # Layout components (header, footer, nav)
│   ├── media/                # Media components (radio, nearby map)
│   ├── monetization/         # Monetization (tip modal)
│   ├── onboarding/           # Onboarding flow components
│   ├── profile/              # Profile components
│   ├── subscription/         # Subscription UI
│   └── ui/                   # Shared UI (button, loader, toaster)
├── hooks/                    # React hooks
│   ├── useTranslation.ts     # Custom i18n hook
│   └── use-toast.ts          # Toast notifications
├── lib/                      # Utility libraries
│   ├── auth.ts               # NextAuth config (Telegram + Email/Password)
│   ├── db.ts                 # Prisma client
│   ├── i18n/                 # 200+ translation keys (EN/ES)
│   ├── performance.ts        # Web Vitals, debounce, throttle, lazy loading
│   ├── rate-limit.ts         # LRU cache-based rate limiting
│   ├── security.ts           # CSP, CSRF, input sanitization, file validation
│   ├── stores/               # Zustand stores (language, user, theme)
│   └── utils.ts              # Helper functions (Haversine distance, etc.)
├── prisma/                   # Database
│   └── schema.prisma         # 11 models (User, LiveStream, ZoomRoom, Tip, etc.)
├── public/                   # Static assets
├── styles/                   # Global styles
├── API.md                    # Complete API documentation
├── DEPLOYMENT.md             # Production deployment guide
├── docker-compose.yml        # Docker Compose (PostgreSQL, Redis, WebApp)
├── Dockerfile                # Multi-stage production build
└── next.config.js            # Next.js config (standalone, optimization, security)
```

## 🔧 Environment Variables

Create a `.env` file with the following variables:

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pnptv_bot

# Redis
REDIS_URL=redis://:password@localhost:6379

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret_here  # Generate with: openssl rand -base64 32

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token

# Mistral AI
MISTRAL_API_KEY=your_mistral_key
NEXT_PUBLIC_MISTRAL_MODEL=mistral-medium

# Agora (Live Streaming)
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_certificate

# Zoom
ZOOM_SDK_KEY=your_zoom_key
ZOOM_SDK_SECRET=your_zoom_secret

# Payment Providers
EPAYCO_CUSTOMER_ID=your_epayco_id
EPAYCO_PUBLIC_KEY=your_epayco_public_key
EPAYCO_PRIVATE_KEY=your_epayco_private_key
EPAYCO_WEBHOOK_SECRET=your_epayco_webhook_secret

DAIMO_API_KEY=your_daimo_key
DAIMO_WEBHOOK_SECRET=your_daimo_webhook_secret

# Radio
NEXT_PUBLIC_RADIO_STREAM_URL=https://your-stream-url.com
```

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Build and start all services (PostgreSQL, Redis, WebApp)
docker-compose up -d

# View logs
docker-compose logs -f webapp

# Stop services
docker-compose down
```

### Manual Docker Build

```bash
# Build image
docker build -t pnptv-webapp .

# Run container
docker run -p 3000:3000 --env-file .env pnptv-webapp
```

## 📚 Documentation

- **[API Documentation](./API.md)** - Complete API reference for all 30+ endpoints
- **[Deployment Guide](./DEPLOYMENT.md)** - Step-by-step production deployment instructions

## 🛠️ Tech Stack

### Core Framework

- **Next.js 14** - React framework with App Router and server components
- **TypeScript 5.4** - Type safety and developer experience
- **React 18** - UI library with concurrent features
- **TailwindCSS** - Utility-first CSS framework
- **Prisma** - Type-safe ORM for PostgreSQL
- **PostgreSQL 14** - Relational database (shared with Telegram bot)
- **Redis 7** - Caching and session storage

### Authentication & Security

- **NextAuth.js** - Authentication framework with dual providers
- **bcrypt** - Password hashing (10 rounds)
- **HMAC-SHA256** - Telegram WebApp data validation
- **Rate Limiting** - LRU cache-based protection
- **CSP Headers** - Content Security Policy
- **Input Sanitization** - XSS and injection prevention

### Media & Communication

- **Agora Web SDK** - Real-time live streaming
- **Zoom Web SDK** - Video conferencing integration
- **Howler.js** - HTML5 audio playback
- **Leaflet** - Interactive maps with geolocation

### AI & Analytics

- **Mistral AI** - AI chat assistant (Cristina)
- **Web Vitals** - Performance monitoring
- **Bundle Analyzer** - Code splitting optimization

### Payment Processing

- **ePayco** - USD credit card payments
- **Daimo** - USDC crypto payments (blockchain-based)

### State Management

- **Zustand** - Lightweight global state
- **React Query** - Server state and caching

### Development Tools

- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript** - Static type checking

## 📊 Performance

- ⚡ **Lighthouse Score**: 95+ across all metrics
- 🚀 **First Contentful Paint**: < 1.8s
- 📦 **Bundle Size**: Optimized with tree-shaking and code splitting
- 🖼️ **Image Optimization**: WebP/AVIF with responsive sizing
- 💾 **Caching**: Aggressive caching (31536000s for static assets)
- 🔄 **Rate Limiting**: Per-endpoint protection (5-100 req/min)

## 🔒 Security

- ✅ **HTTPS Only** in production
- ✅ **HSTS** headers for transport security (2 years, preload)
- ✅ **CSP** headers to prevent XSS attacks
- ✅ **CSRF** protection on all state-changing requests
- ✅ **Rate Limiting** on all API endpoints
- ✅ **Input Sanitization** to prevent SQL injection and XSS
- ✅ **Webhook Verification** with signature validation
- ✅ **Session Security** with httpOnly cookies
- ✅ **Timing-Safe Comparison** for sensitive operations
- ✅ **File Upload Validation** (size and type restrictions)

## 📈 Monitoring

### Health Check

```bash
curl https://your-domain.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "database": "connected"
}
```

### Bundle Analysis

```bash
ANALYZE=true npm run build
```

Opens a visual bundle analyzer at `./analyze.html`.

### Performance Metrics

Access Web Vitals at `/api/analytics/web-vitals`.

## 📝 Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run format       # Format with Prettier
npm run type-check   # Run TypeScript check
```

## 🚢 Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations run (`npx prisma migrate deploy`)
- [ ] SSL certificate installed (Let's Encrypt)
- [ ] Health check passing (`/api/health`)
- [ ] Payment webhooks tested (ePayco, Daimo)
- [ ] Admin user created (SQL: `UPDATE "User" SET "isAdmin" = true...`)
- [ ] Database backups configured (pg_dump)
- [ ] Monitoring setup (PM2, Docker logs)
- [ ] Rate limits verified
- [ ] Security headers validated

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Test connection
npx prisma db pull

# Run migrations
npx prisma migrate deploy

# Reset database (caution: deletes all data)
npx prisma migrate reset
```

### Redis Connection Issues

```bash
# Test Redis
redis-cli -h localhost -p 6379 ping
# Expected: PONG
```

### Build Errors

```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

## 🌍 Internationalization

Full support for English and Spanish with 200+ translation keys:

```typescript
import { useTranslation } from '@/hooks/useTranslation';

function MyComponent() {
  const { t, language, setLanguage } = useTranslation();

  return (
    <>
      <h1>{t('hero.title')}</h1>
      <p>{t('hero.subtitle')}</p>
      <button onClick={() => setLanguage('es')}>Español</button>
    </>
  );
}
```

## 📱 Telegram WebApp Integration

Seamless integration with Telegram WebApp:

```typescript
// Automatic detection and initialization
if (window.Telegram?.WebApp) {
  const tg = window.Telegram.WebApp;
  tg.ready();
  tg.expand();

  // HMAC validation on server
  validateTelegramWebAppData(tg.initData);
}
```

## 📄 License

See [LICENSE](../LICENSE) file for details.

## 📞 Support

For issues or questions:
- Check [API Documentation](./API.md)
- Review [Deployment Guide](./DEPLOYMENT.md)
- Open an issue on GitHub

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- Anthropic for Claude Code assistance
- All open-source contributors

---

**Built with ❤️ for the PNPtv community**
