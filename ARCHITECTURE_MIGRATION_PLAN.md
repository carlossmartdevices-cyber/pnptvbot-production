# PNPtv Monorepo Architecture & Migration Plan
**Status**: Phase 1 Ready (Nginx config) | Phase 2-3 Planned
**Updated**: 2026-02-21

---

## 📊 Executive Summary

This document details the evolution of PNPtv's web application architecture from a semi-monorepo (`/webapps/`) to a fully optimized **npm/pnpm monorepo** with:

- **Centralized configuration** (Vite, ESLint, TypeScript)
- **Shared packages** (UI kit, API client, design tokens)
- **Semantic routing** (cleaner URLs like `/hub/`, `/media/live/`)
- **Nginx auth_request** (route protection without revealing auth logic to React)
- **Optimized builds** (all webapps compile to `/public/` in parallel)

**Current State**: Production-ready with `/webapps/` structure
**Target State**: Fully optimized monorepo (phases 1-3)

---

## 🏗️ Current Architecture (as of 2026-02-21)

```
pnptvbot-production/
├── src/                          # Express.js backend + Telegram bot
│   ├── bot/                      # Telegraf bot handlers
│   ├── api/                      # Express routes & controllers
│   ├── services/                 # Business logic (payments, media, etc.)
│   ├── config/                   # epayco.js, plans.js
│   └── models/                   # PostgreSQL models (Sequelize)
│
├── webapps/                      # ⭐ React SPA applications
│   ├── prime-hub/                # Main dashboard + admin panel
│   ├── hangouts/                 # Agora video rooms
│   ├── live/                     # Agora livestreaming
│   ├── radio/                    # Audio streaming player
│   ├── videorama/                # VOD library + featured content
│   └── portal/                   # User portal (legacy)
│
├── public/                       # Compiled output
│   ├── prime-hub/assets/         # React compiled → Nginx serves
│   ├── live/assets/
│   ├── radio/assets/
│   ├── videorama/assets/
│   ├── hangouts/assets/
│   └── uploads/                  # User avatar/post images
│
├── scripts/                      # Data migrations, cron jobs
├── tests/                        # Jest unit & integration tests
├── ecosystem.config.js           # PM2 configuration
├── package.json                  # Root: build scripts + backend deps
└── nginx.conf                    # Reverse proxy + auth_request (to be updated)
```

### Current Build Process
```bash
npm run build:webapps
  → cd webapps/prime-hub && npm install && vite build
  → cp dist/* ../../public/prime-hub/
  → (repeat for each webapp)
```

**Problem**: No centralized config → Config duplication across 6 webapps

---

## 🎯 Target Architecture (Phase 1-3)

```
pnptvbot-production/
├── src/                          # Express backend (unchanged)
│
├── packages/                     # ⭐ NEW: Shared monorepo packages
│   ├── config/                   # Centralized Vite/ESLint/TypeScript configs
│   │   ├── vite.base.js         # Base Vite config (all webapps extend)
│   │   ├── eslint.config.js
│   │   └── tsconfig.base.json
│   │
│   ├── api-client/              # Centralized API client with React Query
│   │   ├── src/
│   │   │   ├── index.js         # axios instance + interceptors
│   │   │   ├── hooks/           # useQuery, useMutation hooks
│   │   │   └── client.js        # API methods (getProfile, getVideos, etc.)
│   │   └── package.json
│   │
│   └── ui-kit/                  # Design system (optional, phase 3)
│       ├── src/components/      # Reusable Button, Card, etc.
│       └── package.json
│
├── apps/                        # ⭐ Renamed from /webapps/ (Phase 2)
│   ├── auth/                    # Login + OAuth (NEW, split from hub)
│   │   ├── src/
│   │   ├── vite.config.js       # Extends packages/config/vite.base.js
│   │   └── package.json
│   │
│   ├── hub/                     # Main dashboard (renamed from prime-hub)
│   │   ├── src/
│   │   ├── vite.config.js
│   │   └── package.json
│   │
│   ├── hangouts/
│   ├── media/                   # ⭐ NEW parent folder
│   │   ├── live/
│   │   ├── radio/
│   │   └── videorama/
│   │
│   └── portal/                  # Legacy portal (optional deprecation)
│
├── public/                      # Compiled output (unchanged)
│
├── pnpm-workspace.yaml          # ⭐ Workspace config (Phase 1.5)
├── package.json                 # Root: workspace definitions + shared scripts
├── nginx.conf                   # ⭐ UPDATED: auth_request middleware
└── ARCHITECTURE.md              # ⭐ This file
```

---

## 🔐 Phase 1: Nginx auth_request Configuration (IMMEDIATE)

**Goal**: Protect authenticated routes at reverse proxy level without exposing auth logic to React

**Why Now?**
- No breaking changes to current structure
- Improves security (blocks unauthorized requests before reaching React)
- Prepares for Phase 2 shared API client

### Current Nginx Setup (Unprotected Routes)

```nginx
server {
  listen 443 ssl http2;
  server_name pnptv.app;

  # Public routes (no auth needed)
  location /login {
    try_files $uri /index.html;  # React handles routing
  }

  location /auth/ {
    try_files $uri /auth/index.html;  # Auth SPA
  }

  location /api/payment/ {
    proxy_pass http://127.0.0.1:3001;  # Payment webhook (no session needed)
  }

  # ❌ PROBLEM: These routes are NOT protected at Nginx level
  # Anyone with the URL can access /hub/ or /media/live/
  location /hub/ {
    try_files $uri /hub/index.html;  # ❌ No auth check
  }

  location /media/live/ {
    try_files $uri /media/live/index.html;  # ❌ No auth check
  }
}
```

### Improved Nginx Setup with auth_request (PHASE 1)

```nginx
# Upstream Express app
upstream pnptv_backend {
  server 127.0.0.1:3001;
}

server {
  listen 80;
  server_name pnptv.app;
  return 301 https://$server_name$request_uri;  # Force HTTPS
}

server {
  listen 443 ssl http2;
  server_name pnptv.app;

  ssl_certificate /etc/ssl/certs/pnptv.crt;
  ssl_certificate_key /etc/ssl/private/pnptv.key;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;

  # ⭐ CRITICAL: Tell Nginx to trust X-Forwarded-* headers (for auth middleware)
  set_real_ip_from 127.0.0.1;
  real_ip_header X-Forwarded-For;

  # ⭐ Route Protection: Auth check handler
  location = /api/webapp/auth/verify {
    # Internal endpoint - not accessible directly from browser
    internal;
    proxy_pass http://pnptv_backend;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";

    # Forward original URL/headers for Express to check session
    proxy_set_header X-Original-URI $request_uri;
    proxy_set_header X-Original-Method $request_method;

    # Session cookie MUST be forwarded
    proxy_set_header Cookie $http_cookie;
  }

  # 📍 PUBLIC ROUTES (no auth_request)
  location /login {
    try_files $uri /index.html;
  }

  location /auth/ {
    try_files $uri /auth/index.html;
  }

  location /api/payment/ {
    proxy_pass http://pnptv_backend;
  }

  location /api/webhook/ {
    proxy_pass http://pnptv_backend;
  }

  location = /health {
    proxy_pass http://pnptv_backend;
  }

  # 📍 AUTHENTICATED ROUTES (with auth_request)
  # Hub (main dashboard)
  location /hub/ {
    auth_request /api/webapp/auth/verify;
    auth_request_set $auth_status $upstream_status;

    # If auth fails (401/403), redirect to login
    error_page 401 403 = @auth_failed;

    try_files $uri /hub/index.html;
  }

  # Media apps (live, radio, videorama)
  location /media/ {
    auth_request /api/webapp/auth/verify;
    error_page 401 403 = @auth_failed;
    try_files $uri /media/index.html;
  }

  # Hangouts (video conferencing)
  location /hangouts/ {
    auth_request /api/webapp/auth/verify;
    error_page 401 403 = @auth_failed;
    try_files $uri /hangouts/index.html;
  }

  # Portal (if kept)
  location /portal/ {
    auth_request /api/webapp/auth/verify;
    error_page 401 403 = @auth_failed;
    try_files $uri /portal/index.html;
  }

  # 📍 API ROUTES (protect sensitive endpoints)
  location /api/webapp/profile {
    auth_request /api/webapp/auth/verify;
    error_page 401 403 = @auth_failed;
    proxy_pass http://pnptv_backend;
  }

  location /api/webapp/admin {
    auth_request /api/webapp/auth/verify;
    error_page 401 403 = @auth_failed;
    proxy_pass http://pnptv_backend;
  }

  location /api/webapp/ {
    auth_request /api/webapp/auth/verify;
    error_page 401 403 = @auth_failed;
    proxy_pass http://pnptv_backend;
  }

  # 📍 ERROR HANDLER
  location @auth_failed {
    return 302 /auth/?redirect=$uri;  # Redirect to login with return URL
  }

  # 📍 STATIC ASSETS (no auth needed, cache aggressive)
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
  }

  location /public/ {
    expires 30d;
    add_header Cache-Control "public";
    try_files $uri =404;
  }

  location /uploads/ {
    expires 30d;
    try_files $uri =404;
  }

  # Root redirect
  location = / {
    return 302 /hub/;  # Redirect to authenticated dashboard
  }
}
```

### Express.js Auth Verify Endpoint (Backend)

The Nginx config calls `/api/webapp/auth/verify` to check session. This endpoint must:
1. ✅ Return 200 + user data if session is valid
2. ✅ Return 401 if no session
3. ✅ Return 403 if session exists but user lacks permission

**Already Implemented** in `src/bot/api/controllers/webAppController.js`:

```javascript
// GET /api/webapp/auth/verify
exports.verifyAuth = (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Optional: Check user role for admin routes
  if (req.originalUrl?.includes('/admin') &&
      !['admin', 'superadmin'].includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Return 200 if authorized
  res.json({
    user: req.session.user,
    authenticated: true
  });
};
```

**Install/Deploy Steps**:
```bash
# 1. Backup current nginx.conf
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup-2026-02-21

# 2. Update nginx.conf with auth_request config above
sudo nano /etc/nginx/nginx.conf

# 3. Test syntax
sudo nginx -t

# 4. Reload Nginx
sudo systemctl reload nginx

# 5. Test auth
curl -i https://pnptv.app/hub/          # Should 302 to /auth/ if not logged in
curl -i https://pnptv.app/api/payment/  # Should work (public)
```

**Testing**:
```bash
# Without session cookie → should redirect
curl -i https://pnptv.app/hub/

# With valid session → should serve index.html
curl -i -H "Cookie: connect.sid=YOUR_SESSION_ID" https://pnptv.app/hub/

# Public routes → should work without cookie
curl -i https://pnptv.app/api/payment/info
```

---

## 🔄 Phase 2: Workspaces + Shared Packages (Next Sprint)

**Goal**: Centralize configuration and API client for DRY builds

### Step 2.1: Create Root Workspace Config

**`pnpm-workspace.yaml`** (or `npm` equivalent in root `package.json`):

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

**Root `package.json`** (add workspaces):

```json
{
  "name": "pnptv-monorepo",
  "version": "1.0.0",
  "private": true,
  "workspaces": {
    "packages": [
      "packages/*",
      "apps/*"
    ]
  },
  "scripts": {
    "build": "pnpm -r run build",
    "build:apps": "pnpm --filter='./apps/*' run build",
    "dev": "pnpm -r --parallel run dev",
    "lint": "pnpm -r run lint",
    "test": "pnpm -r run test"
  }
}
```

### Step 2.2: Create `/packages/config/`

**`packages/config/vite.base.js`** (base for all webapps):

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../apps/*/src'),
    },
  },
  build: {
    target: 'es2020',
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
  server: {
    middlewareMode: false,
  },
})
```

**`packages/config/package.json`**:

```json
{
  "name": "@pnptv/config",
  "version": "1.0.0",
  "private": true,
  "files": ["vite.base.js", "eslint.config.js", "tsconfig.json"],
  "devDependencies": {
    "vite": "^7.3.1",
    "@vitejs/plugin-react": "^4.0.0"
  }
}
```

### Step 2.3: Create `/packages/api-client/`

**`packages/api-client/src/index.js`**:

```javascript
import axios from 'axios'

export const apiClient = axios.create({
  baseURL: '/api/webapp',
  withCredentials: true, // Session cookie auto-sent
})

// Auto-redirect to login on 401
apiClient.interceptors.response.use(
  (res) => res.data,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/auth/'
    }
    return Promise.reject(error)
  }
)

export default apiClient
```

**`packages/api-client/src/client.js`** (API methods):

```javascript
import apiClient from './index.js'

export const profileAPI = {
  getProfile: () => apiClient.get('/profile'),
  updateProfile: (data) => apiClient.put('/profile', data),
  uploadAvatar: (formData) => apiClient.post('/profile/avatar', formData),
}

export const mediaAPI = {
  getVideorama: () => apiClient.get('/media/videorama'),
  getLiveStreams: () => apiClient.get('/live/streams'),
  getRadioNowPlaying: () => apiClient.get('/radio/now-playing'),
}

export const chatAPI = {
  getChatHistory: (room) => apiClient.get(`/chat/${room}/history`),
  sendMessage: (room, msg) => apiClient.post(`/chat/${room}/send`, { message: msg }),
}

export default { profileAPI, mediaAPI, chatAPI }
```

**`packages/api-client/package.json`**:

```json
{
  "name": "@pnptv/api-client",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.js",
  "exports": {
    ".": "./src/index.js",
    "./client": "./src/client.js"
  },
  "dependencies": {
    "axios": "^1.13.2"
  }
}
```

### Step 2.4: Update Each Webapp

**`apps/hub/vite.config.js`** (example):

```javascript
import { defineConfig, mergeConfig } from 'vite'
import baseConfig from '@pnptv/config'

export default mergeConfig(baseConfig, defineConfig({
  base: './',
  server: { port: 3002 },
  build: { outDir: '../../public/hub' },
}))
```

**`apps/hub/package.json`**:

```json
{
  "name": "@pnptv/app-hub",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "@pnptv/api-client": "workspace:*",
    "react": "^18.0.0"
  },
  "scripts": {
    "build": "vite build",
    "dev": "vite"
  }
}
```

---

## 🚀 Phase 3: App Reorganization & Naming (Future)

**Goal**: Cleaner URL structure and logical grouping

```
/apps/
├── auth/                # → /auth/
├── hub/                 # → /hub/ (rename from prime-hub)
├── hangouts/            # → /hangouts/
├── media/               # Group of streaming apps
│   ├── live/           # → /media/live/
│   ├── radio/          # → /media/radio/
│   └── videorama/      # → /media/videorama/
└── portal/             # → /portal/ (deprecated)
```

**Nginx routing becomes semantic**:
- `/auth/` → Login & OAuth
- `/hub/` → Main dashboard (social, profile, admin)
- `/hangouts/` → Video conferencing
- `/media/live/` → Livestreaming
- `/media/radio/` → Radio player
- `/media/videorama/` → VOD library
- `/api/webapp/*` → Backend API

---

## 📋 Migration Execution Checklist

### Pre-Migration (Validate Current State)
- [ ] All webapps build successfully: `npm run build:webapps`
- [ ] Nginx serves `/hub/`, `/live/`, `/radio/`, etc. correctly
- [ ] Health check passes: `curl https://pnptv.app/health`
- [ ] No 404 errors in browser console
- [ ] Admin panel accessible at `/prime-hub/admin`

### Phase 1: Nginx auth_request (IMMEDIATE)
- [ ] Create backup: `sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup`
- [ ] Update nginx.conf with auth_request config (see above)
- [ ] Test nginx syntax: `sudo nginx -t`
- [ ] Reload nginx: `sudo systemctl reload nginx`
- [ ] Test protected routes:
  - [ ] Without session: `curl -i https://pnptv.app/hub/` → 302 to /auth/
  - [ ] With session: `curl -i -H "Cookie: connect.sid=..." https://pnptv.app/hub/` → 200
- [ ] Test public routes still work: `curl -i https://pnptv.app/api/payment/`
- [ ] Monitor logs for auth errors: `tail -f /var/log/nginx/error.log`

### Phase 2: Workspaces + Shared Packages (Next Sprint - 1-2 weeks)
- [ ] Create `/packages/config/vite.base.js`
- [ ] Create `/packages/api-client/` with centralized axios
- [ ] Add `pnpm-workspace.yaml` to root
- [ ] Update root `package.json` with workspace config
- [ ] Migrate each webapp: `apps/hub/vite.config.js` → use `mergeConfig(baseConfig, ...)`
- [ ] Test: `pnpm install`, `pnpm run build:apps`
- [ ] All webapps still compile to `/public/`

### Phase 3: Rename `/webapps/` → `/apps/` (Future)
- [ ] Rename directories
- [ ] Update build scripts
- [ ] Update nginx routes (optional semantic cleanup)
- [ ] Update `.gitignore`, CI/CD pipelines
- [ ] Test full deployment

---

## 🔗 Related Documentation

- **WEBAPPS_ARCHITECTURE.md** - Detailed feature specs (Hangouts, Radio, etc.)
- **MEMORY.md** - Project memory (ePayco, PostgreSQL, deployment notes)
- **ecosystem.config.js** - PM2 process manager configuration
- **package.json** - Current build scripts and dependencies

---

## 📞 Support

For questions on:
- **Nginx auth_request**: See Phase 1 section above
- **Monorepo setup**: See Phase 2 section
- **Webapp features**: See WEBAPPS_ARCHITECTURE.md
- **Deployment**: See ecosystem.config.js

---

**Document Version**: 1.0
**Last Updated**: 2026-02-21
**Maintained by**: Claude Code Agent
