# 🔧 Ejemplos de Integración - Nuevas Features

Este documento muestra cómo integrar las mejoras de **Fase 1** en handlers existentes.

---

## 📋 Índice

1. [Validación de Usuario](#validación-de-usuario)
2. [Sanitización de Inputs](#sanitización-de-inputs)
3. [Rate Limiting Contextual](#rate-limiting-contextual)
4. [Validación de Webhooks](#validación-de-webhooks)
5. [Combinando Todo](#combinando-todo)

---

## 1. Validación de Usuario

### Antes ❌
```javascript
// src/bot/handlers/user/profile.js

bot.command('update_name', async (ctx) => {
  const name = ctx.message.text.split(' ')[1];

  // Sin validación - cualquier input aceptado
  await UserModel.update(ctx.from.id, { displayName: name });

  ctx.reply('✅ Nombre actualizado');
});
```

### Después ✅
```javascript
// src/bot/handlers/user/profile.js
const { validateData, schemas } = require('../../../validation/schemas/user.schema');
const sanitize = require('../../../utils/sanitizer');

bot.command('update_name', async (ctx) => {
  const rawName = ctx.message.text.split(' ')[1];

  // 1. Sanitizar primero
  const name = sanitize.text(rawName, {
    maxLength: 100,
    escapeHtml: true,
    allowNewlines: false,
  });

  // 2. Validar
  const profileData = { displayName: name };
  const result = await validateData(schemas.profileUpdate, profileData);

  if (!result.valid) {
    return ctx.reply(`❌ Nombre inválido:\n${result.errors.join('\n')}`);
  }

  // 3. Actualizar con datos validados
  await UserModel.update(ctx.from.id, result.data);

  ctx.reply('✅ Nombre actualizado correctamente');
});
```

**Beneficios:**
- ✅ Previene inputs maliciosos
- ✅ Limita longitud
- ✅ Escapa HTML para prevenir XSS
- ✅ Mensajes de error claros

---

## 2. Sanitización de Inputs

### Ejemplo: Actualizar Bio

### Antes ❌
```javascript
bot.command('bio', async (ctx) => {
  const bio = ctx.message.text.substring(5); // Todo después de "/bio "

  await UserModel.update(ctx.from.id, { bio });
  ctx.reply('Bio actualizada');
});
```

### Después ✅
```javascript
const sanitize = require('../../../utils/sanitizer');

bot.command('bio', async (ctx) => {
  const rawBio = ctx.message.text.substring(5);

  // Sanitizar con límites y validación
  const bio = sanitize.text(rawBio, {
    maxLength: 500,
    allowNewlines: true, // Permitir saltos de línea en bio
    escapeHtml: true,
  });

  if (!bio || bio.trim().length === 0) {
    return ctx.reply('❌ La bio no puede estar vacía');
  }

  await UserModel.update(ctx.from.id, { bio });
  ctx.reply('✅ Bio actualizada correctamente');
});
```

### Ejemplo: Sanitizar Email

```javascript
const sanitize = require('../../../utils/sanitizer');

bot.command('email', async (ctx) => {
  const rawEmail = ctx.message.text.split(' ')[1];

  // Sanitiza Y valida email
  const email = sanitize.email(rawEmail);

  if (!email) {
    return ctx.reply('❌ Email inválido. Ejemplo: user@example.com');
  }

  await UserModel.update(ctx.from.id, { email });
  ctx.reply('✅ Email actualizado correctamente');
});
```

### Ejemplo: Sanitizar Objeto Completo

```javascript
const sanitize = require('../../../utils/sanitizer');

bot.action('profile_update', async (ctx) => {
  const rawData = {
    username: ctx.session.tempUsername,
    email: ctx.session.tempEmail,
    age: ctx.session.tempAge,
    bio: ctx.session.tempBio,
  };

  // Sanitizar todo el objeto de una vez
  const cleanData = sanitize.object(rawData, {
    username: 'username',
    email: 'email',
    age: { type: 'number', min: 13, max: 120 },
    bio: { type: 'text', maxLength: 500, allowNewlines: true },
  });

  await UserModel.update(ctx.from.id, cleanData);
  ctx.reply('✅ Perfil actualizado');
});
```

---

## 3. Rate Limiting Contextual

### Ejemplo: Handler de Pagos

### Antes ❌
```javascript
// src/bot/handlers/payments/index.js

// Todos los pagos usan el rate limit global (30 req/min)
bot.action(/pay_daimo_(.+)/, async (ctx) => {
  const planId = ctx.match[1];

  const payment = await PaymentService.createDaimoPayment({
    userId: ctx.from.id,
    planId,
  });

  ctx.reply(`💰 Link de pago: ${payment.paymentUrl}`);
});
```

### Después ✅
```javascript
// src/bot/handlers/payments/index.js
const { rateLimitByContext } = require('../../core/middleware/rateLimitGranular');

// Pagos tienen su propio límite (5 req/min, bloqueo 5 min)
bot.action(/pay_daimo_(.+)/,
  rateLimitByContext('payment', {
    skipForAdmins: true, // Admins sin límite
    onLimitReached: async (ctx, retryAfter, context) => {
      await ctx.reply(
        `🚫 Demasiados intentos de pago.\n\n` +
        `Por favor espera ${retryAfter} segundos.\n\n` +
        `Si necesitas ayuda, contacta a soporte.`
      );

      // Log para análisis
      logger.warn('Payment rate limit exceeded', {
        userId: ctx.from.id,
        username: ctx.from.username,
        planId: ctx.match[1],
      });
    },
  }),
  async (ctx) => {
    const planId = ctx.match[1];

    const payment = await PaymentService.createDaimoPayment({
      userId: ctx.from.id,
      planId,
    });

    ctx.reply(`💰 Link de pago: ${payment.paymentUrl}`);
  }
);
```

### Ejemplo: Handler de Media (Radio)

```javascript
// src/bot/handlers/media/radio.js
const { rateLimitByContext } = require('../../core/middleware/rateLimitGranular');

// Media tiene límite de 30 req/min
bot.command('radio',
  rateLimitByContext('media'),
  async (ctx) => {
    const radioUrl = await RadioService.getStreamUrl();

    ctx.reply(`🎵 Escucha nuestra radio:\n${radioUrl}`);
  }
);

bot.action('radio_stop',
  rateLimitByContext('media'),
  async (ctx) => {
    await ctx.answerCbQuery('Radio detenida');
  }
);
```

### Ejemplo: Handler de Búsqueda

```javascript
// src/bot/handlers/user/search.js
const { rateLimitByContext, checkRateLimit } = require('../../core/middleware/rateLimitGranular');

bot.command('search',
  rateLimitByContext('search'),
  async (ctx) => {
    const query = ctx.message.text.split(' ').slice(1).join(' ');

    if (!query) {
      return ctx.reply('❌ Debes proporcionar un término de búsqueda');
    }

    // Verificar límite antes de operación costosa
    const { allowed, remainingPoints } = await checkRateLimit(
      ctx.from.id.toString(),
      'search'
    );

    if (remainingPoints <= 2) {
      ctx.reply(`⚠️ Te quedan ${remainingPoints} búsquedas antes del límite`);
    }

    const results = await SearchService.search(query);

    ctx.reply(`🔍 Resultados:\n${results.join('\n')}`);
  }
);
```

### Ejemplo: Consumir Rate Limit Manualmente

```javascript
// Útil cuando la operación NO está en un middleware
const { consumeRateLimit } = require('../../core/middleware/rateLimitGranular');

async function processFileUpload(userId, file) {
  // Consumir 1 punto del contexto 'upload'
  const allowed = await consumeRateLimit(userId.toString(), 'upload', 1);

  if (!allowed) {
    throw new Error('Rate limit exceeded for uploads');
  }

  // Procesar archivo
  await uploadToStorage(file);
}
```

---

## 4. Validación de Webhooks

### Ejemplo: Webhook de Daimo

### Antes ❌
```javascript
// src/bot/api/controllers/webhookController.js

const handleDaimoWebhook = async (req, res) => {
  const { event, payment } = req.body;

  // Sin validación - cualquier payload aceptado
  await PaymentService.processDaimoWebhook(req.body);

  res.json({ success: true });
};
```

### Después ✅
```javascript
// src/bot/api/controllers/webhookController.js
const { schemas } = require('../../../validation/schemas/payment.schema');
const logger = require('../../../utils/logger');

const handleDaimoWebhook = async (req, res) => {
  // 1. Validar payload con schema
  const { error, value } = schemas.daimoWebhook.validate(req.body, {
    abortEarly: false,
    stripUnknown: true, // Elimina campos desconocidos
  });

  if (error) {
    const errors = error.details.map(d => d.message).join(', ');

    logger.error('Invalid Daimo webhook payload', {
      errors,
      body: req.body,
      ip: req.ip,
    });

    return res.status(400).json({
      error: 'Invalid payload',
      details: errors,
    });
  }

  // 2. Verificar firma (ya implementado)
  const isValid = await PaymentService.verifyDaimoSignature(
    req.headers['x-daimo-signature'],
    req.body
  );

  if (!isValid) {
    logger.error('Invalid Daimo signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 3. Procesar con datos validados
  await PaymentService.processDaimoWebhook(value);

  res.json({ success: true });
};
```

### Ejemplo: Webhook de ePayco

```javascript
const { schemas } = require('../../../validation/schemas/payment.schema');

const handleEpaycoWebhook = async (req, res) => {
  // Validar payload de ePayco
  const { error, value } = schemas.epaycoWebhook.validate(req.body);

  if (error) {
    logger.error('Invalid ePayco webhook', { errors: error.details });
    return res.status(400).json({ error: 'Invalid payload' });
  }

  // Verificar firma de ePayco
  const expectedSignature = generateEpaycoSignature(value);

  if (value.x_signature !== expectedSignature) {
    logger.error('Invalid ePayco signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Procesar pago
  await PaymentService.processEpaycoWebhook(value);

  res.json({ success: true });
};
```

---

## 5. Combinando Todo

### Ejemplo Completo: Handler de Registro con Todas las Mejoras

```javascript
// src/bot/handlers/user/onboarding.js
const { validate, validateData, schemas } = require('../../../validation/schemas/user.schema');
const sanitize = require('../../../utils/sanitizer');
const { rateLimitByContext } = require('../../core/middleware/rateLimitGranular');
const UserService = require('../../services/userService');
const logger = require('../../../utils/logger');

/**
 * Paso 1: Iniciar registro
 */
bot.command('start',
  rateLimitByContext('registration'), // Límite: 3 intentos/5min
  async (ctx) => {
    const userId = ctx.from.id;

    // Verificar si ya está registrado
    const exists = await UserService.exists(userId);

    if (exists) {
      return ctx.reply('Ya estás registrado. Usa /menu para ver opciones.');
    }

    // Iniciar flujo de registro
    ctx.session.registrationStep = 'awaiting_username';

    ctx.reply(
      '¡Bienvenido a PNPtv! 🎬\n\n' +
      'Por favor ingresa tu nombre de usuario (5-32 caracteres, solo letras, números y _):'
    );
  }
);

/**
 * Paso 2: Capturar y validar username
 */
bot.on('text',
  rateLimitByContext('registration'),
  async (ctx, next) => {
    if (ctx.session.registrationStep !== 'awaiting_username') {
      return next();
    }

    const rawUsername = ctx.message.text;

    // 1. Sanitizar username
    const username = sanitize.username(rawUsername);

    if (!username) {
      return ctx.reply(
        '❌ Nombre de usuario inválido.\n\n' +
        'Solo se permiten letras, números y guiones bajos.'
      );
    }

    // 2. Validar con schema
    const result = await validateData(schemas.username, username);

    if (!result.valid) {
      return ctx.reply(
        `❌ Nombre de usuario inválido:\n\n` +
        `${result.errors.join('\n')}\n\n` +
        'Intenta nuevamente.'
      );
    }

    // 3. Verificar disponibilidad
    const available = await UserService.isUsernameAvailable(username);

    if (!available) {
      return ctx.reply(
        '❌ Ese nombre de usuario ya está en uso.\n\n' +
        'Por favor elige otro.'
      );
    }

    // 4. Guardar y continuar
    ctx.session.tempUsername = result.data;
    ctx.session.registrationStep = 'awaiting_email';

    ctx.reply(
      `✅ Usuario "${username}" disponible.\n\n` +
      'Ahora ingresa tu correo electrónico:'
    );
  }
);

/**
 * Paso 3: Capturar y validar email
 */
bot.on('text',
  rateLimitByContext('registration'),
  async (ctx, next) => {
    if (ctx.session.registrationStep !== 'awaiting_email') {
      return next();
    }

    const rawEmail = ctx.message.text;

    // 1. Sanitizar email (normaliza y valida)
    const email = sanitize.email(rawEmail);

    if (!email) {
      return ctx.reply(
        '❌ Correo electrónico inválido.\n\n' +
        'Ejemplo: usuario@example.com\n\n' +
        'Intenta nuevamente.'
      );
    }

    // 2. Validar con schema
    const result = await validateData(schemas.email, email);

    if (!result.valid) {
      return ctx.reply(
        `❌ Email inválido:\n${result.errors.join('\n')}`
      );
    }

    // 3. Guardar y continuar
    ctx.session.tempEmail = result.data;
    ctx.session.registrationStep = 'confirming';

    ctx.reply(
      `📋 Confirma tus datos:\n\n` +
      `Usuario: ${ctx.session.tempUsername}\n` +
      `Email: ${ctx.session.tempEmail}\n\n` +
      `¿Es correcto? (Sí/No)`
    );
  }
);

/**
 * Paso 4: Confirmar y crear usuario
 */
bot.hears(['Sí', 'Si', 'Yes', 'sí', 'si'],
  rateLimitByContext('registration'),
  async (ctx, next) => {
    if (ctx.session.registrationStep !== 'confirming') {
      return next();
    }

    const userId = ctx.from.id.toString();

    // Preparar datos de registro
    const registrationData = {
      userId,
      username: ctx.session.tempUsername,
      email: ctx.session.tempEmail,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
      languageCode: ctx.from.language_code,
    };

    // Validar todos los datos juntos
    const result = await validateData(schemas.registration, registrationData);

    if (!result.valid) {
      logger.error('Registration validation failed', {
        errors: result.errors,
        data: registrationData,
      });

      return ctx.reply(
        '❌ Error en los datos de registro.\n\n' +
        'Por favor intenta nuevamente con /start'
      );
    }

    try {
      // Crear usuario con datos validados
      await UserService.create(result.data);

      // Limpiar sesión
      delete ctx.session.registrationStep;
      delete ctx.session.tempUsername;
      delete ctx.session.tempEmail;

      logger.info('User registered successfully', {
        userId,
        username: result.data.username,
      });

      ctx.reply(
        '🎉 ¡Registro completado exitosamente!\n\n' +
        'Usa /menu para ver las opciones disponibles.'
      );
    } catch (error) {
      logger.error('Error creating user', {
        error: error.message,
        userId,
      });

      ctx.reply(
        '❌ Error al crear tu cuenta.\n\n' +
        'Por favor contacta a soporte.'
      );
    }
  }
);
```

**Características implementadas:**
- ✅ **Rate limiting:** 3 intentos/5min, bloqueo 10min
- ✅ **Sanitización:** Username y email limpiados
- ✅ **Validación:** Schema Joi para todos los campos
- ✅ **Logging estructurado:** Logs con contexto
- ✅ **Error handling:** Mensajes claros para usuarios
- ✅ **Session management:** Flujo multi-step seguro

---

## 📊 Comparación Antes vs Después

| Aspecto               | Antes ❌               | Después ✅                     |
|-----------------------|------------------------|--------------------------------|
| Validación de inputs  | Manual, inconsistente  | Schemas centralizados Joi      |
| Sanitización          | Ninguna                | 11 funciones especializadas    |
| Rate limiting         | Global (30 req/min)    | Contextual (9 niveles)         |
| Seguridad XSS         | Vulnerable             | HTML escape automático          |
| Prevención de abuso   | Limitada               | Rate limits por feature        |
| Mensajes de error     | Genéricos              | Descriptivos y útiles          |
| Logging               | Básico                 | Estructurado con contexto      |

---

## 🎓 Buenas Prácticas

1. **SIEMPRE sanitizar primero, validar después**
   ```javascript
   const clean = sanitize.text(raw);
   const result = await validateData(schema, clean);
   ```

2. **Aplicar rate limiting apropiado según criticidad**
   - Pagos, registro: Muy restrictivo
   - Búsquedas, media: Moderado
   - Admin: Permisivo

3. **Usar datos validados, no inputs crudos**
   ```javascript
   // ❌ NO
   await UserModel.update(userId, { email: ctx.message.text });

   // ✅ SÍ
   const result = await validateData(schema, sanitized);
   if (result.valid) {
     await UserModel.update(userId, result.data);
   }
   ```

4. **Logs estructurados con contexto**
   ```javascript
   logger.info('Action completed', {
     userId: ctx.from.id,
     username: ctx.from.username,
     action: 'payment_created',
     metadata: { amount, planId },
   });
   ```

---

## 🔗 Referencias

- [Documentación Completa](../REFACTORING_PHASE_1_COMPLETED.md)
- [User Schema](../../src/validation/schemas/user.schema.js)
- [Payment Schema](../../src/validation/schemas/payment.schema.js)
- [Sanitizer](../../src/utils/sanitizer.js)
- [Rate Limiter Granular](../../src/bot/core/middleware/rateLimitGranular.js)

---

**Última actualización:** 2025-11-16
