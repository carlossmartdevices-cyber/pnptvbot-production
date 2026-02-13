# Manual del Bot - Flujo de Pagos con ePayco

Este documento describe la integración de la pasarela de pagos ePayco. La implementación distingue entre pagos únicos y suscripciones recurrentes, utilizando tanto páginas de checkout personalizadas como páginas alojadas por ePayco.

## 1. Archivos Clave

- **SDK y Configuración**: `src/config/epayco.js`, `src/config/epaycoSubscriptionPlans.js`
- **Servicio de Pagos**: `src/bot/services/paymentService.js`
- **Controlador de Webhooks**: `src/bot/api/controllers/webhookController.js`
- **Rutas API**: `src/bot/api/routes.js`

## 2. Variables de Entorno

La integración con ePayco depende de las siguientes variables de entorno:

- `EPAYCO_PUBLIC_KEY`: Llave pública de la API.
- `EPAYCO_PRIVATE_KEY`: Llave privada de la API.
- `EPAYCO_P_CUST_ID`: ID de cliente, usado para la firma de webhooks.
- `EPAYCO_P_KEY`: Llave privada, usada para la firma de webhooks.
- `EPAYCO_TEST_MODE`: Se establece en `'true'` para usar el entorno de pruebas de ePayco.

## 3. Flujo A: Suscripciones Recurrentes

Este flujo se utiliza para planes que requieren pagos periódicos (ej. mensual, anual) y aprovecha las páginas de suscripción alojadas directamente por ePayco.

### PASO 1️⃣: INICIACIÓN DE LA SUSCRIPCIÓN

1.  **Selección del Plan**: El usuario elige un plan de suscripción recurrente dentro del bot.
2.  **Generación de URL**:
    - El `paymentService.js` detecta que es un plan de suscripción.
    - Llama a la función `getEpaycoSubscriptionUrl` de `epaycoSubscriptionPlans.js`.
    - Esta función construye una URL única que dirige a la página de ese plan específico en la plataforma de ePayco (ej: `https://subscription-landing.epayco.co/plan/{ID_DEL_PLAN}`).
3.  **Envío al Usuario**: El bot envía esta URL al usuario.

### PASO 2️⃣: PAGO EN EPAYCO

1.  El usuario abre la URL, que lo lleva a una página segura de ePayco.
2.  El usuario introduce sus datos de pago y completa el formulario de suscripción en el entorno de ePayco.

### PASO 3️⃣: CONFIRMACIÓN VÍA WEBHOOK

1.  **Notificación de ePayco**: Cuando la suscripción se crea (o se renueva, o falla), ePayco envía un request HTTP POST a la URL de webhook del bot: `/api/webhooks/epayco`.
2.  **Recepción y Verificación**:
    - El request es manejado por `webhookController.handleEpaycoWebhook`.
    - **Seguridad (Firma)**: Se verifica la firma del webhook. El `paymentService.verifyEpaycoSignature` recrea una firma SHA256 con los datos de la transacción y la compara con la firma `x_signature` enviada por ePayco. Esto garantiza que la petición es auténtica.
    - **Seguridad (Idempotencia)**: Se utiliza Redis (`cache.acquireLock`) para asegurar que un mismo evento de webhook no se procese dos veces.
3.  **Procesamiento y Activación**:
    - Si la verificación es exitosa, se llama a `PaymentService.processEpaycoWebhook`.
    - Esta función interpreta el estado de la transacción (`x_cod_transaction_state`):
      - `1` (Aceptada): Se activa la suscripción del usuario en la base de datos, se le concede acceso a los beneficios (PRIME) y se guarda el registro en `payment_history`.
      - `2` (Rechazada) / `4` (Fallida): Se registra el fallo.
      - `3` (Pendiente): Se registra el estado pendiente, a la espera de una confirmación definitiva.

---

## 4. Flujo B: Pagos Únicos

Este flujo se usa para compras de un solo producto (no recurrentes) y utiliza una página de checkout intermedia alojada por el propio sistema del bot.

### PASO 1️⃣: INICIACIÓN DEL PAGO

1.  **Selección del Producto**: El usuario elige un producto de pago único.
2.  **Generación de URL**:
    - El `paymentService.js` determina que no es un plan de suscripción.
    - Genera una URL que apunta a una página del frontend del bot, por ejemplo: `https://easybots.store/checkout/pnp/{ID_PAGO_INTERNO}`.
3.  **Envío al Usuario**: El bot envía esta URL de checkout personalizada al usuario.

### PASO 2️⃣: PAGO EN CHECKOUT PERSONALIZADO

1.  El usuario abre la URL y ve una página de la aplicación web del bot.
2.  Esta página integra el "checkout" de ePayco, probablemente a través de su librería `checkout.js` o un formulario que envía los datos a ePayco.

### PASO 3️⃣: CONFIRMACIÓN (WEBHOOK Y REDIRECCIÓN)

1.  **Canal 1 (Webhook)**: Al igual que en el flujo de suscripciones, ePayco envía una notificación de webhook a `/api/webhooks/epayco`, que sigue el mismo proceso de verificación y activación descrito en el Flujo A.
2.  **Canal 2 (Redirección del Usuario)**: Tras el pago, ePayco redirige al usuario a una URL de confirmación definida por el bot, como `/checkout/pnp/confirmation`.
    - El `routes.js` muestra que esta ruta también apunta al manejador `webhookController.handleEpaycoWebhook`.
    - Esto proporciona un mecanismo de confirmación redundante y más rápido. Si el webhook se retrasa, la propia redirección del usuario puede procesar y activar la compra. El sistema de idempotencia con Redis previene problemas si ambos eventos llegan casi al mismo tiempo.
