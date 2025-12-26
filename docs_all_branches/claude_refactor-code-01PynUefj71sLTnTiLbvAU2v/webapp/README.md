# PNPtv WebApp - Production Ready

A modern, production-ready web application for PNPtv featuring live streaming, radio, Zoom rooms, subscription payments, and more. Built with Next.js 14, TypeScript, and TailwindCSS.

## 🌟 Features

### Completed Features ✅
- **Modern Tech Stack**: Next.js 14 with App Router, TypeScript, TailwindCSS
- **i18n Support**: Full English/Spanish translations with dynamic language switching
- **Theme System**: Light/Dark mode with system preference support
- **Responsive Design**: Mobile-first responsive UI
- **Landing Page**: Hero, Features, Pricing, and CTA sections
- **UI Components**: Reusable Button, Loader, Toaster components
- **State Management**: Zustand for global state (user, language, theme)
- **Database Schema**: Prisma schema for PostgreSQL (shared with Telegram bot)

### In Progress 🚧
- Database connection and migrations
- Authentication system (Telegram WebApp + NextAuth.js)
- API routes and webhooks

### Upcoming Features 📋
- User onboarding flow
- Profile management
- Subscription system with ePayco & Daimo payments
- Live streaming (Agora SDK)
- Radio player (Howler.js)
- Zoom rooms integration
- Nearby users with interactive map (Leaflet)
- AI chat assistant (Mistral API)
- Admin dashboard
- Creator monetization
- Testing suite (Jest + Cypress)

## 📁 Project Structure

```
webapp/
├── app/                      # Next.js app directory
│   ├── api/                  # API routes
│   ├── auth/                 # Authentication pages
│   ├── dashboard/            # Dashboard pages
│   ├── profile/              # Profile pages
│   ├── nearby/               # Nearby users
│   ├── live/                 # Live streams
│   ├── radio/                # Radio player
│   ├── zoom/                 # Zoom rooms
│   ├── support/              # Support center
│   ├── subscribe/            # Subscription plans
│   ├── admin/                # Admin dashboard
│   ├── globals.css           # Global styles
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Landing page
├── components/               # React components
│   ├── common/               # Reusable components
│   │   ├── button.tsx
│   │   ├── loader.tsx
│   │   └── toaster.tsx
│   ├── layout/               # Layout components
│   │   ├── header.tsx
│   │   ├── footer.tsx
│   │   ├── hero.tsx
│   │   ├── features.tsx
│   │   ├── pricing.tsx
│   │   └── cta.tsx
│   ├── media/                # Media components (radio, video, zoom)
│   ├── social/               # Social sharing components
│   ├── user/                 # User components (profile, cards)
│   ├── admin/                # Admin components
│   ├── providers.tsx         # App providers
│   ├── theme-provider.tsx    # Theme provider
│   └── telegram-provider.tsx # Telegram WebApp provider
├── lib/                      # Utilities and configurations
│   ├── i18n/                 # Internationalization
│   │   └── translations.ts
│   ├── stores/               # Zustand stores
│   │   ├── language-store.ts
│   │   ├── user-store.ts
│   │   └── theme-store.ts
│   ├── db.ts                 # Prisma client
│   └── utils.ts              # Utility functions
├── hooks/                    # Custom React hooks
│   └── useTranslation.ts
├── services/                 # API services
├── types/                    # TypeScript types
│   └── index.ts
├── prisma/                   # Prisma schema
│   └── schema.prisma
├── public/                   # Static assets
│   ├── images/
│   └── fonts/
├── .env.example              # Environment variables template
├── next.config.js            # Next.js configuration
├── tailwind.config.ts        # Tailwind configuration
├── tsconfig.json             # TypeScript configuration
├── package.json              # Dependencies
└── README.md                 # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL 14+ (shared with Telegram bot)
- Redis 7+

### 1. Installation

```bash
cd webapp
npm install
```

### 2. Environment Setup

Copy the environment template:

```bash
cp .env.example .env
```

Configure your environment variables in `.env`:

```env
# Database (shared with Telegram bot)
DATABASE_URL=postgresql://postgres:password@localhost:5432/pnptv_bot

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret_here

# Telegram
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=pnptv_bot
TELEGRAM_BOT_TOKEN=your_bot_token

# Payment Providers
NEXT_PUBLIC_EPAYCO_PUBLIC_KEY=your_key
EPAYCO_PRIVATE_KEY=your_key
NEXT_PUBLIC_DAIMO_API_KEY=your_key

# Zoom
NEXT_PUBLIC_ZOOM_SDK_KEY=your_key
ZOOM_SDK_SECRET=your_secret

# Agora (Live Streaming)
NEXT_PUBLIC_AGORA_APP_ID=your_app_id
AGORA_APP_CERTIFICATE=your_certificate

# Radio
NEXT_PUBLIC_RADIO_STREAM_URL=https://your-stream-url

# Mistral AI
MISTRAL_API_KEY=your_api_key

# Maps
NEXT_PUBLIC_MAPBOX_TOKEN=your_token
```

### 3. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# (Optional) Open Prisma Studio
npx prisma studio
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📦 Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run Jest tests
npm run test:e2e     # Run Cypress E2E tests
npm run type-check   # TypeScript type checking
```

## 🎨 Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **Styling** | TailwindCSS + CSS Modules |
| **State Management** | Zustand |
| **Data Fetching** | TanStack Query (React Query) |
| **Database** | PostgreSQL + Prisma ORM |
| **Authentication** | NextAuth.js + Telegram WebApp |
| **Payments** | ePayco, Daimo Pay |
| **Live Streaming** | Agora Web SDK |
| **Video Rooms** | Zoom Web SDK |
| **Radio** | Howler.js |
| **Maps** | Leaflet / Mapbox |
| **AI** | Mistral API |
| **Testing** | Jest + React Testing Library + Cypress |
| **Deployment** | Vercel / Docker |

## 🔒 Security Features

- NextAuth.js authentication
- Secure session management
- CSRF protection
- Rate limiting
- Input validation with Zod
- SQL injection prevention (Prisma)
- XSS protection
- Secure headers (Next.js)

## 📱 Telegram WebApp Integration

The webapp is designed to work seamlessly both as a standalone web app and within Telegram WebApp:

```typescript
// Automatically detects Telegram WebApp context
if (isTelegramWebApp()) {
  const tg = getTelegramWebApp();
  tg.ready();
  tg.expand();
}
```

## 🌍 Internationalization

Full support for English and Spanish with easy extensibility:

```typescript
import { useTranslation } from '@/hooks/useTranslation';

function MyComponent() {
  const { t, language, setLanguage } = useTranslation();

  return <h1>{t('hero.title')}</h1>;
}
```

## 🎨 Theme System

Dark/Light mode with system preference support:

```typescript
import { useTheme } from 'next-themes';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
    Toggle Theme
  </button>;
}
```

## 📊 Database Schema

The webapp shares a PostgreSQL database with the Telegram bot. Key models:

- `User` - User profiles and settings
- `Subscription` - Premium subscription management
- `Payment` - Payment transactions
- `LiveStream` - Live streaming sessions
- `ZoomRoom` - Video conference rooms
- `SongRequest` - Radio song requests
- `Tip` - Creator monetization
- `Broadcast` - Admin broadcasts
- `Notification` - User notifications

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Docker

```bash
# Build
docker build -t pnptv-webapp .

# Run
docker run -p 3000:3000 pnptv-webapp
```

## 📝 Environment Variables

See `.env.example` for all required and optional environment variables.

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - NextAuth.js secret key
- `TELEGRAM_BOT_TOKEN` - Telegram bot token

Optional (feature-specific):
- Payment provider keys (ePayco, Daimo)
- Zoom API credentials
- Agora App ID
- Mistral API key
- Map provider tokens

## 🧪 Testing

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# E2E tests
npm run test:e2e

# Coverage
npm test -- --coverage
```

## 📚 Documentation

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [Agora Docs](https://docs.agora.io)
- [Zoom SDK Docs](https://developers.zoom.us)

## 🤝 Integration with Telegram Bot

The webapp shares the same PostgreSQL database with the Telegram bot (`../src/`), ensuring:

- Unified user accounts
- Synchronized subscription status
- Shared payment records
- Cross-platform notifications

## 🛠️ Development Roadmap

### Phase 1: Foundation ✅
- [x] Next.js setup
- [x] i18n implementation
- [x] Theme system
- [x] Landing page
- [x] Basic UI components
- [x] Database schema

### Phase 2: Core Features 🚧
- [ ] Authentication (Telegram + Email)
- [ ] User onboarding
- [ ] Profile management
- [ ] Subscription system

### Phase 3: Media Features
- [ ] Live streaming
- [ ] Radio player
- [ ] Zoom integration
- [ ] Nearby users map

### Phase 4: Advanced Features
- [ ] AI chat (Mistral)
- [ ] Admin dashboard
- [ ] Creator monetization
- [ ] Broadcast system

### Phase 5: Production
- [ ] Testing suite
- [ ] Performance optimization
- [ ] Security audit
- [ ] Docker deployment
- [ ] Documentation

## 📄 License

MIT License - see LICENSE file for details

## 👥 Support

- Email: support@pnptv.com
- Telegram: @pnptv_support
- Documentation: https://docs.pnptv.com

---

Built with ❤️ for PNPtv
