# 🛡️ Sistema de Manejo de Errores - Bot Resiliente

## 🎯 Objetivo

El bot está diseñado para **SIEMPRE arrancar**, incluso cuando hay errores de configuración o servicios caídos. En vez de crashear, el bot arranca en **modo degradado** y loggea los problemas.

---

## ✅ Garantías del Sistema

### 1. **El bot NUNCA hace `process.exit(1)`**
- Incluso con errores críticos, el proceso se mantiene vivo
- Evita reinicios infinitos en plataformas como Railway/Render
- Facilita diagnóstico en producción

### 2. **Fallback en cascada**
Cada servicio puede fallar independientemente:

```
✅ Sentry falla → continúa sin monitoring
✅ Firebase falla → continúa sin base de datos (modo degradado)
✅ Redis falla → continúa sin cache (performance reducido)
✅ Cache prewarm falla → continúa con cache vacío
```

### 3. **Logs detallados**
Cada error loggea:
- ❌ Qué servicio falló
- ⚠️ Consecuencias del fallo
- ℹ️ Cómo afecta la funcionalidad
- 🔧 Qué configurar para solucionarlo

---

## 🚦 Modos de Operación

### ✅ Modo NORMAL (todos los servicios funcionando)

```
✓ Environment variables validated
✓ Sentry initialized
✓ Firebase initialized
✓ Redis initialized
✓ Cache prewarmed successfully
✓ Bot started in polling mode
✓ API server running on port 3000
🚀 PNPtv Telegram Bot is running!
```

**Funcionalidad:** 100% operacional

---

### ⚠️ Modo DEGRADADO (algunos servicios fallan)

**Ejemplo: Firebase falla pero Redis funciona**

```
✓ Environment variables validated
✓ Sentry initialized
❌ Firebase initialization failed. Bot will run in DEGRADED mode without database.
⚠️  Bot features requiring database will not work!
✓ Redis initialized
✓ Cache prewarmed successfully
✓ Bot started in polling mode
✓ API server running on port 3000
🚀 PNPtv Telegram Bot is running! (degraded mode)
```

**Funcionalidad:**
- ❌ No funciona: onboarding, perfil, suscripciones, pagos, admin panel
- ✅ Funciona: comandos básicos, respuestas estáticas, health check

**Solución:** Configurar Firebase correctamente y reiniciar

---

### 🆘 Modo EMERGENCIA (fallo crítico en startup)

Si el bot no puede arrancar normalmente, inicia un servidor mínimo:

```
❌ CRITICAL ERROR during bot startup: [error details]
⚠️  Bot encountered a critical error but will attempt to keep process alive
⚠️  Some features may not work properly. Check logs above for details.
⚠️  Emergency API server running on port 3000 (degraded mode)
Bot is NOT fully functional. Fix configuration and restart.
```

**Funcionalidad:**
- ❌ Bot de Telegram NO funciona
- ✅ Servidor HTTP responde (evita que Railway/Render lo marque como muerto)
- ✅ Health check muestra estado degradado
- ✅ Proceso se mantiene vivo para inspección de logs

**Solución:** Revisar logs, corregir configuración, reiniciar manualmente

---

## 🔍 Tipos de Errores Capturados

### 1️⃣ **Variables de Entorno Faltantes**

**Antes (crasheaba):**
```javascript
Missing critical environment variables: BOT_TOKEN, FIREBASE_PROJECT_ID
Process exited with code 1
```

**Ahora (continúa):**
```javascript
CRITICAL: Missing environment variables, but attempting to continue...
Missing critical environment variables: BOT_TOKEN, FIREBASE_PROJECT_ID
⚠️  Bot may fail later, but we'll try to start anyway
```

---

### 2️⃣ **Firebase No Disponible**

**Antes (crasheaba):**
```javascript
Failed to initialize Firebase. Please check your Firebase credentials.
Process exited with code 1
```

**Ahora (continúa en modo degradado):**
```javascript
Firebase initialization failed. Bot will run in DEGRADED mode without database.
Error: FIREBASE_PRIVATE_KEY is invalid
⚠️  Bot features requiring database will not work!
✓ Redis initialized
✓ Bot started in polling mode
```

---

### 3️⃣ **Excepciones No Capturadas**

**Manejadores globales instalados:**

```javascript
process.on('uncaughtException', (error) => {
  logger.error('❌ UNCAUGHT EXCEPTION:', error);
  logger.warn('Process will continue despite uncaught exception');
  // NO hace process.exit()
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ UNHANDLED PROMISE REJECTION:', reason);
  logger.warn('Process will continue despite unhandled rejection');
  // NO hace process.exit()
});
```

**Resultado:** Errores inesperados se loggean pero el proceso continúa

---

## 📊 Checklist de Diagnóstico

### ✅ Bot arranca pero no responde

**Posibles causas:**
1. Firebase no configurado → usuarios no se guardan
2. BOT_TOKEN incorrecto → Telegram rechaza conexión
3. Redis caído → sesiones no funcionan

**Qué revisar:**
```bash
# Ver logs de inicio
tail -f logs/combined.log | grep "✓\|❌\|⚠️"

# Verificar variables de entorno
env | grep BOT_TOKEN
env | grep FIREBASE

# Probar conexiones
redis-cli ping
curl https://api.telegram.org/bot<TOKEN>/getMe
```

---

### ✅ Bot responde pero funciones fallan

**Síntomas:**
- `/start` funciona pero onboarding no guarda datos
- Pagos no se procesan
- Panel de admin vacío

**Causa probable:** Firebase en modo degradado

**Solución:**
```bash
# Verificar Firebase config
echo $FIREBASE_PROJECT_ID
echo $FIREBASE_PRIVATE_KEY | head -c 50

# Ver logs de Firebase
tail -f logs/error.log | grep Firebase

# Reiniciar con config correcta
npm start
```

---

### ✅ Performance lento

**Síntomas:**
- Respuestas tardan 2-5 segundos
- Mismo query se repite

**Causa probable:** Redis no funciona (sin cache)

**Qué revisar:**
```bash
# Verificar Redis
redis-cli ping

# Ver uso de cache en logs
tail -f logs/combined.log | grep cache

# Verificar latencia
redis-cli --latency
```

---

## 🔧 Configuración Recomendada

### Variables de entorno mínimas:

```bash
# CRÍTICAS (bot arranca sin ellas pero en modo degradado)
BOT_TOKEN=your_telegram_bot_token
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@...

# OPCIONALES (bot funciona sin ellas)
REDIS_URL=redis://localhost:6379
SENTRY_DSN=https://...
NODE_ENV=production
PORT=3000
```

### Para producción (Railway/Render):

```bash
# Telegram
BOT_TOKEN=
BOT_WEBHOOK_DOMAIN=https://tu-app.railway.app
BOT_WEBHOOK_PATH=/webhook/telegram

# Firebase
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=

# Redis (Railway addon)
REDIS_URL=redis://:password@host:port

# Monitoring
SENTRY_DSN=
SENTRY_ENVIRONMENT=production

# Admins
SUPER_ADMIN_USER_IDS=123456,789012
ADMIN_USER_IDS=345678
```

---

## 🚀 Mejores Prácticas

### 1. **Monitoring en Producción**

```bash
# Ver logs en vivo
railway logs --tail

# Buscar errores
railway logs | grep "❌\|⚠️"

# Ver estado del bot
curl https://tu-app.railway.app/health
```

### 2. **Testing de Resiliencia**

Simular fallos para verificar que el bot continúa:

```bash
# Test 1: Sin Firebase
unset FIREBASE_PROJECT_ID
npm start
# Debería: arrancar en modo degradado

# Test 2: Sin Redis
# Detener Redis localmente
npm start
# Debería: arrancar sin cache

# Test 3: BOT_TOKEN incorrecto
BOT_TOKEN=invalid npm start
# Debería: arrancar pero con error en conexión a Telegram
```

### 3. **Recuperación Automática**

En Railway/Render, configurar health checks:

```yaml
# railway.toml
[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 100
```

Si el health check falla, Railway reinicia automáticamente.

---

## 📝 Logs de Ejemplo

### ✅ Startup exitoso completo:

```
[2024-01-15 10:30:00] info: Starting PNPtv Telegram Bot...
[2024-01-15 10:30:00] info: ✓ Environment variables validated
[2024-01-15 10:30:00] info: ✓ Sentry initialized
[2024-01-15 10:30:01] info: ✓ Firebase initialized
[2024-01-15 10:30:01] info: ✓ Redis initialized
[2024-01-15 10:30:02] info: ✓ Cache prewarmed successfully
[2024-01-15 10:30:02] info: ✓ Bot started in polling mode
[2024-01-15 10:30:02] info: ✓ API server running on port 3000
[2024-01-15 10:30:02] info: 🚀 PNPtv Telegram Bot is running!
```

### ⚠️ Startup con Firebase fallando:

```
[2024-01-15 10:30:00] info: Starting PNPtv Telegram Bot...
[2024-01-15 10:30:00] info: ✓ Environment variables validated
[2024-01-15 10:30:00] info: ✓ Sentry initialized
[2024-01-15 10:30:01] error: Firebase initialization failed. Bot will run in DEGRADED mode without database.
[2024-01-15 10:30:01] error: Error: Invalid private key
[2024-01-15 10:30:01] warn: ⚠️  Bot features requiring database will not work!
[2024-01-15 10:30:01] info: ✓ Redis initialized
[2024-01-15 10:30:02] info: ✓ Cache prewarmed successfully
[2024-01-15 10:30:02] info: ✓ Bot started in polling mode
[2024-01-15 10:30:02] info: ✓ API server running on port 3000
[2024-01-15 10:30:02] info: 🚀 PNPtv Telegram Bot is running!
```

### 🆘 Startup en modo emergencia:

```
[2024-01-15 10:30:00] info: Starting PNPtv Telegram Bot...
[2024-01-15 10:30:00] error: CRITICAL: Missing environment variables, but attempting to continue...
[2024-01-15 10:30:00] error: Missing critical environment variables: BOT_TOKEN
[2024-01-15 10:30:00] info: ✓ Sentry initialized
[2024-01-15 10:30:01] error: Firebase initialization failed. Bot will run in DEGRADED mode without database.
[2024-01-15 10:30:01] error: ❌ CRITICAL ERROR during bot startup: TypeError: Cannot read property 'telegram' of undefined
[2024-01-15 10:30:01] warn: ⚠️  Bot encountered a critical error but will attempt to keep process alive
[2024-01-15 10:30:01] warn: ⚠️  Some features may not work properly. Check logs above for details.
[2024-01-15 10:30:01] info: ⚠️  Emergency API server running on port 3000 (degraded mode)
[2024-01-15 10:30:01] info: Bot is NOT fully functional. Fix configuration and restart.
```

---

## 🎓 Resumen

| Escenario | Bot Arranca | Funcionalidad | Acción |
|-----------|-------------|---------------|--------|
| Todo OK | ✅ Sí | 100% | Ninguna |
| Sin Redis | ✅ Sí | 90% (sin cache) | Configurar Redis (opcional) |
| Sin Firebase | ✅ Sí | 30% (sin DB) | Configurar Firebase (crítico) |
| Sin BOT_TOKEN | ✅ Sí (modo emergencia) | 0% | Configurar token (crítico) |
| Error crítico | ✅ Sí (servidor mínimo) | 0% | Revisar logs y corregir |

**Principio clave:** El bot SIEMPRE arranca, loggea problemas claramente y opera en el mejor modo posible dadas las circunstancias.

---

**Última actualización:** 2025-11-16
