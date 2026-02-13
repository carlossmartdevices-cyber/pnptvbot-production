DETALLES PASO A PASO DE MERU

  PASO 1️⃣ : INICIALIZACIÓN DEL SISTEMA

  Archivo: src/services/meruLinkInitializer.js

  Cuando la app inicia, se crea la
  infraestructura:

  1.1 Crear tabla en BD:

  meru_payment_links (
    id UUID PRIMARY KEY,
    code VARCHAR(50) UNIQUE,           -- Ej:
  "LSJUek"
    meru_link VARCHAR(255) UNIQUE,     -- Ej:
  "https://pay.getmeru.com/LSJUek"
    product VARCHAR(100),              --
  'lifetime-pass'
    status VARCHAR(50),                --
  'active', 'used', 'expired', 'invalid'
    used_by VARCHAR(255),              -- ID
  del usuario que lo usó
    used_by_username VARCHAR(255),     --
  Username de quien lo activó
    used_at TIMESTAMP,                 --
  Cuándo se activó
    created_at TIMESTAMP,
    invalidated_at TIMESTAMP,
    invalidation_reason TEXT
  )

  1.2 Cargar links conocidos en BD:

  Se inserta una lista predefinida de 10 links
   Meru:

  const knownLinks = [
    { code: 'LSJUek', url:
  'https://pay.getmeru.com/LSJUek' },
    { code: 'FCqG-z', url:
  'https://pay.getmeru.com/FCqG-z' },
    { code: 'MEz8OG', url:
  'https://pay.getmeru.com/MEz8OG' },
    { code: 'uqLZH9', url:
  'https://pay.getmeru.com/uqLZH9' },
    // ... 7 más
  ];

  // Para cada link:
  await meruLinkService.addLink(link.code,
  link.url, 'lifetime-pass');

  Resultado: Tabla con 10 links, todos con
  status = 'active'

  ---
  PASO 2️⃣ : USUARIO INICIA ACTIVACIÓN

  Archivo: src/bot/handlers/user/onboarding.js
   (línea 142)

  2.1 Usuario ejecuta:

  /start activate_lifetime

  2.2 Bot responde:

  ¡Muchas gracias por tu compra!

  Para activar tu Lifetime Pass, por favor
  presiona el botón de abajo
  y envíanos tu código de confirmación.

  [✉️  Enviar mi código de confirmación]

  2.3 Usuario presiona botón:

  - Flag waitingForLifetimeCode = true (línea
  85)
  - Espera a que usuario envíe el código

  ---
  PASO 3️⃣ : USUARIO ENVÍA EL CÓDIGO

  Archivo: src/bot/handlers/user/onboarding.js
   (línea 429-468)

  3.1 Usuario escribe:

  LSJUek

  3.2 Bot valida el código:

  const rawCode = ctx.message?.text?.trim();
  // "LSJUek"

  // Validación 1: No vacío, sin espacios
  if (!rawCode || rawCode.length === 0 ||
  rawCode.includes(' ')) {
    await ctx.reply('❌ Formato de código
  inválido');
    return;
  }

  // Validación 2: Verificar que el código
  existe en lifetime-pass.html
  const htmlContent = await
  fs.readFile('/path/to/lifetime-pass.html',
  'utf8');
  const meruLinksRegex = /https:\/\/pay\.getme
  ru\.com\/([a-zA-Z0-9_-]+)/g;

  // Extrae todos los códigos válidos del HTML
  let match;
  const meruCodes = [];
  while ((match =
  meruLinksRegex.exec(htmlContent)) !== null)
  {
      meruCodes.push(match[1]);  // ["LSJUek",
   "FCqG-z", ...]
  }

  // Busca coincidencia exacta
  const matchingLinkCode = meruCodes.find(code
   => code === rawCode);

  if (!matchingLinkCode) {
    await ctx.reply('❌ Código no encontrado o
   inválido');
    return;
  }

  ---
  PASO 4️⃣ : BOT VERIFICA PAGO CON PUPPETEER

  Archivo: src/services/meruPaymentService.js
  (línea 43-130)

  4.1 Bot inicia navegador headless:

  const meruPaymentService =
  require('../services/meruPaymentService');

  const paymentCheck = await
  meruPaymentService.verifyPayment(
    matchingLinkCode,  // "LSJUek"
    lang               // "es"
  );

  4.2 Puppeteer hace lo siguiente:

  Subpaso A: Inicializar navegador
  this.browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',  // Necesario
   para Docker
    ],
  });

  Subpaso B: Crear nueva pestaña
  page = await browser.newPage();

  // Configurar idioma según el usuario
  const acceptLanguage = lang === 'es'
    ? 'es-ES,es;q=0.9,en;q=0.8'
    : 'en-US,en;q=0.9,es;q=0.8';

  await page.setExtraHTTPHeaders({
    'Accept-Language': acceptLanguage,
  });

  // Timeout de 15 segundos
  await page.setDefaultTimeout(15000);

  Subpaso C: Navegar a la URL de Meru
  const meruUrl =
  `https://pay.getmeru.com/LSJUek`;
  await page.goto(meruUrl, { waitUntil:
  'networkidle2' });

  Subpaso D: Esperar a que se cargue
  JavaScript
  // Obtener HTML después que JavaScript se
  ejecuta
  const pageContent = await page.content();

  // Esperar 1 segundo más para animaciones
  await page.waitForTimeout(1000);

  // Obtener texto visible en la página
  const visibleText = await page.evaluate(()
  => {
    return document.body.innerText;
  });

  4.3 Analizar la respuesta:

  Si el usuario PAGÓ en Meru, la página
  muestra uno de estos mensajes:

  EN ESPAÑOL:
  "El enlace de pago ha caducado o ya ha sido
  pagado"
  "El link de pago ha caducado"
  "ya ha sido pagado"

  EN INGLÉS:
  "Payment link expired or already paid"
  "payment link has expired"
  "already paid"

  El bot busca estos patrones:
  const paidPatterns = [
    'El enlace de pago ha caducado o ya ha
  sido pagado',
    'El link de pago ha caducado',
    'ya ha sido pagado',
  ];

  const isPaid = paidPatterns.some(
    pattern => pageContent.includes(pattern)
  || visibleText.includes(pattern)
  );

  Resultado del verifyPayment():
  {
    isPaid: true,              // ✅ Pago
  confirmado
    message: 'Payment link already used or
  expired',
    rawContent: '<html>...',
    visibleText: 'El enlace...'
  }

  ---
  PASO 5️⃣ : BOT ACTIVA LA MEMBRESÍA

  Archivo: src/bot/handlers/user/onboarding.js
   (línea 483-550)

  5.1 Si isPaid === true:

  if (paymentCheck.isPaid) {
    const userId = ctx.from.id;
  // ID de Telegram
    const planId = 'lifetime_pass';
    const product = 'lifetime-pass';

    // Activar PRIME
    const activated = await
  activateMembership({
      ctx,
      userId,
      planId,
      product,
    });

    if (!activated) {
      await ctx.reply('❌ Ocurrió un error
  durante la activación');
      return;
    }

  5.2 Marcar código como usado en la BD:

  // Marcar el código de activación como
  utilizado
  await markCodeUsed(matchingLinkCode, userId,
   ctx.from.username);

  // IMPORTANTE: Invalidar el link de Meru en
  la BD
  const linkInvalidation = await meruLinkServi
  ce.invalidateLinkAfterActivation(
    matchingLinkCode,      // "LSJUek"
    userId,                // ID de usuario
    ctx.from.username      // Username de
  Telegram
  );

  Lo que hace en BD:
  UPDATE meru_payment_links
  SET status = 'used',
      used_by = $2,                      -- ID
   del usuario
      used_by_username = $3,             --
  Username
      used_at = NOW()
  WHERE code = $1 AND status = 'active'
  RETURNING id, code, meru_link;

  Resultado:
  Registro antes:
  id: uuid-123
  code: LSJUek
  status: active
  used_by: NULL

  Registro después:
  id: uuid-123
  code: LSJUek
  status: used
  used_by: 123456789
  used_by_username: @juanperu
  used_at: 2026-02-13 14:30:22

  ---
  PASO 6️⃣ : REGISTRAR PAGO EN HISTORIAL

  Archivo: src/bot/handlers/user/onboarding.js
   (línea 521-544)

  await PaymentHistoryService.recordPayment({
    userId: 123456789,
    paymentMethod: 'meru',                 //
  Método: Meru
    amount: 50,                            //
  Precio: $50 USD
    currency: 'USD',
    planId: 'lifetime_pass',
    planName: 'Lifetime Pass',
    product: 'lifetime-pass',
    paymentReference: 'LSJUek',            //
  Código del link
    status: 'completed',                   //
  Completado
    metadata: {
      meru_link:
  'https://pay.getmeru.com/LSJUek',
      verification_method: 'puppeteer',
      language: 'es',
    },
  });

  En tabla payment_history queda registrado:
  payment_method    | meru
  amount            | 50.00
  currency          | USD
  payment_reference | LSJUek
  status            | completed
  payment_date      | 2026-02-13 14:30:22
  metadata          | {"meru_link": "...",
  "verification_method": "puppeteer"}

  ---
  PASO 7️⃣ : NOTIFICACIONES FINALES

  Archivo: src/bot/handlers/user/onboarding.js
   (línea 546-550)

  7.1 Log de activación:

  await logActivation({
    userId,
    username: ctx.from.username,
    code: matchingLinkCode,
    product,
    success: true
  });

  7.2 Notificar a administrador:

  BusinessNotificationService.notifyCodeActiva
  tion({
    userId,
    username: ctx.from.username,
    code: matchingLinkCode,
    product
  });

  7.3 Enviar enlace de invitación PRIME:

  const inviteLink = await
  getPrimeInviteLink(ctx, userId);
  await ctx.reply(
    '✅ ¡Tu Lifetime Pass ha sido activado!
  ¡Bienvenido a PRIME!

' +
    '🌟 Accede al canal PRIME:
' +
    `👉 ${inviteLink}`
  );

  ---
  RESUMEN DE ESTADOS

  STATUS = 'active'  → Link disponible para
  usar
            ↓
  User envía código
            ↓
  Puppeteer verifica pago
            ↓
  isPaid = true
            ↓
  STATUS = 'used'    → Link marcado como
  usado, no puede reutilizarse

  ---
  ¿Qué previene la reutilización?

  1. En BD: Una vez status = 'used', nunca un
  usuario puede usarlo de nuevo
  2. En lógica: Solo se procesan links con
  status = 'active'
  3. En Meru: El mismo link de pago no se
  puede pagar 2 veces