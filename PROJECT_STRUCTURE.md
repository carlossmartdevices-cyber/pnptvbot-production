# PNPtv! - Project Structure (Monorepo)

**Version**: 2.0.0 (Optimized Monorepo Architecture)
**Status**: Migration Phase 1 Complete (Nginx Auth Guard)
**Last Updated**: 2026-02-21

---

## Root Level Files

- `package.json` - Configuración raíz de NPM Workspaces
- `package-lock.json` - Dependency lock file global
- `pnpm-workspace.yaml` - Workspace configuration (if using pnpm)
- `ecosystem.config.js` - Configuración de PM2 para despliegue en producción
- `.gitignore` - Reglas de exclusión de Git
- `README.md` - Documentación principal del proyecto
- `ARCHITECTURE_MIGRATION_PLAN.md` - Phases 1-3 roadmap con detalles técnicos

---

## Main Directories

### `/packages` - Shared Libraries (Internal Packages)

Librerías internas consumidas por las aplicaciones. No se despliegan de forma independiente, sino que se enlazan automáticamente por npm/pnpm workspaces.

**`packages/config/`** - `@pnptv/config`
- Configuraciones centralizadas para todo el monorepo
- `vite.base.js` - Base Vite config (todas las webapps extienden)
- `eslint.config.js` - ESLint rules compartidas
- `tsconfig.base.json` - TypeScript config base
- Uso: `mergeConfig(baseConfig, defineConfig({...}))`

**`packages/api-client/`** - `@pnptv/api-client`
- Instancia centralizada de Axios con interceptores
- `src/index.js` - Axios instance + session cookie auto-inject
- `src/client.js` - API methods (profileAPI, mediaAPI, chatAPI, etc.)
- Interceptores: 401 → redirige a `/auth/`, retry logic
- Uso: `import { apiClient, profileAPI } from '@pnptv/api-client'`

**`packages/ui-kit/`** - `@pnptv/ui-kit` (Opcional, Phase 3)
- Design System: componentes React reutilizables
- `src/components/` - Button, Card, Modal, etc.
- `src/styles/` - Preset Tailwind + variables de diseño
- `src/tokens/` - Design tokens (colores, tipografía, espaciado)
- Consumido por todas las webapps para consistencia

---

### `/apps` - Executable Applications

Aplicaciones compilables (React SPAs) + servidor backend (Node.js + Telegram Bot).

**`apps/auth/`** - `@pnptv/auth` (NEW)
- Login & OAuth portal (Email, Telegram, X/Twitter)
- Ruta pública: `/auth/`
- SPA React compilada a `/public/auth/`
- Componentes: LoginForm, OAuthButtons, SignupFlow
- Integración: express-session (backend-driven sessions)

**`apps/backend/`** - `@pnptv/backend` (Renamed from `/src/`)
- Express.js server + Telegraf bot core
- Ruta: Port 3001 (127.0.0.1, internal only via Nginx reverse proxy)
- Estructura:
  ```
  apps/backend/
  ├── src/
  │   ├── bot/               # Telegram bot handlers & commands
  │   ├── controllers/       # Express REST API endpoints
  │   ├── models/            # Sequelize ORM (PostgreSQL)
  │   ├── services/          # Business logic (ePayco, Daimo, email)
  │   ├── middlewares/       # Auth, rate-limit, logging
  │   ├── config/            # epayco.js, redis.js, db.js
  │   └── utils/             # Helpers & validators
  ├── .env.example
  ├── package.json
  └── ecosystem.config.js    # PM2 config
  ```

**`apps/hub/`** - `@pnptv/hub` (Renamed from `prime-hub`)
- Main dashboard + admin panel
- Ruta pública: `/hub/`
- SPA React compilada a `/public/hub/`
- Componentes: Dashboard, Profile, SocialFeed, AdminPanel
- Autenticación: Cookie-based session (via `@pnptv/api-client`)

**`apps/hangouts/`** - `@pnptv/hangouts`
- Video conferencing rooms (Agora RTC integration)
- Ruta pública: `/hangouts/`
- SPA React compilada a `/public/hangouts/`

**`apps/media-live/`** - `@pnptv/media-live`
- Live streaming (Agora broadcasting)
- Ruta pública: `/media/live/`
- SPA React compilada a `/public/media/live/`

**`apps/media-radio/`** - `@pnptv/media-radio`
- 24/7 radio streaming
- Ruta pública: `/media/radio/`
- SPA React compilada a `/public/media/radio/`
- Integración: Navidrome API para now-playing

**`apps/media-videorama/`** - `@pnptv/media-videorama`
- VOD library + YouTube embeds
- Ruta pública: `/media/videorama/`
- SPA React compilada a `/public/media/videorama/`
- Características: Prime content protection, featured collage

---

### `/public` - Static Assets & Nginx Root

Directorio raíz servido directamente por Nginx. Contiene compilados de todas las webapps + uploads de usuarios.

```
public/
├── auth/                    # Compiled @pnptv/auth SPA
│   ├── assets/             # JS/CSS bundles con hash
│   └── index.html          # Entry point
├── hub/                     # Compiled @pnptv/hub SPA
├── hangouts/               # Compiled @pnptv/hangouts SPA
├── media/
│   ├── live/              # Compiled @pnptv/media-live SPA
│   ├── radio/             # Compiled @pnptv/media-radio SPA
│   └── videorama/         # Compiled @pnptv/media-videorama SPA
├── uploads/
│   ├── avatars/           # User profile pictures (*.webp)
│   └── posts/             # Social post images (*.webp)
└── index.html             # Root index (redirects to /hub/)
```

**Build Output**: Cada webapp compila su `dist/` → `/public/{app}/`
```bash
npm run build                    # Compila TODOS los apps
npm run build:hub               # Compila solo @pnptv/hub
npm run build --workspace=@pnptv/hub  # Alternativa
```

---

### `/infrastructure` - Deployment & Docker (Optional, Phase 2)

Configuraciones de servidor, reverse proxy, y orchestration.

**`infrastructure/nginx.conf`** (o `/etc/nginx/nginx.conf` en servidor)
- Reverse proxy en puerto 443 (HTTPS)
- Auth Guard via `auth_request /api/webapp/auth/verify`
- Routes protegidas: `/hub/`, `/media/*`, `/hangouts/`
- Routes públicas: `/auth/`, `/api/payment/`, `/api/webhook/`

**`infrastructure/docker-compose.yml`**
- PostgreSQL (puerto 5432)
- Redis (puerto 6379)
- Inicio local: `docker-compose up -d`

**`infrastructure/fail2ban/`**
- Reglas de seguridad para bloquear IPs maliciosas
- Protege endpoints de login y API

---

### `/apps/backend/src` - Backend Core Architecture

Lógica principal del servidor Node.js (Express + Telegraf).

```
src/
├── bot/
│   ├── commands/          # Telegram /command handlers
│   ├── handlers/          # Message/callback handlers
│   ├── middlewares/       # Update processor middlewares
│   └── core/              # Bot initialization
│
├── api/
│   ├── controllers/       # Express route handlers (REST)
│   ├── routes.js          # Route definitions
│   ├── middlewares/       # Auth guard, rate-limit, validation
│   └── swagger.js         # OpenAPI docs generator
│
├── models/                # Sequelize ORM models
│   ├── User.js
│   ├── Subscription.js
│   ├── SocialPost.js
│   └── ...
│
├── services/              # Business logic
│   ├── paymentService.js   # ePayco/Daimo integration
│   ├── emailService.js     # Nodemailer templates
│   ├── mediaService.js     # Video/image processing
│   └── ...
│
├── config/
│   ├── database.js         # PostgreSQL connection
│   ├── redis.js            # Redis client
│   ├── epayco.js           # ePayco SDK initialization
│   ├── epaycoSubscriptionPlans.js  # Plan definitions
│   └── env.js              # Environment validation
│
└── utils/
    ├── envValidator.js
    ├── logger.js
    ├── errors.js
    └── validators.js
```

---

## Quick Reference Table

| Componente | Ubicación | Package Name | Propósito |
|---|---|---|---|
| UI Components | `packages/ui-kit/` | `@pnptv/ui-kit` | Design System compartido |
| API Client | `packages/api-client/` | `@pnptv/api-client` | Axios + interceptores |
| Config Base | `packages/config/` | `@pnptv/config` | Vite/ESLint/TS centralizados |
| Login Portal | `apps/auth/` | `@pnptv/auth` | OAuth & Email login |
| Backend | `apps/backend/src/` | `@pnptv/backend` | Express API + Telegram Bot |
| Main Dashboard | `apps/hub/` | `@pnptv/hub` | Social feed + Admin panel |
| Video Rooms | `apps/hangouts/` | `@pnptv/hangouts` | Agora conferencing |
| Live Stream | `apps/media-live/` | `@pnptv/media-live` | Agora broadcasting |
| Radio | `apps/media-radio/` | `@pnptv/media-radio` | Navidrome streaming |
| VOD Library | `apps/media-videorama/` | `@pnptv/media-videorama` | Videos & YouTube embeds |
| Compiled Output | `public/` | N/A | Nginx root (all builds) |
| PostgreSQL | localhost:5432 | N/A | Main database |
| Redis | localhost:6379 | N/A | Sessions & cache |

---

## Monorepo Commands

```bash
# Install all dependencies (auto-links workspaces)
npm install

# Build all apps in parallel
npm run build

# Build specific app
npm run build --workspace=@pnptv/hub

# Dev server for specific app
npm run dev:hub

# Lint all apps
npm run lint

# Test all apps
npm run test

# Add dependency to specific package
npm install lodash --workspace=@pnptv/ui-kit

# Update PM2 in production
npm run build && pm2 reload ecosystem.config.js
```

---

## Migration Path

**Phase 1** (✅ COMPLETE): Nginx auth_request route protection
**Phase 2** (📋 PLANNED): Centralize config + shared API client
**Phase 3** (🎯 FUTURE): Monorepo restructuring complete

See **ARCHITECTURE_MIGRATION_PLAN.md** for detailed roadmap.

---

**Maintained by**: Claude Code Agent
**Last Review**: 2026-02-21
