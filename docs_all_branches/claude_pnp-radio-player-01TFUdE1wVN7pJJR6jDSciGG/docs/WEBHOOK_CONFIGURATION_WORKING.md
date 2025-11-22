# Configuración del Webhook - Estado Funcional

**Fecha:** 2025-11-16
**Estado:** ✅ Funcionando correctamente

## Resumen de la Configuración

El bot está configurado para recibir actualizaciones de Telegram vía webhook en producción.

### 1. Ruta del Webhook

**URL del Webhook:** `https://easybots.store/webhook/telegram`

**Configuración en el código:**
- Archivo: `src/bot/core/bot.js`
- Línea 118: `const webhookPath = process.env.BOT_WEBHOOK_PATH || '/webhook/telegram';`

### 2. Configuración de Nginx

**Archivo:** `/etc/nginx/sites-available/pnptv-bot.conf`
**Symlink:** `/etc/nginx/sites-enabled/pnptv-bot.conf`

**Configuración clave del webhook (líneas 67-101):**

```nginx
# Telegram Webhook Endpoint - CRITICAL for bot functionality
location /webhook/telegram {
    # Allow GET for testing and POST for actual webhooks
    limit_except GET POST {
        deny all;
    }

    # Proxy to bot container
    proxy_pass http://localhost:3000/webhook/telegram;
    proxy_http_version 1.1;

    # CRITICAL: Preserve request body and headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Port $server_port;

    # CRITICAL: Don't buffer the request body
    proxy_request_buffering off;
    proxy_buffering off;

    # CRITICAL: Set Content-Type header explicitly
    proxy_set_header Content-Type $content_type;

    # Keep-alive connection for better performance
    proxy_set_header Connection "keep-alive";
    proxy_cache_bypass $http_upgrade;

    # No redirects for webhooks
    proxy_redirect off;

    # Logging for debugging
    access_log /var/log/nginx/telegram-webhook.log combined;
}
```

**SSL Configuración:**
```nginx
ssl_certificate /etc/letsencrypt/live/easybots.store/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/easybots.store/privkey.pem;
```

### 3. Configuración del Bot (Express)

**Archivo:** `src/bot/core/bot.js` (líneas 127-170)

```javascript
apiApp.post(webhookPath, async (req, res) => {
  // Disable response timeout for this specific route
  req.setTimeout(0);
  res.setTimeout(0);

  // Set headers for stable connection
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Content-Type', 'application/json');

  try {
    logger.info('Telegram webhook received:', {
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      contentType: req.headers['content-type'],
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Validate that we have a body
    if (!req.body || Object.keys(req.body).length === 0) {
      logger.warn('Webhook received empty body');
      return res.status(200).json({ ok: true, message: 'Empty body received' });
    }

    // Process the update
    await bot.handleUpdate(req.body);

    // Send success response
    res.status(200).json({ ok: true });
    logger.info('Webhook processed successfully');
  } catch (error) {
    logger.error('Error processing Telegram webhook:', {
      error: error.message,
      stack: error.stack,
      body: req.body,
    });

    // Always send a response to prevent connection reset
    // Telegram expects a response even on errors
    res.status(200).json({ ok: false, error: error.message });
  }
});
```

### 4. Configuración de Express (routes.js)

**Archivo:** `src/bot/api/routes.js`

**Body parsing (CRÍTICO - líneas 17-20):**
```javascript
// CRITICAL: Apply body parsing FIRST for ALL routes
// This must be before any route registration
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
```

**Middleware aplicado:**
```javascript
// Logging
app.use(morgan('combined', { stream: logger.stream }));

// Security middleware
app.use(helmet());
app.use(cors());
app.use(compression());
```

**IMPORTANTE:** No hay código de webhook en `routes.js` - el webhook se registra directamente en `bot.js` DESPUÉS de que se importa el app de Express.

### 5. Docker Configuration

**Puerto expuesto:** `3000:3000`

**Contenedores:**
- `pnptv-bot` - Bot principal (puerto 3000)
- `pnptv-redis` - Redis cache
- `pnptv-postgres` - Base de datos

### 6. Variables de Entorno Necesarias

```bash
NODE_ENV=production
BOT_TOKEN=<telegram_bot_token>
BOT_WEBHOOK_DOMAIN=https://easybots.store
BOT_WEBHOOK_PATH=/webhook/telegram  # Opcional, default es /webhook/telegram
PORT=3000
```

## Problemas Comunes y Soluciones

### Problema 1: Bot no responde
**Síntomas:** El bot no procesa mensajes de usuarios

**Checklist de diagnóstico:**
1. ✅ Verificar que nginx esté corriendo: `systemctl status nginx`
2. ✅ Verificar que el contenedor esté corriendo: `docker ps | grep pnptv-bot`
3. ✅ Verificar logs del bot: `docker logs pnptv-bot --tail 50`
4. ✅ Verificar configuración de nginx: `nginx -t`
5. ✅ Verificar que el symlink existe: `ls -la /etc/nginx/sites-enabled/`

**Solución:**
```bash
# 1. Copiar configuración de nginx
cp /root/pnptvbot-production/nginx/pnptv-bot.conf /etc/nginx/sites-available/pnptv-bot.conf

# 2. Crear symlink si no existe
ln -s /etc/nginx/sites-available/pnptv-bot.conf /etc/nginx/sites-enabled/pnptv-bot.conf

# 3. Probar y recargar nginx
nginx -t && systemctl reload nginx

# 4. Reconstruir y reiniciar bot
cd /root/pnptvbot-production
docker-compose down
docker-compose build --no-cache bot
docker-compose up -d

# 5. Verificar logs
docker logs pnptv-bot --tail 50 -f
```

### Problema 2: Conflicto en ruta del webhook
**Síntomas:** Logs muestran "Route.post() requires a callback function but got a [object Undefined]"

**Causa:** Hay código en `routes.js` intentando registrar el webhook

**Solución:** El webhook debe registrarse SOLO en `bot.js`, no en `routes.js`. Asegurar que `routes.js` no contiene referencias a `webhookController.handleTelegramWebhook`.

### Problema 3: Puerto 3000 en uso
**Síntomas:** "address already in use" al iniciar contenedores

**Solución:**
```bash
# Encontrar proceso usando el puerto
lsof -i :3000

# Matar el proceso (reemplazar PID)
kill <PID>

# Reiniciar contenedores
docker-compose up -d
```

### Problema 4: Ruta del webhook incorrecta
**Síntomas:** Telegram no puede alcanzar el webhook

**Verificar:**
- Bot.js usa: `/webhook/telegram`
- Nginx escucha en: `/webhook/telegram`
- Telegram apunta a: `https://easybots.store/webhook/telegram`

**NO usar:** `/pnp/webhook/telegram` (ruta antigua que causaba conflictos)

## Comandos Útiles para Troubleshooting

```bash
# Verificar estado de nginx
systemctl status nginx

# Ver logs de nginx en tiempo real
tail -f /var/log/nginx/telegram-webhook.log

# Ver logs del bot en tiempo real
docker logs pnptv-bot -f

# Probar webhook localmente
curl -X POST http://localhost:3000/webhook/telegram \
  -H "Content-Type: application/json" \
  -d '{"update_id": 1, "message": {"message_id": 1, "from": {"id": 123, "is_bot": false, "first_name": "Test"}, "chat": {"id": 123, "type": "private"}, "text": "/start"}}'

# Verificar que nginx esté proxy-ing correctamente
curl -I https://easybots.store/webhook/telegram

# Reiniciar todo el stack
docker-compose down && docker-compose up -d

# Ver todos los contenedores
docker ps -a
```

## Estructura de Archivos Críticos

```
/root/pnptvbot-production/
├── src/
│   └── bot/
│       ├── core/
│       │   └── bot.js           # Registra el webhook POST handler
│       └── api/
│           ├── routes.js        # NO debe tener código de webhook
│           └── controllers/
│               └── webhookController.js  # Solo para webhooks de pago (ePayco, Daimo)
├── nginx/
│   └── pnptv-bot.conf          # Configuración de nginx
├── docker-compose.yml
└── Dockerfile

/etc/nginx/
├── sites-available/
│   └── pnptv-bot.conf          # Archivo de configuración
└── sites-enabled/
    └── pnptv-bot.conf -> ../sites-available/pnptv-bot.conf  # Symlink
```

## Verificación de Estado Funcional

**✅ Señales de que todo está bien:**
```
# En los logs del bot:
✓ Webhook set to: https://easybots.store/webhook/telegram
✓ Webhook callback registered at: /webhook/telegram
🚀 PNPtv Telegram Bot is running!
Telegram webhook received: {"hasBody":true,"bodyKeys":["update_id","message"],...}
Webhook processed successfully
```

**❌ Señales de problemas:**
```
Route.post() requires a callback function but got a [object Undefined]
ECONNREFUSED
404 Not Found
Empty body received (cuando debería haber datos)
```

## Última Actualización

**Cambios aplicados el 2025-11-16:**
1. ✅ Eliminado código problemático en `routes.js` (middleware condicional que registraba webhook)
2. ✅ Cambiada ruta default de `/pnp/webhook/telegram` a `/webhook/telegram` en `bot.js:118`
3. ✅ Configuración de nginx habilitada correctamente con symlink
4. ✅ Rebuild completo de la imagen Docker con `--no-cache`

**Estado actual:** Bot funcionando correctamente, procesando webhooks sin errores.
