# REPORTE CRÍTICO DE AUDITORÍA DE CÓDIGO - PNPtv Bot

**Fecha del análisis**: 2025-11-16
**Proyecto**: pnptvbot-production
**Tipo de análisis**: COMPLETO Y EXHAUSTIVO
**Severidad**: CRÍTICA, ALTA, MEDIA

---

## RESUMEN EJECUTIVO

Se han identificado **95+ problemas** en el código, incluyendo:
- **1 CRÍTICA** (credenciales expuestas)
- **15+ ALTAS** (errores de lógica, async/await, manejo de errores)
- **79+ MEDIAS** (variables no utilizadas, líneas largas)

El código tiene problemas de seguridad, confiabilidad y calidad que requieren atención inmediata.

---

## 1. ERRORES CRÍTICOS

### 1.1 CREDENCIALES EXPUESTAS EN .env.example
**Ubicación**: `/home/user/pnptvbot-production/.env.example` (líneas 1-170)
**Severidad**: CRÍTICA
**Descripción**: El archivo contiene credenciales REALES de producción:
- Sentry DSN (línea 69)
- ePayco API Keys (línea 77-79)
- Daimo API Key y Webhook Secret (línea 89-90)
- Bot Token de Telegram (línea 3)
- JWT Secret (línea 138)
- Encryption Key (línea 140)

**Impacto Potencial**: 
- Acceso no autorizado a bases de datos
- Fraude con pagos ePayco
- Abuso de webhook de Daimo
- Acceso completo al bot de Telegram
- Imposibilidad de revocar secretos

**Solución**: 
1. Revocar TODAS las credenciales inmediatamente
2. Usar valores placeholder en .env.example (ej: `your_key_here`)
3. NO incluir datos reales en ejemplos

---

## 2. ERRORES DE ASYNC/AWAIT Y PROMESAS

### 2.1 setTimeout sin await en activation.js
**Ubicación**: `/home/user/pnptvbot-production/src/bot/handlers/payments/activation.js` (línea 153)
**Severidad**: ALTA
**Tipo**: Promise no manejada

```javascript
// INCORRECTO:
setTimeout(async () => {
  try {
    await ctx.reply(...);
  } catch (err) {
    logger.error('Error sending follow-up message:', err);
  }
}, 2000);
```

**Problema**: 
- No hay await, la función continúa antes de que se envíe el mensaje
- El contexto de Telegraf (ctx) podría no estar disponible después de 2 segundos
- Errores silenciosos si el contexto se destruye

**Impacto Potencial**: 
- Mensaje no se envía en el contexto correcto
- Errores silenciosos sin visibilidad

**Solución**:
```javascript
// CORRECTO - Usar Promise.resolve().then() o almacenar datos
const sendFollowUpMessage = async () => {
  try {
    await ctx.reply(...);
  } catch (err) {
    logger.error('Error sending follow-up message:', err);
  }
};
// Enviar después de completar la respuesta actual
Promise.resolve().then(() => sendFollowUpMessage());
```

---

### 2.2 Manejo inconsistente de errores en bot.js
**Ubicación**: `/home/user/pnptvbot-production/src/bot/core/bot.js` (líneas 64-71)
**Severidad**: ALTA
**Descripción**: El código continúa si faltan variables de entorno críticas

```javascript
// INCORRECTO:
try {
  validateCriticalEnvVars();
  logger.info('✓ Environment variables validated');
} catch (error) {
  logger.error('CRITICAL: Missing environment variables, but attempting to continue...');
  logger.error(error.message);
  // Continuar de todos modos, el bot puede fallar después pero al menos intentamos
}
```

**Problema**: 
- Las variables críticas (BOT_TOKEN) son ESENCIALES
- Continuando sin ellas causará fallos silenciosos después
- El bot fallará de forma impredecible

**Impacto Potencial**: 
- Comportamiento impredecible en producción
- Fallos en cascada cuando se intente usar Telegram

**Solución**: 
Hacer throw en lugar de continuar para variables CRÍTICAS:
```javascript
try {
  validateCriticalEnvVars();
} catch (error) {
  logger.error('CRITICAL: Cannot start bot without environment variables');
  process.exit(1);
}
```

---

## 3. VARIABLES NO DECLARADAS Y NO UTILIZADAS

### 3.1 Imports sin uso (45+ instancias)
**Severidad**: MEDIA
**Ejemplos**:

| Archivo | Línea | Variable |
|---------|-------|----------|
| bot.js | 3 | `express` (importado pero no usado) |
| paymentService.js | 1 | `_axios` (renombrado a _axios pero no usado) |
| callService.js | 6 | `ConfigurationError` |
| callManagement.js (admin) | 5 | `t` (variable i18n) |
| privateCalls.js | 5 | `DaimoConfig` |
| helpers.js | 64 | `timeoutMinutes` (parámetro) |
| roleManagement.js | 3 | `PERMISSIONS` y `t` |
| radio.js | 4 | `UserModel` |

**Solución**: Remover imports no utilizados
```javascript
// ANTES:
const express = require('express');
const { t } = require('../utils/i18n');

// DESPUÉS: Solo lo necesario
const { t } = require('../utils/i18n');
```

---

### 3.2 Parámetros de función no utilizados
**Severidad**: MEDIA
**Ejemplos**:

| Archivo | Línea | Parámetro |
|---------|-------|-----------|
| errorHandler.js (API) | 9 | `next` (no usado en error handler) |
| moderationFilter.js | 89 | `lang` |
| paymentService.js | 565, 581 | `payment` |
| session.js | 56, 70 | `redisError` |

**Solución**: Usar convención `_` para parámetros no utilizados:
```javascript
// ANTES:
function errorHandler(err, req, res, next) { }

// DESPUÉS:
function errorHandler(err, req, res, _next) { }
```

---

### 3.3 Variables asignadas pero no utilizadas
**Severidad**: MEDIA
**Ejemplos**:

| Archivo | Línea | Variable |
|---------|-------|----------|
| subscriptionController.js | 193-195 | `x_amount`, `x_currency_code`, `x_signature` |
| webhookController.js | 132 | `ref` |
| callManagement.js (admin) | 15 | `lang` |
| paymentAnalytics.js | 175 | `paymentApps` |
| menu.js | 198 | `error` |

**Ejemplo**:
```javascript
// INCORRECTO:
const { ref, status } = req.query;
// 'ref' nunca se usa

// CORRECTO:
const { status } = req.query;
```

---

## 4. ERRORES DE CÓDIGO Y LÓGICA

### 4.1 Líneas que superan el límite de 120 caracteres (13 instancias)
**Severidad**: MEDIA
**Ubicaciones**:
- subscriptionController.js: 157, 141
- bot.js: 224
- rateLimitGranular.js: 199, 200
- api/routes.js: 141
- handlers/admin/index.js: 137, 139
- handlers/media/support.js: 33, 49, 389, 419, 420
- handlers/user/settings.js: 115
- handlers/user/profile.js: 460-464, 564
- models/liveStreamModel.js: 558, 888
- utils/i18n.js: 185, 539, 544, 545, 547

**Solución**: Refactorizar líneas largas:
```javascript
// ANTES (125+ caracteres):
message += `Para contactar a un administrador del grupo, por favor:\n\n1. Menciona a uno de los administradores en el chat del grupo\n`;

// DESPUÉS:
const contactMessage = 'Para contactar a un administrador del grupo, '
  + 'por favor:\n\n'
  + '1. Menciona a uno de los administradores en el chat del grupo\n';
message += contactMessage;
```

---

### 4.2 Falta de validación de null/undefined
**Ubicación**: Múltiples archivos
**Severidad**: MEDIA
**Ejemplo** - chat-cleanup.js (línea 47):

```javascript
this.scheduledDeletions.delete(timeoutId);
```

Si `timeoutId` es null o undefined, esto puede causar comportamiento impredecible.

**Solución**:
```javascript
if (timeoutId) {
  this.scheduledDeletions.delete(timeoutId);
}
```

---

### 4.3 Manejo incompleto de errores
**Ubicación**: `/home/user/pnptvbot-production/src/bot/services/paymentService.js` (línea 235)
**Severidad**: ALTA
**Descripción**: 

```javascript
const validation = validateEpaycoPayload(req.body);
if (!validation.valid) {
  logger.warn('Invalid ePayco webhook payload', { error: validation.error });
  return res.status(400).json({ success: false, error: validation.error });
}
```

Aquí no se valida que `validation` tenga las propiedades esperadas.

**Solución**:
```javascript
if (!validation || !validation.valid) {
  logger.warn('Invalid ePayco webhook payload', { 
    error: validation?.error || 'Unknown validation error' 
  });
  return res.status(400).json({ success: false, error: 'Invalid payload' });
}
```

---

### 4.4 Uso potencial de this sin vincular en métodos static
**Ubicación**: `/home/user/pnptvbot-production/src/bot/services/chatCleanupService.js` (línea 35)
**Severidad**: MEDIA
**Descripción**: setTimeout con callback async que usa `this`:

```javascript
const timeoutId = setTimeout(async () => {
  try {
    await telegram.deleteMessage(chatId, messageId);
    // ...
    this.scheduledDeletions.delete(timeoutId);  // <-- 'this' puede perder contexto
  } catch (error) {
    // ...
    this.scheduledDeletions.delete(timeoutId);  // <-- 'this' puede ser undefined
  }
}, delay);
```

**Solución**: Guardar referencia a this:
```javascript
const self = this;
const timeoutId = setTimeout(async () => {
  try {
    await telegram.deleteMessage(chatId, messageId);
    self.scheduledDeletions.delete(timeoutId);
  } catch (error) {
    self.scheduledDeletions.delete(timeoutId);
  }
}, delay);
```

---

## 5. PROBLEMAS DE SEGURIDAD

### 5.1 XSS potencial en handlePaymentResponse
**Ubicación**: `/home/user/pnptvbot-production/src/bot/api/controllers/webhookController.js` (líneas 135-258)
**Severidad**: MEDIA
**Descripción**: El nombre del bot se inserta directamente en HTML:

```javascript
res.send(`
  ...
  <a href="https://t.me/${process.env.BOT_USERNAME || 'pnptv_bot'}" ...>
  ...
`);
```

Si `BOT_USERNAME` contiene caracteres especiales, podría causar XSS.

**Solución**:
```javascript
const botUsername = (process.env.BOT_USERNAME || 'pnptv_bot')
  .replace(/[<>"']/g, ''); // Sanitizar
const telegramLink = `https://t.me/${botUsername}`;
```

---

### 5.2 Información sensible en logs
**Ubicación**: `/home/user/pnptvbot-production/src/bot/core/bot.js` (línea 169-176)
**Severidad**: MEDIA
**Descripción**: Se registran detalles de la solicitud incluyendo potencialmente datos sensibles:

```javascript
logger.info('Telegram webhook received:', {
  hasBody: !!req.body,
  bodyKeys: req.body ? Object.keys(req.body) : [],
  contentType: req.headers['content-type'],
  // ...
});
```

Si el webhook contiene datos de usuario, estos quedan registrados.

**Solución**: No registrar el cuerpo completo en producción:
```javascript
logger.info('Telegram webhook received:', {
  hasBody: !!req.body,
  contentType: req.headers['content-type'],
  // No incluir bodyKeys o datos sensibles
});
```

---

## 6. PROBLEMAS DE CONFIGURACIÓN

### 6.1 Error handling incoherente en daimo.js
**Ubicación**: `/home/user/pnptvbot-production/src/config/daimo.js` (línea 35-42)
**Severidad**: ALTA

```javascript
const getDaimoConfig = () => {
  const treasuryAddress = process.env.DAIMO_TREASURY_ADDRESS;
  
  // Lanza error si no está configurado
  if (!treasuryAddress) {
    logger.error('DAIMO_TREASURY_ADDRESS not configured');
    throw new Error('DAIMO_TREASURY_ADDRESS is required for Daimo Pay');
  }
```

Pero en `src/bot/handlers/payments/index.js`, esto podría no ser capturado correctamente si se llama durante el inicio.

---

### 6.2 Redis connection error handling
**Ubicación**: `/home/user/pnptvbot-production/src/config/redis.js` (línea 20-22)
**Severidad**: MEDIA
**Descripción**: El retryStrategy devuelve delay pero no debería devolver 0:

```javascript
retryStrategy: (times) => {
  const delay = Math.min(times * 50, 2000);
  return delay;  // Si delay es 0, Redis podría no reintentar
},
```

---

## 7. TODOS INCOMPLETOS

### 7.1 TODO encontrado
**Ubicación**: `/home/user/pnptvbot-production/src/bot/handlers/user/callManagement.js` (línea 392)
**Severidad**: ALTA
**Descripción**: 
```javascript
// TODO: Process actual refund through payment provider
```

La lógica de reembolso no está implementada. Los usuarios podrían solicitar reembolsos sin procesarlos.

**Solución**: Implementar la lógica de reembolso o deshabilitar la función hasta que esté lista.

---

## 8. PROBLEMAS DE CALIDAD DE CÓDIGO

### 8.1 Código muerto/no utilizado
**Severidad**: MEDIA
**Ejemplos**:
- models/callPackageModel.js: COLLECTION no se usa
- models/emoteModel.js: COLLECTION no se usa
- utils/errors.js: eslint-disable innecesario (línea 5)

---

### 8.2 Inconsistencias en manejo de errores
**Severidad**: MEDIA
**Descripción**: Algunos archivos usan try-catch, otros no. Algunos logean errores, otros no.

**Ejemplo inconsistencia**:
```javascript
// En algunos handlers:
try {
  // ...
} catch (error) {
  logger.error('Error:', error);
  // Pero NO notifica al usuario
}

// En otros handlers:
try {
  // ...
} catch (error) {
  logger.error('Error:', error);
  await ctx.reply('Error occurred');
  // Notifica al usuario
}
```

---

## 9. PROBLEMAS DOCUMENTADOS EN ESLint

### Resumen de advertencias ESLint:
- **95 advertencias totales**
- **0 errores** (pero muchas advertencias son de riesgo)
- **1 advertencia potencialmente auto-corregible**

**Categorías principales**:
1. Variables no utilizadas: ~45
2. Líneas demasiado largas: ~13
3. Parámetros no utilizados: ~15
4. Otros: ~22

---

## 10. RECOMENDACIONES PRIORITARIAS

### 🔴 INMEDIATO (Hacer ahora):
1. **Revocar TODAS las credenciales en .env.example**
2. **Corregir variables de entorno críticas en bot.js** - no continuar si faltan
3. **Implementar lógica de reembolso** o deshabilitar función
4. **Arreglar setTimeout async** en activation.js
5. **Validar todas las entrada de webhooks**

### 🟠 URGENTE (Esta semana):
1. **Remover todos los imports no utilizados**
2. **Corregir manejo de errores inconsistente**
3. **Refactorizar líneas largas**
4. **Implementar sanitización en handlePaymentResponse**
5. **Mejorar logging** - no registrar datos sensibles

### 🟡 IMPORTANTE (Este mes):
1. **Estandarizar error handling** en toda la aplicación
2. **Agregar validaciones de null/undefined** en todas partes
3. **Completar pruebas unitarias** para funciones críticas
4. **Documentar funciones de pago** - especialmente webhooks
5. **Implementar health checks** para todas las dependencias

---

## CONCLUSIÓN

El código tiene **problemas de SEGURIDAD y FIABILIDAD CRÍTICOS** que deben ser resueltos antes de cualquier despliegue en producción. La exposición de credenciales es el problema más grave.

**Puntuación de calidad**: 2.5/10
- Funcionalidad: OK
- Seguridad: CRÍTICA
- Mantenibilidad: MEDIA
- Fiabilidad: MEDIA-BAJA

