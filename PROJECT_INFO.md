# PNPtv! - Project Information & Setup

**Last Updated**: 2026-02-21
**Version**: 2.0.0 (Monorepo Architecture)
**Status**: Production-Ready | Phase 1 (Nginx Auth Guard) Deployable

---

## 📌 Quick Summary

**PNPtv!** es una plataforma integral para la comunidad queer PNP (Party 'n Play) que opera bajo una arquitectura monorepo optimizada. Combina:

- **Telegram Bot** (Telegraf) - Interactivo, con 20+ comandos
- **Multiple React Webapps** (Vite SPAs) - Hangouts, Live, Radio, Videorama, Hub
- **Express.js Backend** - Node.js 18+ con PostgreSQL + Redis
- **Nginx Reverse Proxy** - Auth Guard, route protection, HTTPS
- **ePayco Integration** - Pagos en USD/COP con 3D Secure
- **AI Support** - OpenAI chatbot para soporte automatizado

**Servicios Principales**:
- 📻 Radio 24/7 (Navidrome streaming)
- 📹 Video Hangouts (Agora video conferencing)
- 🔴 PNP Live (Agora broadcasting + chat)
- 🎬 Videorama (VOD library + YouTube embeds)
- 💳 Suscripciones PRIME (ePayco payments)
- 👥 Social Feed (posts, likes, comments)

---

## 🚀 Quick Start (Desarrollo Local)

### Prerequisites

```bash
# Verificar versiones
node --version      # v18.0.0+
npm --version       # v9.0.0+
docker --version    # Latest
```

### Setup Local Development

**1. Clonar y instalar dependencias globales:**

```bash
cd pnptvbot-production
npm install
# Auto-enlaza todos los workspaces: packages/* + apps/*
```

**2. Configurar entorno:**

```bash
# Backend
cd apps/backend
cp .env.example .env
# Editar .env con credenciales:
# - POSTGRES_PASSWORD=
# - REDIS_PASSWORD=
# - TELEGRAM_BOT_TOKEN=
# - EPAYCO_PUBLIC_KEY=
# - EPAYCO_PRIVATE_KEY=
# - etc.
```

**3. Iniciar infraestructura (Docker):**

```bash
# Desde root
docker-compose -f infrastructure/docker-compose.yml up -d

# Verificar
docker ps
# Debe mostrar: postgres, redis
```

**4. Iniciar servidores de desarrollo:**

```bash
# Terminal 1: Backend + Telegram Bot
npm run dev:backend
# Escucha en http://localhost:3001

# Terminal 2: Hub webapp
npm run dev:hub
# Escucha en http://localhost:5173 (Vite)

# Terminal 3: Radio webapp (opcional)
npm run dev:media-radio
# Escucha en http://localhost:5174

# Terminal 4: Hangouts webapp (opcional)
npm run dev:hangouts
```

**5. Acceder aplicación:**

- **Backend**: http://localhost:3001
- **Hub** (with proxy): http://localhost:5173
- **Telegram Webhook**: http://localhost:3001/webhook/telegram

### Common Development Tasks

```bash
# Build single app for testing
npm run build --workspace=@pnptv/hub

# Run tests
npm run test

# Lint code
npm run lint
npm run lint:fix

# Add dependency to specific package
npm install axios --workspace=@pnptv/api-client

# View workspace structure
npm workspaces list
```

---

## 🌍 Entorno de Producción (VPS)

El proyecto está deployado en servidor dedicado: **srv1182731.hstgr.cloud**

### Server Details

| Aspecto | Valor |
|---|---|
| **IP** | 148.230.80.210 |
| **Domain** | pnptv.app |
| **OS** | Linux Ubuntu 22.04 LTS |
| **Node.js** | v18.x (via nvm) |
| **Process Manager** | PM2 |
| **Web Server** | Nginx (reverse proxy) |
| **Database** | PostgreSQL 14 |
| **Cache** | Redis 7.x |

### Port Mapping

| Servicio | Puerto | Acceso | Propósito |
|---|---|---|---|
| Nginx (HTTP) | 80 | Público | Redirect a HTTPS |
| Nginx (HTTPS) | 443 | Público | Reverse proxy (Auth Guard) |
| Express.js | 3001 | Interno (127.0.0.1) | Backend API + Bot |
| PostgreSQL | 5432 | Interno (localhost) | Base de datos |
| Redis | 6379 | Interno (localhost) | Sessions + cache |

### API Webhooks (Inbound)

| Servicio | URL | Propósito |
|---|---|---|
| **Telegram** | https://pnptv.app/webhook/telegram | Bot updates (messages, callbacks) |
| **ePayco** | https://pnptv.app/api/webhook/epayco | Payment confirmations |

---

## 🛠️ Comandos Frecuentes del Workspace

### Build & Deployment

```bash
# Build complete ecosystem
npm run build

# Build specific app
npm run build --workspace=@pnptv/hub
npm run build --workspace=@pnptv/media-radio

# Build all media apps
npm run build --workspace='@pnptv/media-*'
```

### Development

```bash
# Start specific dev server
npm run dev:hub
npm run dev:backend

# Run all dev servers (parallel)
npm run dev
```

### Testing & Quality

```bash
# Run all tests
npm run test

# Run tests for specific app
npm run test --workspace=@pnptv/hub

# Lint all code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Dependency Management

```bash
# Add to root (shared)
npm install lodash

# Add to specific package
npm install axios --workspace=@pnptv/api-client

# Update all dependencies
npm update

# View workspaces
npm workspaces list
```

### Production Deployment

```bash
# 1. Pull latest code
git pull origin main

# 2. Install & build
npm install
npm run build

# 3. Reload PM2 processes
pm2 reload ecosystem.config.js

# 4. Verify health
curl https://pnptv.app/health

# 5. Check logs
pm2 logs pnptv-production

# 6. Save PM2 state
pm2 save
```

---

## 📁 Directory Structure Overview

```
pnptvbot-production/
├── packages/                    # Shared libraries
│   ├── api-client/              # Axios + interceptors
│   ├── config/                  # Vite/ESLint/TS base
│   └── ui-kit/                  # Design system (future)
│
├── apps/                        # Executable applications
│   ├── auth/                    # Login portal
│   ├── backend/                 # Node.js + Telegram
│   ├── hub/                     # Main dashboard
│   ├── hangouts/                # Video conferencing
│   ├── media-live/              # Live streaming
│   ├── media-radio/             # Radio player
│   └── media-videorama/         # VOD library
│
├── public/                      # Nginx root (compiled builds)
│   ├── auth/
│   ├── hub/
│   ├── media/
│   └── uploads/
│
├── infrastructure/              # Deployment configs
│   ├── nginx.conf              # Reverse proxy + auth_request
│   ├── docker-compose.yml      # PostgreSQL + Redis
│   └── fail2ban/               # Security rules
│
├── scripts/                     # Utilities & migrations
│   ├── validate-nginx-auth-request.sh
│   └── migrate-to-monorepo.sh  # (New)
│
├── package.json                 # Root workspace config
├── pnpm-workspace.yaml          # (Optional, if using pnpm)
├── ecosystem.config.js          # PM2 configuration
├── ARCHITECTURE_MIGRATION_PLAN.md
├── PROJECT_STRUCTURE.md
├── PROJECT_INFO.md
└── SYSTEM_ARCHITECTURE.md
```

See **PROJECT_STRUCTURE.md** for detailed component breakdown.

---

## 🔐 Security & Authentication

### Session Management

- **Type**: HTTP-only cookies (no JWT in localStorage)
- **Store**: Redis (centralized, encrypted)
- **TTL**: 7 días
- **Cookie Name**: `connect.sid` (express-session default)

### Auth Flow

1. Usuario accede a `/auth/` (login portal)
2. Ingresa credenciales o selecciona OAuth (Telegram/X)
3. Backend valida y crea sesión en Redis
4. Cookie `connect.sid` se inyecta automáticamente (HttpOnly, Secure, SameSite)
5. Peticiones posteriores van a `/api/webapp/*` con cookie
6. Nginx valida sesión via `auth_request /api/webapp/auth/verify` antes de servir apps protegidas

### Route Protection (Nginx)

- **Public**: `/auth/`, `/api/payment/`, `/health`
- **Protected**: `/hub/`, `/media/*`, `/hangouts/`, `/portal/`
- **Admin**: `/api/webapp/admin` (requiere `user.role='admin'`)

---

## 📊 Database Schema (Highlights)

### Key Tables

```sql
-- Users
users (id, email, username, telegram_id, tier, role, ...)

-- Subscriptions
subscriptions (id, user_id, plan_id, status, starts_at, expires_at, ...)

-- Social Feed
social_posts (id, user_id, content, media_url, likes_count, ...)
social_comments (id, post_id, user_id, content, ...)

-- Media
media_library (id, title, artist, url, category, is_prime, ...)

-- Live Streams
live_streams (id, host_id, title, status, viewers_count, ...)

-- Chat
chat_messages (id, room_id, user_id, message, created_at, ...)
```

### ePayco Integration

- Payment records stored in `subscription_payments` table
- Transaction state tracked: `pending` → `accepted` → `confirmed` or `rejected`
- Webhook handler auto-updates DB and sends user notifications

---

## 🧪 Testing

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Test specific app
npm run test --workspace=@pnptv/hub

# Coverage report
npm run test:coverage
```

---

## 📚 Key Documentation Files

| Documento | Propósito |
|---|---|
| **ARCHITECTURE_MIGRATION_PLAN.md** | Phases 1-3 de optimización (Nginx → Monorepo → Refactor) |
| **PROJECT_STRUCTURE.md** | Estructura de directorios y workspaces |
| **SYSTEM_ARCHITECTURE.md** | Diagramas de data flow y seguridad |
| **WEBAPPS_ARCHITECTURE.md** | Specs detalladas de cada webapp (Hangouts, Radio, etc.) |
| **ecosystem.config.js** | PM2 configuration (PM2 apps, env vars, auto-restart) |

---

## 🆘 Troubleshooting

### Backend won't start

```bash
# Check if port 3001 is in use
lsof -i :3001

# Verify .env file
cat apps/backend/.env | grep DATABASE_URL

# Check database connection
psql -U postgres -h localhost -d pnptv
```

### Nginx auth_request failing

```bash
# Validate syntax
sudo nginx -t

# Check error logs
tail -f /var/log/nginx/pnptv-error.log

# Test auth verify endpoint
curl -i http://127.0.0.1:3001/api/webapp/auth/verify

# Run validation script
bash scripts/validate-nginx-auth-request.sh
```

### App not building

```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install

# Build with verbose output
npm run build --workspace=@pnptv/hub --verbose

# Check for build errors
npm run build 2>&1 | tee build.log
```

---

## 📞 Support & Maintenance

- **Issues**: Report at [GitHub Issues](https://github.com/pnptv/pnptvbot-production/issues)
- **Documentation**: See files in root directory
- **Logs**: `pm2 logs` (production) or browser console (frontend)
- **Monitoring**: Health check at `https://pnptv.app/health`

---

**Maintained by**: Development Team
**Version**: 2.0.0 (Monorepo)
**Last Updated**: 2026-02-21
