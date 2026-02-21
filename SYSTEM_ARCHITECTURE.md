# PNPtv! - System Architecture Diagram & Data Flow

**Version**: 2.0.0 (Monorepo + Nginx Auth Guard)
**Last Updated**: 2026-02-21
**Status**: Production-Ready

---

## 🏗️ High-Level Architecture Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                         🌐 EXTERNAL SERVICES                                 │
│                                                                               │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────┐        │
│  │  TELEGRAM USERS │  │  ePayco Payment  │  │ Navidrome Radio      │        │
│  │  (Bot + OAuth)  │  │  Gateway         │  │ Server               │        │
│  └────────┬────────┘  └────────┬─────────┘  └──────────┬───────────┘        │
└───────────┼──────────────────────┼────────────────────────┼────────────────────┘
            │                      │                        │
            ▼                      ▼                        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    🔐 NGINX REVERSE PROXY & AUTH GUARD                       │
│                     (IP: 148.230.80.210 | Port: 443)                         │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ PROTECTED ROUTES (auth_request verification)                          │  │
│  │                                                                        │  │
│  │  /hub/          ──auth_request──→ /api/webapp/auth/verify            │  │
│  │  /media/        ──auth_request──→     (Redis session check)          │  │
│  │  /hangouts/     ──auth_request──→     ├─ Session valid? → 200 OK    │  │
│  │  /portal/       ──auth_request──→     └─ Session invalid? → 401     │  │
│  │                                                 ▼                      │  │
│  │                                          Nginx error_page 401          │  │
│  │                                               ▼                       │  │
│  │                                     Redirect to /auth/?redirect=$uri  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ PUBLIC ROUTES (no auth needed)                                        │  │
│  │                                                                        │  │
│  │  /auth/          → React SPA (login/oauth portal)                    │  │
│  │  /api/payment/*  → ePayco webhook processing                        │  │
│  │  /api/webhook/*  → Telegram/ePayco updates                          │  │
│  │  /health         → Health check endpoint                             │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ STATIC ASSETS (aggressive caching)                                    │  │
│  │                                                                        │  │
│  │  /assets/*  → JS/CSS bundles (1-year cache, immutable hash)         │  │
│  │  /public/*  → Images/media (30-day cache)                           │  │
│  │  /uploads/* → User avatars/posts (7-day cache)                      │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  All requests proxy to upstream: http://127.0.0.1:3001                      │
└──────────────────────────────────────────────────────────────────────────────┘
            │
            │ (Session cookie forwarded)
            ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│         🚀 NODEJS BACKEND (Express.js + Telegraf) - Port 3001                │
│                      (Managed by PM2 on VPS)                                 │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ REQUEST LAYER (Express Middleware)                                    │  │
│  │                                                                        │  │
│  │  ├─ cors()                 # Cross-origin requests                    │  │
│  │  ├─ helmet()               # Security headers (CSP, HSTS, etc.)      │  │
│  │  ├─ express-session        # Session management (Redis-backed)       │  │
│  │  ├─ rate-limiter           # Anti-DDoS protection                   │  │
│  │  └─ morgan()               # Request logging                         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ROUTING LAYER                                                         │  │
│  │                                                                        │  │
│  │  /api/webapp/auth/*          # Session management & OAuth            │  │
│  │  /api/webapp/profile         # User profile (CRUD)                   │  │
│  │  /api/webapp/social/*        # Posts, likes, comments               │  │
│  │  /api/webapp/chat/*          # Community chat + WebSockets          │  │
│  │  /api/webapp/admin/*         # Admin panel APIs                     │  │
│  │  /api/payment/*              # Payment initiation                   │  │
│  │  /api/webhook/epayco         # ePayco payment notifications         │  │
│  │  /webhook/telegram           # Telegram bot updates                 │  │
│  │  /health                     # Health check                         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ TELEGRAM BOT LAYER (Telegraf)                                         │  │
│  │                                                                        │  │
│  │  Webhook receiver → Update processor → Command handlers              │  │
│  │                                                                        │  │
│  │  /hangout      → Generate Agora token + send link                   │  │
│  │  /live         → Create livestream session                          │  │
│  │  /videorama    → Show VOD library link                              │  │
│  │  /prime        → Show subscription options                          │  │
│  │  /help         → Show available commands                            │  │
│  │                                                                        │  │
│  │  Callbacks → Inline button handlers (payment flows, etc.)           │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ SERVICES LAYER (Business Logic)                                      │  │
│  │                                                                        │  │
│  │  PaymentService          # ePayco SDK integration                    │  │
│  │  EmailService            # Nodemailer (invoices, welcomes)           │  │
│  │  MediaService            # Image processing, WebP compression        │  │
│  │  AuthService             # Session validation, OAuth                 │  │
│  │  AdminService            # User management, stats                    │  │
│  │  ChatService             # Message history, WebSocket handling       │  │
│  │  RadioService            # Navidrome integration                     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ DATA ACCESS LAYER (Sequelize ORM)                                    │  │
│  │                                                                        │  │
│  │  User, Subscription, SocialPost, LiveStream, ChatMessage, ...        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
            │                              │
            │ SQL queries                  │ Cache/Sessions
            ▼                              ▼
┌────────────────────────────┐  ┌──────────────────────────────┐
│  PostgreSQL Database       │  │  Redis Cache & Sessions      │
│  (Port 5432)               │  │  (Port 6379)                 │
│                            │  │                              │
│  ├─ users                  │  │  ├─ connect.sid (sessions)   │
│  ├─ subscriptions          │  │  ├─ user:{id}:* (user cache) │
│  ├─ social_posts           │  │  ├─ radio:now-playing        │
│  ├─ live_streams           │  │  ├─ rate-limits              │
│  ├─ chat_messages          │  │  └─ webhook locks            │
│  └─ payment_records        │  │                              │
└────────────────────────────┘  └──────────────────────────────┘
```

---

## 🔄 Key Data Flow Scenarios

### Scenario 1: User Authentication Flow

```text
Browser [https://pnptv.app/auth/]
   │
   ├─ User clicks "Login with Telegram"
   │
   ▼
POST /api/webapp/auth/telegram/start
   │
   ├─ Express generates Telegram OAuth challenge
   ├─ Redirects to https://oauth.telegram.org/auth?bot_id=...
   │
   ▼
Telegram OAuth Server
   │
   ├─ User approves bot access
   ├─ Redirects back to /api/webapp/auth/telegram/callback
   │
   ▼
Express: /api/webapp/auth/telegram/callback
   │
   ├─ Validates Telegram hash (crypto.HMAC-SHA256)
   ├─ Finds or creates user in PostgreSQL
   ├─ Creates session in Redis (express-session)
   ├─ Sets cookie: connect.sid (HttpOnly, Secure, SameSite=Lax)
   ├─ Redirects browser to /hub/
   │
   ▼
Browser: GET /hub/
   │
   ├─ Nginx intercepts (auth_request)
   ├─ Verifies cookie: connect.sid → checks Redis session
   ├─ Session valid → 200 OK
   │
   ▼
Nginx serves /public/hub/index.html
   │
   ├─ React app initializes
   ├─ Loads user profile from @pnptv/api-client
   ├─ API client auto-injects session cookie
   │
   ▼
GET /api/webapp/profile (with cookie)
   │
   ├─ Express validates session
   ├─ Returns user data + subscription status
   │
   ▼
React renders Dashboard with user profile
```

### Scenario 2: Payment Processing (ePayco)

```text
User clicks "Subscribe to PRIME" (in React app)
   │
   ▼
@pnptv/api-client POST /api/payment/create-subscription
   │
   ├─ Validates user tier
   ├─ Calls epayco.charge.create()
   │
   ▼
ePayco Payment Gateway
   │
   ├─ Generates secure payment link
   ├─ Returns URL for card payment
   │
   ▼
User enters credit card details (ePayco hosted page)
   │
   ├─ ePayco processes payment
   ├─ If 3DS required → redirect to bank
   │
   ▼
ePayco Webhook → POST /api/webhook/epayco
   │
   ├─ Express validates signature (crypto verification)
   ├─ Checks transaction state: "Aceptada" or "Pendiente"
   ├─ Updates PostgreSQL: subscriptions.status = 'active'
   ├─ Invalidates Redis cache for user
   ├─ Sends Welcome email (NodeMailer)
   ├─ Sends Telegram notification (Telegraf)
   │
   ▼
User receives confirmation messages (Email + Telegram)
   │
   ├─ Email: Invoice + welcome to PRIME
   ├─ Telegram: "✅ Suscripción activada"
   │
   ▼
User logs back in → Dashboard shows "✅ PRIME Subscriber"
```

### Scenario 3: Live Streaming Session

```text
User in Telegram types /live
   │
   ▼
Telegraf handler: /live command
   │
   ├─ Validates user subscription tier
   ├─ Calls Agora API → generates stream token
   ├─ Creates livestream record in PostgreSQL
   ├─ Generates secure URL with params
   │
   ▼
Telegram message with link
   │
   ├─ "Go live: https://pnptv.app/media/live?stream=ID&token=XXX&role=host"
   │
   ▼
User clicks → Browser loads /media/live/
   │
   ├─ Nginx auth_request validates session
   ├─ React app initializes (Vite SPA)
   ├─ Parses URL params (stream_id, role, token)
   ├─ Connects to Agora RTC with token
   │
   ▼
React: Live component starts broadcasting
   │
   ├─ Camera/mic enabled
   ├─ Sends "Host is LIVE" notification to subscribers
   ├─ Viewers can join as audience
   │
   ▼
Real-time updates via WebSocket
   │
   ├─ Chat messages (Socket.IO)
   ├─ Viewer count updates (every 5s)
   ├─ Donation notifications
   │
   ▼
When host ends stream
   │
   ├─ Agora session closes
   ├─ PostgreSQL updates: livestream.status = 'ended'
   ├─ Viewers get redirected/disconnected
```

---

## 🔐 Security Architecture

### Layer 1: Transport Security
- **HTTPS Only**: All traffic encrypted (TLS 1.2+)
- **HSTS Header**: Browsers enforced to use HTTPS
- **SSL Pinning**: (Optional) Prevent MITM attacks

### Layer 2: Network Security
- **Nginx Reverse Proxy**: Single entry point
- **Internal-Only Backend**: Express runs on 127.0.0.1:3001
- **Fail2Ban Rules**: Auto-block IPs with repeated login attempts

### Layer 3: Authentication
- **Session Cookies**: HttpOnly, Secure, SameSite=Lax
- **CSRF Tokens**: (Optional) For state-changing requests
- **Rate Limiting**: 100 req/min per IP on auth endpoints

### Layer 4: Authorization
- **Nginx auth_request**: Validates session before serving React apps
- **Express Middleware**: Role-based access control (admin, user, etc.)
- **Database**: Fine-grained permissions (user.role, subscription.tier)

### Layer 5: Data Protection
- **Password Hashing**: bcryptjs (10 salt rounds)
- **Payment Data**: ePayco tokenization (PCI DSS compliant)
- **Sensitive Logs**: Masked API keys, tokens in logs
- **Encryption at Rest**: (Optional) Encrypted DB backups

### Layer 6: API Security
- **Signature Verification**: ePayco webhooks verified with HMAC
- **Idempotency**: Webhook retry-safe (prevents duplicate payments)
- **Input Validation**: Joi schemas on all endpoints
- **SQL Injection Prevention**: Sequelize parameterized queries

---

## 📊 NPM Workspace Structure

```
pnptvbot-production/
│
├── packages/
│   ├── api-client/
│   │   └── Shared Axios instance + interceptors
│   ├── config/
│   │   └── Centralized Vite/ESLint/TS configs
│   └── ui-kit/
│       └── Design system (future phase)
│
├── apps/
│   ├── auth/                    → /auth/
│   │   └── Login & OAuth portal
│   │
│   ├── backend/
│   │   └── Express API + Telegram Bot
│   │
│   ├── hub/                     → /hub/
│   │   └── Main dashboard + admin
│   │
│   ├── hangouts/                → /hangouts/
│   │   └── Video conferencing
│   │
│   ├── media-live/              → /media/live/
│   │   └── Live streaming
│   │
│   ├── media-radio/             → /media/radio/
│   │   └── Radio player
│   │
│   └── media-videorama/         → /media/videorama/
│       └── VOD library
│
└── public/
    └── Nginx root (compiled builds)
```

**Workspace Benefits**:
- ✅ Single `npm install` installs all apps + packages
- ✅ Shared dependencies (React, Axios) deduplicated
- ✅ Monorepo scripts: `npm run build --workspace=@pnptv/hub`
- ✅ Local development: Each app has its own dev server
- ✅ Type safety: Shared TypeScript config

---

## 🚀 Deployment Pipeline

```text
Developer commits code
   │
   ├─ git push origin main
   │
   ▼
GitHub Actions (CI/CD)
   │
   ├─ Run tests: npm run test
   ├─ Lint code: npm run lint
   ├─ Build apps: npm run build
   │
   ▼ (If all pass)
   │
Deploy to VPS (148.230.80.210)
   │
   ├─ git pull origin main
   ├─ npm install
   ├─ npm run build
   ├─ pm2 reload ecosystem.config.js
   │
   ▼
PM2 Restart Processes
   │
   ├─ Gracefully stop old processes
   ├─ Start new processes
   ├─ Verify health check
   │
   ▼ (If health check fails)
   │
   ├─ Automatic rollback to previous version
   │
   ▼ (If health check passes)
   │
   ├─ Nginx reloads config
   ├─ New code live at pnptv.app
```

---

## 📈 Performance Optimization

### Frontend
- **Code Splitting**: Vite automatically splits large bundles
- **Lazy Loading**: React Router v6 code splitting
- **Caching**: 1-year cache for hashed assets
- **Compression**: Gzip/Brotli via Nginx
- **CDN Ready**: Assets can be served from CDN (future)

### Backend
- **Connection Pooling**: PostgreSQL connections reused
- **Redis Caching**: Session data cached (no DB hit per request)
- **Rate Limiting**: Prevents abuse, reduces server load
- **Horizontal Scaling**: PM2 cluster mode (future)

### Database
- **Indexes**: On user_id, subscription_id, created_at columns
- **Query Optimization**: Sequelize eager loading
- **Partitioning**: Large tables (chat_messages) can be partitioned

---

## 🔄 Monitoring & Logging

### Application Logs
```bash
pm2 logs pnptv-production    # Real-time backend logs
tail -f /var/log/nginx/pnptv-error.log  # Nginx errors
```

### Health Checks
```bash
curl https://pnptv.app/health           # Overall health
curl http://127.0.0.1:3001/health       # Backend only
redis-cli ping                           # Redis connectivity
psql -c "SELECT 1;"                      # PostgreSQL connectivity
```

### Metrics (Future)
- Prometheus + Grafana (CPU, memory, requests/min)
- Sentry for error tracking
- DataDog for distributed tracing

---

## 📚 Related Documentation

- **PROJECT_STRUCTURE.md** - Detailed component breakdown
- **PROJECT_INFO.md** - Setup instructions + troubleshooting
- **ARCHITECTURE_MIGRATION_PLAN.md** - Phases 1-3 roadmap
- **WEBAPPS_ARCHITECTURE.md** - Individual webapp specs

---

**Maintained by**: Development Team
**Version**: 2.0.0
**Last Updated**: 2026-02-21
