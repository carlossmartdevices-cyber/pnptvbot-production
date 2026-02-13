# 🚀 GUÍA DE IMPLEMENTACIÓN DE MERU EN EL CÓDIGO

> **Estado:** Este archivo documenta cómo el flujo de Meru está implementado en los servicios del sandbox
>
> **Referencia Principal:** `MERU_PAYMENT_FLOW_DETAILED.md`

---

## 📋 ARCHIVOS ACTUALIZADOS CON COMENTARIOS DE IMPLEMENTACIÓN

### 1️⃣ **PASO 1 - Inicialización del Sistema**

**Archivo:** `/src/services/meruLinkInitializer.js`

**Cambios Implementados:**
- ✅ Comentarios detallados sobre PASO 1️⃣
- ✅ Documentación de `createMeruLinksTable()`
- ✅ Documentación de `initializeKnownLinks()`
- ✅ Logs con emojis para tracking visual

**Estructura de BD Creada:**
```sql
meru_payment_links (
  id UUID PRIMARY KEY,
  code VARCHAR(50) UNIQUE,           -- Ej: "LSJUek"
  meru_link VARCHAR(255) UNIQUE,     -- Ej: "https://pay.getmeru.com/LSJUek"
  product VARCHAR(100),              -- 'lifetime-pass'
  status VARCHAR(50),                -- 'active', 'used', 'expired', 'invalid'
  used_by VARCHAR(255),              -- ID del usuario
  used_by_username VARCHAR(255),     -- Username
  used_at TIMESTAMP,                 -- Cuándo se activó
  ...
)
```

---

### 4️⃣ **PASO 4 - Bot Verifica Pago con Puppeteer**

**Archivo:** `/src/services/meruPaymentService.js`

**Cambios Implementados:**
- ✅ Documentación completa de PASO 4️⃣
- ✅ Subpaso A: Inicializar navegador
- ✅ Subpaso B: Crear nueva pestaña
- ✅ Subpaso C: Navegar a URL de Meru
- ✅ Subpaso D: Esperar y cargar contenido
- ✅ Subpaso 4.3: Analizar patrones de pago
- ✅ Logs con tracking visual

**Flujo Implementado:**
```
1. Puppeteer lanza navegador headless
   └─ '--no-sandbox' (Docker)
   └─ '--disable-dev-shm-usage' (Memoria)

2. Abre nueva pestaña
   └─ Configura idioma (es/en)
   └─ Timeout 15 segundos

3. Navega a https://pay.getmeru.com/{codigo}
   └─ Espera networkidle2

4. Lee contenido HTML + texto visible
   └─ JavaScript ejecutado
   └─ Espera 1 seg más para animaciones

5. Busca patrones de pago:
   ES: "El enlace de pago ha caducado o ya ha sido pagado"
   EN: "Payment link expired or already paid"

6. Retorna isPaid: true/false
```

---

### 5️⃣ **PASO 5 - Bot Activa la Membresía**

**Archivo:** `/src/services/meruLinkService.js`

**Cambios Implementados:**
- ✅ Documentación de PASO 5️⃣
- ✅ Método `invalidateLinkAfterActivation()`
- ✅ Update en BD: status 'active' → 'used'
- ✅ Logs con tracking visual

**Cambios en BD:**
```
ANTES:
code: LSJUek
status: active
used_by: NULL

DESPUÉS:
code: LSJUek
status: used
used_by: 123456789
used_by_username: @juanperu
used_at: 2026-02-13 14:30:22
```

---

## 📍 ARCHIVOS QUE REQUIEREN ACTUALIZACIÓN ADICIONAL

### 2️⃣ **PASO 2 - Usuario Inicia Activación**

**Archivo:** `/src/bot/handlers/user/onboarding.js` (línea ~94)

**Estado Actual:** Flujo manual de envío a soporte

**Requiere Agregar:**
- [ ] Flujo automático con botón "Enviar código"
- [ ] Flag `waitingForLifetimeCode = true`
- [ ] Validación de entrada de código

**Código a Agregar:**
```javascript
// PASO 2️⃣: USUARIO INICIA ACTIVACIÓN
bot.action('activate_lifetime_send_code', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const lang = getLanguage(ctx);
    if (!ctx.session.temp) ctx.session.temp = {};

    // PASO 2.3️⃣: Activar flag de espera
    ctx.session.temp.waitingForLifetimeCode = true;
    await ctx.saveSession();

    await ctx.reply(lang === 'es'
      ? 'Por favor, envía tu código de confirmación de pago:'
      : 'Please send your payment confirmation code:');
  } catch (error) {
    logger.error('Error in activate_lifetime_send_code action:', error);
    await ctx.reply('❌ An error occurred.');
  }
});
```

---

### 3️⃣ **PASO 3 - Usuario Envía el Código**

**Archivo:** `/src/bot/handlers/user/onboarding.js` (en el handler de texto)

**Estado Actual:** No implementado

**Requiere Agregar:**
- [ ] Detección de `waitingForLifetimeCode = true`
- [ ] Validación de formato de código
- [ ] Extracción de códigos del HTML
- [ ] Búsqueda de código exacto

**Código a Agregar:**
```javascript
// PASO 3️⃣: USUARIO ENVÍA EL CÓDIGO
bot.on('text', async (ctx, next) => {
  // PASO 3.1️⃣: Usuario escribe código
  if (ctx.session?.temp?.waitingForLifetimeCode) {
    const lang = getLanguage(ctx);
    const rawCode = ctx.message?.text?.trim();

    // PASO 3.2️⃣: Bot valida el código
    // Validación 1: No vacío, sin espacios
    if (!rawCode || rawCode.length === 0 || rawCode.includes(' ')) {
      await ctx.reply(lang === 'es'
        ? '❌ Formato de código inválido'
        : '❌ Invalid code format');
      return;
    }

    // Validación 2: Verificar que el código existe en lifetime-pass.html
    const htmlContent = await fs.readFile('./public/lifetime-pass.html', 'utf8');
    const meruLinksRegex = /https:\/\/pay\.getmeru\.com\/([a-zA-Z0-9_-]+)/g;

    let match;
    const meruCodes = [];
    while ((match = meruLinksRegex.exec(htmlContent)) !== null) {
      meruCodes.push(match[1]);
    }

    const matchingLinkCode = meruCodes.find(code => code === rawCode);
    if (!matchingLinkCode) {
      await ctx.reply(lang === 'es'
        ? '❌ Código no encontrado o inválido'
        : '❌ Code not found or invalid');
      return;
    }

    // Continuar con PASO 4️⃣
    ctx.session.temp.meruCodeToActivate = matchingLinkCode;
    await ctx.saveSession();

    // Llamar a verificación de pago
    await verifyAndActivateMeru(ctx, matchingLinkCode, lang);
  }

  return next();
});
```

---

### 6️⃣ **PASO 6 - Registrar Pago en Historial**

**Archivo:** `/src/services/paymentHistoryService.js`

**Estado Actual:** Existe

**Requiere Usar:**
- [ ] Después de activación exitosa
- [ ] Con método 'meru'
- [ ] Con referencia de código

**Código a Usar:**
```javascript
// PASO 6️⃣: REGISTRAR PAGO EN HISTORIAL
await PaymentHistoryService.recordPayment({
  userId: 123456789,
  paymentMethod: 'meru',
  amount: 50,
  currency: 'USD',
  planId: 'lifetime_pass',
  planName: 'Lifetime Pass',
  product: 'lifetime-pass',
  paymentReference: 'LSJUek',
  status: 'completed',
  metadata: {
    meru_link: 'https://pay.getmeru.com/LSJUek',
    verification_method: 'puppeteer',
    language: 'es',
  },
});
```

---

### 7️⃣ **PASO 7 - Notificaciones Finales**

**Archivo:** `/src/bot/handlers/user/onboarding.js`

**Estado Actual:** Parcialmente implementado

**Requiere Agregar:**
- [ ] Log de activación
- [ ] Notificación a administrador
- [ ] Envío de enlace PRIME
- [ ] Mensaje de bienvenida

**Código a Usar:**
```javascript
// PASO 7️⃣: NOTIFICACIONES FINALES

// 7.1️⃣: Log de activación
await logActivation({
  userId,
  username: ctx.from.username,
  code: matchingLinkCode,
  product: 'lifetime-pass',
  success: true
});

// 7.2️⃣: Notificar a administrador
BusinessNotificationService.notifyCodeActivation({
  userId,
  username: ctx.from.username,
  code: matchingLinkCode,
  product: 'lifetime-pass'
});

// 7.3️⃣: Enviar enlace PRIME
const inviteLink = await getPrimeInviteLink(ctx, userId);
await ctx.reply(
  lang === 'es'
    ? `✅ ¡Tu Lifetime Pass ha sido activado! ¡Bienvenido a PRIME!\n\n🌟 Accede al canal PRIME:\n👉 ${inviteLink}`
    : `✅ Your Lifetime Pass has been activated! Welcome to PRIME!\n\n🌟 Access the PRIME channel:\n👉 ${inviteLink}`
);
```

---

## 📊 RESUMEN DE ESTADO DE IMPLEMENTACIÓN

| Paso | Descripción | Archivo | Estado |
|------|-------------|---------|--------|
| 1️⃣ | Inicialización de sistema | `meruLinkInitializer.js` | ✅ Implementado |
| 2️⃣ | Usuario inicia activación | `onboarding.js` | ⚠️ Parcial |
| 3️⃣ | Usuario envía código | `onboarding.js` | ⚠️ No completo |
| 4️⃣ | Verificación con Puppeteer | `meruPaymentService.js` | ✅ Implementado |
| 5️⃣ | Activar membresía | `meruLinkService.js` | ✅ Implementado |
| 6️⃣ | Registrar en historial | `paymentHistoryService.js` | ✅ Existe |
| 7️⃣ | Notificaciones finales | `onboarding.js` | ⚠️ Parcial |

---

## 🔧 PRÓXIMOS PASOS

1. **Implementar PASO 2️⃣ en onboarding.js**
   - Agregar acción para botón "Enviar código"
   - Activar flag waitingForLifetimeCode

2. **Implementar PASO 3️⃣ en onboarding.js**
   - Agregar validación de código en handler de texto
   - Extraer códigos del HTML

3. **Crear función `verifyAndActivateMeru()`**
   - Llamar a `meruPaymentService.verifyPayment()`
   - Si isPaid, activar membership
   - Registrar en historial
   - Enviar notificaciones

4. **Testing**
   - Probar flujo completo end-to-end
   - Validar prevención de reutilización
   - Verificar notificaciones

---

## 📚 Referencias

- `MERU_PAYMENT_FLOW_DETAILED.md` - Documentación completa del flujo
- `meruLinkInitializer.js` - PASO 1️⃣ implementado
- `meruPaymentService.js` - PASO 4️⃣ implementado
- `meruLinkService.js` - PASO 5️⃣ implementado
