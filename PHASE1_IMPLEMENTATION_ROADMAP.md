# 🚀 PHASE 1: INVESTIGACIÓN & PROTOTIPO
**Duración:** 2-3 semanas
**Objetivo:** Validar viabilidad técnica de Mastodon + Jami + PNPtv

---

## 📅 TIMELINE RECOMENDADO

### **SEMANA 1: SETUP LOCAL**

#### **DÍAS 1-2: Mastodon Local**
```
1. Instalar Docker + Docker Compose
   $ curl -fsSL https://get.docker.com | sh
   $ sudo usermod -aG docker $USER

2. Clonar Mastodon
   $ git clone https://github.com/mastodon/mastodon.git
   $ cd mastodon

3. Configurar docker-compose.yml
   - PostgreSQL
   - Redis
   - Mastodon app
   - Nginx reverse proxy

4. Initializar base de datos
   $ docker-compose run --rm web bundle exec rake db:setup

5. Acceder en http://localhost

6. Crear cuenta de admin
   $ docker-compose run --rm web bundle exec rake mastodon:make_admin USERNAME=admin
```

**Entregable:** Mastodon corriendo localmente

---

#### **DÍAS 3-4: Jami Local**

```
1. Instalar jami-daemon
   Ubuntu/Debian:
   $ sudo apt-get install jami jami-daemon

   macOS:
   $ brew install jami

2. Iniciar daemon
   $ jami-daemon

3. Crear cuenta de prueba
   - Username: testuser@local

4. Crear sala de prueba
   - Tipo: Private
   - Capacidad: 5 personas

5. Probar conectividad P2P
   - Múltiples clientes conectándose
   - Video/audio básico
```

**Entregable:** Jami corriendo con rooms funcionales

---

#### **DÍAS 5-7: Integración Básica**

```
1. Node.js client para Mastodon
   $ npm install masto

   Código básico:
   ```javascript
   const { login } = require('masto');

   const client = await login({
     url: 'http://localhost',
     accessToken: 'YOUR_TOKEN'
   });

   // Publicar post
   await client.statuses.create({
     status: 'Hola desde Node.js!',
     visibility: 'public'
   });
   ```

2. Node.js bindings para Jami
   $ npm install jami

   Código básico:
   ```javascript
   const Jami = require('jami');

   // Registrar callback
   Jami.on('new-call-indication', (call) => {
     console.log('Nueva llamada:', call);
   });

   // Crear/unirse a room
   const roomId = await Jami.createConversation();
   ```

3. Webhook listener para eventos
   ```javascript
   // Mastodon → Jami
   POST /webhook/mastodon
   - Si post tiene #liveshow
   - Crear room en Jami
   - Actualizar post con link jami://
   ```

4. Test end-to-end
   - Publicar en Mastodon
   - Webhook crea room
   - Unirse desde Jami
   ```

**Entregable:** Integraciones proof-of-concept

---

### **SEMANA 2: ENTENDER APIs & ARQUITECTURA**

#### **DÍAS 8-10: Mastodon API Deep Dive**

```
1. Documentación oficial
   https://docs.joinmastodon.org/api/

2. Endpoints críticos
   - POST /api/v1/statuses (crear post)
   - GET /api/v1/statuses/:id (obtener post)
   - POST /api/v1/accounts (crear usuario)
   - GET /api/v1/accounts/:id (obtener perfil)

3. OAuth2 flow
   - Entender authentication
   - Setup application en Mastodon
   - Token management

4. Webhooks / Real-time events
   - Server-Sent Events (SSE)
   - Polling fallback

5. Federation (ActivityPub)
   - Entender cómo se federat
   - Importante para futuro multiinstancia
```

**Entregable:** Documento de API mappings

---

#### **DÍAS 11-14: Jami API Deep Dive**

```
1. Documentación oficial
   https://jami.net/en/

2. Architecture
   - DHT (Distributed Hash Table)
   - P2P connectivity
   - Signaling
   - STUN/TURN servers (si es necesario)

3. Room modes
   - Private (1:1)
   - Group (2-50)
   - Large group (50+)
   - Performance implications

4. Security
   - TLS 1.3 encryption
   - Certificate management
   - End-to-end encryption

5. Integration options
   - REST API (en desarrollo)
   - Dring protocol
   - Direct SDK
```

**Entregable:** Documento de Jami architecture

---

### **SEMANA 3: PROTOTIPO & VALIDACIÓN**

#### **DÍAS 15-17: Prototipo Integrado**

```
1. Backend PNPtv integration
   File: src/services/mastodon.js
   - Conectar a Mastodon local
   - Crear users
   - Publicar posts
   - Escuchar webhooks

   File: src/services/jami.js
   - Conectar a Jami
   - Crear rooms
   - Invitar users
   - Escuchar eventos

2. Frontend de prueba
   File: public/test-sovereign.html
   - Post composer (Mastodon)
   - Room creator (Jami)
   - User registry
   - Analytics básicas

3. Database extensions
   - Tabla: jami_accounts (mapping usuario → jami ID)
   - Tabla: jami_rooms (tracking de rooms)
   - Tabla: mastodon_accounts (mapping usuario → mastodon ID)
   - Tabla: sovereign_transactions (registrar pagos)

4. Test scenarios
   Scenario 1: Crear usuario
     1. User se registra en PNPtv
     2. Backend crea cuenta en Mastodon
     3. Backend crea ID en Jami
     4. User puede postear + hacer calls

   Scenario 2: Performer anuncia show
     1. Performer publica post en Mastodon
     2. Incluye #liveshow en post
     3. Backend webhook detecta
     4. Backend crea room en Jami
     5. Post se actualiza con link jami://
     6. Followers ven post + link
     7. Hacen clic → se unen a Jami

   Scenario 3: Monetización
     1. User intenta unirse a room premium
     2. Backend detecta paywall
     3. Redirige a checkout (ePayco/Meru)
     4. Confirma pago
     5. Grant acceso a room
     6. Analytics registran transacción
```

**Entregable:** Prototipo funcional de 3 componentes

---

#### **DÍAS 18-21: Validación & Documentación**

```
1. Load testing (básico)
   - 5 usuarios simultáneos
   - 10 usuarios simultáneos
   - Medir latencia
   - Medir uso de recursos

2. Security audit
   - Jami encryption verificada
   - Mastodon SSL/TLS funcionando
   - Tokens no expuestos
   - Rate limiting en su lugar

3. Documentation
   - Architecture diagram
   - API mappings
   - Setup guide
   - Known limitations

4. Decisión go/no-go
   ✅ Todos sistemas funcionan
   ✅ Integración viable
   ✅ Performance aceptable
   → PROCEED to PHASE 2

   ❌ Problemas encontrados
   ❌ Performance insuficiente
   → ADJUST architecture / ESCALATE
```

**Entregable:** Validación técnica + recomendación

---

## 🛠️ REQUERIMIENTOS TÉCNICOS

### **Hardware Local (para desarrollo)**
```
- Laptop/Desktop con 8GB+ RAM
- 100GB+ SSD (Mastodon + databases)
- Internet estable
- Docker + Docker Compose instalado
```

### **Software**
```
- Node.js 16+
- Docker 20.10+
- Git
- Postman (para testing APIs)
- VS Code + extensions
```

### **Accounts/Credenciales**
```
- GitHub (para clonar repos)
- DigitalOcean/Linode (si usas VPS)
```

---

## 📊 ACTIVIDADES DIARIAS

### **DURANTE SEMANA 1**

**Día 1:**
```
09:00 - Kick-off + planning
10:00 - Install Docker
11:00 - Clone Mastodon
12:00 - Lunch break
13:00 - Setup Mastodon docker-compose
16:00 - Initialize DB
17:00 - Testing access + Admin setup
18:00 - Wrap-up + plan day 2
```

**Día 2-3:** Similar para Jami

**Día 4-5:** Integraciones básicas

**Día 6-7:** Testing + documentación

---

## 📋 CHECKLIST FASE 1

### **Setup Mastodon**
- [ ] Docker corriendo
- [ ] Mastodon clone en local
- [ ] docker-compose.yml editado
- [ ] DB initialized
- [ ] Web accesible en localhost
- [ ] Admin account creado
- [ ] OAuth client creado

### **Setup Jami**
- [ ] jami-daemon instalado
- [ ] Cuenta de test creada
- [ ] Room privada creada
- [ ] Video/audio funciona
- [ ] P2P connectivity verificada
- [ ] Node.js bindings instalados

### **Integración Básica**
- [ ] Mastodon API client (Node.js) funciona
- [ ] Jami API client (Node.js) funciona
- [ ] Crear usuario en ambos sistemas
- [ ] Publicar post automáticamente
- [ ] Crear room automáticamente
- [ ] Webhook listener activo
- [ ] End-to-end test exitoso

### **Documentación**
- [ ] API mappings document
- [ ] Architecture diagram
- [ ] Setup guide escrito
- [ ] Known issues listed
- [ ] Performance notes

### **Validación**
- [ ] Load test 5 users
- [ ] Load test 10 users
- [ ] Security checklist
- [ ] Go/no-go decision

---

## 🎯 OBJETIVOS DE FASE 1

### **Técnicos**
✅ Mastodon + Jami corriendo localmente
✅ Integración Node.js funcional
✅ Webhook system funciona
✅ End-to-end flow completo

### **Conocimiento**
✅ Entender Mastodon API completamente
✅ Entender Jami P2P architecture
✅ Identificar pain points
✅ Documentar learnings

### **Decisionali**
✅ ¿Es viable técnicamente? ✅ Costo operacional ✅ Esfuerzo estimado
✅ Recursos necesarios
✅ Decisión: ¿Proceder a FASE 2?

---

## ⚠️ RIESGOS & MITIGACIÓN

### **Riesgo 1: Jami API limitada**
```
Realidad: Jami aún está en desarrollo
Mitigación: Usar direct Dring protocol si es necesario
Fallback: REST API cuando esté disponible
```

### **Riesgo 2: Mastodon pesado para dev**
```
Realidad: Consume 2GB+ RAM
Mitigación: Usar VPS en cloud si necesario
Fallback: Rebase en servidor existente
```

### **Riesgo 3: Performance P2P**
```
Realidad: Latencia puede ser alta
Mitigación: Probar con NAT/firewall
Fallback: TURN servers en lugar de solo STUN
```

---

## 💰 PRESUPUESTO FASE 1

```
Horas de desarrollo:    ~55 hrs × $50/hr = $2,750
Servidores (si usas):   ~$20/mes × 3 meses = $60
Software:               $0 (todo open-source)
────────────────────────────────
Total estimado:         ~$2,810

Este es "learning investment"
No cuenta para FASE 2
```

---

## 🚀 RESULTADO ESPERADO

**Al final de FASE 1 tendrás:**

1. ✅ Mastodon instance local corriendo
2. ✅ Jami P2P network funcional
3. ✅ Backend Node.js conectado a ambos
4. ✅ Flujo end-to-end probado
5. ✅ Documentación técnica completa
6. ✅ Viabilidad validada
7. ✅ Decisión informada sobre FASE 2

**Y sabrás:**
- ✅ Si es técnicamente posible
- ✅ Qué es difícil
- ✅ Cuánto tiempo toma realmente
- ✅ Qué recursos necesitas
- ✅ Si vale la pena proceder

---

## 📞 SOPORTE & RECURSOS

### **Documentación Oficial**
- https://docs.joinmastodon.org
- https://jami.net/en/
- https://github.com/mastodon/mastodon
- https://git.jami.net/jami/jami

### **Community**
- Mastodon forums
- Jami community
- Node.js stackoverflow
- Docker documentation

### **Tools**
- Postman (API testing)
- DevTools (browser debugging)
- Docker Dashboard (container monitoring)
- Wireshark (network debugging)

---

## 🎯 SIGUIENTE PASO

**Hoy (2026-02-13):**
1. ✅ Revisaste la arquitectura propuesta
2. ✅ Leíste el plan de implementación
3. ⏳ Decides si quieres comenzar

**Mañana (2026-02-14):**
1. [ ] Instalar Docker
2. [ ] Comenzar setup de Mastodon
3. [ ] Documentar el proceso

**Esta semana:**
1. [ ] Ambos sistemas corriendo
2. [ ] Integraciones básicas
3. [ ] Primer test end-to-end

---

**Creado:** 2026-02-13
**Versión:** PHASE 1 Roadmap v1.0
**Status:** Listo para comenzar
