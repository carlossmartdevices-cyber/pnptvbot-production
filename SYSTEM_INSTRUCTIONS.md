# 📋 PNPtv System Instructions & Master Guidelines

**Version**: 1.0
**Date**: February 21, 2026
**Status**: Production-Grade Architecture

---

## 🎯 Master Context

**PNPtv!** is a full-stack, production-grade platform for the queer PNP community built on:

- **Frontend**: React 18 + Vite + Tailwind CSS (Monorepo Webapps)
- **Backend**: Node.js 18 + Express + Telegraf (Telegram Bot)
- **Infrastructure**: Nginx (Auth Guard), PostgreSQL, Redis, PM2
- **Architecture**: NPM Workspaces Monorepo (Packages + Apps)

---

## 📚 Key Documentation (Read in Order)

1. **PROJECT_INFO.md** - START HERE (setup, quick start)
2. **PROJECT_STRUCTURE.md** - Repository layout and workspaces
3. **SYSTEM_ARCHITECTURE.md** - Data flows, security, performance
4. **ARCHITECTURE_MIGRATION_PLAN.md** - Phases 1-3 implementation roadmap
5. **SPECIALIZED_AGENTS_GUIDE.md** - How to invoke specialized agents
6. **MIGRATION_COMPLETE.md** - Current status (Phase 2 executed)

---

## 🤖 The 5 Specialized Agents

When working on tasks, invoke the appropriate specialized agent:

### 1. **@dba-specialist** 🗄️
- PostgreSQL, PostGIS, Redis, Query optimization
- Use for: Database schemas, caching strategies, migrations
- Style: Provides complete SQL scripts with no placeholders

### 2. **@devops-specialist** 🚀
- Nginx, Docker, PM2, CI/CD, VPS security
- Use for: Infrastructure, deployments, security configs
- Style: Copy-pasteable configs with exact Bash commands

### 3. **@frontend-specialist** 🎨
- React 18, Vite, Tailwind CSS, Design system, Mobile-first
- Use for: UI components, pages, styling, accessibility
- Style: Production-ready React code with full implementations

### 4. **@qa-security-specialist** 🔒
- Testing, security audits, vulnerability detection, code review
- Use for: Security analysis, test suites, edge case testing
- Style: Complete Jest/RTL test files with no placeholders

### 5. **@fullstack-architect** 🏗️
- Overall architecture, end-to-end implementations
- Use for: Complex features, refactoring, system design
- Style: Complete implementations from DB to UI with all imports

---

## 🏗️ Architecture Overview

```
FRONTEND LAYER (React SPAs)
├── /apps/hub/ (@pnptv/hub) → pnptv.app/hub
├── /apps/hangouts/ → pnptv.app/hangouts
├── /apps/media-live/ → pnptv.app/media/live
├── /apps/media-radio/ → pnptv.app/media/radio
└── /apps/media-videorama/ → pnptv.app/media/videorama

   ↓ (Session cookies + API calls)

SHARED LAYER (NPM Workspaces)
├── @pnptv/ui-kit (Design system)
├── @pnptv/api-client (Axios + interceptors)
└── @pnptv/config (Vite base config)

   ↓ (HTTP/WebSocket via Nginx)

NGINX REVERSE PROXY (Port 443 - HTTPS)
├── auth_request protection on /hub/, /media/*, /hangouts/
├── Static file serving from /public/ (React builds)
└── API proxying to backend

   ↓

BACKEND LAYER (Express + Telegram Bot)
├── /apps/backend/src/controllers/ (REST endpoints)
├── /apps/backend/src/bot/ (Telegram commands)
├── /apps/backend/src/services/ (Business logic)
└── /apps/backend/src/models/ (Database ORM)

   ↓

DATA LAYER
├── PostgreSQL (Primary data store)
├── PostGIS (Geolocation data)
└── Redis (Sessions + caching)
```

---

## 🔄 Development Workflow

### 1. Fresh Start
```bash
npm install                    # Install all workspaces
npm workspaces list           # Verify linking
```

### 2. Local Development
```bash
# Terminal 1
npm run dev:backend           # Port 3001

# Terminal 2
npm run dev:hub               # Port 5173 (or assigned port)

# Terminal 3 (Optional)
npm run dev:media-radio
```

### 3. Build for Production
```bash
npm run build                 # Build all apps
npm run build --workspace=@pnptv/hub  # Build single app
```

### 4. Deploy to VPS
```bash
git add -A
git commit -m "chore: [description]"
git push origin main

# On VPS:
git pull origin main
npm install
npm run build
pm2 reload ecosystem.config.js
```

---

## 🔐 Security & Auth Flow

### Session Management
- **Type**: HTTP-only cookies (no JWT in localStorage)
- **Storage**: Redis (centralized, encrypted)
- **TTL**: 7 days
- **Cookie Name**: `connect.sid` (express-session)

### Auth Flow
1. User visits `/auth/` (public route)
2. Logs in with Email/Telegram/X OAuth
3. Backend validates → creates session in Redis
4. Cookie `connect.sid` set (HttpOnly, Secure, SameSite)
5. User accesses `/hub/` (protected route)
6. Nginx calls `/api/webapp/auth/verify` (auth_request)
7. Express validates session → returns 200 or 401
8. Nginx serves React app or redirects to `/auth/`

### Protected Routes (Nginx auth_request)
```
/hub/       ✅ Protected
/media/*    ✅ Protected
/hangouts/  ✅ Protected
/portal/    ✅ Protected
/auth/      ❌ Public
/api/payment/  ❌ Public
/health     ❌ Public
```

---

## 📦 Monorepo Commands Reference

```bash
# View all workspaces
npm workspaces list

# Install in specific workspace
npm install lodash --workspace=@pnptv/ui-kit

# Build specific app
npm run build --workspace=@pnptv/hub

# Run tests in specific app
npm run test --workspace=@pnptv/hub

# Add script to all workspaces
npm run [script] --workspace="@pnptv/*"

# View workspace configuration
cat package.json | grep -A10 workspaces
```

---

## 🚀 Phase Status

### ✅ PHASE 1: Nginx Auth Guard
**Status**: Configuration ready (NOT YET DEPLOYED)
- File: `nginx-auth-request.conf`
- Validation: `scripts/validate-nginx-auth-request.sh`
- Deployment: Manual (need to merge into /etc/nginx/nginx.conf)

### ✅ PHASE 2: Monorepo Structure
**Status**: COMPLETE (EXECUTED)
- `/packages/` created
- `/src/` → `/apps/backend/`
- `/webapps/` → `/apps/{new-names}`
- Root `package.json` updated
- `pnpm-workspace.yaml` created
- Backup: `backups/repo_backup_20260221_153109/`

### ⏳ PHASE 3: Full Optimization (PLANNED)
- Migrate webapps to use centralized Vite config
- Implement shared UI components from ui-kit
- Horizontal scaling with PM2 cluster mode

---

## 📋 Best Practices

### Frontend Development
- ✅ Always import from `@pnptv/api-client` and `@pnptv/ui-kit`
- ✅ Use only Tailwind preset colors (no custom hex)
- ✅ Include loading, empty, and error states
- ✅ Make mobile-first (44x44px tap targets)
- ❌ Never hardcode API URLs (use @pnptv/api-client)
- ❌ Never use relative imports from sibling apps

### Backend Development
- ✅ All routes must validate `req.session.user`
- ✅ Use parameterized queries (Sequelize handles this)
- ✅ Wrap async code in try/catch
- ✅ Return 401 for missing session, 403 for insufficient permission
- ❌ Never send passwords or secrets in JSON responses
- ❌ Never skip session validation for "internal" APIs

### DevOps & Deployment
- ✅ All configs in version control (except `.env` secrets)
- ✅ Test Nginx syntax before reloading
- ✅ Verify health endpoint after deployment
- ✅ Keep backups for all infrastructure changes
- ❌ Never force-push to main
- ❌ Never deploy without testing locally first

### Testing
- ✅ Write tests for all new features
- ✅ Mock external dependencies (Redis, PostgreSQL)
- ✅ Include edge cases (race conditions, duplicate webhooks)
- ✅ Full test file output (no placeholders)
- ❌ Don't skip test on "simple" code
- ❌ Don't leave `.only` in test files

---

## 🆘 Common Issues & Solutions

### Issue: `npm install` fails with workspace errors
**Solution**: Clear cache and reinstall
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Issue: Nginx auth_request returns 502
**Solution**: Verify backend is running
```bash
curl http://127.0.0.1:3001/api/webapp/auth/verify
pm2 logs pnptv-production
```

### Issue: React app won't build
**Solution**: Check for import errors
```bash
npm run build --workspace=@pnptv/hub 2>&1 | head -50
```

### Issue: Need to revert monorepo migration
**Solution**: Restore from backup
```bash
cp -r backups/repo_backup_20260221_153109/* .
git reset --hard
npm install
```

---

## 📞 When to Use Each Agent

| Situation | Agent | Example |
|-----------|-------|---------|
| "Add a new database table" | @dba-specialist | "Design user_preferences table with caching" |
| "Deploy to production" | @devops-specialist | "Write deployment script with health checks" |
| "Build a new page" | @frontend-specialist | "Create ProfilePage component with edit mode" |
| "Code is broken/slow" | @qa-security-specialist | "Audit payment webhook for race conditions" |
| "Build complete feature" | @fullstack-architect | "Implement end-to-end geolocation feature" |

---

## 📚 File Organization

```
pnptvbot-production/
├── 📖 Documentation (Master Guides)
│   ├── PROJECT_INFO.md
│   ├── PROJECT_STRUCTURE.md
│   ├── SYSTEM_ARCHITECTURE.md
│   ├── ARCHITECTURE_MIGRATION_PLAN.md
│   ├── SPECIALIZED_AGENTS_GUIDE.md
│   ├── SYSTEM_INSTRUCTIONS.md (this file)
│   └── MIGRATION_COMPLETE.md
│
├── 📦 Source Code
│   ├── packages/              (Shared: config, api-client, ui-kit)
│   └── apps/                  (Applications: backend, hub, hangouts, media-*)
│
├── 🔧 Configuration
│   ├── package.json           (Workspaces)
│   ├── ecosystem.config.js    (PM2)
│   ├── nginx-auth-request.conf (Phase 1 - not deployed)
│   └── pnpm-workspace.yaml
│
├── 🧪 Scripts
│   ├── scripts/migrate-to-monorepo.sh (already executed)
│   └── scripts/validate-nginx-auth-request.sh
│
└── 📦 Backups
    └── backups/repo_backup_20260221_153109/
```

---

## 🎓 Learning Path for New Developers

1. Read **PROJECT_INFO.md** (15 min)
2. Read **PROJECT_STRUCTURE.md** (15 min)
3. Run `npm install && npm run dev:backend` (5 min)
4. Read **SYSTEM_ARCHITECTURE.md** (30 min)
5. Read **SPECIALIZED_AGENTS_GUIDE.md** (20 min)
6. Start contributing following best practices

---

## 🔗 External Resources

- **Node.js**: https://nodejs.org/docs/
- **Express.js**: https://expressjs.com/
- **React**: https://react.dev
- **Tailwind CSS**: https://tailwindcss.com
- **Telegraf**: https://telegraf.js.org/
- **Nginx**: https://nginx.org/en/docs/
- **PostgreSQL**: https://www.postgresql.org/docs/
- **PostGIS**: https://postgis.net/documentation/

---

## 📝 Summary

**You have everything you need to:**
- ✅ Understand the architecture
- ✅ Develop new features
- ✅ Deploy to production
- ✅ Fix issues efficiently
- ✅ Collaborate with specialized agents

**Next Steps:**
1. Run `npm install` locally
2. Start `npm run dev:backend` + `npm run dev:hub`
3. When you need help, invoke the appropriate agent
4. Deploy Phase 1 (Nginx) when ready for production

---

**Created**: February 21, 2026
**By**: Claude Code Agent
**Status**: ✅ Complete & Production-Ready
