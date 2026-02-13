# 🚀 PHASE 1: INVESTIGACIÓN & PROTOTIPO LOCAL
**Duración:** 2-3 semanas (10-15 días de trabajo)
**Objetivo:** Setup local de Mastodon + Matrix + Jitsi + Backend integración

---

## 📅 CRONOGRAMA

### **SEMANA 1: SETUP LOCAL (3 sistemas)**

#### **DÍAS 1-2: MASTODON LOCAL**
```
Meta: Mastodon corriendo en localhost

Paso 1: Instalar Docker
$ curl -fsSL https://get.docker.com | sh
$ sudo usermod -aG docker $USER

Paso 2: Clonar Mastodon
$ cd /root/pnptvbot-sandbox
$ git clone https://github.com/mastodon/mastodon.git mastodon-local
$ cd mastodon-local

Paso 3: Crear .env.production.local
SECRET_KEY_BASE=<generar: openssl rand -hex 64>
OTP_SECRET=<generar: openssl rand -hex 32>
VAPID_PRIVATE_KEY=<generar>
VAPID_PUBLIC_KEY=<generar>
DB_HOST=db
DB_USER=postgres
DB_PASS=<password>
REDIS_HOST=redis
LOCAL_DOMAIN=localhost:3000
SINGLE_USER_MODE=false

Paso 4: Setup docker-compose.yml
- PostgreSQL
- Redis
- Mastodon app
- Nginx reverse proxy en :3000

Paso 5: Inicializar BD
$ docker-compose run --rm web bundle exec rake db:setup

Paso 6: Crear admin
$ docker-compose run --rm web \
  bundle exec rake mastodon:make_admin USERNAME=admin

Paso 7: Test
→ Acceder http://localhost:3000
→ Login admin / password
→ Crear cuenta de test

⏱️ Tiempo: 4-6 horas
✅ Entregable: Mastodon funcional
```

---

#### **DÍAS 3-4: MATRIX + ELEMENT LOCAL**
```
Meta: Matrix homeserver + Element web client corriendo

Paso 1: Instalar Synapse (Matrix server)
Ubuntu/Debian:
$ sudo apt-get update
$ sudo apt-get install -y \
  python3-dev python3-pip \
  libjpeg-dev zlib1g-dev \
  build-essential postgresql postgresql-contrib

Paso 2: Crear usuario y BD PostgreSQL
$ sudo su - postgres
$ createuser synapse_user
$ createdb --owner synapse_user synapse
$ exit

Paso 3: Instalar Synapse
$ pip3 install --user --upgrade synapse

Paso 4: Generar configuración
$ python3 -m synapse.app.homeserver \
  --server-name matrix.localhost:8008 \
  --config-path /opt/synapse/homeserver.yaml \
  --generate-config

Paso 5: Configurar homeserver.yaml
database:
  name: psycopg2
  args:
    user: synapse_user
    password: <password>
    database: synapse
    host: localhost
    cp_min: 5
    cp_max: 10

listeners:
  - port: 8008
    bind_addresses: ['127.0.0.1']
    type: http
    x_forwarded: true
    resources:
      - names: [client, federation]
        compress: false

Paso 6: Iniciar Synapse
$ python3 -m synapse.app.homeserver \
  --config-path /opt/synapse/homeserver.yaml

Paso 7: Instalar Element (web client)
$ cd /root/pnptvbot-sandbox
$ git clone https://github.com/vector-im/element-web.git element-local
$ cd element-local
$ npm install
$ npm run build

Paso 8: Servir Element
$ npx http-server -p 8009 -c-1

Paso 9: Test
→ Acceder http://localhost:8009
→ Apuntar a: http://localhost:8008
→ Crear usuario de test

⏱️ Tiempo: 4-6 horas
✅ Entregable: Matrix + Element funcional
```

---

#### **DÍAS 5-7: JITSI LOCAL**
```
Meta: Jitsi corriendo con rooms funcionales

Paso 1: Instalar Jitsi Meet (Docker)
$ cd /root/pnptvbot-sandbox
$ git clone https://github.com/jitsi/docker-jitsi-meet.git jitsi-local
$ cd jitsi-local

Paso 2: Generar secrets
$ openssl rand -out /tmp/.jwtRS256.key 2048
$ openssl rsa -in /tmp/.jwtRS256.key -pubout

Paso 3: Crear .env
DOMAIN=localhost
XMPP_DOMAIN=jitsi.localhost
XMPP_AUTH_DOMAIN=auth.jitsi.localhost
XMPP_GUEST_DOMAIN=guest.jitsi.localhost
XMPP_MUC_DOMAIN=muc.jitsi.localhost
XMPP_INTERNAL_MUC_DOMAIN=internal-muc.jitsi.localhost
HTTP_PORT=8080
HTTPS_PORT=8443
TZ=UTC

Paso 4: Start con docker-compose
$ docker-compose up -d

Paso 5: Crear usuario de test
$ docker exec -it jitsi-local_prosody_1 \
  prosodyctl --config /etc/prosody/prosody.cfg.lua \
  register testuser jitsi.localhost testpass

Paso 6: Test
→ Acceder http://localhost:8080
→ Crear room: testroom
→ Iniciar video
→ Compartir link con otro usuario
→ Ambos pueden verse

⏱️ Tiempo: 3-4 horas
✅ Entregable: Jitsi funcional con rooms
```

---

### **SEMANA 2: INTEGRACIÓN BÁSICA**

#### **DÍAS 8-10: NODE.JS CLIENTS & WEBHOOKS**
```
Meta: Backend Node.js conectado a 3 sistemas

Paso 1: Crear servicios Node.js
File: src/services/mastodon-service.js
- Conectar a API Mastodon local
- Crear usuarios automáticamente
- Publicar posts
- Escuchar webhooks

$ npm install masto axios

Código básico:
const { login } = require('masto');

const mastodonClient = await login({
  url: 'http://localhost:3000',
  accessToken: 'token_from_admin'
});

// Crear usuario
async function createMastodonUser(username, password) {
  const account = await mastodonClient.accounts.create({
    username,
    email: `${username}@pnptv.local`,
    password,
    agreement: true
  });
  return account;
}

// Publicar post
async function postInMastodon(content) {
  const status = await mastodonClient.statuses.create({
    status: content,
    visibility: 'public'
  });
  return status;
}

Paso 2: Crear servicio Matrix
File: src/services/matrix-service.js
- Conectar a Synapse local
- Crear usuarios
- Crear rooms
- Invitar usuarios
- Escuchar mensajes

$ npm install matrix-js-sdk

Código básico:
const sdk = require('matrix-js-sdk');

const client = sdk.createClient({
  baseUrl: 'http://localhost:8008',
  userId: '@bot:matrix.localhost'
});

// Crear usuario
async function createMatrixUser(username, password) {
  const user = await client.register(username, password);
  return user;
}

// Crear room
async function createMatrixRoom(roomName, topic) {
  const room = await client.createRoom({
    room_alias_name: roomName,
    topic: topic,
    visibility: 'public'
  });
  return room;
}

Paso 3: Crear servicio Jitsi
File: src/services/jitsi-service.js
- Generar dynamic room names
- Crear rooms con password
- Generar JWT tokens (si

 habilitado)

Código básico:
const jwt = require('jsonwebtoken');

function createJitsiRoom(performerId, roomName) {
  const roomId = `room_${performerId}_${Date.now()}`;
  const password = Math.random().toString(36).substring(2, 15);
  return {
    roomId,
    password,
    url: `http://localhost:8080/${roomId}`
  };
}

// JWT token (opcional para auth)
function generateJitsiToken(roomName, userId) {
  const payload = {
    context: {
      user: {
        id: userId,
        name: userId
      }
    },
    aud: 'jitsi',
    iss: 'jitsi',
    sub: 'jitsi.localhost',
    room: roomName,
    exp: Math.floor(Date.now() / 1000) + 3600
  };
  return jwt.sign(payload, 'secret');
}

Paso 4: Webhook listener
File: src/routes/webhooks.js

POST /webhook/create-event
Body: {
  performerId: "123",
  performerName: "alex",
  title: "Live Show",
  price: 5,
  roomType: "liveshow"
}

Response: {
  mastodonPostId: "xxx",
  matrixRoomId: "!xxx:matrix.localhost",
  jitsiRoomUrl: "http://localhost:8080/livealex2026",
  matrixRoomLink: "https://app.element.io/#/room/!xxx:matrix.localhost"
}

El webhook:
1. Crea Mastodon post
2. Crea Matrix room
3. Crea Jitsi room
4. Retorna todos los links

⏱️ Tiempo: 6-8 horas
✅ Entregable: Node.js clients funcionales
```

---

#### **DÍAS 11-14: END-TO-END TESTING**
```
Meta: Flujo completo funcionando

Test 1: User Registration
$ curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "testpass",
    "email": "test@pnptv.local"
  }'

Verifica:
✅ Usuario en Mastodon (social.pnptv.app)
✅ Usuario en Matrix (matrix.localhost)
✅ Registro en BD PNPtv local

Test 2: Create Live Stream
$ curl -X POST http://localhost:3001/api/events/create \
  -H "Content-Type: application/json" \
  -d '{
    "performerId": "testuser",
    "title": "Test Live Show",
    "price": 5,
    "duration": 60
  }'

Verifica:
✅ Post creado en Mastodon
✅ Room creado en Matrix
✅ Room creado en Jitsi
✅ Links en el post de Mastodon

Test 3: Access Control
- Usuario SIN pago intenta acceder → DENIED
- Usuario CON pago intenta acceder → ALLOWED

Test 4: Analytics
- Verificar que se registran:
  ✅ Join timestamps
  ✅ User count
  ✅ Duration
  ✅ Revenue

Test 5: Load Test (básico)
- 2 usuarios en mismo room
- 3 usuarios simultáneos
- 5 usuarios (si tolera Jitsi local)

⏱️ Tiempo: 4-6 horas
✅ Entregable: Sistema end-to-end validado
```

---

## 🛠️ REQUERIMIENTOS

### **Hardware**
```
RAM:   8GB mínimo (recomendado 16GB)
SSD:   100GB mínimo
CPU:   4 cores mínimo
```

### **Software**
```
Docker 20.10+
Docker Compose 1.29+
Node.js 18+
PostgreSQL 13+ (ya instalado)
Redis 6+ (ya instalado)
Git
```

---

## 📋 CHECKLIST DIARIO

### **SEMANA 1**

**Día 1:**
- [ ] Docker instalado y funcionando
- [ ] Mastodon clone descargado
- [ ] docker-compose.yml editado
- [ ] BD inicializada

**Día 2:**
- [ ] Mastodon accesible en localhost:3000
- [ ] Admin account creado
- [ ] Puedo crear usuarios manualmente
- [ ] Puedo crear posts manualmente

**Día 3:**
- [ ] Synapse instalado
- [ ] PostgreSQL setup para Synapse
- [ ] Synapse server running en 8008
- [ ] Element web accesible en 8009

**Día 4:**
- [ ] Puedo hacer login en Element
- [ ] Puedo crear rooms en Element
- [ ] Puedo chatear en rooms
- [ ] Encryption E2E funciona

**Día 5:**
- [ ] Docker Jitsi descargado
- [ ] docker-compose.yml del Jitsi funciona
- [ ] Jitsi accesible en 8080
- [ ] Puedo crear rooms manualmente

**Día 6:**
- [ ] Puedo entrar en room de Jitsi
- [ ] Audio/video funciona
- [ ] Puedo compartir pantalla
- [ ] Con otro usuario todo funciona

**Día 7:**
- [ ] Documentación actualizada
- [ ] Todos los sistemas funcionan
- [ ] Screenshots de cada sistema
- [ ] Notas técnicas escritas

### **SEMANA 2**

**Días 8-10:**
- [ ] mastodon-service.js funcional
- [ ] matrix-service.js funcional
- [ ] jitsi-service.js funcional
- [ ] Webhook listener activo
- [ ] Primer test end-to-end exitoso

**Días 11-14:**
- [ ] Todos los tests pasando
- [ ] Load test completado
- [ ] Performance documentado
- [ ] Decisión go/no-go tomada

---

## 📊 MÉTRICAS A MEDIR

### **Performance**
```
- Tiempo de creación de usuario: <1s
- Tiempo de creación de event: <2s
- Tiempo de unirse a room Jitsi: <3s
- Latencia de chat Matrix: <500ms
```

### **Recursos**
```
- Memory Mastodon: <1GB
- Memory Matrix: <500MB
- Memory Jitsi: <800MB
- Total: <2.5GB
```

### **Funcionalidad**
```
- ✅ Usuarios creables en 3 sistemas
- ✅ Posts creables en Mastodon
- ✅ Rooms creables en Matrix
- ✅ Rooms accesibles en Jitsi
- ✅ Webhooks funcionan correctamente
- ✅ End-to-end flow completo
```

---

## ⚠️ RIESGOS & MITIGACIÓN

### **Riesgo 1: Memory pressure**
```
Realidad: 3 sistemas en mismo laptop = pesado
Mitigación:
  - Si <8GB: ejecutar uno a la vez
  - Usar VPS en cloud ($20/mes)
  - Linode/DigitalOcean
```

### **Riesgo 2: Port conflicts**
```
Realidad: Todos quieren puertos específicos
Mitigación:
  - Mastodon: 3000
  - Synapse: 8008
  - Element: 8009
  - Jitsi: 8080-8443
  - Backend: 3001

  Si hay conflicto: cambiar en .env
```

### **Riesgo 3: API incompatibilities**
```
Realidad: Versiones nuevas pueden romper
Mitigación:
  - Usar versiones estables (no latest)
  - Documentar versiones exactas
  - Test regresión en cada cambio
```

---

## 📈 RESULTADO ESPERADO

**Al final de PHASE 1 tendrás:**

1. ✅ Mastodon running en localhost:3000
2. ✅ Matrix (Synapse) running en localhost:8008
3. ✅ Element web running en localhost:8009
4. ✅ Jitsi running en localhost:8080
5. ✅ Backend Node.js con 3 clients
6. ✅ Webhook system funcional
7. ✅ End-to-end flow probado
8. ✅ Documentación técnica completa
9. ✅ Performance metrics
10. ✅ Go/no-go decision

**Y sabrás:**
- ✅ Si es técnicamente viable
- ✅ Qué es fácil / qué es difícil
- ✅ Cuánto tiempo toma realmente
- ✅ Qué recursos necesitas
- ✅ Si vale la pena proceder

---

## 🎯 SIGUIENTE PASO

**Aprobación de esta PHASE 1 roadmap:**
1. Revisas el plan
2. Aceptas o sugiere cambios
3. Comienzo de desarrollo inmediato

**Luego:**
- PHASE 2: Deploy a servidor real
- PHASE 3: Production-ready

---

**Creado:** 2026-02-13
**Versión:** PHASE 1 Complete Roadmap v2.0
**Status:** Listo para aprobación y desarrollo
