# 🗺️ Diagrama de Rutas y Servicios - PNPtv

**Última Actualización:** Febrero 21, 2026

## 1. ARQUITECTURA GENERAL

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLIENTE (NAVEGADOR)                                 │
│  https://pnptv.app/auth/  |  https://pnptv.app/hub/  | Mobile/Web Apps    │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ HTTPS/HTTP2
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                    NGINX REVERSE PROXY (Puerto 443)                         │
│  ┌─ rate limiting (api:10r/s, auth:2r/s)                                  │
│  ├─ CORS whitelist + Security Headers                                      │
│  ├─ Gzip compression (60-70% reduction)                                    │
│  ├─ HTTP/2 multiplexing                                                    │
│  └─ auth_request middleware → /api/webapp/auth/verify                      │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ HTTP/1.1 (keepalive)
                               │ 127.0.0.1:3001
┌──────────────────────────────▼──────────────────────────────────────────────┐
│              EXPRESS.JS + TELEGRAF BOT (PM2 Managed)                        │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │ Middleware Stack:                                            │           │
│  │ • Session Management (Redis store, 7 días TTL)              │           │
│  │ • JWT Authentication (Bearer token)                         │           │
│  │ • Helmet Security Headers                                   │           │
│  │ • Morgan Logging                                            │           │
│  │ • Error Handling & Sentry Integration                       │           │
│  └──────────────────────────────────────────────────────────────┘           │
└──────────────────────────────┬──────────────────────────────────────────────┘
                    ┌──────────┼──────────────┬──────────────┐
                    │          │              │              │
         ┌──────────▼────┐ ┌──▼─────────┐ ┌─▼──────────┐ ┌─▼──────────┐
         │  POSTGRESQL  │ │   REDIS    │ │  TELEGRAM  │ │   ePayco   │
         │              │ │            │ │    Bot     │ │  Payment   │
         │ • Users      │ │ • Sessions │ │ • Webhook  │ │  Gateway   │
         │ • Content    │ │ • Cache    │ │ • Commands │ │ • Charges  │
         │ • Payments   │ │ • Queues   │ │ • Messages │ │ • Tokens   │
         │ • Subs       │ │ • Locks    │ │            │ │ • 3DS      │
         └──────────────┘ └────────────┘ └────────────┘ └────────────┘
```

---

## 2. RUTAS PÚBLICAS (Sin Autenticación)

### 🏠 Página Principal
```
GET /
├─ Servicio: Static File Server
├─ Archivo: /public/index.html
├─ Respuesta: HTTP/2 200 (HTML)
└─ Cache: 1 hora
```

### 🔐 Página de Login
```
GET /auth/
├─ Servicio: Static File Server
├─ Archivo: /public/auth/index.html
├─ Features:
│  ├─ Telegram OAuth Widget
│  ├─ Email/Password form
│  └─ Responsive UI
├─ Respuesta: HTTP/2 200 (HTML, 38.6 KB)
└─ Cache: 1 hora

GET /auth/?redirect=/hub/
├─ Servicio: Static File Server
├─ Parámetro: redirect URL capture para post-login
└─ Flujo: Usuario redirectado aquí si accede ruta protegida sin auth
```

### ❤️ Health Check
```
GET /health
├─ Servicio: healthController
├─ Autenticación: NINGUNA (public)
├─ Response:
│  {
│    "status": "ok",
│    "timestamp": "2026-02-21T16:52:48.867Z",
│    "uptime": 141.435781175,
│    "memory": {...},
│    "dependencies": {
│      "redis": "ok",
│      "database": "ok"
│    }
│  }
├─ Rate Limit: 10r/s (api zone)
└─ Uso: Monitoreo, Nginx upstream health
```

### 💳 Endpoints de Pago
```
POST /api/payment/...
├─ Servicio: paymentController
├─ Rutas:
│  ├─ /api/payment/epayco/charge
│  ├─ /api/payment/epayco/token
│  └─ /api/payment/daimo/...
├─ Autenticación: NINGUNA (webhooks de pago)
├─ Rate Limit: 20r/s (api zone)
└─ Uso: Procesamiento de pagos, checkout
```

### 🔔 Webhooks
```
POST /api/webhook/epayco
├─ Servicio: webhookController.processEpaycoWebhook()
├─ Origen: ePayco Payment Gateway
├─ Payload: x_transaction_state, x_amount, x_customer_email
├─ Procesa:
│  ├─ Transacciones pendientes → completadas
│  ├─ Activación de suscripciones
│  ├─ Envío de emails
│  └─ Actualización de estatus de usuario
├─ Autenticación: NINGUNA (verificación por IP ePayco)
├─ Rate Limit: 10r/s (api zone)
└─ Crítico: NO puede fallar (pagos reales)
```

### 🔓 Autenticación Telegram
```
GET /api/telegram-auth/callback?hash=XXX&...
├─ Servicio: telegramAuthHandler
├─ Flujo:
│  ├─ 1. Usuario hace clic en "Login with Telegram"
│  ├─ 2. Telegram redirige con datos + hash
│  ├─ 3. Backend verifica hash (HMAC-SHA256)
│  ├─ 4. Crea/Actualiza sesión
│  ├─ 5. Redirige a /hub/ o URL guardada
│  └─ 6. Cookie de sesión set-via header
├─ Autenticación: Verificación HMAC (no JWT)
├─ Rate Limit: 5r/s (auth zone)
├─ Session: Redis store, TTL 7 días
└─ Cookie: __pnptv_sid (httpOnly, secure, sameSite=lax)
```

### ✅ Auth Status (Verificación de Sesión)
```
GET /api/auth/status
├─ Servicio: authController.checkAuthStatus()
├─ Parámetros: NINGUNO (usa cookies de sesión)
├─ Response:
│  {
│    "success": true,
│    "data": {
│      "authenticated": false,
│      "user": null
│    }
│  }
├─ Autenticación: NO (pero retorna estado actual)
└─ Uso: Verificación de sesión en frontend
```

---

## 3. RUTAS PROTEGIDAS (Requieren Autenticación)

### Middleware de Autenticación
```
┌─ auth_request /api/webapp/auth/verify (Nginx)
│  └─ Valida sesión via cookies
│     ├─ 200 = Permitir acceso
│     ├─ 401/403 = Redirect a /auth/
│     └─ Timeout = Error 504
│
└─ authenticateUser (Express)
   ├─ Verifica req.session.user.id
   ├─ O verifica Bearer token JWT
   └─ Retorna 401 si falla
```

### 📊 Hub Principal (App Dashboard)
```
GET /hub/
├─ Servicio: Static SPA (React 18 + Vite)
├─ Archivo: /public/hub/index.html
├─ Autenticación: ✅ REQUERIDA (auth_request)
├─ Flujo Desautenticado:
│  ├─ 1. GET /hub/
│  ├─ 2. Nginx auth_request → /api/webapp/auth/verify
│  ├─ 3. Express retorna 401
│  ├─ 4. Nginx error_page 401 → @auth_failed
│  ├─ 5. Redirige: 302 /auth/?redirect=/hub/
│  └─ 6. Usuario ve login page
├─ Servicios Backend:
│  ├─ Socket.IO (conexiones real-time)
│  ├─ User Profile Service
│  ├─ Feed Service
│  ├─ Social Features (like, comment, share)
│  └─ Notification Service
├─ Assets:
│  ├─ index-XXXXX.js (1.6MB → 455KB gzipped)
│  ├─ index-XXXXX.css (29.3KB → 5.78KB gzipped)
│  └─ vendor-XXXXX.js (162KB → 53.17KB gzipped)
├─ Cache: 1 hora (immutable para assets con hash)
├─ Rate Limit: 30r/s (api zone, para endpoints)
└─ Rate Limit: 60r/15min (general page)
```

### 🎬 Media - Videorama
```
GET /media/videorama/
├─ Servicio: Static SPA (React + Vite)
├─ Archivo: /public/videorama/index.html
├─ Autenticación: ✅ REQUERIDA
├─ Features:
│  ├─ Video Library
│  ├─ Featured Content (4-card collage)
│  │  ├─ Latest Prime Video
│  │  ├─ Latest Videorama Video
│  │  ├─ Active Live Stream
│  │  └─ Most Active Hangout
│  ├─ Search & Filter
│  └─ Playback Controls
├─ API Endpoints:
│  ├─ GET /api/videos (lista con filtros)
│  ├─ GET /api/videos/:id (detalle)
│  ├─ GET /api/featured-content (collage)
│  └─ POST /api/watch-history (rastreo)
├─ Rate Limit: 30r/s
└─ Cache: 1 hora
```

### 📻 Media - Radio Live
```
GET /media/live/
├─ Servicio: Static SPA (Agora RTC)
├─ Archivo: /public/live/index.html
├─ Autenticación: ✅ REQUERIDA
├─ Features:
│  ├─ Live Streaming
│  ├─ Multiple Streams
│  ├─ Chat Real-time
│  ├─ Listener Count
│  └─ Quality Selection
├─ Backend Services:
│  ├─ liveController (stream management)
│  ├─ Socket.IO (live chat)
│  ├─ Agora RTC (video codec H.264)
│  └─ Redis (listener count cache)
├─ Rate Limit: 30r/s
└─ WebSocket: Conexión persistente
```

### 🎵 Media - Radio
```
GET /media/radio/
├─ Servicio: Static SPA
├─ Archivo: /public/radio/index.html
├─ Autenticación: ✅ REQUERIDA
├─ Features:
│  ├─ 24/7 Live Radio
│  ├─ Listener Tracking
│  ├─ Now Playing Info
│  ├─ 3-Tab System:
│  │  ├─ History (últimas 20 canciones)
│  │  ├─ Queue (próximas canciones)
│  │  └─ Requests (solicitudes de oyentes)
│  └─ Request Form
├─ API Endpoints:
│  ├─ GET /api/radio/now-playing (actualiza cada 5s)
│  ├─ GET /api/radio/history
│  ├─ GET /api/radio/queue
│  ├─ GET /api/radio/requests
│  └─ POST /api/radio/request (enviar solicitud)
├─ Backend Service: radioController
├─ Listener Count Polling: 5s interval
└─ Rate Limit: 30r/s
```

### 👥 Hangouts (Salas Comunitarias)
```
GET /hangouts/
├─ Servicio: Static SPA (Agora RTC)
├─ Archivo: /public/hangouts/index.html
├─ Autenticación: ✅ REQUERIDA
├─ Features:
│  ├─ Video Rooms
│  ├─ Text Chat
│  ├─ Member List
│  ├─ User Presence
│  └─ Room Management
├─ Backend Services:
│  ├─ hangoutsController
│  ├─ roomService (crear/join salas)
│  ├─ memberService (tracking usuarios)
│  ├─ Socket.IO (real-time events)
│  └─ Agora RTC (video/audio)
├─ API Endpoints:
│  ├─ GET /api/hangouts (listar salas)
│  ├─ POST /api/hangouts/create
│  ├─ POST /api/hangouts/:id/join
│  ├─ POST /api/hangouts/:id/leave
│  └─ GET /api/hangouts/:id/members
├─ Rate Limit: 30r/s
└─ WebSocket: Conexión persistente
```

### 🎪 Portal de Usuario
```
GET /portal/
├─ Servicio: Static SPA
├─ Archivo: /public/portal/index.html
├─ Autenticación: ✅ REQUERIDA
├─ Features:
│  ├─ User Profile
│  ├─ Subscription Management
│  ├─ Payment History
│  ├─ Settings & Preferences
│  ├─ Account Security
│  └─ Withdrawal/Payouts
├─ Backend Services:
│  ├─ userManagementController
│  ├─ subscriptionController
│  ├─ paymentHistoryService
│  └─ accountSecurityService
├─ Rate Limit: 30r/s
└─ Cache: 1 hora (para datos no sensibles)
```

---

## 4. API ENDPOINTS PROTEGIDOS (/api/webapp/)

### 👤 User Management
```
GET /api/webapp/user/profile
├─ Servicio: userManagementController
├─ Autenticación: ✅ JWT o Session
├─ Response: User object
│  {
│    "id": "user-uuid",
│    "email": "user@example.com",
│    "name": "John Doe",
│    "avatar": "https://...",
│    "subscription_status": "active",
│    "plan": "premium",
│    "created_at": "2026-01-01T...",
│    "location_sharing_enabled": false
│  }
├─ Rate Limit: 30r/s
└─ Cache: 5 minutos (Redis)

PUT /api/webapp/user/profile
├─ Servicio: userManagementController
├─ Campos Actualizables:
│  ├─ name
│  ├─ bio
│  ├─ avatar (file upload)
│  ├─ location_sharing_enabled
│  └─ language preference
├─ Rate Limit: 10r/s
└─ Validación: Sanitización XSS

GET /api/webapp/user/subscription
├─ Servicio: subscriptionController
├─ Response: Subscription details
│  {
│    "status": "active|expired|pending",
│    "plan": "week_pass|three_months|lifetime",
│    "expiry_date": "2026-03-01T...",
│    "auto_renewal": true,
│    "payment_method": "epayco|daimo"
│  }
└─ Rate Limit: 30r/s
```

### 📝 Social Features
```
POST /api/webapp/feed/like
├─ Servicio: socialController
├─ Body: { post_id: "uuid" }
├─ Autenticación: ✅ REQUERIDA
├─ Response: { likes_count: 42 }
├─ Rate Limit: 30r/s
└─ Optimistic Update en frontend

POST /api/webapp/feed/comment
├─ Servicio: socialController
├─ Body: { post_id: "uuid", text: "..." }
├─ Validación: Max 500 chars, sanitize HTML
├─ Notificación: Real-time via Socket.IO
└─ Rate Limit: 20r/s

GET /api/webapp/feed
├─ Servicio: feedController
├─ Query: { page: 1, limit: 20, sort: "recent" }
├─ Response: Array of posts
├─ Caching: 2 minutos (Redis)
└─ Rate Limit: 30r/s
```

### 🔔 Notifications
```
GET /api/webapp/notifications
├─ Servicio: notificationService
├─ Response: Array de notificaciones
├─ Rate Limit: 30r/s
└─ WebSocket: Real-time push via Socket.IO

POST /api/webapp/notifications/mark-read
├─ Servicio: notificationService
├─ Rate Limit: 20r/s
└─ Updates Redis cache
```

### ⚙️ Settings
```
GET /api/webapp/settings
├─ Servicio: settingsController
├─ Response: User preferences
│  {
│    "email_notifications": true,
│    "push_notifications": true,
│    "dark_mode": true,
│    "language": "es",
│    "location_precision": 3,
│    "privacy_mode": false
│  }
└─ Rate Limit: 30r/s

PUT /api/webapp/settings
├─ Servicio: settingsController
├─ Rate Limit: 10r/s
└─ Auditar cambios en audit log
```

---

## 5. SERVICIOS BACKEND (Node.js)

### Core Services

| Servicio | Archivo | Función |
|----------|---------|---------|
| **authController** | `api/controllers/authController.js` | Login/Logout, auth status checks |
| **userManagementController** | `api/controllers/userManagementController.js` | User profile CRUD |
| **webhookController** | `api/controllers/webhookController.js` | ePayco webhook processing |
| **paymentController** | `api/controllers/paymentController.js` | Payment endpoints |
| **subscriptionController** | `api/controllers/subscriptionController.js` | Subscription management |
| **feedController** | `api/controllers/feedController.js` | Social feed, posts |
| **socialController** | `api/controllers/socialController.js` | Likes, comments, shares |
| **liveController** | `api/controllers/liveController.js` | Live streaming management |
| **hangoutsController** | `api/controllers/hangoutsController.js` | Video room management |
| **radioController** | `api/controllers/radioController.js` | Radio stream management |
| **nearbyController** | `api/controllers/nearbyController.js` | Location-based features |

### Business Logic Services

| Servicio | Archivo | Función |
|----------|---------|---------|
| **UserService** | `bot/services/userService.js` | User entity management, subscriptions |
| **PaymentService** | `bot/services/paymentService.js` | ePayco integration, charge creation |
| **PaymentRecoveryService** | `bot/services/paymentRecoveryService.js` | Stuck payment recovery, 3DS handling |
| **MembershipCleanupService** | `bot/services/membershipCleanupService.js` | Status sync, expired member cleanup |
| **VisaCybersourceService** | `bot/services/visaCybersourceService.js` | Recurring payment processing |
| **MediaCleanupService** | `bot/services/mediaCleanupService.js` | Avatar/media file cleanup |
| **TutorialReminderService** | `bot/services/tutorialReminderService.js` | Health tips scheduling |
| **CultEventService** | `bot/services/cultEventService.js` | Event reminders |
| **PermissionService** | `bot/services/permissionService.js` | Admin/role checks |
| **NearbyService** | `bot/services/nearbyService.js` | Geolocation with privacy (3 decimals) |

### Middleware

| Middleware | Archivo | Función |
|-----------|---------|---------|
| **authenticateUser** | `api/middleware/auth.js` | JWT/Session validation |
| **errorHandler** | `api/middleware/errorHandler.js` | Global error handling |
| **auditLogger** | `api/middleware/auditLogger.js` | Action logging (fixed IP use req.ip) |
| **cors** | Helmet | CORS whitelist (5 dominios) |
| **rateLimiter** | express-rate-limit | Rate limiting |
| **requirePageAuth** | `api/routes.js` | Page-level auth check |

---

## 6. EXTERNAL INTEGRATIONS

### 📱 Telegram Bot
```
Webhook: POST https://roadtopnptv.online/webhook/telegram
├─ Servicio: Telegraf bot + webhook mode
├─ Procesa:
│  ├─ /start → Menu principal
│  ├─ /menu → Opciones
│  ├─ /admin → Panel admin
│  ├─ /stats → Estadísticas
│  └─ User messages
├─ Respuestas: Inline keyboards, menus
└─ Database: Sync con PostgreSQL

Webhook Host: easybots.store (backup domain)
Port: 8000 (config via environment)
```

### 💳 ePayco Payment Gateway
```
API: https://api.epayco.co/
├─ Servicio: epayco-sdk-node v1.4.4
├─ Endpoints:
│  ├─ POST /payment/v1/charge/create → charge()
│  ├─ GET /payment/v1/charge/:uid → charge.get()
│  ├─ POST /subscription/v1/create → subscriptions()
│  ├─ POST /customer/v1/create → customers()
│  └─ POST /plan/v1/create → plans()
├─ Webhook: POST /api/webhook/epayco
│  └─ x_transaction_state, x_ref_payco, x_amount
├─ 3DS Handling:
│  ├─ Configurado en Dashboard (no API parameter)
│  ├─ Response: "Pendiente" + URL redirect
│  ├─ User completes 3DS en banco
│  └─ Webhook notifica resultado
├─ Test Mode: EPAYCO_TEST_MODE env var
│  ├─ true → Sandbox (test cards)
│  └─ false → Live (real cards)
└─ Shared Client: getEpaycoClient() in config/epayco.js
```

### 🎥 Agora Real-time Communication
```
SDK: AgoraRTC Web SDK
├─ Servicios:
│  ├─ Video Streaming (live.pnptv.app)
│  ├─ Video Rooms (hangouts.pnptv.app)
│  └─ Audio only (radio alternative)
├─ Codec: H.264 (VP9 fallback)
├─ RTM: Real-time messaging for presence
└─ Token Generation: Backend → Client
```

### 📧 Email Service
```
Provider: nodemailer
├─ Usar: Sendgrid o SMTP
├─ Triggers:
│  ├─ Welcome email (registro)
│  ├─ Subscription confirmation
│  ├─ Payment receipt
│  ├─ Subscription renewal
│  └─ Account alerts
└─ Fallback Email Chain:
   x_customer_email → user.email → subscriber.email
```

### 📊 Error Tracking
```
Sentry Integration:
├─ Servicio: @sentry/node
├─ Captura:
│  ├─ Uncaught exceptions
│  ├─ API errors (5xx)
│  ├─ Payment failures
│  ├─ Database timeouts
│  └─ Performance issues
├─ Sampling: 10% en producción
└─ Dashboard: alerts en real-time
```

---

## 7. CRON JOBS (Automatización)

```
PAYMENT_RECOVERY_CRON: 0 */2 * * * (cada 2 horas)
├─ Servicio: PaymentRecoveryService.processStuckPayments()
├─ Busca: Pagos pending > 10 min, < 24h
├─ Valida: En ePayco API
└─ Acción: Replay webhook si completado

PAYMENT_CLEANUP_CRON: 0 0 * * * (medianoche)
├─ Servicio: PaymentRecoveryService.cleanupAbandonedPayments()
├─ Marca: Pagos > 24h como "abandoned"
└─ Previene: 3DS timeout hangs

MEMBERSHIP_CLEANUP_CRON: 0 0 * * * (medianoche)
├─ Servicio: MembershipCleanupService.runFullCleanup()
├─ Actualiza: user_status (active/churned/free)
└─ Ejecuta: Kicks expired users de PRIME channel

MEMBERSHIP_SYNC_CRON: 0 6,18 * * * (6 AM y 6 PM UTC)
├─ Servicio: MembershipCleanupService.syncAllMembershipStatuses()
├─ Valida: plan_expiry vs estado actual
└─ Sincroniza: Base de datos + cache Redis

SUBSCRIPTION_CHECK_CRON: 0 6 * * * (6 AM UTC)
├─ Servicio: UserService.processExpiredSubscriptions()
├─ Legacy: Kept for backwards compatibility
└─ Procesa: Expired suscripciones

MEDIA_CLEANUP_CRON: 0 3 * * * (3 AM UTC)
├─ Servicio: MediaCleanupService
├─ Limpia: Avatars > 30 días
├─ Limpia: Post media > 90 días
└─ Ahorra: Storage costs

CULT_EVENT_REMINDERS_CRON: 0 15 * * * (3 PM UTC)
├─ Servicio: CultEventService.processReminders()
├─ Envía: Telegram messages a usuarios
└─ Usa: Bot instance

RECURRING_PAYMENTS_CRON: 0 8 * * * (8 AM UTC)
├─ Servicio: VisaCybersourceService.processDuePayments()
├─ Cobra: Tarjetas de suscripciones renovables
└─ Webhook: Notifica resultados

RECURRING_RETRY_CRON: 0 14 * * * (2 PM UTC)
├─ Servicio: VisaCybersourceService.processDuePayments()
├─ Reintenta: Pagos que fallaron en la mañana
└─ Timeout: Máximo 2 reintentos
```

---

## 8. FLUJOS CRÍTICOS

### 🔓 Flujo de Login
```
1. Usuario accede /auth/
   └─ GET /auth/ → HTTP/2 200 (login.html)

2. Usuario hace clic "Telegram Login"
   └─ window.Telegram.Login.auth()

3. Telegram redirige callback
   └─ GET /api/telegram-auth/callback?hash=X&...

4. Backend verifica hash
   ├─ Calcula HMAC-SHA256
   ├─ Compara con hash del cliente
   ├─ Valida timestamp (< 5 minutos)
   └─ Si falla: error 401

5. Crea/Actualiza usuario en PostgreSQL
   ├─ username
   ├─ telegram_id
   ├─ avatar_url
   └─ phone_number

6. Crea sesión en Redis
   ├─ sessionId = random UUID
   ├─ TTL = 7 días
   └─ Datos: { userId, name, avatar }

7. Set-Cookie header
   ├─ Cookie: __pnptv_sid=sessionId
   ├─ secure=true (HTTPS only)
   ├─ httpOnly=true (no JS access)
   ├─ sameSite=lax
   └─ rolling=true (refresh TTL)

8. Redirige a /hub/
   └─ Preserva redirect parameter si existe
```

### 💳 Flujo de Pago (ePayco)
```
1. Usuario selecciona plan (week_pass, etc.)
   └─ POST /api/payment/epayco/charge

2. Backend crea charge en ePayco
   ├─ SDK.charge.create({
   │    ref_payco: "unique-ref",
   │    description: "Plan SKU",
   │    value: amount,
   │    email: user.email,
   │    ip: req.ip,
   │    ...
   │  })
   └─ Response: { id, estado, url_response_bank }

3. Si 3DS requerido
   ├─ estado = "Pendiente"
   ├─ URL = ePayco dashboard o banco
   └─ User redirected para completar

4. User completa 3DS en banco
   └─ Banco valida authenticación

5. ePayco webhook notifica resultado
   ├─ POST /api/webhook/epayco
   ├─ x_transaction_state: "Aceptada" / "Rechazada"
   ├─ x_ref_payco: "XXXX-XXXXX"
   └─ x_amount: 9999

6. Backend procesa webhook
   ├─ UPDATE payment SET estado = x_transaction_state
   ├─ CREATE suscripción si "Aceptada"
   ├─ ENVÍA email confirmación
   ├─ REPLICA webhook si perdido (recovery service)
   └─ UPDATE user.plan

7. Frontend notificado
   ├─ Socket.IO event "payment_completed"
   └─ Redirect a /hub/ o thankyou page
```

### 🔄 Flujo de Recuperación de Pago (Stuck)
```
1. Cron ejecuta cada 2 horas
   └─ PaymentRecoveryService.processStuckPayments()

2. Busca pagos en estado pending
   ├─ created_at < 24 horas
   ├─ updated_at > 10 minutos sin cambio
   └─ Query PostgreSQL

3. Para cada pago, consulta ePayco
   ├─ SDK.charge.get(ref_payco)
   ├─ Obtiene estado real en ePayco
   └─ Si falta en BD local

4. Si completado en ePayco pero pending en BD
   ├─ Actualiza DB a "Aceptada"
   ├─ Crea suscripción
   ├─ REPLAYS webhook internamente
   ├─ Envía email
   └─ LOG: "Payment recovered"

5. Si > 24 horas y aún pending
   ├─ Marca como "abandoned"
   ├─ Crea notificación al usuario
   └─ Puede reintentar desde /portal/
```

---

## 9. SECURITY LAYERS

```
┌────────────────────────────────────────────┐
│ Layer 1: HTTPS/TLS (Nginx)                 │
│ • Let's Encrypt certificates               │
│ • HSTS headers                             │
│ • OCSP stapling                            │
└────────────────────────────────────────────┘
          ↓
┌────────────────────────────────────────────┐
│ Layer 2: Rate Limiting (Nginx)             │
│ • 10r/s para /api/                         │
│ • 2r/s para /api/auth/                     │
│ • 60r/15min para páginas                   │
└────────────────────────────────────────────┘
          ↓
┌────────────────────────────────────────────┐
│ Layer 3: CORS Whitelist                    │
│ • pnptv.app                                │
│ • t.me (Telegram)                          │
│ • localhost (dev)                          │
└────────────────────────────────────────────┘
          ↓
┌────────────────────────────────────────────┐
│ Layer 4: Authentication                    │
│ • Session validation (Redis)               │
│ • JWT verification                         │
│ • HMAC-SHA256 (Telegram)                   │
└────────────────────────────────────────────┘
          ↓
┌────────────────────────────────────────────┐
│ Layer 5: Authorization                     │
│ • Role-based (admin/user/model)            │
│ • Resource ownership checks                │
│ • Permission service                       │
└────────────────────────────────────────────┘
          ↓
┌────────────────────────────────────────────┐
│ Layer 6: Data Protection                   │
│ • geolocation redondeo (3 decimales)       │
│ • GDPR compliant (opt-in location)         │
│ • audit log (con IP real vía req.ip)       │
└────────────────────────────────────────────┘
```

---

## 10. MONITOREO Y ALERTAS

### Health Indicators
```
GET /health
├─ Redis connection
├─ PostgreSQL connection
├─ Memory usage
├─ Uptime
└─ Version

Monitoreo:
├─ Nginx: tail /var/log/nginx/pnptv-error.log
├─ App: pm2 logs pnptv-bot --follow
├─ DB: SELECT * FROM pg_stat_activity
├─ Redis: redis-cli ping
└─ Sentry: dashboard.sentry.io
```

### Alertas Críticas
```
Payment webhook failures → Email admin
Login failures (> 10/min) → Rate limit trigger
Database connection pool exhausted → Restart needed
Memory > 80% → Restart PM2
Subscription expiry check failures → Manual review
```

---

## 11. DEPLOYMENT TOPOLOGY

```
┌─────────────────────────────────────┐
│         INTERNET (Users)             │
└──────────────────┬──────────────────┘
                   │ HTTPS/HTTP2
                   ▼
┌─────────────────────────────────────┐
│     Nginx (pnptv.app:443)            │
│  • Reverse proxy                     │
│  • SSL/TLS termination               │
│  • Rate limiting                     │
│  • Static files serving              │
│  • auth_request middleware           │
└──────────────────┬──────────────────┘
                   │ HTTP/1.1 (keepalive)
                   │ 127.0.0.1:3001
                   ▼
┌─────────────────────────────────────┐
│  Node.js Express + Telegraf (PM2)    │
│  • PID: 1417106                      │
│  • 1 fork process                    │
│  • Graceful shutdown (30s timeout)   │
└──────────────────┬──────────────────┘
      ┌────────────┼────────────┐
      ▼            ▼            ▼
  ┌────────┐  ┌────────┐  ┌────────┐
  │ Redis  │  │  PgSQL │  │ ePayco │
  │ :6379  │  │ :5432  │  │ (ext)  │
  └────────┘  └────────┘  └────────┘
```

---

**Última Actualización:** Febrero 21, 2026
**Estado:** ✅ Production Ready
**Versión:** 1.0.0
