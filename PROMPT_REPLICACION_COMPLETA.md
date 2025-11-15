# PROMPT COMPLETO: REPLICACIÓN BOT TELEGRAM PNPTV - CERO A PRODUCCIÓN

## 📋 TABLA DE CONTENIDOS
1. [Descripción General](#descripción-general)
2. [Stack Tecnológico Exacto](#stack-tecnológico-exacto)
3. [Arquitectura del Sistema](#arquitectura-del-sistema)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Guía Paso a Paso de Implementación](#guía-paso-a-paso-de-implementación)
6. [Configuración de Variables de Entorno](#configuración-de-variables-de-entorno)
7. [Modelos de Datos](#modelos-de-datos)
8. [Funcionalidades Completas](#funcionalidades-completas)
9. [Patrones de Código](#patrones-de-código)
10. [Configuración de Despliegue](#configuración-de-despliegue)
11. [Seguridad y Mejores Prácticas](#seguridad-y-mejores-prácticas)
12. [Testing](#testing)

---

## 📖 DESCRIPCIÓN GENERAL

### Tipo de Aplicación
Bot de Telegram multiplataforma para entretenimiento social con funcionalidades premium.

### Propósito
Plataforma integral que combina:
- **Red social**: Descubrimiento de usuarios cercanos por geolocalización
- **Entretenimiento**: Radio 24/7, live streaming, videoconferencias Zoom
- **Monetización**: Sistema de suscripciones premium con pagos en USD y USDC
- **Soporte**: Asistente AI (Cristina) basado en GPT-4

### Características Clave
- ✅ Onboarding multiidioma (EN/ES)
- ✅ Sistema de perfiles con fotos, ubicación e intereses
- ✅ Geolocalización con búsqueda por radio
- ✅ Pagos integrados (ePayco USD + Daimo USDC)
- ✅ Radio streaming 24/7 con solicitud de canciones
- ✅ Salas Zoom públicas/privadas
- ✅ Live streaming con Agora
- ✅ Chat con IA GPT-4
- ✅ Panel administrativo completo
- ✅ Rate limiting y seguridad
- ✅ Caché multinivel (Redis)
- ✅ Logging estructurado con rotación
- ✅ Monitoreo de errores (Sentry)
- ✅ Dockerizado y listo para producción

---

## 🔧 STACK TECNOLÓGICO EXACTO

### Runtime y Lenguaje
```json
{
  "node": ">=18.0.0",
  "npm": ">=9.0.0",
  "language": "JavaScript ES6+"
}
```

### Dependencias de Producción (package.json)
```json
{
  "dependencies": {
    "@google-cloud/firestore": "^7.1.0",
    "@sentry/node": "^7.99.0",
    "agora-access-token": "^2.0.4",
    "axios": "^1.6.5",
    "bcrypt": "^5.1.1",
    "compression": "^1.7.4",
    "cors": "^2.8.5",
    "crypto-js": "^4.2.0",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.5",
    "firebase-admin": "^12.0.0",
    "geolib": "^3.3.4",
    "helmet": "^7.1.0",
    "i18next": "^23.7.16",
    "ioredis": "^5.3.2",
    "joi": "^17.11.0",
    "jsonwebtoken": "^9.0.2",
    "moment": "^2.30.1",
    "moment-timezone": "^0.5.45",
    "morgan": "^1.10.0",
    "multer": "^1.4.5-lts.1",
    "node-cron": "^3.0.3",
    "node-geocoder": "^4.3.0",
    "openai": "^4.24.7",
    "qrcode": "^1.5.3",
    "rate-limiter-flexible": "^5.0.0",
    "redis": "^4.6.12",
    "sharp": "^0.33.2",
    "stripe": "^14.12.0",
    "swagger-jsdoc": "^6.2.8",
    "swagger-ui-express": "^5.0.0",
    "telegraf": "^4.15.0",
    "uuid": "^9.0.1",
    "validator": "^13.11.0",
    "winston": "^3.11.0",
    "winston-daily-rotate-file": "^4.7.1"
  },
  "devDependencies": {
    "@types/jest": "^29.5.11",
    "axios-mock-adapter": "^2.1.0",
    "eslint": "^8.56.0",
    "eslint-config-airbnb-base": "^15.0.0",
    "eslint-plugin-import": "^2.29.1",
    "jest": "^29.7.0",
    "nodemon": "^3.0.2",
    "supertest": "^6.3.4"
  }
}
```

### Infraestructura
- **Base de datos principal**: Firebase Firestore (NoSQL)
- **Caché**: Redis 7.x (ioredis)
- **Servidor web**: Express 4.18.2
- **Framework Telegram**: Telegraf 4.15.0
- **Contenedores**: Docker + Docker Compose

### APIs Externas
- **OpenAI**: GPT-4 Turbo (`gpt-4-turbo-preview`)
- **Zoom API**: Videoconferencias
- **Agora**: Live streaming
- **ePayco**: Pagos en USD
- **Daimo**: Pagos en USDC
- **Sentry**: Monitoreo de errores
- **Google Geocoding**: Geolocalización

---

## 🏗️ ARQUITECTURA DEL SISTEMA

### Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────┐
│              USUARIOS TELEGRAM                      │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│           TELEGRAM BOT API                          │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
  [WEBHOOK]              [POLLING]
  (Producción)           (Desarrollo)
        │                     │
        └─────────┬───────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│     EXPRESS SERVER (Puerto 3000)                    │
│  ┌──────────────────────────────────────────────┐   │
│  │ Middleware Stack:                            │   │
│  │ 1. helmet (seguridad headers)                │   │
│  │ 2. cors (CORS)                               │   │
│  │ 3. compression (compresión gzip)             │   │
│  │ 4. express.json() (body parser)              │   │
│  │ 5. morgan (logging HTTP)                     │   │
│  │ 6. express-rate-limit (API endpoints)        │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Routes:                                             │
│  - POST /webhook/telegram  → Bot webhook            │
│  - POST /api/webhooks/epayco → Webhook ePayco       │
│  - POST /api/webhooks/daimo → Webhook Daimo         │
│  - GET  /health            → Health check           │
│  - GET  /api/stats         → Estadísticas públicas  │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│        TELEGRAF BOT INSTANCE                        │
│  ┌──────────────────────────────────────────────┐   │
│  │ Middleware Global:                           │   │
│  │ 1. Session (Redis/Memoria)                   │   │
│  │ 2. Rate Limit (30 req/min por usuario)       │   │
│  │ 3. Error Handler                             │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Handlers:                                           │
│  ├── User: onboarding, menu, profile, nearby        │
│  ├── Admin: panel, stats, broadcast, gestión        │
│  ├── Payments: planes, checkout, webhooks           │
│  └── Media: radio, zoom, live, support              │
└──────────────────┬───────────────────────────────────┘
                   │
      ┌────────────┴─────────────┐
      │                          │
      ▼                          ▼
┌─────────────┐           ┌─────────────┐
│  SERVICES   │◄──────────┤   MODELS    │
│ ─────────── │           │ ─────────── │
│ userSvc     │           │ userModel   │
│ paymentSvc  │           │ planModel   │
│ cacheSvc    │           │ paymentModel│
└──────┬──────┘           └──────┬──────┘
       │                         │
       ▼                         ▼
┌─────────────────────────────────────────┐
│       DATA LAYER                        │
│  ┌────────────┐    ┌────────────┐      │
│  │ Firestore  │    │   Redis    │      │
│  │ (Firebase) │    │ (Cache +   │      │
│  │            │    │  Sessions) │      │
│  │ users      │    │            │      │
│  │ plans      │    │ user:{id}  │      │
│  │ payments   │    │ session:*  │      │
│  │ streams    │    │ nearby:*   │      │
│  │ zoomRooms  │    │ stats:*    │      │
│  └────────────┘    └────────────┘      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│     EXTERNAL SERVICES                   │
│  ┌──────────────────────────────────┐   │
│  │ OpenAI GPT-4 (AI Cristina)      │   │
│  │ Zoom API (Videoconferencias)    │   │
│  │ Agora (Live Streaming)           │   │
│  │ ePayco (Pagos USD)               │   │
│  │ Daimo (Pagos USDC)               │   │
│  │ Sentry (Error Tracking)          │   │
│  │ Google Geocoding (Geoloc)        │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Flujo de Procesamiento

```
1. Mensaje Usuario → Telegram Bot API
2. Telegram → Webhook (POST) → Express
3. Express → Telegraf middleware chain
4. Session middleware → Cargar sesión de Redis
5. Rate limit → Verificar límites (30 req/min)
6. Handler → Procesar comando/callback
7. Service → Lógica de negocio
8. Model → CRUD en Firestore/Redis
9. Response → Handler → Telegraf → Telegram
10. Usuario recibe respuesta
```

---

## 📁 ESTRUCTURA DEL PROYECTO

### Árbol de Directorios Completo

```
pnptvbot-production/
│
├── src/
│   ├── bot/
│   │   ├── core/
│   │   │   ├── bot.js                         # ⭐ Entry point principal
│   │   │   ├── middleware/
│   │   │   │   ├── session.js                 # Sesiones Redis
│   │   │   │   ├── rateLimit.js               # Rate limiting por usuario
│   │   │   │   └── errorHandler.js            # Error handler global
│   │   │   └── plugins/
│   │   │       └── sentry.js                  # Integración Sentry
│   │   │
│   │   ├── handlers/
│   │   │   ├── user/
│   │   │   │   ├── index.js                   # Registro de handlers
│   │   │   │   ├── onboarding.js              # ⭐ Flujo onboarding
│   │   │   │   ├── menu.js                    # Menú principal
│   │   │   │   ├── profile.js                 # Gestión perfil
│   │   │   │   ├── nearby.js                  # Usuarios cercanos
│   │   │   │   └── settings.js                # Configuración usuario
│   │   │   │
│   │   │   ├── admin/
│   │   │   │   └── index.js                   # ⭐ Panel admin completo
│   │   │   │
│   │   │   ├── payments/
│   │   │   │   └── index.js                   # ⭐ Suscripciones y pagos
│   │   │   │
│   │   │   └── media/
│   │   │       ├── index.js                   # Registro media handlers
│   │   │       ├── radio.js                   # Radio 24/7
│   │   │       ├── zoom.js                    # Salas Zoom
│   │   │       ├── live.js                    # Live streaming
│   │   │       └── support.js                 # AI + soporte
│   │   │
│   │   ├── services/
│   │   │   ├── userService.js                 # Lógica negocio usuarios
│   │   │   ├── paymentService.js              # ⭐ Procesamiento pagos
│   │   │   └── cacheService.js                # Cache helpers
│   │   │
│   │   ├── api/
│   │   │   ├── routes.js                      # ⭐ Express server principal
│   │   │   ├── controllers/
│   │   │   │   └── webhookController.js       # ⭐ Webhooks ePayco/Daimo
│   │   │   └── middleware/
│   │   │       └── errorHandler.js            # Error handlers API
│   │   │
│   │   └── utils/
│   │       └── helpers.js                     # Utilidades generales
│   │
│   ├── models/
│   │   ├── userModel.js                       # ⭐ Modelo usuarios
│   │   ├── planModel.js                       # Modelo planes suscripción
│   │   └── paymentModel.js                    # Modelo transacciones
│   │
│   ├── config/
│   │   ├── firebase.js                        # ⭐ Config Firebase
│   │   └── redis.js                           # ⭐ Config Redis
│   │
│   └── utils/
│       ├── logger.js                          # ⭐ Winston logging
│       ├── i18n.js                            # ⭐ Traducciones EN/ES
│       ├── validation.js                      # Validación inputs
│       ├── errors.js                          # Custom errors
│       └── envValidator.js                    # Validación env vars
│
├── scripts/
│   ├── cron.js                                # Tareas programadas
│   ├── seed.js                                # Seed DB planes
│   ├── migrate.js                             # Migraciones
│   └── validate-indexes.js                    # Validar índices Firestore
│
├── tests/
│   ├── unit/
│   │   ├── models/
│   │   ├── services/
│   │   └── utils/
│   └── integration/
│       ├── handlers/
│       └── api/
│
├── docs/
│   ├── API.md
│   ├── DEPLOYMENT.md
│   └── ARCHITECTURE.md
│
├── logs/                                      # Logs rotatorios (gitignore)
├── uploads/                                   # Uploads temporales (gitignore)
│
├── .env.example                               # ⭐ Template variables
├── .env                                       # Variables locales (gitignore)
├── .gitignore
├── .eslintrc.js
├── package.json                               # ⭐ Dependencias
├── package-lock.json
├── Dockerfile                                 # ⭐ Docker build
├── docker-compose.yml                         # ⭐ Orquestación
├── .dockerignore
├── jest.config.js
├── README.md
└── PROMPT_REPLICACION_COMPLETA.md             # Este archivo
```

---

## 🚀 GUÍA PASO A PASO DE IMPLEMENTACIÓN

### FASE 1: CONFIGURACIÓN INICIAL

#### 1.1 Crear Proyecto y Estructura

```bash
# Crear directorio
mkdir pnptvbot-production
cd pnptvbot-production

# Inicializar npm
npm init -y

# Crear estructura de carpetas
mkdir -p src/{bot/{core/{middleware,plugins},handlers/{user,admin,payments,media},services,api/{controllers,middleware},utils},models,config,utils}
mkdir -p scripts tests/{unit,integration} docs logs uploads

# Crear archivos principales
touch src/bot/core/bot.js
touch src/config/{firebase.js,redis.js}
touch src/utils/{logger.js,i18n.js,validation.js,errors.js,envValidator.js}
touch .env.example .gitignore README.md
touch Dockerfile docker-compose.yml
```

#### 1.2 Instalar Dependencias

```bash
# Producción
npm install @google-cloud/firestore@^7.1.0 \
  @sentry/node@^7.99.0 \
  agora-access-token@^2.0.4 \
  axios@^1.6.5 \
  bcrypt@^5.1.1 \
  compression@^1.7.4 \
  cors@^2.8.5 \
  crypto-js@^4.2.0 \
  dotenv@^16.3.1 \
  express@^4.18.2 \
  express-rate-limit@^7.1.5 \
  firebase-admin@^12.0.0 \
  geolib@^3.3.4 \
  helmet@^7.1.0 \
  i18next@^23.7.16 \
  ioredis@^5.3.2 \
  joi@^17.11.0 \
  jsonwebtoken@^9.0.2 \
  moment@^2.30.1 \
  moment-timezone@^0.5.45 \
  morgan@^1.10.0 \
  multer@^1.4.5-lts.1 \
  node-cron@^3.0.3 \
  node-geocoder@^4.3.0 \
  openai@^4.24.7 \
  qrcode@^1.5.3 \
  rate-limiter-flexible@^5.0.0 \
  redis@^4.6.12 \
  sharp@^0.33.2 \
  stripe@^14.12.0 \
  swagger-jsdoc@^6.2.8 \
  swagger-ui-express@^5.0.0 \
  telegraf@^4.15.0 \
  uuid@^9.0.1 \
  validator@^13.11.0 \
  winston@^3.11.0 \
  winston-daily-rotate-file@^4.7.1

# Desarrollo
npm install --save-dev @types/jest@^29.5.11 \
  axios-mock-adapter@^2.1.0 \
  eslint@^8.56.0 \
  eslint-config-airbnb-base@^15.0.0 \
  eslint-plugin-import@^2.29.1 \
  jest@^29.7.0 \
  nodemon@^3.0.2 \
  supertest@^6.3.4
```

#### 1.3 Configurar package.json

```json
{
  "name": "pnptv-telegram-bot",
  "version": "1.0.0",
  "description": "Bot de Telegram para PNPtv con funciones premium",
  "main": "src/bot/core/bot.js",
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  },
  "scripts": {
    "start": "node src/bot/core/bot.js",
    "dev": "nodemon src/bot/core/bot.js",
    "test": "jest --coverage",
    "test:unit": "jest --testMatch='**/unit/**/*.test.js' --coverage",
    "test:integration": "jest --testMatch='**/integration/**/*.test.js' --detectOpenHandles --forceExit",
    "test:watch": "jest --watch",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "seed": "node scripts/seed.js",
    "validate:env": "node -e \"require('./src/utils/envValidator').validateEnv()\"",
    "validate:indexes": "node scripts/validate-indexes.js",
    "prestart": "npm run validate:env"
  },
  "keywords": ["telegram", "bot", "pnptv", "payments", "streaming"],
  "author": "Tu Nombre",
  "license": "MIT"
}
```

### FASE 2: CONFIGURACIÓN DE SERVICIOS

#### 2.1 Configurar Firebase (src/config/firebase.js)

```javascript
const admin = require('firebase-admin');
const logger = require('../utils/logger');

let db = null;
let initialized = false;

/**
 * Inicializar Firebase Admin SDK
 */
const initializeFirebase = () => {
  if (initialized) {
    logger.warn('Firebase already initialized');
    return db;
  }

  try {
    // Validar variables requeridas
    const requiredVars = ['FIREBASE_PROJECT_ID', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL'];
    const missing = requiredVars.filter(v => !process.env[v]);

    if (missing.length > 0) {
      throw new Error(`Missing Firebase env vars: ${missing.join(', ')}`);
    }

    // Preparar private key (escapar \n)
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

    // Inicializar Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: privateKey,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });

    db = admin.firestore();

    // Configuraciones de Firestore
    db.settings({
      ignoreUndefinedProperties: true,
      timestampsInSnapshots: true,
    });

    initialized = true;
    logger.info('✓ Firebase initialized successfully');

    return db;
  } catch (error) {
    logger.error('Failed to initialize Firebase:', error);
    throw error;
  }
};

/**
 * Obtener instancia de Firestore
 */
const getFirestore = () => {
  if (!initialized) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return db;
};

/**
 * Obtener Admin SDK
 */
const getAdmin = () => admin;

module.exports = {
  initializeFirebase,
  getFirestore,
  getAdmin,
};
```

#### 2.2 Configurar Redis (src/config/redis.js)

```javascript
const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient = null;
let isConnected = false;

/**
 * Inicializar cliente Redis
 */
const initializeRedis = () => {
  if (redisClient) {
    logger.warn('Redis already initialized');
    return redisClient;
  }

  try {
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    };

    redisClient = new Redis(redisConfig);

    // Event handlers
    redisClient.on('connect', () => {
      logger.info('✓ Redis connecting...');
    });

    redisClient.on('ready', () => {
      isConnected = true;
      logger.info('✓ Redis connected and ready');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis error:', err);
      isConnected = false;
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
      isConnected = false;
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    throw error;
  }
};

/**
 * Obtener cliente Redis
 */
const getRedis = () => {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call initializeRedis() first.');
  }
  return redisClient;
};

/**
 * Cache helper functions
 */
const cache = {
  /**
   * Get value from cache
   */
  async get(key) {
    try {
      if (!isConnected) return null;
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  },

  /**
   * Set value in cache with TTL
   */
  async set(key, value, ttl = 300) {
    try {
      if (!isConnected) return false;
      await redisClient.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  },

  /**
   * Delete key from cache
   */
  async del(key) {
    try {
      if (!isConnected) return false;
      await redisClient.del(key);
      return true;
    } catch (error) {
      logger.error('Cache del error:', error);
      return false;
    }
  },

  /**
   * Delete keys by pattern (non-blocking SCAN)
   */
  async delPattern(pattern) {
    try {
      if (!isConnected) return false;
      const stream = redisClient.scanStream({ match: pattern, count: 100 });
      const pipeline = redisClient.pipeline();
      let keysDeleted = 0;

      stream.on('data', (keys) => {
        if (keys.length) {
          keys.forEach((key) => pipeline.del(key));
          keysDeleted += keys.length;
        }
      });

      await new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      if (keysDeleted > 0) {
        await pipeline.exec();
      }

      logger.debug(`Deleted ${keysDeleted} keys matching ${pattern}`);
      return true;
    } catch (error) {
      logger.error('Cache delPattern error:', error);
      return false;
    }
  },

  /**
   * Check if key exists
   */
  async exists(key) {
    try {
      if (!isConnected) return false;
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  },

  /**
   * Increment counter
   */
  async incr(key, ttl = null) {
    try {
      if (!isConnected) return 0;
      const value = await redisClient.incr(key);
      if (ttl && value === 1) {
        await redisClient.expire(key, ttl);
      }
      return value;
    } catch (error) {
      logger.error('Cache incr error:', error);
      return 0;
    }
  },

  /**
   * Set if not exists (idempotency)
   */
  async setNX(key, value, ttl = 300) {
    try {
      if (!isConnected) return false;
      const result = await redisClient.set(key, JSON.stringify(value), 'EX', ttl, 'NX');
      return result === 'OK';
    } catch (error) {
      logger.error('Cache setNX error:', error);
      return false;
    }
  },

  /**
   * Acquire distributed lock
   */
  async acquireLock(key, ttl = 120) {
    const lockKey = `lock:${key}`;
    const lockValue = Date.now().toString();
    const acquired = await this.setNX(lockKey, lockValue, ttl);
    return acquired ? lockValue : null;
  },

  /**
   * Release distributed lock
   */
  async releaseLock(key) {
    const lockKey = `lock:${key}`;
    await this.del(lockKey);
  },

  /**
   * Get or set (cache-aside pattern)
   */
  async getOrSet(key, fetchFunction, ttl = 300) {
    // Try to get from cache
    let value = await this.get(key);

    if (value !== null) {
      return value;
    }

    // Fetch from source
    value = await fetchFunction();

    // Store in cache
    if (value !== null && value !== undefined) {
      await this.set(key, value, ttl);
    }

    return value;
  },
};

module.exports = {
  initializeRedis,
  getRedis,
  cache,
};
```

#### 2.3 Configurar Logger (src/utils/logger.js)

```javascript
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logLevel = process.env.LOG_LEVEL || 'info';
const logDir = process.env.LOG_DIR || './logs';

// Formato personalizado
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

// Transports
const transports = [
  // Console
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(
        ({ timestamp, level, message, ...meta }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
          }
          return msg;
        },
      ),
    ),
  }),

  // File - All logs
  new DailyRotateFile({
    filename: `${logDir}/combined-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: customFormat,
  }),

  // File - Error logs only
  new DailyRotateFile({
    level: 'error',
    filename: `${logDir}/error-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    format: customFormat,
  }),
];

// Crear logger
const logger = winston.createLogger({
  level: logLevel,
  format: customFormat,
  transports,
  exitOnError: false,
});

module.exports = logger;
```

#### 2.4 Configurar i18n (src/utils/i18n.js)

```javascript
const i18next = require('i18next');

// Traducciones
const resources = {
  en: {
    translation: {
      // Onboarding
      languageSelected: 'Language set to English 🇺🇸',
      ageConfirmation: '🔞 Are you 18 years or older?',
      ageConfirmYes: 'Yes, I\'m 18+',
      ageConfirmNo: 'No',
      underAge: 'Sorry, you must be 18 or older to use this bot.',
      termsAndPrivacy: '📄 Please read and accept our Terms of Service and Privacy Policy:',
      termsAccepted: '✅ Terms accepted!',
      emailPrompt: '📧 Would you like to provide your email? (Optional)',
      skipEmail: 'Skip',
      emailReceived: '✅ Email received!',
      onboardingComplete: '🎉 Welcome to PNPtv! Let\'s get started.',
      invalidInput: '❌ Invalid input.',
      confirm: 'I Accept',

      // Menu
      mainMenu: '🏠 *Main Menu*\n\nWhat would you like to do?',
      subscribeToPrime: '💎 Subscribe to PRIME',
      myProfile: '👤 My Profile',
      nearbyUsers: '🌍 Nearby Users',
      liveStreams: '🎤 Live Streams',
      radio: '📻 Radio',
      zoomRooms: '🎥 Zoom Rooms',
      support: '🤖 Support',
      settings: '⚙️ Settings',

      // Subscriptions
      chooseYourPlan: '💎 *Choose Your Plan*\n\nSelect a subscription plan:',
      selectPaymentMethod: '💳 *Select Payment Method*',
      payWithEpayco: '💳 Pay with ePayco (USD)',
      payWithDaimo: '💰 Pay with Daimo (USDC)',
      subscriptionActivated: '✅ Subscription activated successfully!',
      paymentFailed: '❌ Payment failed. Please try again.',

      // Support
      supportMenu: '🤖 *Support Center*\n\nHow can we help you?',
      chatWithAI: '💬 Chat with Cristina AI',
      contactAdmin: '👨‍💼 Contact Admin',
      faq: '❓ FAQs',

      // Common
      back: '◀️ Back',
      cancel: 'Cancel',
      loading: 'Loading...',
      error: '❌ An error occurred. Please try again.',
    },
  },
  es: {
    translation: {
      // Onboarding
      languageSelected: 'Idioma configurado a Español 🇪🇸',
      ageConfirmation: '🔞 ¿Eres mayor de 18 años?',
      ageConfirmYes: 'Sí, soy mayor de 18',
      ageConfirmNo: 'No',
      underAge: 'Lo sentimos, debes tener 18 años o más para usar este bot.',
      termsAndPrivacy: '📄 Por favor lee y acepta nuestros Términos de Servicio y Política de Privacidad:',
      termsAccepted: '✅ ¡Términos aceptados!',
      emailPrompt: '📧 ¿Te gustaría proporcionar tu email? (Opcional)',
      skipEmail: 'Omitir',
      emailReceived: '✅ ¡Email recibido!',
      onboardingComplete: '🎉 ¡Bienvenido a PNPtv! Comencemos.',
      invalidInput: '❌ Entrada inválida.',
      confirm: 'Acepto',

      // Menu
      mainMenu: '🏠 *Menú Principal*\n\n¿Qué te gustaría hacer?',
      subscribeToPrime: '💎 Suscribirse a PRIME',
      myProfile: '👤 Mi Perfil',
      nearbyUsers: '🌍 Usuarios Cercanos',
      liveStreams: '🎤 Transmisiones en Vivo',
      radio: '📻 Radio',
      zoomRooms: '🎥 Salas Zoom',
      support: '🤖 Soporte',
      settings: '⚙️ Configuración',

      // Subscriptions
      chooseYourPlan: '💎 *Elige Tu Plan*\n\nSelecciona un plan de suscripción:',
      selectPaymentMethod: '💳 *Selecciona Método de Pago*',
      payWithEpayco: '💳 Pagar con ePayco (USD)',
      payWithDaimo: '💰 Pagar con Daimo (USDC)',
      subscriptionActivated: '✅ ¡Suscripción activada exitosamente!',
      paymentFailed: '❌ Pago fallido. Por favor intenta de nuevo.',

      // Support
      supportMenu: '🤖 *Centro de Soporte*\n\n¿Cómo podemos ayudarte?',
      chatWithAI: '💬 Chat con Cristina AI',
      contactAdmin: '👨‍💼 Contactar Admin',
      faq: '❓ Preguntas Frecuentes',

      // Common
      back: '◀️ Atrás',
      cancel: 'Cancelar',
      loading: 'Cargando...',
      error: '❌ Ocurrió un error. Por favor intenta de nuevo.',
    },
  },
};

// Inicializar i18next
i18next.init({
  lng: 'en',
  fallbackLng: 'en',
  resources,
  interpolation: {
    escapeValue: false,
  },
});

/**
 * Obtener traducción
 * @param {string} key - Clave de traducción
 * @param {string} lang - Idioma (en|es)
 * @param {Object} options - Opciones de interpolación
 */
const t = (key, lang = 'en', options = {}) => {
  return i18next.t(key, { lng: lang, ...options });
};

module.exports = { t, i18next };
```

### FASE 3: MODELOS DE DATOS

#### 3.1 User Model (src/models/userModel.js)

```javascript
const { getFirestore } = require('../config/firebase');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

const COLLECTION = 'users';

class UserModel {
  /**
   * Crear o actualizar usuario
   */
  static async createOrUpdate(userData) {
    try {
      const db = getFirestore();
      const userId = userData.userId.toString();
      const userRef = db.collection(COLLECTION).doc(userId);

      const timestamp = new Date();
      const data = {
        ...userData,
        updatedAt: timestamp,
      };

      const doc = await userRef.get();
      if (!doc.exists) {
        data.createdAt = timestamp;
        data.subscriptionStatus = 'free';
        data.language = userData.language || 'en';
        data.onboardingComplete = false;
      }

      await userRef.set(data, { merge: true });
      await cache.del(`user:${userId}`);

      logger.info('User created/updated', { userId });
      return data;
    } catch (error) {
      logger.error('Error creating/updating user:', error);
      throw error;
    }
  }

  /**
   * Obtener usuario por ID (con caché)
   */
  static async getById(userId) {
    try {
      const cacheKey = `user:${userId}`;

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();
          const doc = await db.collection(COLLECTION).doc(userId.toString()).get();

          if (!doc.exists) {
            return null;
          }

          return { id: doc.id, ...doc.data() };
        },
        600, // 10 minutos
      );
    } catch (error) {
      logger.error('Error getting user:', error);
      return null;
    }
  }

  /**
   * Actualizar perfil
   */
  static async updateProfile(userId, updates) {
    try {
      const db = getFirestore();
      const userRef = db.collection(COLLECTION).doc(userId.toString());

      await userRef.update({
        ...updates,
        updatedAt: new Date(),
      });

      await cache.del(`user:${userId}`);

      logger.info('User profile updated', { userId, updates });
      return true;
    } catch (error) {
      logger.error('Error updating user profile:', error);
      return false;
    }
  }

  /**
   * Actualizar suscripción
   */
  static async updateSubscription(userId, subscription) {
    try {
      const db = getFirestore();
      const userRef = db.collection(COLLECTION).doc(userId.toString());

      await userRef.update({
        subscriptionStatus: subscription.status,
        planId: subscription.planId,
        planExpiry: subscription.expiry,
        updatedAt: new Date(),
      });

      await cache.del(`user:${userId}`);
      await cache.delPattern('nearby:*');

      logger.info('User subscription updated', { userId, subscription });
      return true;
    } catch (error) {
      logger.error('Error updating subscription:', error);
      return false;
    }
  }

  /**
   * Obtener usuarios cercanos
   */
  static async getNearby(location, radiusKm = 10) {
    try {
      const lat = Math.round(location.lat * 100) / 100;
      const lng = Math.round(location.lng * 100) / 100;
      const cacheKey = `nearby:${lat},${lng}:${radiusKm}`;

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();

          const snapshot = await db.collection(COLLECTION)
            .where('location', '!=', null)
            .where('subscriptionStatus', 'in', ['active', 'free'])
            .limit(100)
            .get();

          const users = [];
          snapshot.forEach((doc) => {
            const userData = { id: doc.id, ...doc.data() };
            if (userData.location) {
              const distance = this.calculateDistance(
                location.lat,
                location.lng,
                userData.location.lat,
                userData.location.lng,
              );
              if (distance <= radiusKm) {
                users.push({ ...userData, distance });
              }
            }
          });

          users.sort((a, b) => a.distance - b.distance);

          logger.info(`Found ${users.length} nearby users`);
          return users;
        },
        300, // 5 minutos
      );
    } catch (error) {
      logger.error('Error getting nearby users:', error);
      return [];
    }
  }

  /**
   * Calcular distancia (Haversine)
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2))
      * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static toRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Obtener estadísticas
   */
  static async getStatistics() {
    try {
      const cacheKey = 'stats:users';

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();

          const totalSnapshot = await db.collection(COLLECTION).count().get();
          const total = totalSnapshot.data().count;

          const premiumSnapshot = await db.collection(COLLECTION)
            .where('subscriptionStatus', '==', 'active')
            .count()
            .get();
          const premium = premiumSnapshot.data().count;

          const free = total - premium;
          const conversionRate = total > 0 ? (premium / total) * 100 : 0;

          return {
            total,
            premium,
            free,
            conversionRate: Math.round(conversionRate * 100) / 100,
            timestamp: new Date().toISOString(),
          };
        },
        60, // 1 minuto
      );
    } catch (error) {
      logger.error('Error getting statistics:', error);
      return { total: 0, premium: 0, free: 0, conversionRate: 0 };
    }
  }

  /**
   * Obtener suscripciones expiradas
   */
  static async getExpiredSubscriptions() {
    try {
      const db = getFirestore();
      const now = new Date();

      const snapshot = await db.collection(COLLECTION)
        .where('subscriptionStatus', '==', 'active')
        .where('planExpiry', '<=', now)
        .get();

      const users = [];
      snapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
      });

      return users;
    } catch (error) {
      logger.error('Error getting expired subscriptions:', error);
      return [];
    }
  }
}

module.exports = UserModel;
```

#### 3.2 Plan Model (src/models/planModel.js)

```javascript
const { getFirestore } = require('../config/firebase');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

const COLLECTION = 'plans';

class PlanModel {
  /**
   * Crear plan
   */
  static async create(planData) {
    try {
      const db = getFirestore();
      const planRef = db.collection(COLLECTION).doc(planData.id);

      const data = {
        ...planData,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await planRef.set(data);
      await cache.del('plans:all');

      logger.info('Plan created', { planId: planData.id });
      return data;
    } catch (error) {
      logger.error('Error creating plan:', error);
      throw error;
    }
  }

  /**
   * Obtener plan por ID
   */
  static async getById(planId) {
    try {
      const cacheKey = `plan:${planId}`;

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();
          const doc = await db.collection(COLLECTION).doc(planId).get();

          if (!doc.exists) {
            return null;
          }

          return { id: doc.id, ...doc.data() };
        },
        3600, // 1 hora
      );
    } catch (error) {
      logger.error('Error getting plan:', error);
      return null;
    }
  }

  /**
   * Obtener todos los planes activos
   */
  static async getAll() {
    try {
      const cacheKey = 'plans:all';

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();
          const snapshot = await db.collection(COLLECTION)
            .where('active', '==', true)
            .orderBy('price', 'asc')
            .get();

          const plans = [];
          snapshot.forEach((doc) => {
            plans.push({ id: doc.id, ...doc.data() });
          });

          return plans;
        },
        3600, // 1 hora
      );
    } catch (error) {
      logger.error('Error getting plans:', error);
      return [];
    }
  }

  /**
   * Prewarm cache
   */
  static async prewarmCache() {
    try {
      await this.getAll();
      logger.info('Plans cache prewarmed');
    } catch (error) {
      logger.error('Error prewarming plans cache:', error);
    }
  }

  /**
   * Actualizar plan
   */
  static async update(planId, updates) {
    try {
      const db = getFirestore();
      const planRef = db.collection(COLLECTION).doc(planId);

      await planRef.update({
        ...updates,
        updatedAt: new Date(),
      });

      await cache.del(`plan:${planId}`);
      await cache.del('plans:all');

      logger.info('Plan updated', { planId, updates });
      return true;
    } catch (error) {
      logger.error('Error updating plan:', error);
      return false;
    }
  }
}

module.exports = PlanModel;
```

#### 3.3 Payment Model (src/models/paymentModel.js)

```javascript
const { getFirestore } = require('../config/firebase');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const COLLECTION = 'payments';

class PaymentModel {
  /**
   * Crear pago
   */
  static async create(paymentData) {
    try {
      const db = getFirestore();
      const paymentId = uuidv4();
      const paymentRef = db.collection(COLLECTION).doc(paymentId);

      const data = {
        id: paymentId,
        ...paymentData,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await paymentRef.set(data);

      logger.info('Payment created', { paymentId, userId: paymentData.userId });
      return data;
    } catch (error) {
      logger.error('Error creating payment:', error);
      throw error;
    }
  }

  /**
   * Obtener pago por ID
   */
  static async getById(paymentId) {
    try {
      const db = getFirestore();
      const doc = await db.collection(COLLECTION).doc(paymentId).get();

      if (!doc.exists) {
        return null;
      }

      return { id: doc.id, ...doc.data() };
    } catch (error) {
      logger.error('Error getting payment:', error);
      return null;
    }
  }

  /**
   * Obtener pago por transaction ID
   */
  static async getByTransactionId(transactionId, provider) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(COLLECTION)
        .where('transactionId', '==', transactionId)
        .where('provider', '==', provider)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      logger.error('Error getting payment by transaction ID:', error);
      return null;
    }
  }

  /**
   * Actualizar estado del pago
   */
  static async updateStatus(paymentId, status, transactionId = null, metadata = {}) {
    try {
      const db = getFirestore();
      const paymentRef = db.collection(COLLECTION).doc(paymentId);

      const updates = {
        status,
        updatedAt: new Date(),
        ...metadata,
      };

      if (transactionId) {
        updates.transactionId = transactionId;
      }

      if (status === 'success') {
        updates.completedAt = new Date();
      }

      await paymentRef.update(updates);

      logger.info('Payment status updated', { paymentId, status });
      return true;
    } catch (error) {
      logger.error('Error updating payment status:', error);
      return false;
    }
  }

  /**
   * Obtener historial de pagos de usuario
   */
  static async getByUserId(userId, limit = 10) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(COLLECTION)
        .where('userId', '==', userId.toString())
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const payments = [];
      snapshot.forEach((doc) => {
        payments.push({ id: doc.id, ...doc.data() });
      });

      return payments;
    } catch (error) {
      logger.error('Error getting payments by user:', error);
      return [];
    }
  }
}

module.exports = PaymentModel;
```

### FASE 4: BOT PRINCIPAL Y MIDDLEWARE

#### 4.1 Bot Principal (src/bot/core/bot.js)

```javascript
require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const { initializeFirebase } = require('../../config/firebase');
const { initializeRedis } = require('../../config/redis');
const { initSentry } = require('./plugins/sentry');
const sessionMiddleware = require('./middleware/session');
const rateLimitMiddleware = require('./middleware/rateLimit');
const errorHandler = require('./middleware/errorHandler');
const logger = require('../../utils/logger');

// Handlers
const registerUserHandlers = require('../handlers/user');
const registerAdminHandlers = require('../handlers/admin');
const registerPaymentHandlers = require('../handlers/payments');
const registerMediaHandlers = require('../handlers/media');

// Models
const PlanModel = require('../../models/planModel');

// API Server
const apiApp = require('../api/routes');

/**
 * Validar variables críticas
 */
const validateCriticalEnvVars = () => {
  const criticalVars = [
    'BOT_TOKEN',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_CLIENT_EMAIL'
  ];
  const missing = criticalVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    logger.error(`Missing critical environment variables: ${missing.join(', ')}`);
    throw new Error(`Missing critical environment variables: ${missing.join(', ')}`);
  }
};

/**
 * Iniciar bot
 */
const startBot = async () => {
  try {
    logger.info('Starting PNPtv Telegram Bot...');

    // Validar variables
    validateCriticalEnvVars();
    logger.info('✓ Environment variables validated');

    // Inicializar Sentry (opcional)
    initSentry();

    // Inicializar Firebase
    try {
      initializeFirebase();
      logger.info('✓ Firebase initialized');
    } catch (error) {
      logger.error('Failed to initialize Firebase');
      throw error;
    }

    // Inicializar Redis
    try {
      initializeRedis();
      logger.info('✓ Redis initialized');

      // Prewarm cache
      try {
        await PlanModel.prewarmCache();
        logger.info('✓ Cache prewarmed');
      } catch (cacheError) {
        logger.warn('Cache prewarming failed:', cacheError.message);
      }
    } catch (error) {
      logger.warn('Redis initialization failed, continuing without cache:', error.message);
    }

    // Crear bot
    const bot = new Telegraf(process.env.BOT_TOKEN);

    // Registrar middleware
    bot.use(sessionMiddleware());
    bot.use(rateLimitMiddleware());

    // Registrar handlers
    registerUserHandlers(bot);
    registerAdminHandlers(bot);
    registerPaymentHandlers(bot);
    registerMediaHandlers(bot);

    // Error handling
    bot.catch(errorHandler);

    // Iniciar bot
    if (process.env.NODE_ENV === 'production' && process.env.BOT_WEBHOOK_DOMAIN) {
      // Webhook mode (producción)
      const webhookPath = process.env.BOT_WEBHOOK_PATH || '/webhook/telegram';
      const webhookUrl = `${process.env.BOT_WEBHOOK_DOMAIN}${webhookPath}`;

      await bot.telegram.setWebhook(webhookUrl);
      logger.info(`✓ Webhook set to: ${webhookUrl}`);

      // Registrar webhook callback ANTES del 404 handler
      apiApp.post(webhookPath, bot.webhookCallback(webhookPath));
      logger.info(`✓ Webhook callback registered at: ${webhookPath}`);
    } else {
      // Polling mode (desarrollo)
      await bot.telegram.deleteWebhook();
      await bot.launch();
      logger.info('✓ Bot started in polling mode');
    }

    // Agregar 404 y error handlers DESPUÉS del webhook
    const { errorHandler: apiErrorHandler, notFoundHandler } = require('../api/middleware/errorHandler');
    apiApp.use(notFoundHandler);
    apiApp.use(apiErrorHandler);
    logger.info('✓ Error handlers registered');

    // Iniciar API server
    const PORT = process.env.PORT || 3000;
    apiApp.listen(PORT, () => {
      logger.info(`✓ API server running on port ${PORT}`);
    });

    logger.info('🚀 PNPtv Telegram Bot is running!');

    // Graceful shutdown
    process.once('SIGINT', () => {
      logger.info('Received SIGINT, stopping bot...');
      bot.stop('SIGINT');
    });

    process.once('SIGTERM', () => {
      logger.info('Received SIGTERM, stopping bot...');
      bot.stop('SIGTERM');
    });
  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
};

// Iniciar
if (require.main === module) {
  startBot();
}

module.exports = { startBot };
```

[**CONTINÚA EN LA SIGUIENTE SECCIÓN - El prompt es muy largo, este es solo el inicio. ¿Deseas que continúe con las siguientes secciones?**]

---

## SECCIONES PENDIENTES POR DOCUMENTAR:

- ✅ FASE 1-4 completadas arriba
- ⏳ FASE 5: Middleware (session, rateLimit, errorHandler)
- ⏳ FASE 6: Handlers completos (onboarding, menu, payments, etc.)
- ⏳ FASE 7: Services (userService, paymentService)
- ⏳ FASE 8: API y Webhooks
- ⏳ FASE 9: Validaciones y utilidades
- ⏳ FASE 10: Docker y despliegue
- ⏳ FASE 11: Scripts (seed, cron)
- ⏳ FASE 12: Testing

**NOTA**: Este es un prompt PARCIAL. Requieres confirmar si deseas que continúe con las secciones restantes para tener el documento 100% completo.
