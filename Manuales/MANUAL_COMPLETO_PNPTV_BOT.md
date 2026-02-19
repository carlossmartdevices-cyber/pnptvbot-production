# 📚 MANUAL COMPLETO - PNP TV Bot

**Versión**: 2.0 - Consolidado
**Última actualización**: 2026-02-13
**Estado**: Documentación Oficial Completa

---

## 📑 TABLA DE CONTENIDOS

1. [Generalidades del Bot](#1-generalidades-del-bot)
2. [Onboarding de Usuarios](#2-onboarding-de-usuarios)
3. [Sistema de Membresías](#3-sistema-de-membresías)
4. [Sistema de Notificaciones](#4-sistema-de-notificaciones)
5. [Panel de Administración](#5-panel-de-administración)
6. [Sistema de Roles y Permisos](#6-sistema-de-roles-y-permisos)
7. [Difusiones (Broadcasts)](#7-difusiones-broadcasts)
8. [Gestión de Comunidad](#8-gestión-de-comunidad)
9. [Grupos y Canales](#9-grupos-y-canales)
10. [Sistema de Soporte](#10-sistema-de-soporte)
11. [Inteligencia Artificial](#11-inteligencia-artificial-generativa)
12. [PNP Live](#12-pnp-live)

---

---

## 1. GENERALIDADES DEL BOT

### 1.1 Stack Tecnológico

El sistema está construido sobre un stack moderno de JavaScript, contenerizado con Docker para asegurar consistencia.

#### **Lenguaje y Runtime**
- **JavaScript (Node.js)** ≥18.0.0
- **Linter**: ESLint (airbnb-base)
- **Transpilador**: Babel

#### **Frameworks Core**
| Componente | Tecnología | Propósito |
|-----------|-----------|----------|
| Bot Telegram | **Telegraf.js** | Interacción con API de Telegram |
| API Backend | **Express.js** | Endpoints RESTful para webhooks |
| Base de Datos | **PostgreSQL 15** | Almacenamiento de datos principal |
| Caché | **Redis 7** | Caché, sesiones, colas |
| Proxy Inverso | **Nginx** | Manejo de tráfico SSL/HTTPS |

#### **Librerías Clave**
- **Pagos**: `@daimo/pay`, `epayco-sdk-node`, `puppeteer`
- **Autenticación**: `jsonwebtoken` (JWT)
- **Email**: `nodemailer` (SMTP/SendGrid)
- **HTTP**: `axios`
- **Streaming**: `agora-token` (Radio/Hangouts)
- **IA**: `openai`, `grok`
- **i18n**: `i18next` (español/inglés)
- **Logging**: `winston`, `morgan`
- **Testing**: Jest, supertest, chai, sinon

### 1.2 Arquitectura de la Aplicación

El proyecto sigue una **arquitectura de monolito modular** con separación de responsabilidades:

```
src/
├── bot/                    # Lógica del bot de Telegram
│   ├── core/              # Punto de entrada (Telegraf)
│   ├── handlers/          # Manejadores de comandos/acciones
│   ├── middleware/        # Middleware específico del bot
│   ├── services/          # Lógica de negocio
│   └── utils/             # Funciones de utilidad
├── api/                   # API REST (Express)
│   ├── routes/            # Definición de rutas
│   ├── controllers/       # Lógica de petición/respuesta
│   └── middleware/        # Auth, validación, logging
├── services/              # Servicios compartidos
├── models/                # Modelos de datos (PostgreSQL)
├── workers/               # Tareas en segundo plano (cron)
├── config/                # Configuración y variables
├── validation/            # Esquemas de validación
└── utils/                 # Utilidades globales
```

### 1.3 Servicios y Alojamiento

**Modelo**: Auto-alojado (self-hosted) en VPS Linux (Debian/Ubuntu)

**Componentes**:
- `bot`: Aplicación Node.js (incluye bot + API Express)
- `postgres`: Base de datos PostgreSQL
- `redis`: Servidor Redis
- `nginx`: Proxy inverso + SSL/TLS
- `certbot`: Renovación automática de certificados Let's Encrypt

### 1.4 Métodos de Despliegue

#### **Opción 1: Docker (Recomendado)**
```bash
docker-compose up -d
```
- Reproducible y aislado
- Mejor para producción
- Archivos: `docker-compose.yml`, `Dockerfile`

#### **Opción 2: Bare-Metal (Legacy)**
```bash
./deploy-server.sh
```
- Instalación directa en el SO
- Gestión con PM2
- Alternativa más antigua

### 1.5 Gestión de Traducciones (i18n)

**Sistema Formal**: `locales/{idioma}/messages.json`
- Español (es)
- Inglés (en)

**Deuda Técnica**: Muchos textos están hardcodeados en el código:
- Uso de operadores ternarios: `lang === 'es' ? 'Hola' : 'Hello'`
- Literales en respuestas
- Especialmente en servicios de notificación y email

**Archivos Críticos con Hardcoding**:
- `src/services/emailService.js`
- `src/bot/services/messageTemplates.js`
- `src/bot/services/pnpLiveNotificationService.js`
- `src/config/menuConfig.js`

---

## 2. ONBOARDING DE USUARIOS

### 2.1 Flujo del Comando `/start`

1. **Búsqueda/Creación de Usuario**: Verifica si existe en BD
2. **Comprobación de Onboarding**: ¿Ya completado (`onboardingComplete = true`)?
   - ✅ Sí → Mostrar menú principal
   - ❌ No → Iniciar flujo secuencial

### 2.2 Deep Links Soportados

El comando `/start` acepta parámetros para dirigir a secciones específicas:

| Parámetro | Destino |
|----------|---------|
| `activate_lifetime` | Flujo de activación de pase vitalicio (Meru) |
| `promo_CODE` | Aplicar código promocional |
| `plans` | Mostrar planes de suscripción |
| `nearby` | Función "Gente Cercana" |
| `edit_profile` | Editar perfil del usuario |
| `pnp_live` | Menú de shows privados |
| `viewprofile_USERID` | Ver perfil de otro usuario |

### 2.3 Secuencia de Pasos del Onboarding

Si el usuario es nuevo o no completó el proceso:

```
1. Selección de Idioma
   ↓
2. Confirmación de Edad (Age Verification)
   ↓
3. Aceptación de Términos de Servicio
   ↓
4. Solicitud de Email
   ↓
5. Compartir Ubicación (Opcional - para Nearby)
   ↓
6. Finalización
   ├─ Marcar: onboardingComplete = true
   ├─ Enviar bienvenida
   ├─ Generar enlace de invitación (one-time) al grupo
   └─ Mostrar menú principal
```

**Archivo**: `src/bot/handlers/user/onboarding.js`

---

## 3. SISTEMA DE MEMBRESÍAS

### 3.1 Modelo de Datos del Usuario

Tabla `users` - Campos Clave:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `subscription_status` | text | `'active'`, `'free'`, `'churned'` |
| `plan_id` | text | Identificador del plan |
| `plan_expiry` | timestamp | Fecha de expiración (NULL = lifetime) |
| `tier` | derived | `'Prime'` o `'Free'` |
| `subscription.isPrime` | boolean | `true` si `status = 'active'` |

### 3.2 Activación de Membresías

#### **Por Pago (ePayco/Daimo)**

```javascript
// Suscripción con tiempo limitado
UserModel.updateSubscription(userId, {
  status: 'active',
  planId: 'monthly_plan',
  expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 días
});
```

#### **Pases Vitalicios/Códigos**

```javascript
// Membresía permanente
UserModel.updateSubscription(userId, {
  status: 'active',
  planId: 'lifetime_pass',
  expiry: null  // Sin expiración
});
```

**Archivo**: `src/bot/handlers/payments/activation.js`

### 3.3 Control de Acceso

**Nivel 1: Interfaz de Menú**
- Menús dinámicos según `isPrime`
- Usuarios gratuitos no ven opciones premium

**Nivel 2: Lógica de Handler**
```javascript
const isPrime = isPrimeUser(user);
if (!isPrime) {
  return; // Denegar acceso
}
// Continuar...
```

**Nivel 3: Middleware**
- `src/bot/core/middleware/topicPermissions.js`
- Verifica `!user?.subscription?.isPrime` antes de ejecutar handlers

### 3.4 Expiración y Baja

#### **Identificación de Expirados**
- Job cron diario: `MEMBERSHIP_CLEANUP_CRON` (medianoche)
- Invoca: `MembershipCleanupService.runFullCleanup()`

#### **Proceso de Limpieza**

```sql
SELECT * FROM users
WHERE subscription_status = 'active'
AND plan_expiry <= NOW()
```

**Acciones**:
1. Actualizar estado a `'free'` o `'churned'`
2. Limpiar `plan_id` y `plan_expiry`
3. Notificar al usuario
4. Expulsar del canal PRIME

#### **Recordatorios**

| Trabajo | Cuándo | Acción |
|---------|--------|--------|
| `REMINDER_3DAY_CRON` | 3 días antes | Recordatorio de renovación |
| `REMINDER_1DAY_CRON` | 1 día antes | Recordatorio urgente |

**Servicio**: `src/bot/services/subscriptionReminderService.js`

---

## 4. SISTEMA DE NOTIFICACIONES

### 4.1 Canales de Comunicación

| Canal | Uso | Servicio |
|-------|-----|---------|
| **DM Telegram** | Comunicación contextual directa | Varios servicios |
| **Email** | Comunicaciones formales/masivas | `emailService.js` |
| **Canal Admin** | Alertas de negocio (admins solo) | `businessNotificationService.js` |

### 4.2 Tipos de Notificaciones

#### **Transaccionales** (Dirigidas al Usuario)
- Bienvenida al completar onboarding
- Confirmación de pago
- Entrega de grabaciones (PNP Live)
- Facturas
- **Archivos**: `emailService.sendWelcomeEmail()`, `sendInvoiceEmail()`

#### **De Ciclo de Vida** (Dirigidas al Usuario)
- Recordatorio expiración (3 días)
- Recordatorio expiración (1 día)
- Notificación de expiración
- Invitación de renovación
- **Archivo**: `src/bot/services/subscriptionReminderService.js`

#### **Administrativas** (Internas)
- Nuevo usuario registrado
- Pago recibido
- Código de activación usado
- Resumen de limpieza diaria
- **Archivo**: `src/bot/services/businessNotificationService.js`

#### **Broadcast y Marketing**
- Newsletters por email
- Anuncios por Telegram
- Campañas de reactivación
- **Archivos**: `emailService.sendBroadcastEmails()`, `broadcastScheduler.js`

### 4.3 Servicios de Notificación

#### **BusinessNotificationService**

Envía alertas administrativas a un canal de Telegram.

**Env Variable**: `NOTIFICATION_CHANNEL_ID`

**Métodos**:
```javascript
// Pago recibido
notifyPayment({ userId, planName, amount, provider, transactionId, customerName })

// Nuevo usuario
notifyNewUser({ userId, username, firstName, language })

// Código activado
notifyCodeActivation({ userId, username, code, product })

// Resumen diario de limpieza
notifyCleanupSummary({ statusUpdates, channelKicks })
```

#### **PaymentNotificationService**

Notificaciones especializadas para pagos.

**Env Variables**:
- `ADMIN_ID`: ID del admin
- `SUPPORT_GROUP_ID`: ID del grupo de soporte
- `PRIME_CHANNEL_ID`: Canal de miembros prime

**Métodos Principales**:
```javascript
// Confirmación al usuario
sendPaymentConfirmation({ bot, userId, planId, amount, expiryDate })

// Alerta a admin
sendAdminPaymentNotification({ userId, planName, amount, transactionId })

// Resumen diario
sendAdminDailySummary({ totalPayments, totalAmount, payments })
```

#### **EmailService**

Gestor central de emails con múltiples plantillas.

**Config**:
```bash
# SendGrid (Preferido)
SENDGRID_API_KEY=sg_xxxxx

# O SMTP genérico
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=user@email.com
SMTP_PASSWORD=password
```

**Plantillas**:
- `sendWelcomeEmail()` - Onboarding nuevo usuario
- `sendBroadcastEmail()` - Marketing/anuncios
- `sendInvoiceEmail()` - Recibos de pago
- `sendReactivationEmail()` - Promociones
- `sendRecordingReady()` - Grabaciones listas

---

## 5. PANEL DE ADMINISTRACIÓN

### 5.1 Acceso

**Comando**: `/admin` (chat privado con el bot)

**Control**: Acceso basado en roles (Super Admin, Admin, Moderator)

### 5.2 Secciones Principales

#### **👥 Gestión de Usuarios**

**Acciones por usuario**:
- Editar perfil (username, email)
- Cambiar tier (Prime ↔ Free)
- Cambiar estado de suscripción
- Extender suscripción
- Activación manual
- Banear/Desbanear
- Forzar verificación de edad
- Enviar mensaje directo

#### **👑 Gestión de Roles**

**Función**: Mostrar y gestionar Super Admins, Admins y Moderators

**Acciones**:
- Promover/Degradar roles
- Respetar jerarquía de permisos
- Solo visible para Super Admin y Admin

#### **📢 Difusiones (Broadcasts)**

**Asistente Interactivo**:
1. Seleccionar audiencia (todos, premium, free, churned)
2. Adjuntar media (fotos, videos, documentos)
3. Escribir mensaje (en/es)
4. Añadir botones interactivos
5. **Generación con IA**: Usar Grok para generar texto
6. Programar o enviar ahora
7. Opción de envío por email

**Gestión de Cola**:
- Ver estado de broadcasts
- Pausar/Reanudar
- Reintentar fallidos

#### **📦 Administración de Contenido**

- **Limpieza de Comunidad**: `/cleanupcommunity` - Elimina spam del grupo
- **Nearby Places**: Aprobar/rechazar sugerencias de lugares
- **Publicaciones en X**: Crear y programar tweets con IA

#### **📊 Estadísticas y Reportes**

- **Quick Stats**: `/stats` - Resumen en tiempo real
- **Webhooks de Pago**: Eventos de pago recientes
- **Security Report**: Eventos de seguridad
- **Modo Vista Previa**: `/viewas` - Ver bot como usuario FREE/PRIME

#### **🧠 Herramientas Especiales**

- **Cristina Admin**: Alimentar a Cristina (IA) con info actualizada
- **Logs**: Acceso a registros del bot (Solo Super Admin)
- **Enlaces PRIME**: `/send_prime_links` - Generar invites

---

## 6. SISTEMA DE ROLES Y PERMISOS

### 6.1 Componentes

| Componente | Archivo | Función |
|-----------|---------|---------|
| Modelo | `permissionModel.js` | Jerarquía, permisos, asociaciones |
| Servicio | `permissionService.js` | Lógica de comprobación y asignación |
| Handlers | `userManagementHandler.js`, `roleManagement.js` | Menús/comandos admin |

### 6.2 Jerarquía de Roles

```
🔴 Super Admin (Nivel 3)
├── Acceso total a todas las funciones
├── Puede gestionar otros admins
└── Definido en env: ADMIN_ID

🟡 Admin (Nivel 2)
├── Gestión de usuarios, difusiones, analíticas
├── No puede gestionar Super Admins
└── Definido en: ADMIN_USER_IDS o asignado via comando

🟢 Moderator (Nivel 1)
├── Permisos limitados (soporte)
├── Puede ver info de usuarios
└── No puede hacer cambios significativos

👤 User (Nivel 0)
└── Sin permisos administrativos
```

### 6.3 Comprobación de Permisos

**Fuente Híbrida**:
1. Primero: Variables de entorno (`ADMIN_ID`, `ADMIN_USER_IDS`)
2. Luego: Campo `role` en base de datos

**Jerarquía**: Un rol inferior NO puede modificar a uno superior

### 6.4 Comandos de Administración

#### **Gestión de Usuarios**

```
/admin → Usuarios → [Buscar por ID/username/email]
  ├─ Banear/Desbanear
  ├─ Cambiar Username/Email
  ├─ Cambiar Tier/Suscripción
  └─ Enviar Mensaje Directo
```

#### **Gestión de Roles**

```
/admin → Roles → [Panel de Roles]
  ├─ ➕ Agregar Moderador/Admin
  └─ Promover/Degradar/Remover
```

---

## 7. DIFUSIONES (BROADCASTS)

### 7.1 Componentes

| Componente | Archivo |
|-----------|---------|
| Creación | `src/bot/handlers/admin/broadcast.js` |
| Envío Inmediato | `src/bot/services/adminService.js` |
| Programación | `src/services/broadcastScheduler.js` |
| Email | `src/services/emailService.js` |
| BD | Tabla `broadcasts` |

### 7.2 Flujo 1: Difusión Inmediata

```
1. Admin crea difusión y elige "Enviar Ahora"
   ↓
2. Se llama adminService.sendBroadcast()
   ↓
3. Se registra en BD con estado 'sending'
   ↓
4. Se obtiene lista de usuarios (aplicando filtros)
   ↓
5. Loop: Enviar a cada usuario con pequeña pausa entre envíos
   (evitar rate-limit de Telegram)
   ↓
6. Se actualiza BD a 'completed' o 'completed_with_errors'
   ↓
7. Reporte de cuántos exitosos/fallidos
```

### 7.3 Flujo 2: Difusión Programada

```
1. Admin crea difusión y elige "Programar"
   ↓
2. Se solicita fecha/hora
   ↓
3. Se guarda en BD con estado 'pending' + scheduled_at
   ↓
4. broadcastScheduler corre cada minuto
   ├─ Busca broadcasts pending cuya scheduled_at está en el pasado
   ├─ Adquiere bloqueo Redis (evitar duplicados en múltiples instancias)
   ├─ Envía la difusión
   └─ Actualiza estado a 'completed'
```

### 7.4 Difusión por Email

```
emailService.sendBroadcastEmails(users, broadcastData)
├─ Itera sobre usuarios
├─ Valida email seguro (previene ataques de parsing)
├─ Envía personalizado
└─ Reporte: sent, failed, errors
```

**Seguridad**: Se rechaza emails con quoted local-parts maliciosos
- ❌ `"test@evil"@example.com` → Bloqueado
- ✅ `test@example.com` → Permitido

---

## 8. GESTIÓN DE COMUNIDAD

### 8.1 Ecosistema Comunitario

**Componentes**:
- Manejador Wall of Fame: `src/bot/handlers/group/wallOfFame.js`
- Servicio de Limpieza: `src/bot/services/groupCleanupService.js`
- Servicio de Popularidad: `src/bot/services/mediaPopularityService.js`
- Planificador: `src/bot/services/mediaPopularityScheduler.js`

**ID de Grupo**: `GROUP_ID`

### 8.2 Contenido Generado por Usuario (UGC)

#### **Flujo de Publicación: "Wall of Fame"**

```
1. Usuario publica foto/video en grupo público
   ↓
2. wallOfFame.js detecta (bot.on(['photo', 'video']))
   ↓
3. Re-publica en tema "Wall of Fame"
   (WALL_OF_FAME_TOPIC_ID)
   ↓
4. Añade automaticamente:
   ├─ Acreditación al autor
   ├─ Botones: 👍 Me gusta | 👎 No me gusta
   └─ Leyenda personalizada
   ↓
5. Esta copia es PERMANENTE (no se elimina)
```

### 8.3 Sistema de Popularidad y Recompensas

```
1. Otros miembros votan: 👍 / 👎
   ↓
2. wallOfFame.js registra votos
   (bot.action(/^(like|dislike):.../)
   ↓
3. mediaPopularityScheduler ejecuta jobs:
   ├─ Diario: Top del Día
   ├─ Semanal: Top de la Semana
   └─ Mensual: Top del Mes
   ↓
4. mediaPopularityService analiza votos
   ↓
5. Bot anuncia ganadores en grupo
   ↓
6. Ganadores reciben premios (ej: acceso temporal a Prime)
```

### 8.4 Moderación

#### **Automática (Limpieza de Spam)**

**Servicio**: `groupCleanupService.js`

**Ejecución**: Cron job dos veces al día

**Detección de Spam**:
- Comandos no autorizados
- Idiomas no permitidos (detecta si NO es es/en)
- Exceso de URLs
- Caracteres especiales abundantes
- Mensajes en MAYÚSCULAS puro

**Acción**: Eliminar mensajes con spam + edad > 12 horas

#### **Manual (Comandos Admin)**

- Expulsar/banear usuarios
- Eliminar mensajes
- Aprobar/rechazar contenido
- Comando: `/rules` - Ver reglas de comunidad

---

## 9. GRUPOS Y CANALES

### 9.1 Grupo Comunitario (Público)

**ID Env**: `GROUP_ID`

**Gestión de Contenido**:
- Contenido de usuarios: público, moderado
- Contenido admin: asistente de creación/programación

**Moderación Automática**:
- Limpieza 2x/día de spam
- Elimina msgs > 12h y marcados como spam

**Moderación Manual**:
- Comandos admin para banear/expulsar
- Eliminación manual

### 9.2 Canal PRIME (Exclusivo para Miembros)

**ID Env**: `PRIME_CHANNEL_ID` (default: `-1002997324714`)

#### **Gestión de Acceso - ENTRADA**

```
Usuario activa membresía (pago o código)
   ↓
activation.js o paymentService.js llama:
bot.telegram.createChatInviteLink()
   ↓
Se genera enlace one-time
(expira después de corto período)
   ↓
Bot envía enlace por DM
   ↓
Usuario se une al canal PRIME
```

**Seguridad**: Enlace de un solo uso = previene compartición

#### **Gestión de Acceso - SALIDA**

```
membershipCleanupService.js (cron diario)
   ↓
Busca usuarios con suscripción expirada
   ↓
Para cada usuario:
├─ banChatMember(channelId, userId)
│  └─ Expulsa del canal
├─ unbanChatMember(channelId, userId)
│  └─ Quita baneo
│     (permite re-entrada con nuevo enlace si renueva)
└─ Notificar al usuario
```

### 9.3 Grupo de Soporte (Interno para Admins)

**ID Env**: `SUPPORT_GROUP_ID`

**Características**:
- Privado
- Función "Temas" (Topics) activada

**Gestión**:
- **Creación de Tickets**: `supportRoutingService.js` crea tema por usuario
- **Acceso de Agentes**: Manual (añadir admins/mods al grupo)
- **Cierre**: Automático al marcar resuelto

---

## 10. SISTEMA DE SOPORTE

### 10.1 Componentes

| Componente | Archivo |
|-----------|---------|
| Servicio Principal | `supportRoutingService.js` |
| Modelo de Datos | `supportTopicModel.js` (tabla `support_topics`) |
| Grupo | `SUPPORT_GROUP_ID` (privado, con Topics) |
| Punto de Entrada | `/support` o botón "Ayuda" |

### 10.2 Flujo de una Conversación

#### **PASO 1: Usuario Inicia**

```
Usuario envía: /support [mensaje de ayuda]
   ↓
Se invoca: supportRoutingService.getOrCreateUserTopic()
```

#### **PASO 2: Creación del "Ticket"**

```
¿Existe tema para este usuario?
   ├─ NO:
   │  ├─ API Telegram: crear nuevo tema
   │  ├─ Nombre: "📬 @usuario (12345678)"
   │  ├─ Guardar: user_id → thread_id en BD
   │  └─ Publicar mensaje inicial con:
   │     ├─ Resumen de usuario
   │     ├─ Prioridad/Categoría (detectada por keywords)
   │     └─ Botones de acción rápida
   │
   └─ SÍ:
      ├─ Reutilizar thread_id existente
      └─ Si estaba cerrado, reabrir
```

#### **PASO 3: Enrutamiento de Mensajes**

**Usuario → Grupo de Soporte**:
```
Usuario envía mensaje
   ↓
supportRoutingService.forwardUserMessage()
   ├─ Toma mensaje (texto, imagen, documento, etc.)
   ├─ Lo reenvía al tema en grupo de soporte
   └─ Añade encabezado: "[ID Usuario] - Nombre"
```

**Grupo de Soporte → Usuario**:
```
Agente responde en el tema del grupo
   ↓
Bot detecta respuesta
   ↓
supportRoutingService.sendReplyToUser()
   ├─ Busca: thread_id → user_id
   ├─ Envía DM al usuario
   ├─ Prefijo: "💬 *Admin (Soporte):*"
   └─ Añade reacción 👍 al mensaje del agente (confirmación)
```

### 10.3 Gestión del Ciclo de Vida

| Característica | Función |
|---------------|---------|
| Asignación | Auto-asignar a agente disponible |
| Cierre | Agentes marcan "resuelto" |
| Encuestas | Satisfacción después de cierre |
| SLA Monitoring | Alertas si no atendido en tiempo |

---

## 11. INTELIGENCIA ARTIFICIAL GENERATIVA

### 11.1 Generación de Contenido para Admins

**Servicio**: `src/bot/services/grokService.js`

**Usar en**: Asistentes de admin (ej: "Compartir Publicación")

**Funcionamiento**:
```
1. Admin proporciona idea/borrador
   (Ej: "anunciar nuevo video de Lex")
   ↓
2. Se invoca grokService con "modo" específico
   (broadcast, salesPost, etc.)
   ↓
3. grokService construye prompt de sistema DETALLADO
   ├─ Persona: "Meth Daddy / Santino"
   ├─ Tono: dominante, oscuro
   ├─ Lenguaje: jerga colombiana, temática PnP
   ├─ Formato, emojis, hashtags
   └─ Reglas estrictas
   ↓
4. Se envía a Grok API
   ↓
5. Grok devuelve texto redactado, listo para publicar
   ├─ En inglés
   └─ En español (simultáneamente)
```

**Resultado**: Sonido como si lo escribiera "Meth Daddy"

### 11.2 Asistente de Soporte "Cristina"

**Handler**: `src/bot/handlers/support/cristinaAI.js`

**Servicio**: `src/bot/services/cristinaAIService.js`

**Comando**: `/cristina [pregunta]`

#### **Personalidad**
- Asistente de soporte profesional
- Empática y conocedora
- Identidad: mujer trans afrolatina, lesbiana
- Tono definido en prompt de sistema

#### **Base de Conocimiento Dinámica**

```
CristinaAdminInfoService actualiza prompt con:
├─ Precios actuales de planes
├─ Estado del bot
└─ Información reciente del admin

Esto asegura respuestas actualizadas
```

#### **Lógica de Respuesta**

**Intento 1: Respuesta con IA**
```
Usuario pregunta: "¿Cómo pago?"
   ↓
Se envía a Grok:
├─ Pregunta del usuario
├─ Personalidad de Cristina
└─ Historial breve (contexto)
   ↓
Grok devuelve respuesta en español/inglés
```

**Intento 2: Fallback con Palabras Clave**
```
Si Grok falla/no está disponible:
   ↓
Buscar palabras clave en pregunta
(pago, suscripción, reglas, etc.)
   ↓
Devolver respuesta predefinida útil
```

### 11.3 Moderación de Contenido

**Servicio**: `src/services/aiModerationService.js`

**Estado Actual**: Mock (simulación)
- Busca en listas predefinidas (badWords, sexualWords)
- Asigna puntuación de toxicidad

**Visión Futura**: Integración real
- Perspective API de Google
- O endpoint de moderación de OpenAI
- Acciones escalonadas: Advertencia → Silencio → Baneo

---

## 12. PNP LIVE

### 12.1 Componentes Clave

| Servicio | Archivo | Función |
|---------|---------|---------|
| Principal | `pnpLiveService.js` | Orquestador central |
| Disponibilidad | `pnpLiveAvailabilityService.js` | Inventario de tiempo |
| Horarios | `pnpLiveTimeSlotService.js` | Lógica de disponibilidad |
| Notificaciones | `pnpLiveNotificationService.js` | Comunicaciones de reservas |
| Videochat | `jaasService.js` | Jitsi-As-A-Service |
| Worker | `pnpLiveWorker.js` | Tareas cron |
| Flujo | `pnpLiveHandler.js` | Asistente conversacional |

### 12.2 Flujo de Reserva

#### **PASO 1️⃣: Descubrimiento y Selección**

```
Usuario inicia (/start pnp_live o botón en menú)
   ↓
Ver lista de modelos disponibles
   ├─ Fotos
   └─ Valoraciones
   ↓
Seleccionar:
├─ Modelo
└─ Duración (15, 30, 60 min, etc.)
```

#### **PASO 2️⃣: Elección de Horario**

```
1. Seleccionar DÍA
   (días con disponibilidad del modelo)
   ↓
2. Seleccionar HORA
   (slots específicos libres)
```

#### **PASO 3️⃣: Reserva y Pago**

```
1. pnpLiveAvailabilityService pone HOLD
   ├─ Bloquea slot durante X minutos
   └─ Permite al usuario pagar sin que otros tomen el sitio

2. Mostrar resumen:
   ├─ Modelo, duración, fecha, hora, precio
   └─ Pedir confirmación final

3. Crear booking en BD
   └─ Estado: pending_payment

4. Generar enlace de pago (ePayco)
   └─ Enviar al usuario
```

#### **PASO 4️⃣: Confirmación y Realización**

```
1. Usuario paga
   ↓
2. Webhook confirma pago
   └─ Estado booking: confirmed

3. jaasService genera sala Jitsi
   ├─ Token usuario
   └─ Token modelo

4. pnpLiveNotificationService envía recordatorios
   ├─ 5 min antes (usuario + modelo)
   └─ Con enlaces de acceso Jitsi

5. Usuario + Modelo se unen a sala Jitsi
   ↓
6. Realizan el show privado
```

#### **PASO 5️⃣: Post-Show**

```
1. pnpLiveWorker detecta fin del horario
   ↓
2. Actualiza estado booking: completed
   ↓
3. Envía solicitud de feedback al usuario
   └─ ¿Cómo fue tu experiencia con el modelo?
```

### 12.3 Retención de Horarios (Hold)

**Mecanismo Anti-Overbooking**:
```
Usuario selecciona hora
   ↓
pnpLiveAvailabilityService.holdSlot()
   ├─ Bloquea slot por X minutos (ej: 10)
   ├─ Si usuario no paga en tiempo
   └─ Slot se libera automáticamente

Esto permite:
✅ Usuario intenta pagar sin perder horario
❌ Evita que alguien lo quite mientras paga
```

### 12.4 Estados de la Reserva

| Estado | Significado |
|--------|------------|
| `pending_payment` | Creada, esperando pago |
| `confirmed` | Pago recibido |
| `completed` | Show terminado |
| `cancelled` | Cancelada |
| `no_show` | No se presentó |

---

---

## 📋 RESUMEN DE VARIABLES DE ENTORNO CLAVE

```bash
# Bot de Telegram
TELEGRAM_BOT_TOKEN=123456:ABCdefGHIjklmnoPQRstuvwxyz

# Base de Datos
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_PASSWORD=secure_password
POSTGRES_DB=pnptv_bot
DATABASE_URL=postgresql://...

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# IDs de Telegram (Chats/Canales)
GROUP_ID=-1001234567890          # Grupo público
PRIME_CHANNEL_ID=-1002997324714  # Canal PRIME
SUPPORT_GROUP_ID=-1001234567890  # Grupo soporte
NOTIFICATION_CHANNEL_ID=-1001234567890  # Canal admin
ADMIN_ID=123456789               # Super admin
ADMIN_USER_IDS=111111,222222     # Otros admins

# Temas
WALL_OF_FAME_TOPIC_ID=123

# Email
SENDGRID_API_KEY=sg_xxxxx
# O SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email@gmail.com
SMTP_PASSWORD=password
EMAIL_FROM=noreply@pnptv.app

# IA
GROK_API_KEY=sk-xxxxx
OPENAI_API_KEY=sk-xxxxx

# Pagos
EPAYCO_PUBLIC_KEY=xxxxx
EPAYCO_PRIVATE_KEY=xxxxx
DAIMO_API_KEY=xxxxx
EPAYCO_TEST_MODE=true/false

# Node
NODE_ENV=production
PORT=3001
```

---

## 📖 ARCHIVOS DE REFERENCIA RÁPIDA

| Función | Archivo |
|---------|---------|
| Stack general | `src/bot/core/bot.js` |
| Comandos | `src/bot/handlers/` |
| API REST | `src/api/routes/` |
| Servicios | `src/services/`, `src/bot/services/` |
| Modelos BD | `src/models/` |
| Configuración | `src/config/` |
| Tests | `src/__tests__/` |
| Docker | `docker-compose.yml` |
| Nginx | `nginx-config-updated.conf` |

---

## 🔗 RELACIONES ENTRE MÓDULOS

```
Usuario (Telegram)
    ↓
Bot Telegraf
    ├─→ Handlers (Comandos, Acciones)
    │   └─→ Services (Lógica)
    │       └─→ Models (BD)
    │
    ├─→ API REST (Express)
    │   ├─→ Controllers
    │   ├─→ Middleware
    │   └─→ Services
    │
    └─→ Workers (Cron)
        └─→ Services
            └─→ Models

Webhooks (Pagos)
    ↓
API REST
    ↓
Services de Pago
    ├─→ Actualizar BD
    ├─→ Enviar notificaciones
    └─→ Generar invites
```

---

**Documento compilado**: 2026-02-13
**Versión**: 2.0 - Consolidado Completo
**Estado**: ✅ Listo para Producción
