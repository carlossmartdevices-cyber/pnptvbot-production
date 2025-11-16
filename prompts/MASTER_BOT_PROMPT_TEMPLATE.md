# 🤖 MASTER PROMPT TEMPLATE - Telegram Bot Generator

## 📋 INSTRUCCIONES DE USO

Este es un **prompt maestro reutilizable** para generar bots de Telegram con arquitectura profesional.

**Cómo usar:**
1. Copia este prompt completo
2. Reemplaza las variables `{{VARIABLE}}` con los valores específicos de tu bot
3. Pégalo en Mistral, Claude, ChatGPT o cualquier LLM
4. El LLM generará un bot completo con la misma arquitectura de PNPtv

---

# 🎯 PROMPT PARA GENERAR BOT DE {{TIPO_DE_NEGOCIO}}

Necesito que desarrolles un **Telegram Bot completo y profesional** para gestionar {{DESCRIPCION_NEGOCIO}}.

## 1️⃣ CONTEXTO DEL NEGOCIO

**Tipo de Bot:** {{TIPO_DE_NEGOCIO}}
**Descripción:** {{DESCRIPCION_DETALLADA}}
**Usuarios objetivo:** {{TIPO_DE_USUARIOS}}

**Ejemplos de casos de uso:**
- {{CASO_USO_1}}
- {{CASO_USO_2}}
- {{CASO_USO_3}}

---

## 2️⃣ ARQUITECTURA OBLIGATORIA

Debes seguir esta arquitectura **exactamente**:

### 📁 Estructura de Archivos

```
{{nombre-bot}}/
├── .env.example
├── package.json
├── src/
│   ├── bot/
│   │   ├── core/
│   │   │   ├── bot.js                    # Entry point principal
│   │   │   ├── middleware/
│   │   │   │   ├── session.js            # Gestión de sesiones Redis
│   │   │   │   ├── rateLimit.js          # Rate limiting per-user
│   │   │   │   └── errorHandler.js       # Error handling centralizado
│   │   │   └── plugins/                   # Integraciones externas
│   │   ├── handlers/
│   │   │   ├── admin/
│   │   │   │   └── index.js              # Panel admin completo
│   │   │   ├── user/
│   │   │   │   ├── index.js              # Agregador de handlers
│   │   │   │   ├── onboarding.js         # Flujo de onboarding
│   │   │   │   ├── menu.js               # Menú principal
│   │   │   │   ├── profile.js            # Gestión de perfil
│   │   │   │   └── settings.js           # Configuración usuario
│   │   │   ├── {{modulo_especifico_1}}/  # Ej: reservations, products, etc
│   │   │   │   └── index.js
│   │   │   ├── {{modulo_especifico_2}}/
│   │   │   │   └── index.js
│   │   │   └── payments/
│   │   │       └── index.js              # Flujo de pagos/suscripciones
│   │   ├── services/
│   │   │   ├── userService.js            # Lógica de negocio de usuarios
│   │   │   ├── paymentService.js         # Lógica de pagos
│   │   │   ├── cacheService.js           # Cache wrapper
│   │   │   ├── {{servicio_1}}.js         # Ej: reservationService.js
│   │   │   └── {{servicio_2}}.js
│   │   ├── utils/
│   │   │   └── helpers.js
│   │   └── api/
│   │       ├── routes.js                 # Express router
│   │       ├── controllers/
│   │       │   ├── webhookController.js
│   │       │   └── {{controlador}}.js
│   │       └── middleware/
│   │           └── auth.js
│   ├── models/
│   │   ├── userModel.js                  # Modelo de usuario
│   │   ├── {{modelo_principal}}.js       # Ej: reservationModel, productModel
│   │   ├── {{modelo_secundario}}.js
│   │   ├── planModel.js                  # Planes de suscripción (si aplica)
│   │   └── paymentModel.js               # Registros de pagos
│   ├── config/
│   │   ├── firebase.js                   # Singleton Firestore
│   │   └── redis.js                      # Cache con helpers
│   └── utils/
│       ├── logger.js                     # Winston con rotación
│       ├── errors.js                     # Jerarquía de errores custom
│       ├── validation.js                 # Validadores Joi
│       └── i18n.js                       # Sistema multi-idioma
└── docs/
    └── architecture.md
```

---

## 3️⃣ MODELOS DE DATOS REQUERIDOS

### 👤 UserModel (OBLIGATORIO - Base para todos los bots)

```javascript
// src/models/userModel.js
Schema: {
  userId: string,                           // Telegram ID
  username: string,
  firstName: string,
  lastName: string,
  email: string,                            // Opcional según bot
  phone: string,                            // Opcional según bot
  language: 'en' | 'es',
  role: 'user' | 'admin' | 'super_admin',   // Sistema de roles
  subscriptionStatus: 'free' | 'active' | 'expired' | 'deactivated',
  planId: string,                           // Si tiene suscripción
  planExpiry: Date,
  {{campos_especificos_negocio}},           // Ej: location, preferences, etc.
  onboardingComplete: boolean,
  createdAt: Date,
  updatedAt: Date
}

Métodos requeridos:
- createOrUpdate(userData)                  // Upsert
- getById(userId)                           // Con cache 10 min
- getAll(filters)                           // Para admin
- getStatistics()                           // Para dashboard admin
- invalidateCache(userId)                   // Multi-pattern invalidation
{{metodos_especificos}}                     // Ej: getNearby, getByCategory, etc.
```

### 📦 {{ModeloPrincipal}} (ESPECÍFICO DEL NEGOCIO)

```javascript
// Ejemplos según tipo de bot:

// RESTAURANTE → OrderModel
Schema: {
  id: string,
  userId: string,
  items: [{ productId, quantity, price, name }],
  totalAmount: number,
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled',
  deliveryAddress: string,
  deliveryTime: Date,
  paymentId: string,
  createdAt: Date,
  updatedAt: Date
}

// ALOJAMIENTO → BookingModel
Schema: {
  id: string,
  userId: string,
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
  guests: number,
  totalAmount: number,
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled',
  paymentId: string,
  specialRequests: string,
  createdAt: Date,
  updatedAt: Date
}

// SERVICIOS → AppointmentModel
Schema: {
  id: string,
  userId: string,
  serviceId: string,
  providerId: string,                       // ID del profesional
  scheduledFor: Date,
  duration: number,                         // minutos
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show',
  totalAmount: number,
  paymentId: string,
  notes: string,
  createdAt: Date,
  updatedAt: Date
}

// TIENDA → ProductModel
Schema: {
  id: string,
  name: string,
  nameEs: string,
  description: string,
  descriptionEs: string,
  price: number,
  currency: string,
  category: string,
  images: string[],
  stock: number,
  active: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### 💳 PaymentModel (OBLIGATORIO si hay pagos)

```javascript
Schema: {
  id: string,                               // UUID
  userId: string,
  {{entityId}}: string,                     // orderId, bookingId, appointmentId, etc.
  amount: number,
  currency: 'USD' | 'USDC' | 'COP' | {{otras_monedas}},
  provider: 'epayco' | 'daimo' | {{otros_providers}},
  status: 'pending' | 'success' | 'failed' | 'refunded',
  transactionId: string,
  paymentUrl: string,
  metadata: {},                             // Info adicional flexible
  createdAt: Date,
  updatedAt: Date,
  completedAt: Date,
  failedAt: Date
}

Métodos requeridos:
- create(paymentData)
- updateStatus(id, status)
- getByTransactionId(transactionId)         // Para webhooks
- getRevenue(filters)                       // Analytics
```

---

## 4️⃣ SISTEMA DE ROLES Y PERMISOS

### 🔐 Jerarquía de Roles

#### **SUPER ADMIN**
- Configurado en variable de entorno: `SUPER_ADMIN_USER_IDS`
- **Permisos completos:**
  - Gestión total de usuarios (buscar, editar, desactivar)
  - Gestión de admins (promover, degradar)
  - Broadcast masivo con segmentación
  - Panel de analytics completo
  - Gestión de {{entidades_principales}} (CRUD completo)
  - Configuración del sistema
  - Logs y auditoría

#### **ADMIN**
- Configurado en variable de entorno: `ADMIN_USER_IDS`
- **Permisos:**
  - Gestión de {{entidades_principales}} (ver, editar, no eliminar)
  - Soporte a usuarios
  - Reportes básicos
  - Broadcast limitado (solo a sus usuarios asignados)
  - {{permisos_especificos_admin}}

#### **PREMIUM USER** (subscriptionStatus: 'active')
- **Permisos:**
  - Todas las funciones free
  - {{feature_premium_1}}                   // Ej: reservas ilimitadas
  - {{feature_premium_2}}                   // Ej: descuentos especiales
  - {{feature_premium_3}}                   // Ej: soporte prioritario
  - Sin límites de {{recurso}}              // Ej: sin límite de órdenes/mes

#### **FREE USER** (subscriptionStatus: 'free')
- **Permisos:**
  - {{feature_free_1}}                      // Ej: 3 reservas/mes
  - {{feature_free_2}}                      // Ej: ver catálogo
  - {{feature_free_3}}                      // Ej: perfil básico
  - Límites: {{limites_free}}               // Ej: 5 productos en carrito

### 🛡️ Implementación de Control de Acceso

```javascript
// src/bot/services/userService.js

class UserService {
  static isSuperAdmin(userId) {
    const superAdminIds = process.env.SUPER_ADMIN_USER_IDS.split(',');
    return superAdminIds.includes(userId.toString());
  }

  static isAdmin(userId) {
    const adminIds = process.env.ADMIN_USER_IDS.split(',');
    return adminIds.includes(userId.toString()) || this.isSuperAdmin(userId);
  }

  static async isPremium(userId) {
    const user = await UserModel.getById(userId);
    return user?.subscriptionStatus === 'active';
  }

  static async checkPermission(userId, requiredRole) {
    if (requiredRole === 'super_admin') return this.isSuperAdmin(userId);
    if (requiredRole === 'admin') return this.isAdmin(userId);
    if (requiredRole === 'premium') return await this.isPremium(userId);
    return true; // 'user' role
  }

  static requireRole(role) {
    return async (ctx, next) => {
      const hasPermission = await this.checkPermission(ctx.from.id, role);
      if (!hasPermission) {
        return ctx.reply('❌ No tienes permisos para esta acción.');
      }
      return next();
    };
  }
}

// Uso en handlers:
bot.command('admin', UserService.requireRole('admin'), async (ctx) => {
  // Solo admins y super admins pueden ejecutar esto
});
```

---

## 5️⃣ FUNCIONALIDADES REQUERIDAS POR ROL

### 👑 Panel de Super Admin

**Comando:** `/admin`

**Menú principal:**
```
🔧 PANEL DE ADMINISTRACIÓN

👥 Gestión de Usuarios
📊 Estadísticas y Analytics
📢 Broadcast Masivo
{{seccion_especifica_1}}              # Ej: 📦 Gestión de Productos
{{seccion_especifica_2}}              # Ej: 📅 Gestión de Reservas
{{seccion_especifica_3}}              # Ej: 💰 Finanzas
⚙️ Configuración del Sistema
```

**Funcionalidades obligatorias:**

1. **Gestión de Usuarios:**
   - Buscar usuario por ID/username/email
   - Ver perfil completo con historial
   - Editar datos de usuario
   - Extender suscripción manualmente
   - Desactivar/reactivar cuenta
   - Promover a admin
   - Ver {{entidades_relacionadas}} del usuario

2. **Estadísticas:**
   ```javascript
   Métricas requeridas:
   - Total de usuarios (activos, inactivos)
   - Usuarios premium vs free
   - Tasa de conversión
   - {{metrica_especifica_1}}           // Ej: órdenes completadas hoy
   - {{metrica_especifica_2}}           // Ej: revenue del mes
   - {{metrica_especifica_3}}           // Ej: tasa de cancelación
   - Gráficos de crecimiento (opcional)
   ```

3. **Broadcast Masivo:**
   - Segmentación: Todos / Premium / Free / {{segmento_custom}}
   - Vista previa del mensaje
   - Confirmación antes de enviar
   - Tracking de entrega (enviados/fallidos)
   - Programación diferida (opcional)

4. **{{Gestión_Entidad_Principal}}:**
   - Listar todas las {{entidades}}
   - Filtrar por estado/fecha/usuario
   - Ver detalles completos
   - Editar {{entidad}}
   - Eliminar {{entidad}}
   - {{accion_especifica}}              // Ej: marcar orden como entregada

### 👨‍💼 Panel de Admin

**Funcionalidades:**
- Todo lo de Super Admin EXCEPTO:
  - No puede promover/degradar roles
  - No puede eliminar {{entidades_criticas}}
  - No puede acceder a configuración del sistema
  - Broadcast limitado a usuarios asignados (si aplica)

### 💎 Funcionalidades Premium

**Beneficios:**
- {{beneficio_1}}
- {{beneficio_2}}
- {{beneficio_3}}
- Sin límites de {{recurso}}
- Soporte prioritario
- {{feature_exclusivo}}

### 🆓 Funcionalidades Free

**Limitaciones:**
- Límite de {{cantidad}} {{recurso}}/mes
- {{restriccion_1}}
- {{restriccion_2}}
- Sin acceso a {{feature_premium}}

---

## 6️⃣ FLUJOS DE USUARIO PRINCIPALES

### 📝 Flujo de Onboarding

```javascript
// src/bot/handlers/user/onboarding.js

Estado inicial → Verificar si onboardingComplete
  ├─ SI → Mostrar menú principal
  └─ NO → Iniciar onboarding
      ├─ Paso 1: Bienvenida y selección de idioma
      ├─ Paso 2: {{paso_especifico_1}}     // Ej: solicitar ubicación
      ├─ Paso 3: {{paso_especifico_2}}     // Ej: intereses/preferencias
      ├─ Paso 4: {{paso_especifico_3}}     // Ej: configurar notificaciones
      └─ Completar → Marcar onboardingComplete = true
```

### 🏠 Menú Principal

```
🏠 MENÚ PRINCIPAL

{{opcion_1}}                              # Ej: 🛍️ Ver Catálogo
{{opcion_2}}                              # Ej: 📅 Mis Reservas
{{opcion_3}}                              # Ej: 🛒 Mi Carrito
{{opcion_4}}                              # Ej: 💳 Suscripción
👤 Mi Perfil
⚙️ Configuración
📞 Soporte
```

### 💳 Flujo de Pago/Suscripción

```javascript
// src/bot/handlers/payments/index.js

Usuario selecciona plan/producto/servicio
  ├─ Mostrar resumen con precio
  ├─ Seleccionar método de pago (ePayco/Daimo/{{otros}})
  ├─ Crear registro en PaymentModel (status: pending)
  ├─ Generar URL de pago
  ├─ Enviar URL al usuario
  ├─ Usuario paga en plataforma externa
  ├─ Webhook recibe confirmación
  │   ├─ Verificar firma/autenticidad
  │   ├─ Verificar idempotencia (evitar duplicados)
  │   ├─ Actualizar PaymentModel (status: success)
  │   └─ Activar servicio (suscripción, orden, reserva, etc.)
  └─ Notificar al usuario vía Telegram
```

**Idempotencia obligatoria:**
```javascript
const idempotencyKey = `webhook:${provider}:${transactionId}`;
const lockAcquired = await cache.acquireLock(idempotencyKey, 120);
if (!lockAcquired) {
  throw new DuplicatePaymentError();
}
try {
  // Procesar pago
} finally {
  await cache.releaseLock(idempotencyKey);
}
```

### {{Flujo_Especifico_1}}

```
// Ejemplo para RESTAURANTE - Flujo de Orden:

Usuario → Ver menú
  ├─ Seleccionar categoría
  ├─ Ver productos
  ├─ Añadir al carrito (session.temp.cart)
  ├─ Modificar cantidad
  ├─ Ver carrito
  ├─ Confirmar orden
  │   ├─ Solicitar dirección entrega
  │   ├─ Calcular total + envío
  │   ├─ Seleccionar método de pago
  │   ├─ Procesar pago
  │   └─ Crear OrderModel
  └─ Tracking de orden
      ├─ pending → preparando → listo → entregado
      └─ Notificaciones en cada cambio de estado
```

---

## 7️⃣ PATRONES DE DISEÑO OBLIGATORIOS

### 🎯 Separación de Responsabilidades

```
Models       → Acceso a datos (Firestore) + Cache
Services     → Lógica de negocio + Orquestación
Handlers     → Interacción con usuario + Flujo
Middleware   → Cross-cutting concerns (auth, logging, rate limit)
Utils        → Helpers puros sin side effects
```

### 💾 Patrón Cache-Aside

```javascript
// Implementar en TODOS los modelos

static async getById(id) {
  const cacheKey = `{{entity}}:${id}`;
  return await cache.getOrSet(
    cacheKey,
    async () => {
      const doc = await db.collection('{{collection}}').doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    },
    600 // TTL en segundos
  );
}

// Invalidación después de mutaciones
static async update(id, data) {
  await db.collection('{{collection}}').doc(id).update(data);
  await cache.del(`{{entity}}:${id}`);
  await cache.delPattern('{{related_pattern}}:*');
}
```

### 🔒 Patrón Idempotente (Webhooks)

```javascript
// OBLIGATORIO para todos los webhooks de pago

async function processWebhook(provider, transactionId, data) {
  const idempotencyKey = `webhook:${provider}:${transactionId}`;

  // 1. Intentar adquirir lock (120 segundos)
  const lockAcquired = await cache.acquireLock(idempotencyKey, 120);
  if (!lockAcquired) {
    logger.warn(`Duplicate webhook detected: ${transactionId}`);
    return { status: 'duplicate', transactionId };
  }

  try {
    // 2. Verificar si ya fue procesado
    const payment = await PaymentModel.getByTransactionId(transactionId);
    if (payment?.status === 'success') {
      logger.warn(`Webhook already processed: ${transactionId}`);
      return { status: 'already_processed', transactionId };
    }

    // 3. Procesar pago
    const result = await PaymentService.processPayment(data);

    return { status: 'success', result };
  } finally {
    // 4. Liberar lock SIEMPRE
    await cache.releaseLock(idempotencyKey);
  }
}
```

### 📊 Patrón Repository (Modelos)

```javascript
// Todos los modelos deben seguir este patrón

class {{Entity}}Model {
  static collectionName = '{{collection}}';

  // CRUD básico
  static async create(data) { }
  static async getById(id) { }
  static async getAll(filters = {}) { }
  static async update(id, data) { }
  static async delete(id) { }

  // Queries especializadas
  static async {{queryEspecifica1}}(params) { }
  static async {{queryEspecifica2}}(params) { }

  // Analytics
  static async getStatistics(filters = {}) { }

  // Cache management
  static async invalidateCache(id) { }
  static async prewarmCache() { }
}
```

### 🎭 Patrón Handler Registration

```javascript
// src/bot/handlers/{{module}}/index.js

const registerHandlers = (bot) => {
  // Commands
  bot.command('{{comando}}', handlerFunction);

  // Actions (callbacks)
  bot.action('{{action_estatico}}', handlerFunction);
  bot.action(/^{{action_dinamico}}_(.+)$/, handlerFunction);

  // Text handlers con state machine
  bot.on('text', async (ctx, next) => {
    if (ctx.session.temp?.{{esperando_input}}) {
      // Procesar input
      return;
    }
    return next();
  });

  // Media handlers
  bot.on('photo', handlerFunction);
  bot.on('location', handlerFunction);
};

module.exports = registerHandlers;
```

---

## 8️⃣ MIDDLEWARE OBLIGATORIO

### 🔐 Session Middleware

```javascript
// src/bot/core/middleware/session.js

Características requeridas:
- Backend: Redis con fallback a in-memory
- TTL: 24 horas (configurable)
- Auto-save después de cada request (try-finally)
- Estructura de sesión:
  {
    language: 'en' | 'es',
    userId: number,
    temp: {
      // Estados temporales del flujo actual
      {{estado_temporal_1}}: any,
      {{estado_temporal_2}}: any,
    }
  }

Helpers requeridos:
- saveSession(ctx)
- clearSession(ctx)
- setSessionState(ctx, key, value, ttlMinutes?)
- getSessionState(ctx, key)
```

### ⏱️ Rate Limit Middleware

```javascript
// src/bot/core/middleware/rateLimit.js

Configuración:
- Por usuario (no global)
- Límite: 30 requests/minuto (ajustable)
- Storage: Redis
- Librería: rate-limiter-flexible
- Mensaje de error user-friendly con tiempo de espera
- Excepciones para super admins
```

### ❌ Error Handler Middleware

```javascript
// src/bot/core/middleware/errorHandler.js

Características:
- Captura TODOS los errores no manejados
- Logging completo (stack trace, contexto, userId)
- Integración con Sentry (opcional pero recomendado)
- Mensajes user-friendly por idioma
- Distinción entre errores operacionales y bugs
- Notificación a super admins en errores críticos
```

---

## 9️⃣ CONFIGURACIÓN Y SERVICIOS EXTERNOS

### 🔥 Firebase/Firestore

```javascript
// src/config/firebase.js

Requerimientos:
- Singleton pattern (única instancia)
- Service account authentication
- Variables de entorno:
  - FIREBASE_PROJECT_ID
  - FIREBASE_PRIVATE_KEY
  - FIREBASE_CLIENT_EMAIL

Colecciones requeridas:
- users
- {{coleccion_principal}}
- payments
- {{otras_colecciones}}

Índices requeridos:
- userId + createdAt (descendente)
- status + createdAt (descendente)
- {{indices_especificos}}
```

### 🗄️ Redis

```javascript
// src/config/redis.js

Helpers requeridos:
- get(key)
- set(key, value, ttl?)
- del(key)
- delPattern(pattern)                    // Usa SCAN, no KEYS
- getOrSet(key, fetchFn, ttl)            // Cache-aside
- acquireLock(key, ttl)                  // Distributed lock
- releaseLock(key)
- mget(keys)                             // Batch get
- mset(entries, ttl?)                    // Batch set
- scanKeys(pattern)                      // Non-blocking scan

Configuración:
- URL: process.env.REDIS_URL
- Retry strategy: exponential backoff
- Fallback: in-memory Map si Redis no disponible
```

### 💳 Proveedores de Pago

```javascript
// src/bot/services/paymentService.js

Providers requeridos: {{lista_providers}}  // Ej: ePayco, Daimo, Stripe

Para cada provider implementar:

class {{Provider}}Service {
  // 1. Crear transacción
  static async createPayment(paymentData) {
    // Llamar API del provider
    // Retornar: { paymentUrl, transactionId }
  }

  // 2. Verificar webhook signature
  static verifySignature(payload, signature) {
    // Validar autenticidad
    // Retornar: boolean
  }

  // 3. Procesar webhook
  static async processWebhook(payload) {
    // Parsear datos del provider
    // Retornar: { transactionId, status, amount, metadata }
  }

  // 4. Consultar estado (opcional)
  static async getPaymentStatus(transactionId) {
    // Consultar API del provider
    // Retornar: { status, details }
  }
}
```

---

## 🔟 INTERNACIONALIZACIÓN (i18n)

### 🌍 Sistema de Traducciones

```javascript
// src/utils/i18n.js

Idiomas requeridos: {{idiomas}}           // Por defecto: ['en', 'es']

Estructura de traducciones:
{
  en: {
    welcome: "Welcome to {{botName}}!",
    menu: {
      main: "Main Menu",
      {{seccion}}: "{{traduccion}}"
    },
    errors: {
      generic: "An error occurred. Please try again.",
      {{error_especifico}}: "{{mensaje}}"
    },
    {{categoria_mensajes}}: { }
  },
  es: {
    welcome: "¡Bienvenido a {{botName}}!",
    // ... traducciones
  }
}

Helper function:
t(key, lang, params = {})
  - Soporta dot notation: t('menu.main', 'en')
  - Interpolación de variables: t('welcome', 'en', { botName: 'MyBot' })
  - Fallback a inglés si falta traducción
```

### 🌐 Detección de Idioma

```javascript
Prioridad:
1. ctx.session.language (preferencia guardada)
2. ctx.from.language_code (idioma de Telegram)
3. 'en' (fallback)

Cambio de idioma:
- Comando: /language o /idioma
- Menú de settings
- Durante onboarding
```

---

## 1️⃣1️⃣ LOGGING Y MONITOREO

### 📝 Winston Logger

```javascript
// src/utils/logger.js

Configuración requerida:
- Niveles: error, warn, info, debug
- Transports:
  - Console (desarrollo): formato coloreado
  - File (producción):
    - combined.log (todos los niveles)
    - error.log (solo errores)
  - DailyRotateFile: rotación diaria, 14 días retention

Formato:
- Timestamp ISO
- Level
- Message
- Metadata (userId, action, additionalData)

Uso:
logger.info('User subscribed', { userId, planId });
logger.error('Payment failed', { userId, error, paymentId });
```

### 🚨 Sentry Integration (Opcional pero recomendado)

```javascript
// src/bot/core/bot.js

Características:
- Captura automática de errores no manejados
- Context enrichment (userId, username, action)
- Release tracking
- Environment tags (development, production)
- Error grouping por tipo
```

---

## 1️⃣2️⃣ VALIDACIÓN Y SEGURIDAD

### ✅ Validadores Joi

```javascript
// src/utils/validation.js

Schemas requeridos:
- userSchema
- {{entitySchema}}                       // Ej: orderSchema, bookingSchema
- paymentSchema

Validadores individuales:
- validateEmail(email)
- validatePhone(phone)
- validateUsername(username)
- validate{{CampoEspecifico}}(value)

Sanitización:
- sanitizeHtml(text)                     // Prevenir XSS
- sanitizeInput(text)                    // Limpieza general
- escapeMarkdown(text)                   // Para mensajes Telegram
```

### 🔐 Seguridad

**Obligatorio implementar:**
1. ✅ Rate limiting (30 req/min por usuario)
2. ✅ Webhook signature verification
3. ✅ Input sanitization
4. ✅ SQL injection prevention (usar Firestore queries correctamente)
5. ✅ XSS prevention (sanitizar inputs antes de guardar)
6. ✅ CSRF protection (tokens en webhooks)
7. ✅ Environment variables para secretos
8. ✅ HTTPS only en webhooks
9. ✅ Helmet.js para headers HTTP seguros
10. ✅ CORS configurado correctamente

---

## 1️⃣3️⃣ API REST (Express)

### 🌐 Endpoints Requeridos

```javascript
// src/bot/api/routes.js

Routes:
- POST   /pnp/webhook/telegram                # Telegram webhook
- POST   /api/webhooks/{{provider1}}      # Payment webhook
- POST   /api/webhooks/{{provider2}}
- GET    /api/payment-response            # Redirect después de pago
- GET    /health                          # Health check
- GET    /api/stats                       # Estadísticas (auth requerido)
- {{endpoint_especifico_1}}               # Ej: GET /api/menu
- {{endpoint_especifico_2}}               # Ej: POST /api/orders

Middleware stack:
1. helmet() - Security headers
2. cors() - CORS configurado
3. compression() - Gzip responses
4. express.json() - Parse JSON body
5. express.urlencoded() - Parse URL-encoded
6. morgan() - HTTP logging
7. rateLimitAPI() - Rate limit per IP
8. webhookRateLimit() - Limit específico para webhooks
```

### 🏥 Health Check

```javascript
GET /health

Response:
{
  status: 'ok' | 'degraded' | 'down',
  timestamp: '2024-01-15T10:30:00Z',
  uptime: 3600,
  services: {
    redis: { status: 'ok', latency: 5 },
    firestore: { status: 'ok', latency: 50 },
    telegram: { status: 'ok' }
  }
}
```

---

## 1️⃣4️⃣ TESTING (Opcional pero recomendado)

### 🧪 Estructura de Tests

```javascript
tests/
├── unit/
│   ├── models/
│   ├── services/
│   └── utils/
├── integration/
│   ├── webhooks/
│   └── handlers/
└── e2e/
    └── flows/

Framework: Jest
Coverage mínimo: 60%

Tests críticos obligatorios:
- Webhook idempotency
- Payment processing
- Role-based access control
- Cache invalidation
- Session management
```

---

## 1️⃣5️⃣ VARIABLES DE ENTORNO

### 🔑 .env.example

```bash
# Bot Configuration
BOT_TOKEN=your_telegram_bot_token
BOT_NAME={{nombre_bot}}
NODE_ENV=development

# Admin Configuration
SUPER_ADMIN_USER_IDS=123456,789012        # Comma-separated
ADMIN_USER_IDS=345678,901234

# Firebase
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@project.iam.gserviceaccount.com

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_TTL_DEFAULT=600

# Payment Providers
{{PROVIDER1_API_KEY}}=
{{PROVIDER1_SECRET}}=
{{PROVIDER2_API_KEY}}=
{{PROVIDER2_SECRET}}=

# API Configuration
PORT=3000
WEBHOOK_URL=https://yourdomain.com/pnp/webhook/telegram
API_BASE_URL=https://yourdomain.com

# Monitoring (opcional)
SENTRY_DSN=
SENTRY_ENVIRONMENT=development

# {{Configuraciones_Específicas}}
{{CONFIG_CUSTOM_1}}=
{{CONFIG_CUSTOM_2}}=
```

---

## 1️⃣6️⃣ DEPLOYMENT

### 📦 package.json Scripts

```json
{
  "scripts": {
    "start": "node src/bot/core/bot.js",
    "dev": "nodemon src/bot/core/bot.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "deploy": "{{comando_deploy}}"
  }
}
```

### 🚀 Plataformas Recomendadas

1. **Railway** - Fácil, auto-scaling
2. **Render** - Free tier generoso
3. **Heroku** - Clásico, robusto
4. **DigitalOcean App Platform** - Precios competitivos
5. **VPS** (Ubuntu) - Máximo control

### 🐳 Docker (Opcional)

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 1️⃣7️⃣ DOCUMENTACIÓN REQUERIDA

### 📚 Archivos de Documentación

```
docs/
├── architecture.md                      # Arquitectura del bot
├── deployment.md                        # Guía de despliegue
├── api.md                               # Documentación de API
├── webhooks.md                          # Configuración de webhooks
└── {{doc_especifica}}.md                # Ej: admin-guide.md
```

### 📖 README.md

Debe incluir:
- Descripción del bot
- Features principales
- Requisitos previos
- Instalación paso a paso
- Configuración de variables de entorno
- Comandos disponibles
- Estructura del proyecto
- Testing
- Deployment
- Troubleshooting
- Licencia

---

## 1️⃣8️⃣ MEJORAS OPCIONALES (Nice to have)

- [ ] 📊 Dashboard web para admins
- [ ] 📈 Analytics avanzado (Google Analytics, Mixpanel)
- [ ] 🤖 AI/GPT integration para soporte
- [ ] 🔔 Sistema de notificaciones push
- [ ] 📧 Email notifications
- [ ] 📱 SMS notifications
- [ ] 🌍 Más idiomas (pt, fr, etc.)
- [ ] 🎨 Personalización de temas
- [ ] 📊 Exportación de reportes (PDF, CSV)
- [ ] 🔄 Integración con {{servicio_externo}}
- [ ] 🗂️ Sistema de archivos (fotos, documentos)
- [ ] 👥 Sistema de referidos
- [ ] 🎁 Programa de puntos/recompensas

---

## 1️⃣9️⃣ CRITERIOS DE ACEPTACIÓN

Para considerar el bot **completo y funcional**, debe cumplir:

### ✅ Funcionalidad
- [ ] Todos los comandos funcionan correctamente
- [ ] Flujo de onboarding completo
- [ ] Sistema de roles implementado (user, admin, super_admin)
- [ ] Panel de admin con todas las funcionalidades
- [ ] Flujo de pago end-to-end funcional
- [ ] Webhooks con idempotencia verificada
- [ ] {{feature_especifica_1}} implementada y probada
- [ ] {{feature_especifica_2}} implementada y probada

### ✅ Calidad de Código
- [ ] Arquitectura modular y escalable
- [ ] Separación de responsabilidades clara
- [ ] Código comentado en puntos críticos
- [ ] Sin código duplicado significativo
- [ ] Manejo de errores completo
- [ ] Logging comprehensivo

### ✅ Seguridad
- [ ] Rate limiting activo
- [ ] Validación de inputs
- [ ] Sanitización de datos
- [ ] Webhook signature verification
- [ ] Variables de entorno para secretos
- [ ] HTTPS en producción

### ✅ Performance
- [ ] Cache implementado correctamente
- [ ] Queries optimizadas
- [ ] Índices de Firestore configurados
- [ ] Respuestas < 2 segundos en promedio

### ✅ UX
- [ ] Mensajes claros y concisos
- [ ] Teclados inline bien organizados
- [ ] Feedback inmediato en acciones
- [ ] Manejo de errores user-friendly
- [ ] Soporte multi-idioma

### ✅ DevOps
- [ ] .env.example completo
- [ ] README con instrucciones claras
- [ ] Health check endpoint
- [ ] Logs estructurados
- [ ] Deployment documentado

---

## 2️⃣0️⃣ ENTREGABLES

Al finalizar, debes proveer:

1. **Código completo:**
   - Todos los archivos de la estructura
   - package.json con dependencias
   - .env.example

2. **Documentación:**
   - README.md completo
   - docs/architecture.md
   - Comentarios en código crítico

3. **Guías:**
   - Guía de instalación
   - Guía de configuración
   - Guía de deployment
   - Guía de uso del panel admin

4. **Extras (si aplica):**
   - Scripts de setup
   - Índices de Firestore (JSON)
   - Colección de Postman para API
   - Video/GIF demostrativo

---

## 🎓 RECURSOS DE REFERENCIA

**Documentación oficial:**
- Telegraf: https://telegraf.js.org/
- Firebase/Firestore: https://firebase.google.com/docs/firestore
- Redis: https://redis.io/docs/
- Express: https://expressjs.com/

**Mejores prácticas:**
- Telegram Bot Best Practices: https://core.telegram.org/bots/features
- Node.js Security Checklist: https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html

---

## 💡 NOTAS FINALES

- Mantén el código DRY (Don't Repeat Yourself)
- Sigue el principio SOLID
- Prioriza la legibilidad sobre la brevedad
- Documenta decisiones arquitectónicas importantes
- Implementa primero el MVP, luego features avanzadas
- Testea cada flujo manualmente antes de considerar completo
- Usa async/await consistentemente
- Maneja errores en TODOS los puntos de fallo

---

# 🚀 ¡COMIENZA A DESARROLLAR!

Con este prompt, desarrolla el bot paso a paso:
1. Setup inicial (package.json, .env, estructura de carpetas)
2. Configuración (Firebase, Redis)
3. Modelos de datos
4. Middleware
5. Handlers básicos (onboarding, menú)
6. Sistema de roles
7. Panel de admin
8. {{Features específicas}}
9. Sistema de pagos
10. Testing
11. Deployment
12. Documentación

**IMPORTANTE:** Desarrolla incrementalmente, testeando cada componente antes de continuar.

---

**¿Listo para empezar? ¡Adelante!** 🎉
