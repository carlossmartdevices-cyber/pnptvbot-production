# PNP Hangouts - Integración JAAS (Jitsi) ✅

## 🎯 Resumen de Cambios

Se ha integrado **JAAS (Jitsi as a Service)** en el sistema PNP Hangouts, proporcionando videollamadas autenticadas y seguras con JWT tokens.

### Estado Actual

✅ **JAAS Configurado**: El servicio JAAS está correctamente configurado
✅ **Dual Platform**: Soporta tanto Jitsi (primario) como Agora (fallback)
✅ **Autenticación JWT**: Tokens seguros para cada participante
✅ **Roles**: Moderadores (creadores) y participantes
✅ **Salas Principales**: Integración con salas comunitarias

---

## 📁 Archivos Modificados/Creados

### Nuevos Archivos
1. **`src/bot/utils/jitsiHangoutsWebApp.js`** - Utilidades para URLs de Jitsi/JAAS
   - `buildJitsiHangoutsUrl()` - Genera URLs con JWT
   - `buildJitsiRoomConfig()` - Configuración completa de sala
   - `generateParticipantUrl()` - URLs para participantes

### Archivos Modificados
1. **`src/bot/handlers/user/hangoutsHandler.js`**
   - Importa `jitsiHangoutsWebApp` y `jaasService`
   - Crea videollamadas con opciones Jitsi + Agora
   - Genera URLs autenticadas para creadores y participantes
   - Integra Jitsi en salas principales

2. **`src/bot/api/controllers/hangoutsController.js`**
   - Genera URLs de Jitsi en respuestas API
   - Proporciona `platform` (jitsi/agora)
   - Incluye `jitsiUrl` en respuestas

---

## 🔧 Configuración Requerida

### Variables de Entorno (.env)
```env
# JAAS (Jitsi as a Service) - ✅ Ya configurado
JAAS_APP_ID=vpaas-magic-cookie-6382ae83d7174b698c05093456a9e209
JAAS_API_KEY_ID=vpaas-magic-cookie-6382ae83d7174b698c05093456a9e209/990be3
JAAS_PRIVATE_KEY_PATH=./config/jaas-private-key.pem

# Jitsi Public (Fallback)
JITSI_DOMAIN=meet.jit.si
JITSI_MUC_DOMAIN=conference.jit.si

# Agora (Fallback)
AGORA_APP_ID=b68ab7b61ea44eabab7f242171311c5e
AGORA_APP_CERTIFICATE=90a6ab0c5ee142fcb20cd5b684243b0a

# Hangouts WebApp
HANGOUTS_WEB_APP_URL=https://pnptv.app/hangouts
```

### Verificar Configuración
```bash
# Verificar que JAAS esté configurado
node -e "const jaas = require('./src/bot/services/jaasService'); console.log('JAAS configured:', jaas.isConfigured())"
```

---

## 🚀 Funcionalidades

### 1. Crear Videollamada

**Handler**: `bot.action('create_video_call')`

**Flujo**:
1. Usuario presiona "Crear Videollamada"
2. Sistema crea sala en base de datos
3. Genera dos URLs:
   - **Jitsi URL** (primaria) - Con JWT token JAAS
   - **Agora WebApp** (fallback) - Para compatibilidad
4. Usuario elige plataforma

**Código**:
```javascript
// Genera URL de Jitsi con autenticación
const jitsiUrl = buildJitsiHangoutsUrl({
  roomName: call.channelName,
  userId: ctx.from.id,
  userName: displayName,
  isModerator: true, // Creador es moderador
  callId: call.id,
  type: 'private',
});
```

### 2. Unirse a Videollamada

**Handler**: `bot.action(/^view_call_(.+)$/)`

**Flujo**:
1. Participante accede a detalles de llamada
2. Sistema verifica si es creador (moderador)
3. Genera JWT con permisos apropiados:
   - **Moderador**: `isModerator: true`
   - **Participante**: `isModerator: false`
4. Ofrece opciones Jitsi + Agora

### 3. Salas Principales (Main Rooms)

**Handler**: `bot.action(/^join_main_room_(\d+)$/)`

**Flujo**:
1. Usuario une a sala comunitaria
2. Genera JWT como viewer (no moderador)
3. Proporciona URLs para Jitsi y Agora
4. Sala soporta hasta 50 participantes

**Ejemplo**:
```javascript
const jitsiUrl = buildJitsiHangoutsUrl({
  roomName: 'pnptv-main-room-1',
  userId: ctx.from.id,
  userName: displayName,
  isModerator: false, // Viewer
  type: 'main',
});
```

---

## 🔐 Seguridad

### JWT Token Features
- ✅ **Expiración**: Tokens expiran automáticamente
  - Moderadores: 4 horas
  - Participantes: 2 horas
- ✅ **Firma RSA256**: Firmado con clave privada JAAS
- ✅ **Roles**: Moderador vs Participante
- ✅ **No Recording**: Grabación deshabilitada (privacidad)
- ✅ **Room Isolation**: Cada sala tiene token único

### Payload Example
```json
{
  "aud": "jitsi",
  "iss": "chat",
  "sub": "vpaas-magic-cookie-...",
  "exp": 1234567890,
  "room": "pnptv-hangout-12345",
  "context": {
    "user": {
      "id": "123456",
      "name": "John Doe",
      "moderator": "true"
    },
    "features": {
      "livestreaming": false,
      "recording": false,
      "transcription": false
    }
  }
}
```

---

## 📱 Interfaz de Usuario

### Botones de Videollamada

**Crear Llamada**:
```
✅ ¡Videollamada Creada!

👥 Capacidad: 0/10 personas
🔗 Comparte: https://t.me/bot?start=call_123

Elige cómo quieres entrar:
[🎥 Entrar (Jitsi)] [📱 Entrar (App)]
[❌ Terminar Llamada]
[⬅️ Volver]
```

**Ver Llamada**:
```
📞 Detalles de Llamada

👥 Participantes: 3/10
📅 Creada: 05/02/2026, 10:30
🔗 Compartir: https://t.me/bot?start=call_123

Elige cómo quieres entrar:
[🎥 Entrar (Jitsi)] [📱 Entrar (App)]
[❌ Terminar] [🗑️ Eliminar]
[⬅️ Volver]
```

**Sala Principal**:
```
🏠 PNP Community Room

Sala comunitaria 24/7 para miembros PRIME

👥 12/50 participantes

Elige cómo quieres entrar:
[🎥 Entrar (Jitsi)] [📱 Entrar (App)]
[⬅️ Volver]
```

---

## 🧪 Testing

### 1. Test JAAS Service
```javascript
const jaasService = require('./src/bot/services/jaasService');

// Test configuración
console.log('JAAS Configured:', jaasService.isConfigured());

// Test token generation
const token = jaasService.generateModeratorToken(
  'test-room-123',
  '123456',
  'Test User'
);
console.log('Token:', token);

// Test URL generation
const url = jaasService.generateMeetingUrl('test-room-123', token);
console.log('Meeting URL:', url);
```

### 2. Test Hangouts WebApp Utils
```javascript
const { buildJitsiHangoutsUrl } = require('./src/bot/utils/jitsiHangoutsWebApp');

const url = buildJitsiHangoutsUrl({
  roomName: 'test-hangout-123',
  userId: '123456',
  userName: 'Test User',
  isModerator: true,
  callId: 'call-123'
});

console.log('Jitsi URL:', url);
```

### 3. Test API Endpoint
```bash
# Create hangout
curl -X POST https://pnptv.app/api/hangouts/create \
  -H "Content-Type: application/json" \
  -H "x-telegram-init-data: <init-data>" \
  -d '{"creatorId": "123456", "creatorName": "Test", "isPublic": false}'

# Response includes jitsiUrl
```

---

## 🐛 Solución de Problemas

### Error: "JAAS not configured"
**Causa**: Variables de entorno faltantes
**Solución**:
```bash
# Verificar variables
echo $JAAS_APP_ID
echo $JAAS_API_KEY_ID
ls -la ./config/jaas-private-key.pem

# Reiniciar bot
pm2 restart pnptvbot
```

### Error: "Failed to generate authentication token"
**Causa**: Clave privada inválida o corrupta
**Solución**:
```bash
# Verificar formato de clave
head -1 ./config/jaas-private-key.pem
# Debe mostrar: -----BEGIN PRIVATE KEY-----

# Verificar permisos
chmod 600 ./config/jaas-private-key.pem
```

### Fallback a Jitsi Público
Si JAAS no está configurado, el sistema automáticamente usa Jitsi público:
```javascript
// Fallback automático
return buildPublicJitsiUrl({ roomName, userName, type });
// Genera: https://meet.jit.si/pnptv-hangout-123#config...
```

---

## 📊 Métricas y Monitoreo

### Logs Importantes
```javascript
// Hangout creado
logger.info('Video call created', { callId, creatorId, platform: 'jitsi' });

// Jitsi URL generada
logger.info('Generated Jitsi hangouts URL', {
  roomName,
  userId,
  userName,
  isModerator
});

// Error generando URL
logger.error('Error building Jitsi hangouts URL:', error);
```

### Verificar en Logs
```bash
# Ver logs de Hangouts
pm2 logs pnptvbot | grep -i "hangout\|jitsi"

# Ver errores JAAS
pm2 logs pnptvbot | grep -i "jaas\|jwt"
```

---

## 🔄 Migración desde Agora

### Opción 1: Dual Platform (Actual)
- ✅ Usuarios eligen entre Jitsi y Agora
- ✅ Máxima compatibilidad
- ✅ Transición suave

### Opción 2: Solo Jitsi
Para usar solo Jitsi, modificar `hangoutsHandler.js`:
```javascript
// Solo mostrar botón Jitsi
Markup.inlineKeyboard([
  [Markup.button.url('🎥 Entrar', jitsiUrl)],
  // Remover botón Agora
])
```

---

## ✅ Checklist de Implementación

- [x] JAAS Service configurado
- [x] Variables de entorno configuradas
- [x] Clave privada JAAS instalada
- [x] jitsiHangoutsWebApp.js creado
- [x] hangoutsHandler.js actualizado
- [x] hangoutsController.js actualizado
- [x] Generación de JWT tokens
- [x] Roles (moderador/participante)
- [x] Salas principales integradas
- [x] Fallback a Jitsi público
- [x] Documentación completa
- [ ] Testing end-to-end
- [ ] Despliegue a producción

---

## 📞 Soporte

### Para Usuarios
- Jitsi no requiere instalación
- Funciona en navegador
- Compatible con móviles
- Sin registro requerido

### Para Admins
- Monitorear logs: `pm2 logs pnptvbot --lines 100 | grep -i jitsi`
- Verificar JAAS: `node -e "require('./src/bot/services/jaasService').isConfigured()"`
- Regenerar tokens: Automático en cada join

---

## 🎉 Beneficios de JAAS

1. ✅ **Seguridad**: JWT tokens firmados
2. ✅ **Privacidad**: Sin grabaciones
3. ✅ **Escalabilidad**: Infraestructura 8x8
4. ✅ **Sin Instalación**: Navegador web
5. ✅ **Multiplataforma**: Web, iOS, Android
6. ✅ **Calidad**: Codec VP9 optimizado
7. ✅ **Compatible**: Funciona con Telegram WebApp
