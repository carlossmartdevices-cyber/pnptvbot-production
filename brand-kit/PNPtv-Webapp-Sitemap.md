# PNPtv! Web Applications — Complete Sitemap

This document maps **every web page, web app, and API endpoint** served by the PNPtv platform across all domains.

---

## Table of Contents

1. [Domain Architecture](#1-domain-architecture)
2. [pnptv.app — Main Platform](#2-pnptvapp--main-platform)
3. [easybots.site — Payment Processing](#3-easybotssite--payment-processing)
4. [easybots.store — Legacy Payment Domain](#4-easybotsstore--legacy-payment-domain)
5. [Protected Web Apps (SPAs)](#5-protected-web-apps-spas)
6. [Checkout & Payment Pages](#6-checkout--payment-pages)
7. [Authentication Pages](#7-authentication-pages)
8. [Legal & Informational Pages](#8-legal--informational-pages)
9. [API Endpoints](#9-api-endpoints)
10. [Rate Limiting](#10-rate-limiting)
11. [Security & Access Control](#11-security--access-control)

---

## 1. Domain Architecture

| Domain | IP | Purpose | SSL |
|--------|-----|---------|-----|
| `pnptv.app` | `76.13.26.234` | Main platform — web apps, landing pages, bot webhook, APIs | Yes (Let's Encrypt) |
| `easybots.site` | `76.13.26.234` | Payment webhooks, checkout pages | Yes (Let's Encrypt) |
| `easybots.store` | `76.13.26.234` | Legacy payment domain (being phased out) | Yes (Let's Encrypt) |

**Backend:** Express.js on port `3001`, managed by PM2 (`pnptv-bot`), behind nginx reverse proxy.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│  pnptv.app   │────▶│              │     │  Express.js :3001    │
│              │     │    nginx     │────▶│                      │
│easybots.site │────▶│  (SSL/proxy) │     │  public/ (static)    │
│              │     │              │     │  src/bot/api/routes.js│
│easybots.store│────▶│              │     │                      │
└──────────────┘     └──────────────┘     └──────────────────────┘
```

---

## 2. pnptv.app — Main Platform

### Landing & Public Pages

| URL | File | Description |
|-----|------|-------------|
| `/` | `public/index.html` | Homepage / landing page |
| `/landing.html` | `public/landing.html` | Alternative landing page |
| `/lifetime-pass` | `public/lifetime-pass.html` | Lifetime Pass sales page |
| `/lifetime100` | `public/lifetime-pass.html` | Lifetime100 promo (redirects) |
| `/community-room` | `public/community-room.html` | PNPtv Haus community room page |
| `/pnptv-haus` | `public/community-room.html` | Alias for community room |
| `/community-features` | `public/community-features.html` | Community features showcase |
| `/how-to-use` | `public/how-to-use.html` | User guide (bilingual) |
| `/youtube-playlist.html` | `public/youtube-playlist.html` | YouTube playlist embed |

### Legal Pages

| URL | File | Description |
|-----|------|-------------|
| `/terms` | `public/terms.html` | Terms of Service (EN) |
| `/terms?lang=es` | `public/policies_es.html` | Terms of Service (ES) |
| `/privacy` | `public/privacy.html` | Privacy Policy (EN) |
| `/privacy?lang=es` | `public/policies_es.html` | Privacy Policy (ES) |
| `/policies` | `public/terms.html` | Policies (alias, EN) |
| `/policies?lang=es` | `public/policies_es.html` | Policies (alias, ES) |
| `/policies_en.html` | `public/policies_en.html` | Policies EN (static) |
| `/policies_es.html` | `public/policies_es.html` | Policies ES (static) |

### Age Verification

| URL | File | Description |
|-----|------|-------------|
| `/age-verification` | `public/age-verification.html` | Age verification form (manual) |
| `/age-verification-camera.html` | `public/age-verification-camera.html` | AI camera age verification |
| `/age-verification-security-faq.html` | `public/age-verification-security-faq.html` | Privacy/security FAQ for age verification |

### Admin & Monitoring

| URL | File | Description |
|-----|------|-------------|
| `/monitoring/dashboard.html` | `public/monitoring/dashboard.html` | Admin monitoring dashboard |
| `/materialious/` | `public/materialious/index.html` | Material Design demo page |

---

## 3. easybots.site — Payment Processing

This domain handles payment webhooks and checkout pages only.

| URL | Purpose |
|-----|---------|
| `/api/webhook/epayco` | ePayco payment webhook (singular) |
| `/api/webhooks/epayco` | ePayco payment webhook (plural alias) |
| `/api/webhooks/daimo` | Daimo crypto payment webhook |
| `/payment/{paymentId}` | One-time payment checkout (card form) |
| `/daimo-checkout/{paymentId}` | Daimo crypto checkout |
| `/webapps/*` | Proxied to Express backend |

All other paths return 404.

---

## 4. easybots.store — Legacy Payment Domain

Being phased out. Shows EasyBots placeholder landing page at `/`. Allows:

| URL | Purpose |
|-----|---------|
| `/` | EasyBots landing page (inline HTML) |
| `/health` | Health check |
| `/api/*` | API endpoints |
| `/checkout/*` | ePayco checkout |
| `/daimo-checkout/*` | Daimo checkout |
| `/payment/*` | Payment checkout |
| `/pnp/webhook/telegram` | Telegram webhook |
| `/webhook/telegram` | Telegram webhook alias |

All PNPtv-specific static files (HTML, CSS, JS, images) are blocked.

---

## 5. Protected Web Apps (SPAs)

These are Single Page Applications requiring Telegram authentication. Unauthenticated users are redirected to `/login?return={originalUrl}`.

### Videorama — Media Center

| URL | File | Tech |
|-----|------|------|
| `/videorama` | `public/videorama-app/index.html` | React SPA |
| `/videorama/*` | SPA routing (fallback to index.html) | |

**Assets:** `public/videorama-app/assets/` (JS + CSS bundles)

**Features:** Video streaming, music playlists, podcasts, radio integration

**API endpoints used:**
- `GET /api/media/library` — Media catalog
- `GET /api/media/categories` — Content categories
- `GET /api/media/:mediaId` — Single media item
- `GET /api/media/playlists` — Public playlists
- `GET /api/videorama/collections` — Curated collections
- `GET /api/videorama/collections/:id` — Collection items

---

### Hangouts — Video Calls

| URL | File | Tech |
|-----|------|------|
| `/hangouts` | `public/hangouts/index.html` | React SPA + Agora SDK |
| `/hangouts/*` | SPA routing (fallback to index.html) | |

**Assets:** `public/hangouts/assets/` (JS + CSS bundles, Agora RTC SDK)

**Features:** Video call rooms, community rooms, Jitsi integration

**API endpoints used:**
- `GET /api/hangouts/public` — List public rooms
- `POST /api/hangouts/create` — Create video call
- `POST /api/hangouts/join/:callId` — Join a call

---

### Live — Live Streaming

| URL | File | Tech |
|-----|------|------|
| `/live` | `public/live/index.html` | React SPA + Agora SDK |
| `/live/*` | SPA routing (fallback to index.html) | |
| `/pnplive` | `public/live/index.html` | Alias |

**Assets:** `public/live/assets/` (JS + CSS bundles, Agora RTC SDK)

**Features:** Live stream viewer/host, chat, reactions, categories

---

### Radio — Music Streaming

| URL | File | Tech |
|-----|------|------|
| `/radio` | `public/radio/index.html` | React SPA |

**Assets:** `public/radio/assets/` (JS + CSS bundle)

**Features:** Live radio stream, now playing, song requests, schedule

**API endpoints used:**
- `GET /api/radio/now-playing` — Current track
- `GET /api/radio/history` — Play history
- `GET /api/radio/schedule` — Weekly schedule
- `POST /api/radio/request` — Song request

---

## 6. Checkout & Payment Pages

### Subscription Payments

| URL | File | Description |
|-----|------|-------------|
| `/payment/{paymentId}` | `public/payment-checkout.html` | Card payment form (ePayco tokenization API) |
| `/checkout/{paymentId}` | `public/payment-checkout.html` | Checkout alias |
| `/daimo-checkout/{paymentId}` | `public/daimo-checkout.html` | Crypto checkout (USDC via Daimo Pay) |
| `/recurring-checkout/{userId}/{planId}` | `public/recurring-checkout.html` | Recurring subscription card setup |

**ePayco Subscription Landing Pages (external):**
```
https://subscription-landing.epayco.co/plan/{epaycoId}?extra1={userId}&extra2={planId}&extra3={paymentId}
```

| Plan | ePayco ID |
|------|-----------|
| Monthly ($24.99/mo) | `98903d6a955eb9e6a02b248` |
| Crystal 3-Month ($49.99) | `989cabf46421ac748080082` |
| 6-Month ($74.99) | `989cb93a2ebe4596309bb12` |
| Yearly ($99.99) | `989cc3619e2a37cfe0111f0` |

### Meet & Greet Payments

| URL | File | Description |
|-----|------|-------------|
| `/pnp/meet-greet/checkout/{bookingId}` | `public/meet-greet-checkout.html` | Card payment for Meet & Greet |
| `/pnp/meet-greet/daimo-checkout/{bookingId}` | `public/meet-greet-daimo-checkout.html` | Crypto payment for Meet & Greet |

### PNP Live Payments

| URL | File | Description |
|-----|------|-------------|
| `/pnp/live/checkout/{bookingId}` | `public/pnp-live-checkout.html` | Card payment for PNP Live show |
| `/pnp/live/daimo-checkout/{bookingId}` | `public/pnp-live-daimo-checkout.html` | Crypto payment for PNP Live show |

---

## 7. Authentication Pages

| URL | File | Description |
|-----|------|-------------|
| `/auth/telegram-login` | `public/auth/telegram-login.html` | Telegram Login Widget page |
| `/auth/telegram-login-complete` | `public/auth/telegram-login-complete.html` | Post-login callback page |
| `/auth/terms` | `public/auth/terms.html` | Terms acceptance gate (post-login) |
| `/auth/not-registered` | `public/auth/not-registered.html` | Not registered error page |

**Auth Flow:**
```
Unauthenticated → /login?return={url}
    → /auth/telegram-login (Telegram Widget)
    → /auth/telegram-login-complete (validates, creates session)
    → /auth/terms (if terms not accepted)
    → Redirect to original {url}
```

---

## 8. Legal & Informational Pages

| URL | Description | Languages |
|-----|-------------|-----------|
| `/terms` | Terms of Service | EN/ES (via `?lang=es`) |
| `/privacy` | Privacy Policy | EN/ES (via `?lang=es`) |
| `/policies` | Combined policies | EN/ES (via `?lang=es`) |
| `/age-verification` | Age verification form | EN |
| `/age-verification-camera.html` | AI camera verification | EN |
| `/age-verification-security-faq.html` | Security FAQ | EN |
| `/how-to-use` | How to use PNPtv guide | EN/ES |
| `/lifetime-pass` | Lifetime Pass landing page | EN |

---

## 9. API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/telegram-auth` | Validate Telegram login data, create session |
| `POST` | `/api/accept-terms` | Accept terms of service |
| `GET` | `/api/auth-status` | Check current auth session status |
| `POST` | `/api/logout` | Destroy session, clear cookie |

### Payment Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/webhooks/epayco` | ePayco payment notification |
| `POST` | `/api/webhook/epayco` | ePayco payment notification (singular) |
| `POST` | `/api/webhooks/daimo` | Daimo Pay crypto notification |
| `POST` | `/api/webhooks/visa-cybersource` | Visa CyberSource notification |
| `GET` | `/api/webhooks/visa-cybersource/health` | CyberSource webhook health check |
| `GET` | `/api/payment-response` | ePayco redirect after payment |

### Payment Processing

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/payment/:paymentId` | Get payment details (for checkout page) |
| `POST` | `/api/payment/tokenized-charge` | Process tokenized card charge |
| `GET` | `/api/confirm-payment/:token` | Confirm payment via email token |

### Recurring Subscriptions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/recurring/tokenize` | Tokenize card for recurring billing |
| `POST` | `/api/recurring/subscribe` | Create recurring subscription |
| `GET` | `/api/recurring/subscription/:userId` | Get subscription details |
| `POST` | `/api/recurring/cancel` | Cancel subscription |
| `POST` | `/api/recurring/reactivate` | Reactivate cancelled subscription |

### Subscription Plans

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/subscription/plans` | List available plans |
| `POST` | `/api/subscription/create-plan` | Create ePayco plan |
| `POST` | `/api/subscription/create-checkout` | Create subscription checkout |
| `POST` | `/api/subscription/epayco/confirmation` | ePayco subscription confirmation |
| `GET` | `/api/subscription/payment-response` | Subscription payment redirect |
| `GET` | `/api/subscription/subscriber/:identifier` | Get subscriber info |
| `GET` | `/api/subscription/stats` | Subscription statistics |

### Meet & Greet Bookings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/meet-greet/booking/:bookingId` | Get booking details + ePayco config |
| `POST` | `/api/meet-greet/booking/:bookingId/confirm` | Confirm booking payment |

### PNP Live Bookings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/pnp-live/booking/:bookingId` | Get booking details + ePayco config |
| `POST` | `/api/pnp-live/booking/:bookingId/confirm` | Confirm booking payment |

### Media Library (Videorama)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/media/library` | Get media catalog (`?type=all&category=&limit=50`) |
| `GET` | `/api/media/categories` | List media categories |
| `GET` | `/api/media/:mediaId` | Get single media item |
| `GET` | `/api/media/playlists` | List public playlists |
| `GET` | `/api/videorama/collections` | Curated collections & featured content |
| `GET` | `/api/videorama/collections/:id` | Collection items (`?type=playlist|category`) |

### Playlists

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/playlists/user` | User's playlists |
| `GET` | `/api/playlists/public` | Public playlists |
| `POST` | `/api/playlists` | Create playlist |
| `POST` | `/api/playlists/:id/videos` | Add video to playlist |
| `DELETE` | `/api/playlists/:id/videos/:videoId` | Remove video from playlist |
| `DELETE` | `/api/playlists/:id` | Delete playlist |

### Hangouts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/hangouts/public` | List public video rooms |
| `POST` | `/api/hangouts/create` | Create video call room |
| `POST` | `/api/hangouts/join/:callId` | Join a video call |

### Radio

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/radio/now-playing` | Current playing track |
| `GET` | `/api/radio/history` | Play history (`?limit=20`) |
| `GET` | `/api/radio/schedule` | Weekly schedule |
| `POST` | `/api/radio/request` | Submit song request |

### Audio Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/audio/list` | List audio files |
| `GET` | `/api/audio/current` | Current audio track |
| `POST` | `/api/audio/setup-soundcloud` | Setup background audio from SoundCloud |
| `POST` | `/api/audio/stop` | Stop background audio |
| `DELETE` | `/api/audio/:filename` | Delete audio file |

### Podcasts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/podcasts/upload` | Upload podcast audio (multipart) |

### Age Verification

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/verify-age` | AI age verification from photo (max 5MB) |

### Group Invitations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/join-group/:token` | Verify group invitation token |
| `GET` | `/join-group/:token` | Redirect to Telegram group |

### Statistics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stats` | Platform statistics |

### Admin APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `*` | `/api/admin/queue/*` | Broadcast queue management |
| `*` | `/api/admin/x/oauth/*` | X/Twitter OAuth management |
| `*` | `/api/auth/x/*` | X OAuth callback (alias) |

### Health & Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check (Redis + PostgreSQL) |
| `GET` | `/api/health` | Health check (alias) |
| `GET` | `/api/metrics` | Performance metrics |
| `POST` | `/api/metrics/reset` | Reset metrics counters |

### Telegram Webhook

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/webhook/telegram` | Telegram bot webhook (registered in bot.js) |

---

## 10. Rate Limiting

| Scope | Window | Max Requests |
|-------|--------|-------------|
| General API (`/api/`) | 15 minutes | 100 per IP |
| Webhooks | 5 minutes | 50 per IP |
| Health checks | 1 minute | 30 per IP |
| Pages | No limit (stub middleware) |

---

## 11. Security & Access Control

### Protected Paths (require Telegram login session)

```
/videorama    → Redirects to /login?return=/videorama
/hangouts     → Redirects to /login?return=/hangouts
/live         → Redirects to /login?return=/live
/pnplive      → Redirects to /login?return=/pnplive
```

### Domain-Based Content Blocking

**easybots.store / easybots.site** can only access:
- `/health`
- `/api/*`
- `/pnp/webhook/telegram`
- `/webhook/telegram`
- `/checkout/*`
- `/daimo-checkout/*`
- `/payment/*`

All PNPtv static files (HTML, CSS, JS, images, videos) are blocked on these domains.

### Session Management

- **Store:** Redis (`sess:` prefix)
- **Cookie:** `connect.sid`, secure in production, 24-hour max age
- **Auth:** Telegram Login Widget → server-side validation → session creation

---

## Visual Sitemap

```
pnptv.app
├── / .......................... Homepage
├── /landing.html .............. Alt landing page
│
├── PROTECTED WEB APPS (Telegram auth required)
│   ├── /videorama ............. Media center SPA
│   ├── /hangouts .............. Video calls SPA
│   ├── /live .................. Live streaming SPA
│   ├── /pnplive ............... PNP Live alias
│   └── /radio ................. Radio streaming SPA
│
├── CHECKOUT PAGES
│   ├── /payment/{id} ......... Card payment (ePayco tokenized)
│   ├── /checkout/{id} ........ Card payment alias
│   ├── /daimo-checkout/{id} .. Crypto payment (USDC)
│   ├── /recurring-checkout/{userId}/{planId} .. Recurring setup
│   ├── /pnp/meet-greet/checkout/{id} ......... Meet & Greet card
│   ├── /pnp/meet-greet/daimo-checkout/{id} ... Meet & Greet crypto
│   ├── /pnp/live/checkout/{id} ............... PNP Live card
│   └── /pnp/live/daimo-checkout/{id} ......... PNP Live crypto
│
├── AUTH PAGES
│   ├── /auth/telegram-login ............. Login widget
│   ├── /auth/telegram-login-complete .... Login callback
│   ├── /auth/terms ...................... Terms gate
│   └── /auth/not-registered ............. Not registered
│
├── LEGAL & INFO PAGES
│   ├── /terms ................. Terms of Service
│   ├── /privacy ............... Privacy Policy
│   ├── /policies .............. Combined policies
│   ├── /age-verification ...... Age verification
│   ├── /how-to-use ............ User guide
│   ├── /lifetime-pass ......... Lifetime sales page
│   ├── /community-room ........ PNPtv Haus
│   └── /community-features .... Features showcase
│
├── ADMIN
│   ├── /monitoring/dashboard.html .. Monitoring dashboard
│   └── /materialious/ .............. Material demo
│
├── API (80+ endpoints)
│   ├── /api/telegram-auth
│   ├── /api/payment/*
│   ├── /api/webhooks/*
│   ├── /api/recurring/*
│   ├── /api/subscription/*
│   ├── /api/media/*
│   ├── /api/videorama/*
│   ├── /api/playlists/*
│   ├── /api/hangouts/*
│   ├── /api/radio/*
│   ├── /api/audio/*
│   ├── /api/meet-greet/*
│   ├── /api/pnp-live/*
│   ├── /api/admin/*
│   ├── /api/auth/x/*
│   ├── /api/stats
│   ├── /api/verify-age
│   └── /api/health
│
└── /health .................... Health check

easybots.site
├── /api/webhook/epayco ........ Payment webhook
├── /api/webhooks/* ............ Payment webhooks
├── /payment/{id} .............. Card checkout
├── /daimo-checkout/{id} ....... Crypto checkout
└── (everything else → 404)

easybots.store (legacy)
├── / .......................... EasyBots placeholder
├── /api/* ..................... API passthrough
├── /payment/* ................. Payment pages
├── /checkout/* ................ Checkout pages
└── (PNPtv content → blocked)
```

---

*This sitemap covers all web pages, SPAs, checkout flows, API endpoints, and domain configurations for the PNPtv platform as of February 2026.*
