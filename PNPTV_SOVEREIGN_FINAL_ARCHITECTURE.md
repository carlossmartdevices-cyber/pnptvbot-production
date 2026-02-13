# 🧠 PNPtv SOVEREIGN - Arquitectura Final
**Fecha:** 2026-02-13
**Versión:** 2.0 - FINAL
**Stack:** Mastodon + Matrix/Element + Jitsi + Backend PNPtv

---

## 🎯 VISIÓN FINAL

**PNPtv es una plataforma social completamente soberana y descentralizada:**

```
ANTES (Centralizado en Telegram/Zoom):
  Telegram → Chat + comunidad + anuncios
  Zoom/Jitsi → Video
  Website → Perfil + monetización

DESPUÉS (100% Soberano):
  🌐 Mastodon → Red social + feed + identidad
  💬 Matrix/Element → Chat descentralizado + grupos
  📞 Jitsi → Video rooms + llamadas
  💳 Backend PNPtv → Pagos + verificación + moderación
```

---

## 🏗️ ARQUITECTURA DE 4 CAPAS

### **CAPA 1: MASTODON** 🌐
**Función:** Red social pública (identidad + comunidad)

**URL:** `social.pnptv.app`

**Identidad usuario:** `usuario@social.pnptv.app`

**Características:**
- ✅ Feed social (posts, multimedia, reposts)
- ✅ Perfiles verificados de performers
- ✅ Followers/seguimiento
- ✅ Hashtags (#pnptv, #performer, #liveshow)
- ✅ Anuncios de eventos
- ✅ Comunidad persistente
- ✅ Menciones @ y notificaciones

**Reemplaza:**
- ❌ Canal Telegram
- ❌ Grupo Telegram
- ❌ Parte del website (community section)

**Ejemplo de post:**
```
🔴 LIVE NOW — Room with Alex
Viernes 20:00 UTC
Chat: matrix:pnptv.app/#livealex2026
Video: jitsi.pnptv.app/livealex2026

Entrada: $5 USD
#pnptv #performer #liveshow

@performer_alex has started streaming
```

---

### **CAPA 2: MATRIX + ELEMENT** 💬
**Función:** Chat descentralizado + grupos privados

**URL Homeserver:** `matrix.pnptv.app`

**Cliente Web:** `element.pnptv.app`

**Identidad usuario:** `usuario:pnptv.app` (o `usuario:matrix.pnptv.app`)

**Características:**
- ✅ Mensajería 1:1 cifrada (E2E)
- ✅ Grupos/salas públicas y privadas
- ✅ Soporte de multimedia
- ✅ Notificaciones en tiempo real
- ✅ Backup de mensajes
- ✅ Integración con bots
- ✅ Roles y permisos (moderadores, admins)
- ✅ Rooms permanentes (backstage, VIP, etc.)

**Tipos de salas:**
```
#general         → Público, chat general
#performers      → Público, solo performers verificados
#vip-access      → Privado, acceso pago
#livealex2026    → Privado, durante evento en vivo
#support         → Público, soporte técnico
#backstage       → Privado, solo staff
```

**Reemplaza:**
- ❌ Telegram DMs
- ❌ Telegram groups
- ❌ Telegram channels (parcialmente)

**Ejemplo de flujo:**
```
1. Performer publica en Mastodon
   "LIVE NOW - Chat aquí: #livealex2026"

2. Usuarios se unen a sala Matrix
   → Leen el post en Mastodon
   → Toquean link #livealex2026
   → Se unen a la sala cifrada en Matrix

3. Durante el stream
   → Chatean en Matrix (E2E cifrado)
   → Video en Jitsi (P2P)
   → Pagan tips en backend

4. Después del stream
   → La sala queda como archivo
   → Nuevos miembros pueden ver historial
```

---

### **CAPA 3: JITSI** 📞
**Función:** Video rooms + llamadas (P2P y conferencias)

**URL:** `jitsi.pnptv.app`

**Características:**
- ✅ Video rooms (sin servidor de video)
- ✅ Llamadas 1:1
- ✅ Conferencias de grupo
- ✅ Pantalla compartida
- ✅ Chat integrado en room
- ✅ Grabación (opcional)
- ✅ P2P cuando es posible
- ✅ Bajo requerimiento de bandwidth
- ✅ Works behind NAT/firewall

**Tipos de rooms:**
```
jitsi.pnptv.app/livealex2026         → Room público (liveshow)
jitsi.pnptv.app/private_call_user123 → Room privado (1:1)
jitsi.pnptv.app/vip_backstage        → Room VIP (acceso limitado)
jitsi.pnptv.app/group_session_5users → Room grupal
```

**Reemplaza:**
- ❌ Zoom
- ❌ Jitsi externo
- ❌ Telegram video calls
- ❌ Hangouts (video P2P)

**Seguridad:**
- ✅ Rooms requieren password (generado dinámicamente)
- ✅ Solo acceso pagado = room privado
- ✅ Moderador puede kickear usuarios
- ✅ Audio/video can be disabled per user

---

### **CAPA 4: BACKEND PNPTV** 🔧
**Función:** Glue logic (pagos, verificación, moderación, analytics)

**Stack:** Node.js + Express + PostgreSQL + Redis

**APIs que consume:**
- ✅ Mastodon API (crear posts, usuarios, etc.)
- ✅ Matrix API (crear rooms, invitar usuarios, etc.)
- ✅ Jitsi REST API (crear rooms dinámicamente)
- ✅ ePayco API (pagos)
- ✅ Meru API (pagos alternativos)

**Responsabilidades:**
```
1. AUTENTICACIÓN
   - Usuario se registra en PNPtv
   - Backend crea cuenta Mastodon
   - Backend crea cuenta Matrix
   - Backend genera JWT tokens

2. USUARIOS & ROLES
   - Verificar performers
   - Asignar roles (viewer, performer, moderator, admin)
   - Manage bans/blocks

3. EVENTOS & STREAMS
   - Crear room Jitsi dinámicamente
   - Crear sala Matrix para chat
   - Publicar anuncio en Mastodon
   - Generar link de acceso

4. PAGOS & MONETIZACIÓN
   - Procesar pagos (ePayco, Meru)
   - Grant acceso a rooms privados
   - Registrar tips
   - Split revenue (performer vs plataforma)

5. MODERACIÓN
   - Moderar posts en Mastodon
   - Moderar mensajes en Matrix
   - Kickear de rooms Jitsi
   - Baneos y sanciones

6. ANALYTICS
   - Registrar quien se une
   - Duración de sesión
   - Ingresos por evento
   - Engagement metrics
```

**Endpoints principales:**
```
POST /api/auth/register
  → Crear cuenta Mastodon + Matrix

POST /api/events/create
  → Crear liveshow (Jitsi room + Matrix room + Mastodon post)

POST /api/events/{id}/pay
  → Pagar entrada
  → Grant acceso a room Jitsi

GET /api/events/{id}/participants
  → Analytics de sesión

POST /api/moderation/ban
  → Banear usuario
```

---

## 🔗 FLUJO COMPLETO: DE INICIO A LIVESHOW

### **FLUJO 1: Usuario se registra**

```
1. Usuario va a pnptv.app
2. Hace clic "Sign up"
3. Backend crea:
   ✅ Cuenta Mastodon (usuario@social.pnptv.app)
   ✅ Cuenta Matrix (usuario:pnptv.app)
   ✅ Registro local en BD PNPtv
4. Usuario recibe JWT token
5. Puede acceder a:
   - Mastodon (social.pnptv.app)
   - Element (element.pnptv.app)
   - Dashboard PNPtv (pnptv.app/dashboard)
```

---

### **FLUJO 2: Performer anuncia liveshow**

```
1. Performer inicia sesión en pnptv.app/dashboard
2. Click "Create Live Stream"
3. Backend crea:
   ✅ Jitsi room (jitsi.pnptv.app/livealex2026)
   ✅ Matrix room (#livealex2026:pnptv.app)
   ✅ Mastodon post (en feed)
4. Backend publica en Mastodon:

   "🔴 LIVE NOW — Alex
   Viernes 20:00 UTC

   Chat en Matrix: #livealex2026
   Video: jitsi.pnptv.app/livealex2026

   Entrada: $5 USD

   #pnptv #performer #liveshow"

5. Followers ven post en feed
6. Se propaga en red Mastodon (federación)
```

---

### **FLUJO 3: Usuario se une al liveshow**

```
1. Usuario ve post en Mastodon
2. Lee: "LIVE NOW - Alex"
3. Toca botón "Join Room"
   (o copia link a Jitsi)
4. Redirige a: jitsi.pnptv.app/livealex2026
5. Backend valida:
   - ¿Usuario pagó?
   - Si NO pagó → Pedir pago
   - Si SÍ pagó → Grant acceso
6. Usuario entra a room Jitsi
7. Toca link a Matrix → se une a #livealex2026
8. Ahora puede:
   ✅ Ver video (Jitsi)
   ✅ Chatear (Matrix)
   ✅ Enviar tips (Backend)
```

---

### **FLUJO 4: Pago y acceso**

```
1. Usuario intenta unirse
   → Backend: ¿Tiene acceso a este room?
   → No tiene

2. Backend muestra checkout:
   "Acceso a room $5 USD"

3. Usuario paga (ePayco/Meru)

4. Backend registra:
   - user_id: 123
   - room_id: livealex2026
   - amount: 5 USD
   - payment_ref: xxx
   - status: completed

5. Backend grant acceso:
   - Jitsi: agregar a whitelist
   - Matrix: invitar a room (si es privada)

6. Usuario ya puede entrar

7. Analytics:
   - Participantes: +1
   - Ingresos: +$5
   - Duración: tracked
```

---

## 📊 IDENTIDADES DEL USUARIO

Cada usuario tiene 3 identidades integradas:

```
MASTODON:
  usuario@social.pnptv.app
  └─ Red social, feed, perfiles

MATRIX:
  usuario:pnptv.app
  └─ Chat, mensajería, grupos

BACKEND PNPtv:
  user_id: uuid
  jwt_token: xxxxx
  └─ Pagos, verificación, roles
```

**Vinculación automática:**
```
Registration en PNPtv
  ↓
Backend crea 3 cuentas
  ↓
Usuario solo ingresa credenciales una vez
  ↓
SSO automático en Mastodon + Matrix + Jitsi
```

---

## 🛠️ STACK TÉCNICO FINAL

### **MASTODON**
```
Framework:     Ruby on Rails
Database:      PostgreSQL
Cache:         Redis
Storage:       S3 o Local
Proxy:         Nginx
Memory:        2GB+ (recomendado 4GB)
Disk:          50GB+ (para media)
```

### **MATRIX HOMESERVER**
```
Server:        Synapse (Python)
Database:      PostgreSQL
Cache:         Redis
Client:        Element (React)
Proxy:         Nginx
Memory:        1-2GB
Disk:          20GB+ (para mensajes)
```

### **JITSI**
```
Server:        Prosody (Lua)
Video Bridge:  jitsi-videobridge (Java)
Proxy:         Nginx
Client:        web-based
Memory:        2GB+ (para video)
Disk:          10GB (logs)
```

### **BACKEND PNPtv**
```
Runtime:       Node.js 18+
Framework:     Express.js
Database:      PostgreSQL
Cache:         Redis
APIs:          REST
Auth:          JWT + OAuth2
```

---

## 💰 MONETIZACIÓN INTEGRADA

```
FLUJO DE INGRESOS:

Performer crea stream
       ↓
Post en Mastodon + room en Jitsi + chat en Matrix
       ↓
Usuarios ven en feed
       ↓
Pagan entrada ($X USD)
       ↓
Backend procesa pago
       ↓
Usuario puede entrar
       ↓
Analytics registran:
   - Participantes
   - Duración
   - Ingresos
   - Engagement
       ↓
Performer recibe pago (70%)
Backend retiene (30%)
```

**Modelos de ingreso:**
```
1. Pay-per-room
   $5 para entrar a room

2. Suscripciones
   $10/mes = acceso a todos los streams de performer

3. Tips durante stream
   Usuario envía tip
   Notificación en Jitsi

4. Premium features
   - Verified badge ($5/mes)
   - Custom profile ($10/mes)
   - Analytics avanzado ($20/mes)
```

---

## 🔐 SEGURIDAD & PRIVACIDAD

### **MASTODON**
```
✅ Control total del servidor
✅ HTTPS/SSL obligatorio
✅ No tracking de terceros
✅ Datos locales (no en cloud)
✅ Federation solo con servidores confiables
```

### **MATRIX/ELEMENT**
```
✅ Encryption E2E (default)
✅ Control total de datos
✅ No metadata retention (configurable)
✅ Open protocol
✅ Federation controlada
```

### **JITSI**
```
✅ No metadata de calls
✅ P2P cuando es posible
✅ Password-protected rooms
✅ Rooms se borran después
✅ No tracking
```

### **BACKEND PNPtv**
```
✅ JWT tokens seguros
✅ Rate limiting
✅ Input validation
✅ SQL injection protection
✅ CORS correctamente configurado
✅ HTTPS/SSL obligatorio
```

---

## 📊 COMPARACIÓN FINAL

| Aspecto | Telegram | Mastodon | Matrix |
|---------|----------|----------|--------|
| **Control** | Rusia | **Tuyo** | **P2P/Tuyo** |
| **Privacy** | Dependiente | Alta | **E2E** |
| **Federation** | No | Sí | Sí |

| Aspecto | Zoom | Jitsi |
|---------|------|-------|
| **P2P** | No (servidor) | **Sí** |
| **Control** | Zoom Inc | **Tuyo** |
| **Open Source** | No | **Sí** |

| Aspecto | Website | Mastodon + Matrix |
|---------|---------|-------------------|
| **Social** | Limitado | **Completo** |
| **Community** | Centralizado | **Descentralizado** |
| **Escalable** | No | **Sí** |

---

## ✨ VENTAJAS FINALES

### **Para PNPtv**
```
✅ Plataforma 100% soberana
✅ No dependencia de terceros
✅ Control total del producto
✅ Diferenciación en mercado
✅ Escalable indefinidamente
✅ Ingresos completos
```

### **Para Performers**
```
✅ Libertad de expresión garantizada
✅ No censurados por plataformas
✅ Monetización directa (70%)
✅ Comunidad leal
✅ Analytics detallado
✅ Backup de contenido
```

### **Para Usuarios**
```
✅ Privacidad garantizada (E2E)
✅ Cifrado end-to-end (Matrix)
✅ No tracked por Meta/Google
✅ Control sobre datos
✅ Community owned
✅ Identidad única (@usuario@social.pnptv.app)
```

---

## ⚠️ DESAFÍOS REALISTAS

```
❌ Complejidad (3 sistemas + backend)
❌ DevOps más complejo
❌ Migración de usuarios desde Telegram
❌ Curva de aprendizaje (Matrix/Element)
❌ Mantenimiento 24/7
❌ Soporte técnico

✅ PERO: Totalmente manejable con equipo
```

---

## 📈 ROADMAP GENERAL

```
FASE 1 (2-3 semanas): Investigación & MVP local
FASE 2 (4-6 semanas): MVP deployado en servidor
FASE 3 (3+ semanas): Production-ready & scaling

TOTAL: 12-14 semanas
```

---

**Status:** ✅ ARQUITECTURA FINAL DEFINIDA
**Next:** PHASE 1 Implementation Roadmap
**Ready:** Para aprobación y desarrollo

