# 📚 PNPtv Bot - Documentación Completa

## Tabla de Contenidos
1. [Introducción](#introducción)
2. [Características](#características)
3. [Arquitectura](#arquitectura)
4. [Instalación](#instalación)
5. [Configuración](#configuración)
6. [Sistema de Pagos](#sistema-de-pagos)
7. [Webhooks](#webhooks)
8. [Base de Datos](#base-de-datos)
9. [API REST](#api-rest)
10. [Comandos Bot](#comandos-bot)
11. [Modulación y Características](#modulación-y-características)
12. [Seguridad](#seguridad)
13. [Deploy](#deploy)
14. [Troubleshooting](#troubleshooting)

---

## Introducción

**PNPtv Bot** es un bot de Telegram avanzado que proporciona:
- Gestión de suscripciones premium
- Sistema de pagos integrado (ePayco & Daimo Pay)
- Llamadas de video privadas
- Streaming en vivo
- Radio en línea
- Sistema de moderación automática
- Análisis de usuarios
- Notificaciones inteligentes

**Stack Tecnológico:**
- **Backend:** Node.js 20.19.5
- **Base de Datos:** PostgreSQL 17
- **Cache:** Redis
- **Pagos:** ePayco & Daimo Pay (USDC en Optimism)
- **Hosting:** Nginx (reverse proxy)
- **Gestor de Procesos:** PM2

---

## Características

### 👥 Gestión de Usuarios
- Perfiles de usuario con información de ubicación
- Sistema de geoubicación (encuentra usuarios cercanos)
- Seguimiento de actividad
- Historial de pagos

### 💳 Sistema de Pagos
- **ePayco:** Transferencias bancarias directas (COP)
- **Daimo Pay:** Pagos en USDC (Zelle, CashApp, Venmo, Revolut, Wise)
- Validación de pago en tiempo real
- Confirmación automática de suscripción

### 📞 Llamadas de Video
- Llamadas privadas 1-a-1
- Videollamadas grupales
- Sistema de reserva de horarios
- Integración con Jitsi
- Integración con Zoom

### 📻 Radio en Línea
- Streaming de música en vivo
- Biblioteca de canciones personalizada
- Control remoto de reproducción
- Notificaciones de canciones

### 🎬 Streaming en Vivo
- Integración con Hangouts
- Chat en vivo
- Control de participantes
- Grabación de sesiones

### 🛡️ Moderación Automática
- Detección de spam
- Bloqueo de usuarios no autorizados
- Límite de mensajes por minuto
- Validación de perfiles
- Sistema de baneos globales

### 🎮 Gamificación
- Sistema de puntos
- Logros y badges
- Leaderboards
- Recompensas

---

## Arquitectura

### Estructura del Proyecto

```
/root/pnptvbot-production/
├── src/
│   ├── bot/
│   │   ├── api/              # Rutas HTTP & Controllers
│   │   ├── handlers/         # Manejadores de eventos
│   │   ├── middleware/       # Middleware de autenticación
│   │   ├── services/         # Lógica de negocio
│   │   └── core/            # Núcleo del bot
│   ├── config/               # Configuraciones
│   ├── models/               # Modelos de datos
│   ├── utils/                # Utilidades
│   └── services/             # Servicios adicionales
├── tests/                    # Pruebas unitarias e integración
├── public/                   # Archivos estáticos (HTML, CSS)
├── database/                 # Scripts de base de datos
├── deployment/               # Guías de despliegue
├── ecosystem.config.js       # Configuración PM2
├── package.json
└── jest.config.js
```

### Flujo de Datos

```
Usuario de Telegram
        ↓
   Bot Telegram
        ↓
  Webhook Handler
        ↓
  Command/Event Handler
        ↓
  Business Logic (Services)
        ↓
  Database/Cache
        ↓
  Response
        ↓
   Usuario de Telegram
```

### Componentes Principales

1. **Bot Core** (`src/index.js`)
   - Inicializa el bot de Telegram
   - Registra handlers
   - Conecta a base de datos

2. **API REST** (`src/bot/api/routes.js`)
   - Endpoints para webhooks
   - Gestión de pagos
   - Información de salud

3. **Handlers** (`src/bot/handlers/`)
   - Menu handler
   - Moderation handler
   - Payment handler
   - Media handler

4. **Services** (`src/bot/services/`)
   - UserService
   - PaymentService
   - DaimoService
   - EmailService

5. **Models** (`src/models/`)
   - UserModel
   - PaymentModel
   - PlanModel
   - SubscriptionModel

---

## Instalación

### Requisitos Previos
- Node.js 20.19.5
- PostgreSQL 17
- Redis 6+
- Nginx (para reverse proxy)

### Paso 1: Clonar Repositorio
```bash
git clone https://github.com/carlossmartdevices-cyber/pnptvbot-production.git
cd pnptvbot-production
```

### Paso 2: Instalar Dependencias
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install --production=false
```

### Paso 3: Configurar Variables de Entorno
```bash
cp .env.example .env
# Editar .env con configuraciones específicas
nano .env
```

### Paso 4: Inicializar Base de Datos
```bash
npm run db:init
# o
PGPASSWORD='password' psql -h localhost -p 55432 -U pnptvbot -d pnptvbot -f database/schema.sql
```

### Paso 5: Ejecutar Tests
```bash
npm test
# Esperado: 244/244 tests passing
```

### Paso 6: Iniciar Bot
```bash
# Desarrollo
npm run dev

# Producción con PM2
pm2 start ecosystem.config.js
pm2 logs pnptvbot
```

---

## Configuración

### Variables de Entorno (.env)

#### Bot Configuration
```env
BOT_TOKEN=8499797477:AAFd47T8VUneD6inhu7B83TO2a_GIODOHAs
BOT_USERNAME=PNPtvbot
BOT_WEBHOOK_DOMAIN=https://easybots.store
BOT_WEBHOOK_PATH=/webhook/telegram
```

#### PostgreSQL
```env
POSTGRES_HOST=localhost
POSTGRES_PORT=55432
POSTGRES_DATABASE=pnptvbot
POSTGRES_USER=pnptvbot
POSTGRES_PASSWORD=Apelo801050#
POSTGRES_SSL=true
POSTGRES_POOL_MIN=2
POSTGRES_POOL_MAX=20
```

#### Redis
```env
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TTL=300
```

#### ePayco Payment
```env
EPAYCO_PUBLIC_KEY=6d5c47f6a632c0bacd5bb31990d4e994
EPAYCO_PRIVATE_KEY=c3b7fa0d75e65dd28804fb9c18989693
EPAYCO_P_CUST_ID=1565511
EPAYCO_P_KEY=4ae1e189c9af6a730b71bc4f15546b78520ad338
EPAYCO_TEST_MODE=false
```

#### Daimo Pay Configuration
```env
DAIMO_API_KEY=pay-televisionlatina-VxZH9SQoHYasAoQmdWKuUw
DAIMO_APP_ID=televisionlatina
DAIMO_TREASURY_ADDRESS=0xcaf17dbbccc0e9ac87dad1af1f2fe3ba3a4d0613
DAIMO_REFUND_ADDRESS=0xcaf17dbbccc0e9ac87dad1af1f2fe3ba3a4d0613
DAIMO_WEBHOOK_SECRET=0x9af864a03261f4e14db063ad86e3e17dc144ba53...
```

#### AI & Services
```env
MISTRAL_API_KEY=6GW5czFojR4qKhgHgv0G5JDDZ9M7Axm3
SENTRY_DSN=https://3dcb63c48d2240a0e5e31bda64f8d10c@...
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_USER=hello@easybots.store
SMTP_PASSWORD=password
```

---

## Sistema de Pagos

### Flujo de Pago ePayco

```
1. Usuario selecciona plan
   ↓
2. Se crea registro de pago (pending)
   ↓
3. Se genera referencia de pago (PAY-XXXXX)
   ↓
4. Usuario redirigido a página de checkout ePayco
   ↓
5. Usuario completa pago
   ↓
6. ePayco envía webhook a /api/webhooks/epayco
   ↓
7. Validamos y actualizamos estado a "completed"
   ↓
8. Activamos suscripción del usuario
   ↓
9. Enviamos confirmación al usuario
```

### Flujo de Pago Daimo

```
1. Usuario selecciona plan
   ↓
2. Se crea registro de pago (pending)
   ↓
3. Se genera "payment intent" con metadata
   ↓
4. Usuario redirigido a Daimo Pay checkout
   ↓
5. Usuario selecciona app (Venmo, CashApp, Zelle, etc)
   ↓
6. Completa pago en USDC
   ↓
7. Daimo envía webhook a /api/webhooks/daimo
   ↓
8. Verificamos firma y metadata
   ↓
9. Activamos suscripción
   ↓
10. Enviamos confirmación
```

### Planes de Suscripción

```javascript
// Estructura de un plan
{
  id: "premium_monthly",
  name: "PREMIUM",
  display_name: "Premium Monthly",
  price: 10,                    // USD
  price_in_cop: 40000,         // COP
  duration: 30,                 // días
  features: ["video_calls", "live_streaming", "radio"],
  active: true
}
```

### Endpoints de Pago

```http
POST /api/payments/create
{
  "userId": 123456789,
  "planId": "premium_monthly",
  "provider": "epayco|daimo"
}

POST /api/webhooks/epayco
{
  "x_ref_payco": "ref_123",
  "x_transaction_state": "Aceptada",
  ...
}

POST /api/webhooks/daimo
{
  "id": "evt_123",
  "status": "payment_completed",
  "metadata": {...}
}
```

---

## Webhooks

### Webhook de Telegram

**Endpoint:** `POST https://easybots.store/webhook/telegram`

Recibe todos los eventos del bot de Telegram:
- Mensajes
- Callbacks de botones
- Comandos
- Reacciones

### Webhook de ePayco

**Endpoint:** `POST https://easybots.store/api/webhooks/epayco`

**Payload:**
```json
{
  "x_ref_payco": "123456789",
  "x_transaction_id": "987654321",
  "x_transaction_state": "Aceptada|Rechazada|Pendiente",
  "x_extra1": "payment_id",
  "x_extra2": "user_id",
  "x_extra3": "plan_id"
}
```

**Validación:**
- Verifica campos requeridos
- Valida estado de transacción
- Comprueba firma (si está disponible)

### Webhook de Daimo

**Endpoint:** `POST https://easybots.store/api/webhooks/daimo`

**Headers:**
```
x-daimo-signature: <HMAC-SHA256>
```

**Payload:**
```json
{
  "id": "evt_daimo_123",
  "status": "payment_completed|payment_bounced|payment_started",
  "source": {
    "payerAddress": "0x...",
    "txHash": "0x..."
  },
  "destination": {
    "toAddress": "0xcaf17dbbccc0e9ac87dad1af1f2fe3ba3a4d0613",
    "toToken": "USDC"
  },
  "metadata": {
    "userId": "123456789",
    "planId": "premium_monthly",
    "paymentId": "pay_123"
  }
}
```

**Validación:**
- Verifica firma HMAC-SHA256
- Valida estructura de metadata
- Comprueba direcciones de blockchain

---

## Base de Datos

### Esquema PostgreSQL

#### Tabla: users
```sql
CREATE TABLE users (
  id BIGINT PRIMARY KEY,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  username VARCHAR(255) UNIQUE,
  email VARCHAR(255),
  phone_number VARCHAR(20),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  bio TEXT,
  profile_photo_url VARCHAR(500),
  is_bot BOOLEAN DEFAULT FALSE,
  is_banned BOOLEAN DEFAULT FALSE,
  ban_reason VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Tabla: subscriptions
```sql
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  plan_id VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  auto_renew BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### Tabla: payments
```sql
CREATE TABLE payments (
  id VARCHAR(50) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  plan_id VARCHAR(100) NOT NULL,
  amount DECIMAL(10,2),
  currency VARCHAR(3),
  provider VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending',
  payment_reference VARCHAR(100),
  daimo_event_id VARCHAR(100),
  payment_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### Tabla: plans
```sql
CREATE TABLE plans (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255),
  display_name VARCHAR(255),
  description TEXT,
  price DECIMAL(10,2),
  price_in_cop DECIMAL(12,2),
  duration_days INTEGER,
  features JSONB,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Conexión a Base de Datos

```javascript
// src/config/postgres.js
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
  min: parseInt(process.env.POSTGRES_POOL_MIN),
  max: parseInt(process.env.POSTGRES_POOL_MAX)
});
```

### Migraciones

```bash
# Ejecutar todas las migraciones
npm run db:migrate

# Revertir última migración
npm run db:migrate:undo

# Ver estado de migraciones
npm run db:migrate:status
```

---

## API REST

### Endpoints Principales

#### 1. Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected",
  "timestamp": "2025-11-26T13:00:00Z"
}
```

#### 2. Crear Pago
```http
POST /api/payments/create
Content-Type: application/json

{
  "userId": 123456789,
  "planId": "premium_monthly",
  "provider": "epayco|daimo"
}
```

**Response:**
```json
{
  "success": true,
  "paymentId": "pay_123",
  "paymentUrl": "https://...",
  "provider": "epayco|daimo"
}
```

#### 3. Procesar Webhook ePayco
```http
POST /api/webhooks/epayco
Content-Type: application/x-www-form-urlencoded

x_ref_payco=...&x_transaction_state=Aceptada&...
```

#### 4. Procesar Webhook Daimo
```http
POST /api/webhooks/daimo
Content-Type: application/json
x-daimo-signature: <signature>

{
  "id": "evt_123",
  "status": "payment_completed",
  ...
}
```

#### 5. Obtener Información del Usuario
```http
GET /api/users/:userId
```

**Response:**
```json
{
  "id": 123456789,
  "username": "username",
  "firstName": "John",
  "subscription": {
    "planId": "premium_monthly",
    "expiresAt": "2025-12-26T00:00:00Z"
  }
}
```

---

## Comandos Bot

### Comandos Disponibles

| Comando | Descripción | Permisos |
|---------|-------------|----------|
| `/start` | Inicia el bot | Público |
| `/menu` | Muestra menú principal | Público |
| `/subscribe` | Ver planes de suscripción | Público |
| `/profile` | Ver/editar perfil | Usuario |
| `/nearby` | Encontrar usuarios cercanos | Premium |
| `/live` | Ver transmisiones en vivo | Premium |
| `/calls` | Gestionar llamadas privadas | Premium |
| `/radio` | Escuchar radio en línea | Premium |
| `/support` | Contactar soporte | Público |
| `/cancel` | Cancelar suscripción | Usuario |

### Ejemplo: Implementar Nuevo Comando

```javascript
// src/bot/handlers/user/index.js

const myNewCommand = async (ctx) => {
  try {
    const userId = ctx.from.id;
    const user = await UserModel.getById(userId);
    
    if (!user) {
      return ctx.reply('Usuario no encontrado');
    }
    
    // Lógica del comando
    const result = await doSomething(user);
    
    await ctx.reply(`Resultado: ${result}`);
  } catch (error) {
    logger.error('Error en comando:', error);
    await ctx.reply('Error procesando tu solicitud');
  }
};

module.exports = { myNewCommand };
```

---

## Modulación y Características

### Características Modulares

1. **Video Calls** (`src/bot/handlers/user/callManagement.js`)
   - Reserva de horarios
   - Gestión de disponibilidad
   - Notificaciones automáticas

2. **Live Streaming** (`src/bot/handlers/media/live.js`)
   - Transmisión en vivo
   - Chat en tiempo real
   - Control de participantes

3. **Radio** (`src/bot/handlers/media/radio.js`)
   - Streaming de música
   - Cola de reproducción
   - Notificaciones de canciones

4. **Moderation** (`src/bot/core/middleware/autoModeration.js`)
   - Detección de spam
   - Bloqueo de usuarios
   - Límites de mensajes

5. **Gamification** (`src/bot/handlers/admin/gamification.js`)
   - Sistema de puntos
   - Logros
   - Leaderboards

### Habilitar/Deshabilitar Características

```javascript
// src/bot/handlers/index.js

const features = {
  VIDEO_CALLS: process.env.FEATURE_VIDEO_CALLS !== 'false',
  LIVE_STREAMING: process.env.FEATURE_LIVE_STREAMING !== 'false',
  RADIO: process.env.FEATURE_RADIO !== 'false',
  GAMIFICATION: process.env.FEATURE_GAMIFICATION !== 'false'
};

if (features.VIDEO_CALLS) {
  bot.action('video_calls', callHandler);
}
```

---

## Seguridad

### Medidas de Seguridad Implementadas

1. **Validación de Entrada**
   - Todos los inputs validados con Joi
   - Sanitización de datos
   - Prevención de SQL injection

2. **Autenticación**
   - JWT tokens para API
   - Verificación de usuario de Telegram
   - Tokens de webhook

3. **Autorización**
   - Middleware de permisos
   - Control de acceso basado en rol (RBAC)
   - Verificación de suscripción

4. **Encriptación**
   - SSL/TLS en todas las conexiones
   - Datos sensibles encriptados en BD
   - Variables de entorno protegidas

5. **Rate Limiting**
   - 30 requests/min por usuario
   - Límite especial para webhooks
   - IP whitelist para endpoints críticos

6. **Logging y Monitoreo**
   - Todos los eventos registrados
   - Alertas de actividad sospechosa
   - Seguimiento de transacciones

### Validación de Pagos

```javascript
// Validación de webhook Daimo
const validateDaimoPayload = (payload) => {
  const requiredFields = ['id', 'status', 'metadata'];
  if (!requiredFields.every(f => f in payload)) {
    throw new Error('Invalid payload');
  }
  
  if (!payload.metadata.userId || !payload.metadata.planId) {
    throw new Error('Invalid metadata');
  }
  
  return true;
};
```

---

## Deploy

### Deploy a Producción

#### Opción 1: Con PM2

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar bot
pm2 start ecosystem.config.js

# Guardar configuración
pm2 save

# Autostart on boot
pm2 startup
```

#### Opción 2: Con Docker

```bash
# Construir imagen
docker build -t pnptvbot .

# Ejecutar contenedor
docker run -d \
  --name pnptvbot \
  --env-file .env \
  -p 3000:3000 \
  pnptvbot
```

#### Opción 3: Fresh Deploy sin Cache

```bash
cd /root/pnptvbot-production

# Limpiar cache
npm cache clean --force
rm -rf node_modules package-lock.json

# Instalar fresco
npm install

# Ejecutar tests
npm test

# Deploy con PM2
pm2 start ecosystem.config.js
pm2 logs pnptvbot
```

### Verificación Post-Deploy

```bash
# Verificar proceso
pm2 status

# Ver logs
pm2 logs pnptvbot

# Verificar salud
curl https://easybots.store/health

# Verificar conexiones
pm2 monit
```

### Rollback

```bash
# Revertir último commit
git revert HEAD

# Reinstalar
npm cache clean --force
rm -rf node_modules
npm install

# Reiniciar
pm2 restart pnptvbot
```

---

## Troubleshooting

### Problema: Bot no se conecta a PostgreSQL

**Síntomas:**
- Error: "ECONNREFUSED"
- Bot no inicia

**Solución:**
```bash
# 1. Verificar PostgreSQL está ejecutándose
pg_isready -h localhost -p 55432

# 2. Verificar credenciales
PGPASSWORD='password' psql -h localhost -p 55432 -U pnptvbot -d pnptvbot -c "SELECT 1;"

# 3. Verificar puerto
lsof -i :55432

# 4. Revisar .env
grep POSTGRES .env
```

### Problema: Webhooks no se reciben

**Síntomas:**
- Pagos pendientes
- Webhooks con timeout

**Solución:**
```bash
# 1. Verificar Nginx
sudo nginx -t
sudo systemctl reload nginx

# 2. Revisar configuración reversa
sudo cat /etc/nginx/sites-enabled/default | grep webhook

# 3. Verificar firewall
sudo ufw status

# 4. Revisar logs
pm2 logs pnptvbot | grep webhook
```

### Problema: Alto uso de memoria

**Síntomas:**
- Uso de memoria > 500MB
- Bot se congela

**Solución:**
```bash
# 1. Ver uso actual
pm2 monit

# 2. Revisar límite de conexiones BD
grep POOL .env

# 3. Limpiar cache Redis
redis-cli FLUSHDB

# 4. Reiniciar bot
pm2 restart pnptvbot

# 5. Monitorear
watch -n 1 'pm2 monit'
```

### Problema: Tests fallando

**Síntomas:**
- `npm test` devuelve errores
- Tests: "X failed, Y passed"

**Solución:**
```bash
# 1. Reinstalar dependencias
npm cache clean --force
rm -rf node_modules
npm install

# 2. Ejecutar test específico
npm test -- tests/unit/services/paymentService.test.js

# 3. Ver qué falla
npm test -- --verbose

# 4. Regenerar fixtures
npm run db:seed:test

# 5. Ejecutar nuevamente
npm test
```

### Problema: Error de transacción de pago

**Síntomas:**
- Pago rechazado
- Estado pendiente infinito

**Solución:**
```bash
# 1. Verificar endpoint del webhook
curl -X POST https://easybots.store/api/webhooks/epayco \
  -H "Content-Type: application/json" \
  -d '{"x_ref_payco":"test","x_transaction_state":"Aceptada"}'

# 2. Ver logs de pago
pm2 logs pnptvbot | grep -i "payment\|pago"

# 3. Verificar BD
PGPASSWORD='pwd' psql -c "SELECT * FROM payments WHERE status='pending';"

# 4. Actualizar estado manualmente (último recurso)
PGPASSWORD='pwd' psql -c "UPDATE payments SET status='completed' WHERE id='pay_123';"
```

---

## Recursos Adicionales

### Documentación Relacionada
- [Guía de Deploy](./REDEPLOY_GUIDE.md)
- [Daimo Pay Implementation](./DAIMO_IMPLEMENTATION_SUMMARY.md)
- [Changelog de Deployment](./CHANGELOG_DEPLOYMENT.md)
- [Quick Start](./QUICK_START_DEPLOY.md)

### Enlaces Útiles
- [Documentación de Telegram Bot API](https://core.telegram.org/bots/api)
- [ePayco API Docs](https://docs.epayco.co)
- [Daimo Pay Docs](https://paydocs.daimo.com)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Redis Docs](https://redis.io/documentation)

### Contacto y Soporte
- **Admin:** @admin_id
- **Support:** support@pnptv.app
- **Technical:** dev@easybots.store

---

**Última Actualización:** 26 de Noviembre de 2025  
**Versión:** 1.0.0  
**Estado:** Producción
