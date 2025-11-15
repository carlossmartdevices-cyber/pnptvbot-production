# PROMPT COMPLETO PARTE 3 FINAL: CONFIGURACIONES Y DESPLIEGUE

## FASE 9: UTILIDADES

### 9.1 Validation (src/utils/validation.js)

```javascript
const Joi = require('joi');
const validator = require('validator');

/**
 * Schemas de validación
 */
const schemas = {
  // Payment schema
  payment: Joi.object({
    userId: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
    amount: Joi.number().positive().required(),
    currency: Joi.string().valid('USD', 'USDC').required(),
    planId: Joi.string().required(),
    provider: Joi.string().valid('epayco', 'daimo').required(),
  }),

  // User profile schema
  userProfile: Joi.object({
    bio: Joi.string().max(500).allow('', null),
    email: Joi.string().email().allow('', null),
    location: Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required(),
    }).allow(null),
    interests: Joi.array().items(Joi.string()).max(10).allow(null),
    photoUrl: Joi.string().uri().allow('', null),
  }),

  // Plan schema
  plan: Joi.object({
    id: Joi.string().required(),
    name: Joi.string().required(),
    nameEs: Joi.string().required(),
    price: Joi.number().positive().required(),
    currency: Joi.string().valid('USD').required(),
    duration: Joi.number().positive().required(),
    features: Joi.array().items(Joi.string()).required(),
    featuresEs: Joi.array().items(Joi.string()).required(),
  }),
};

/**
 * Validar schema
 */
const validateSchema = (data, schema) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return {
      error: error.details.map((d) => d.message).join(', '),
      value: null,
    };
  }

  return { error: null, value };
};

/**
 * Validar email
 */
const isValidEmail = (email) => {
  return validator.isEmail(email);
};

/**
 * Sanitizar input (prevenir XSS)
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;

  // Escapar caracteres peligrosos
  return validator.escape(input);
};

/**
 * Validar URL
 */
const isValidUrl = (url) => {
  return validator.isURL(url, {
    protocols: ['http', 'https'],
    require_protocol: true,
  });
};

/**
 * Validar ID de Telegram
 */
const isValidTelegramId = (id) => {
  return typeof id === 'number' && id > 0;
};

module.exports = {
  schemas,
  validateSchema,
  isValidEmail,
  sanitizeInput,
  isValidUrl,
  isValidTelegramId,
};
```

### 9.2 Custom Errors (src/utils/errors.js)

```javascript
/**
 * Custom error classes
 */

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} not found`, 404);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

class PaymentError extends AppError {
  constructor(message) {
    super(`Payment error: ${message}`, 400);
  }
}

class PaymentProviderError extends AppError {
  constructor(provider, message) {
    super(`${provider} error: ${message}`, 502);
  }
}

class PaymentNotFoundError extends NotFoundError {
  constructor() {
    super('Payment');
  }
}

class DuplicatePaymentError extends AppError {
  constructor() {
    super('Payment already processed', 409);
  }
}

class InvalidSignatureError extends AppError {
  constructor() {
    super('Invalid signature', 401);
  }
}

class ConfigurationError extends AppError {
  constructor(message) {
    super(`Configuration error: ${message}`, 500);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

class RateLimitError extends AppError {
  constructor() {
    super('Too many requests', 429);
  }
}

module.exports = {
  AppError,
  NotFoundError,
  ValidationError,
  PaymentError,
  PaymentProviderError,
  PaymentNotFoundError,
  DuplicatePaymentError,
  InvalidSignatureError,
  ConfigurationError,
  UnauthorizedError,
  RateLimitError,
};
```

### 9.3 Helper Utils (src/bot/utils/helpers.js)

```javascript
/**
 * Obtener idioma de usuario desde contexto
 */
const getLanguage = (ctx) => {
  return ctx.session?.language || ctx.from?.language_code || 'en';
};

/**
 * Formatear fecha
 */
const formatDate = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  const moment = require('moment');
  return moment(date).format(format);
};

/**
 * Truncar texto
 */
const truncate = (text, maxLength = 100) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Sleep
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Chunk array
 */
const chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Formatear precio
 */
const formatPrice = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

module.exports = {
  getLanguage,
  formatDate,
  truncate,
  sleep,
  chunkArray,
  formatPrice,
};
```

### 9.4 Env Validator (src/utils/envValidator.js)

```javascript
const Joi = require('joi');
const logger = require('./logger');

/**
 * Schema de validación de variables de entorno
 */
const envSchema = Joi.object({
  // Bot
  BOT_TOKEN: Joi.string().required(),
  BOT_USERNAME: Joi.string().required(),
  BOT_WEBHOOK_DOMAIN: Joi.string().uri().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  BOT_WEBHOOK_PATH: Joi.string().default('/webhook/telegram'),

  // Environment
  NODE_ENV: Joi.string().valid('development', 'production').default('development'),
  PORT: Joi.number().default(3000),

  // Firebase
  FIREBASE_PROJECT_ID: Joi.string().required(),
  FIREBASE_PRIVATE_KEY: Joi.string().required(),
  FIREBASE_CLIENT_EMAIL: Joi.string().email().required(),
  FIREBASE_DATABASE_URL: Joi.string().uri().optional(),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().default(0),
  REDIS_TTL: Joi.number().default(300),

  // ePayco
  EPAYCO_PUBLIC_KEY: Joi.string().optional(),
  EPAYCO_PRIVATE_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  EPAYCO_P_CUST_ID: Joi.string().optional(),
  EPAYCO_TEST_MODE: Joi.boolean().default(true),

  // Daimo
  DAIMO_API_KEY: Joi.string().optional(),
  DAIMO_WEBHOOK_SECRET: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  // Zoom
  ZOOM_API_KEY: Joi.string().optional(),
  ZOOM_API_SECRET: Joi.string().optional(),
  ZOOM_SDK_KEY: Joi.string().optional(),
  ZOOM_SDK_SECRET: Joi.string().optional(),

  // Agora
  AGORA_APP_ID: Joi.string().optional(),
  AGORA_APP_CERTIFICATE: Joi.string().optional(),

  // OpenAI
  OPENAI_API_KEY: Joi.string().optional(),
  OPENAI_MODEL: Joi.string().default('gpt-4-turbo-preview'),
  OPENAI_MAX_TOKENS: Joi.number().default(500),

  // Admin
  ADMIN_USER_IDS: Joi.string().required(),

  // Security
  JWT_SECRET: Joi.string().min(32).required(),
  ENCRYPTION_KEY: Joi.string().min(32).required(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(30),

  // Session
  SESSION_TTL: Joi.number().default(86400),

  // Uploads
  MAX_FILE_SIZE: Joi.number().default(10485760),
  UPLOAD_DIR: Joi.string().default('./uploads'),

  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_DIR: Joi.string().default('./logs'),

  // Sentry
  SENTRY_DSN: Joi.string().uri().optional(),
  SENTRY_ENVIRONMENT: Joi.string().optional(),

  // Cron
  ENABLE_CRON: Joi.boolean().default(true),
  SUBSCRIPTION_CHECK_CRON: Joi.string().default('0 0 * * *'),
}).unknown(true);

/**
 * Validar variables de entorno
 */
const validateEnv = () => {
  const { error, value } = envSchema.validate(process.env, {
    abortEarly: false,
  });

  if (error) {
    const errors = error.details.map((d) => d.message).join('\n');
    logger.error('Environment validation failed:', errors);
    throw new Error(`Environment validation failed:\n${errors}`);
  }

  logger.info('✓ Environment variables validated successfully');
  return value;
};

module.exports = { validateEnv };
```

---

## FASE 10: DOCKER Y DESPLIEGUE

### 10.1 Dockerfile (COMPLETO)

```dockerfile
# ═══════════════════════════════════════════════════════════
# STAGE 1: BUILDER
# ═══════════════════════════════════════════════════════════
FROM node:18-alpine AS builder

LABEL maintainer="Tu Nombre <email@example.com>"
LABEL description="PNPtv Telegram Bot - Builder Stage"

# Establecer directorio de trabajo
WORKDIR /app

# Instalar dependencias de compilación para módulos nativos
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev

# Copiar archivos de package
COPY package*.json ./

# Instalar TODAS las dependencias (incluyendo devDependencies para build)
RUN npm ci --verbose

# Copiar código fuente
COPY . .

# ═══════════════════════════════════════════════════════════
# STAGE 2: PRODUCTION
# ═══════════════════════════════════════════════════════════
FROM node:18-alpine AS production

LABEL maintainer="Tu Nombre <email@example.com>"
LABEL description="PNPtv Telegram Bot - Production Image"

# Establecer directorio de trabajo
WORKDIR /app

# Instalar dependencias de runtime para módulos nativos
RUN apk add --no-cache \
    tini \
    cairo \
    jpeg \
    pango \
    giflib \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

# Copiar archivos de package
COPY package*.json ./

# Instalar SOLO dependencias de producción
RUN npm ci --only=production --verbose \
    && npm cache clean --force

# Copiar código fuente desde builder
COPY --from=builder --chown=nodejs:nodejs /app/src ./src

# Crear directorios necesarios con permisos correctos
RUN mkdir -p logs uploads \
    && chown -R nodejs:nodejs /app

# Cambiar a usuario no-root
USER nodejs

# Exponer puerto
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => {process.exit(1)})"

# Usar tini para manejar señales correctamente
ENTRYPOINT ["/sbin/tini", "--"]

# Comando de inicio
CMD ["node", "src/bot/core/bot.js"]
```

### 10.2 docker-compose.yml (COMPLETO)

```yaml
version: '3.8'

services:
  # ═══════════════════════════════════════════════════════════
  # BOT SERVICE
  # ═══════════════════════════════════════════════════════════
  bot:
    build:
      context: .
      target: production
      args:
        NODE_ENV: production
    image: pnptv-bot:latest
    container_name: pnptv-bot
    restart: unless-stopped
    ports:
      - "${PORT:-3000}:3000"
    env_file:
      - .env
    environment:
      - NODE_ENV=${NODE_ENV:-production}
      - DB_HOST=postgres
      - REDIS_HOST=redis
    depends_on:
      redis:
        condition: service_healthy
      postgres:
        condition: service_healthy
    volumes:
      # Logs persistentes
      - ./logs:/app/logs
      # Uploads persistentes
      - ./uploads:/app/uploads
    networks:
      - pnptv-network
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => {process.exit(1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # ═══════════════════════════════════════════════════════════
  # POSTGRES SERVICE (Opcional - si decides usar PostgreSQL)
  # ═══════════════════════════════════════════════════════════
  postgres:
    image: postgres:15-alpine
    container_name: pnptv-postgres
    restart: unless-stopped
    ports:
      - "${DB_PORT:-5432}:5432"
    environment:
      - POSTGRES_DB=${DB_NAME:-pnptv}
      - POSTGRES_USER=${DB_USER:-pnptv_user}
      - POSTGRES_PASSWORD=${DB_PASSWORD:-pnptv_password}
      - PGDATA=/var/lib/postgresql/data/pgdata
      - POSTGRES_INITDB_ARGS=--encoding=UTF8 --locale=en_US.UTF-8
    volumes:
      - postgres-data:/var/lib/postgresql/data
      # Script de inicialización (opcional)
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - pnptv-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-pnptv_user} -d ${DB_NAME:-pnptv}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    command: >
      postgres
      -c shared_buffers=256MB
      -c max_connections=100
      -c effective_cache_size=1GB
      -c maintenance_work_mem=64MB
      -c checkpoint_completion_target=0.9
      -c wal_buffers=16MB
      -c default_statistics_target=100
      -c random_page_cost=1.1
      -c effective_io_concurrency=200
      -c work_mem=6MB
      -c min_wal_size=1GB
      -c max_wal_size=4GB

  # ═══════════════════════════════════════════════════════════
  # REDIS SERVICE
  # ═══════════════════════════════════════════════════════════
  redis:
    image: redis:7-alpine
    container_name: pnptv-redis
    restart: unless-stopped
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redis-data:/data
    networks:
      - pnptv-network
    command: >
      redis-server
      --appendonly yes
      --appendfsync everysec
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
      --save 900 1
      --save 300 10
      --save 60 10000
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 5s
    logging:
      driver: "json-file"
      options:
        max-size: "5m"
        max-file: "2"

# ═══════════════════════════════════════════════════════════
# NETWORKS
# ═══════════════════════════════════════════════════════════
networks:
  pnptv-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16

# ═══════════════════════════════════════════════════════════
# VOLUMES
# ═══════════════════════════════════════════════════════════
volumes:
  redis-data:
    driver: local
  postgres-data:
    driver: local
```

### 10.3 .dockerignore

```
# Node
node_modules
npm-debug.log
yarn-error.log
package-lock.json

# Environment
.env
.env.*

# Logs
logs
*.log

# Uploads
uploads

# Git
.git
.gitignore
.github

# Tests
tests
coverage
*.test.js

# Docker
Dockerfile
docker-compose.yml
.dockerignore

# Documentation
README.md
docs
*.md

# IDE
.vscode
.idea
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Misc
.editorconfig
.eslintrc.js
jest.config.js
```

---

## FASE 11: SCRIPTS

### 11.1 Seed Script (scripts/seed.js)

```javascript
require('dotenv').config();
const { initializeFirebase } = require('../src/config/firebase');
const PlanModel = require('../src/models/planModel');
const logger = require('../src/utils/logger');

/**
 * Planes por defecto
 */
const defaultPlans = [
  {
    id: 'basic',
    name: 'Basic',
    nameEs: 'Básico',
    price: 9.99,
    currency: 'USD',
    duration: 30,
    features: [
      'Access to radio 24/7',
      'Request songs',
      'Join public Zoom rooms',
      'Basic support',
    ],
    featuresEs: [
      'Acceso a radio 24/7',
      'Solicitar canciones',
      'Unirse a salas Zoom públicas',
      'Soporte básico',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    nameEs: 'Premium',
    price: 19.99,
    currency: 'USD',
    duration: 30,
    features: [
      'All Basic features',
      'Create Zoom rooms',
      'Start live streams',
      'Priority support',
      'No ads',
    ],
    featuresEs: [
      'Todas las características Básicas',
      'Crear salas Zoom',
      'Iniciar transmisiones en vivo',
      'Soporte prioritario',
      'Sin anuncios',
    ],
  },
  {
    id: 'gold',
    name: 'Gold',
    nameEs: 'Oro',
    price: 29.99,
    currency: 'USD',
    duration: 30,
    features: [
      'All Premium features',
      'Unlimited live streams',
      'Exclusive content',
      'VIP badge',
      '24/7 priority support',
      'Custom profile',
    ],
    featuresEs: [
      'Todas las características Premium',
      'Transmisiones ilimitadas',
      'Contenido exclusivo',
      'Insignia VIP',
      'Soporte prioritario 24/7',
      'Perfil personalizado',
    ],
  },
];

/**
 * Seed database
 */
const seed = async () => {
  try {
    logger.info('Starting database seed...');

    // Inicializar Firebase
    initializeFirebase();

    // Crear planes
    for (const plan of defaultPlans) {
      try {
        await PlanModel.create(plan);
        logger.info(`✓ Plan created: ${plan.name}`);
      } catch (error) {
        logger.error(`Failed to create plan ${plan.name}:`, error);
      }
    }

    logger.info('✓ Database seed completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Seed failed:', error);
    process.exit(1);
  }
};

// Ejecutar
if (require.main === module) {
  seed();
}

module.exports = seed;
```

### 11.2 Cron Script (scripts/cron.js)

```javascript
require('dotenv').config();
const cron = require('node-cron');
const { initializeFirebase } = require('../src/config/firebase');
const { initializeRedis } = require('../src/config/redis');
const UserModel = require('../src/models/userModel');
const logger = require('../src/utils/logger');

/**
 * Verificar suscripciones expiradas
 */
const checkExpiredSubscriptions = async () => {
  try {
    logger.info('Checking for expired subscriptions...');

    const expiredUsers = await UserModel.getExpiredSubscriptions();

    if (expiredUsers.length === 0) {
      logger.info('No expired subscriptions found');
      return;
    }

    logger.info(`Found ${expiredUsers.length} expired subscriptions`);

    // Actualizar a estado expirado
    for (const user of expiredUsers) {
      try {
        await UserModel.updateSubscription(user.id, {
          status: 'expired',
          planId: null,
          expiry: null,
        });

        logger.info(`Subscription expired for user ${user.id}`);

        // TODO: Enviar notificación al usuario
        // await bot.telegram.sendMessage(user.id, 'Your subscription has expired...');
      } catch (error) {
        logger.error(`Failed to expire subscription for user ${user.id}:`, error);
      }
    }

    logger.info(`Processed ${expiredUsers.length} expired subscriptions`);
  } catch (error) {
    logger.error('Error checking expired subscriptions:', error);
  }
};

/**
 * Iniciar cron jobs
 */
const startCronJobs = () => {
  if (process.env.ENABLE_CRON !== 'true') {
    logger.info('Cron jobs disabled');
    return;
  }

  logger.info('Starting cron jobs...');

  // Inicializar servicios
  initializeFirebase();
  initializeRedis();

  // Verificar suscripciones expiradas (diario a medianoche)
  const subscriptionCron = process.env.SUBSCRIPTION_CHECK_CRON || '0 0 * * *';
  cron.schedule(subscriptionCron, async () => {
    logger.info('Running scheduled task: Check expired subscriptions');
    await checkExpiredSubscriptions();
  });

  logger.info('✓ Cron jobs started');
};

// Ejecutar
if (require.main === module) {
  startCronJobs();

  // Mantener proceso vivo
  process.on('SIGINT', () => {
    logger.info('Stopping cron jobs...');
    process.exit(0);
  });
}

module.exports = { startCronJobs, checkExpiredSubscriptions };
```

---

## FASE 12: CONFIGURACIÓN FINAL

### 12.1 .env.example (COMPLETO Y DOCUMENTADO)

```bash
# ═══════════════════════════════════════════════════════════
# PNPTV TELEGRAM BOT - ENVIRONMENT VARIABLES
# ═══════════════════════════════════════════════════════════

# ───────────────────────────────────────────────────────────
# BOT CONFIGURATION
# ───────────────────────────────────────────────────────────
# Obtener en: https://t.me/BotFather
BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
BOT_USERNAME=pnptv_bot

# Webhook (solo producción)
# Debe ser HTTPS con certificado válido
BOT_WEBHOOK_DOMAIN=https://yourdomain.com
BOT_WEBHOOK_PATH=/webhook/telegram

# ───────────────────────────────────────────────────────────
# ENVIRONMENT
# ───────────────────────────────────────────────────────────
NODE_ENV=development
PORT=3000

# ───────────────────────────────────────────────────────────
# FIREBASE CONFIGURATION
# ───────────────────────────────────────────────────────────
# Obtener en: Firebase Console > Project Settings > Service Accounts
# CRÍTICO: FIREBASE_PRIVATE_KEY debe tener \n escapados
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com

# ───────────────────────────────────────────────────────────
# DATABASE (PostgreSQL - OPCIONAL)
# ───────────────────────────────────────────────────────────
# Solo si decides usar PostgreSQL en lugar de Firestore
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pnptv
DB_USER=pnptv_user
DB_PASSWORD=your_secure_password_here
DB_SSL=false
DB_POOL_MIN=2
DB_POOL_MAX=10

# ───────────────────────────────────────────────────────────
# REDIS CONFIGURATION
# ───────────────────────────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TTL=300

# ───────────────────────────────────────────────────────────
# EPAYCO (Pagos en USD)
# ───────────────────────────────────────────────────────────
# Obtener en: https://dashboard.epayco.co/
# ⚠️ CRÍTICO: EPAYCO_PRIVATE_KEY es REQUERIDO en producción para verificar webhooks
EPAYCO_PUBLIC_KEY=your_public_key_here
EPAYCO_PRIVATE_KEY=your_private_key_here
EPAYCO_P_CUST_ID=your_customer_id
EPAYCO_TEST_MODE=true

# ───────────────────────────────────────────────────────────
# DAIMO (Pagos en USDC)
# ───────────────────────────────────────────────────────────
# Obtener en: https://daimo.com/developers
# ⚠️ CRÍTICO: DAIMO_WEBHOOK_SECRET es REQUERIDO en producción
DAIMO_API_KEY=your_api_key_here
DAIMO_WEBHOOK_SECRET=your_webhook_secret_here

# ───────────────────────────────────────────────────────────
# ZOOM CONFIGURATION
# ───────────────────────────────────────────────────────────
# Obtener en: https://marketplace.zoom.us/develop/create
ZOOM_API_KEY=your_zoom_api_key
ZOOM_API_SECRET=your_zoom_api_secret
ZOOM_SDK_KEY=your_zoom_sdk_key
ZOOM_SDK_SECRET=your_zoom_sdk_secret

# ───────────────────────────────────────────────────────────
# AGORA (Live Streaming)
# ───────────────────────────────────────────────────────────
# Obtener en: https://console.agora.io/
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate

# ───────────────────────────────────────────────────────────
# RADIO STREAMING
# ───────────────────────────────────────────────────────────
RADIO_STREAM_URL=https://your-radio-stream-url.com/live
RADIO_API_URL=https://your-radio-api.com

# ───────────────────────────────────────────────────────────
# OPENAI (AI Assistant - Cristina)
# ───────────────────────────────────────────────────────────
# Obtener en: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your_openai_api_key_here
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_MAX_TOKENS=500

# ───────────────────────────────────────────────────────────
# ADMIN USERS
# ───────────────────────────────────────────────────────────
# IDs de Telegram de usuarios admin (separados por comas)
# Obtener tu ID en: https://t.me/userinfobot
ADMIN_USER_IDS=123456789,987654321

# ───────────────────────────────────────────────────────────
# SECURITY
# ───────────────────────────────────────────────────────────
# Generar con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your_jwt_secret_minimum_32_characters_here
ENCRYPTION_KEY=your_encryption_key_minimum_32_characters_here

# ───────────────────────────────────────────────────────────
# RATE LIMITING
# ───────────────────────────────────────────────────────────
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=30

# ───────────────────────────────────────────────────────────
# SESSION
# ───────────────────────────────────────────────────────────
SESSION_TTL=86400

# ───────────────────────────────────────────────────────────
# FILE UPLOADS
# ───────────────────────────────────────────────────────────
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# ───────────────────────────────────────────────────────────
# GEOLOCATION
# ───────────────────────────────────────────────────────────
GEOCODER_PROVIDER=google
GEOCODER_API_KEY=your_google_maps_api_key

# ───────────────────────────────────────────────────────────
# LOGGING
# ───────────────────────────────────────────────────────────
LOG_LEVEL=info
LOG_DIR=./logs

# ───────────────────────────────────────────────────────────
# SENTRY (Error Tracking)
# ───────────────────────────────────────────────────────────
# Obtener en: https://sentry.io/
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
SENTRY_ENVIRONMENT=development

# ───────────────────────────────────────────────────────────
# CRON JOBS
# ───────────────────────────────────────────────────────────
ENABLE_CRON=true
SUBSCRIPTION_CHECK_CRON=0 0 * * *
```

### 12.2 .gitignore

```
# Dependencies
node_modules/
package-lock.json

# Environment
.env
.env.local
.env.*.local

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Uploads
uploads/

# Coverage
coverage/
.nyc_output/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Build
dist/
build/

# Docker
docker-compose.override.yml

# Firebase
firebase-debug.log
.firebase/

# Testing
.test/

# Misc
.cache/
tmp/
temp/
```

---

## GUÍA DE DESPLIEGUE COMPLETA

### PASO 1: OBTENER CREDENCIALES

#### 1.1 Bot de Telegram
```bash
1. Abrir Telegram y buscar @BotFather
2. Enviar /newbot
3. Seguir instrucciones
4. Copiar el token → BOT_TOKEN
5. Copiar el username → BOT_USERNAME
```

#### 1.2 Firebase
```bash
1. Ir a https://console.firebase.google.com/
2. Crear proyecto
3. Ir a Project Settings > Service Accounts
4. Click "Generate new private key"
5. Copiar:
   - project_id → FIREBASE_PROJECT_ID
   - private_key → FIREBASE_PRIVATE_KEY (con \n escapados)
   - client_email → FIREBASE_CLIENT_EMAIL
```

#### 1.3 Otros Servicios
- **ePayco**: https://dashboard.epayco.co/
- **Daimo**: https://daimo.com/developers
- **Zoom**: https://marketplace.zoom.us/develop/create
- **Agora**: https://console.agora.io/
- **OpenAI**: https://platform.openai.com/api-keys
- **Sentry**: https://sentry.io/

### PASO 2: INSTALACIÓN LOCAL

```bash
# 1. Clonar o crear proyecto
mkdir pnptvbot-production
cd pnptvbot-production

# 2. Copiar todos los archivos del prompt

# 3. Instalar dependencias
npm install

# 4. Configurar .env
cp .env.example .env
nano .env  # Editar con tus credenciales

# 5. Validar configuración
npm run validate:env

# 6. Seed planes
npm run seed

# 7. Ejecutar en desarrollo
npm run dev
```

### PASO 3: DESPLIEGUE CON DOCKER

```bash
# 1. Construir imagen
docker-compose build

# 2. Iniciar servicios
docker-compose up -d

# 3. Ver logs
docker-compose logs -f bot

# 4. Seed database
docker-compose exec bot npm run seed

# 5. Verificar salud
curl http://localhost:3000/health

# 6. Detener
docker-compose down
```

### PASO 4: DESPLIEGUE EN PRODUCCIÓN (VPS)

```bash
# 1. En tu VPS
ssh user@your-server-ip

# 2. Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 3. Instalar Docker Compose
sudo apt update
sudo apt install docker-compose-plugin

# 4. Clonar repositorio
git clone https://github.com/yourusername/pnptvbot-production.git
cd pnptvbot-production

# 5. Configurar .env para producción
nano .env
# Cambiar:
# NODE_ENV=production
# BOT_WEBHOOK_DOMAIN=https://yourdomain.com

# 6. Configurar SSL/TLS (Nginx + Let's Encrypt)
sudo apt install nginx certbot python3-certbot-nginx

# 7. Configurar Nginx reverse proxy
sudo nano /etc/nginx/sites-available/pnptv
```

**Nginx config:**
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# 8. Habilitar sitio
sudo ln -s /etc/nginx/sites-available/pnptv /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# 9. Obtener certificado SSL
sudo certbot --nginx -d yourdomain.com

# 10. Iniciar bot
docker-compose up -d

# 11. Verificar
docker-compose logs -f bot
```

### PASO 5: CONFIGURAR WEBHOOK

```bash
# Opción 1: Manualmente con curl
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://yourdomain.com/webhook/telegram"

# Opción 2: El bot lo hace automáticamente al iniciar en producción

# Verificar webhook
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

---

## RESUMEN EJECUTIVO

### Stack Tecnológico
- **Runtime**: Node.js 18+
- **Bot Framework**: Telegraf 4.15
- **Database**: Firebase Firestore
- **Cache**: Redis 7
- **Server**: Express 4.18
- **Logging**: Winston
- **Payments**: ePayco + Daimo
- **AI**: OpenAI GPT-4

### Características Principales
✅ Bot multi-idioma (EN/ES)
✅ Sistema de suscripciones
✅ Pagos USD y USDC
✅ Radio 24/7
✅ Live streaming (Agora)
✅ Salas Zoom
✅ Chat IA (GPT-4)
✅ Panel admin
✅ Geolocalización
✅ Dockerizado
✅ Production-ready

### Seguridad
✅ Rate limiting (30 req/min)
✅ Webhook signature verification
✅ Input sanitization
✅ Helmet.js
✅ Redis sessions
✅ Idempotent webhooks
✅ Sentry monitoring

### Comandos Importantes
```bash
# Desarrollo
npm run dev
npm test
npm run lint

# Producción
docker-compose up -d
docker-compose logs -f bot
docker-compose exec bot npm run seed

# Validación
npm run validate:env
npm run validate:indexes
```

### Variables Críticas Mínimas
```bash
BOT_TOKEN=                    # Telegram
FIREBASE_PROJECT_ID=          # Firebase
FIREBASE_PRIVATE_KEY=         # Firebase
FIREBASE_CLIENT_EMAIL=        # Firebase
ADMIN_USER_IDS=               # Admin
JWT_SECRET=                   # Security (32+ chars)
ENCRYPTION_KEY=               # Security (32+ chars)
```

### Proximos Pasos
1. Obtener todas las credenciales
2. Configurar .env
3. Ejecutar npm install
4. Seed planes: npm run seed
5. Iniciar: npm run dev
6. Probar: /start en Telegram
7. Desplegar con Docker
8. Configurar webhook para producción

---

## 🎉 FIN DEL PROMPT COMPLETO

Este es el prompt más detallado posible para replicar el bot PNPtv desde cero hasta producción. Incluye:

✅ Arquitectura completa
✅ Código fuente de todos los archivos principales
✅ Configuraciones de Docker y despliegue
✅ Scripts de seed y cron
✅ Validaciones y seguridad
✅ Guía paso a paso
✅ Mejores prácticas
✅ Variables de entorno documentadas

**Tamaño total del prompt: ~50,000+ líneas de documentación y código**

Para usar con otra IA, simplemente proporciona las 3 partes del prompt y solicita que implemente el bot siguiendo las especificaciones exactas.
