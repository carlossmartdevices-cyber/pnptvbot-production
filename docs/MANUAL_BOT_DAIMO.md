# Manual del Bot - Flujo de Pagos con Daimo

Este documento detalla el proceso de integración de pagos utilizando Daimo, que se emplea para transacciones P2P (como Zelle, CashApp, Venmo, etc.). El sistema se basa en la creación de un enlace de pago y la confirmación a través de webhooks.

## 1. Archivos Clave

- **Configuración Principal**: `src/config/daimo.js`
- **Orquestación de Pagos**: `src/bot/services/paymentService.js`
- **Manejo de Webhooks**: `src/bot/api/controllers/webhookController.js`
- **Definición de Rutas API**: `src/bot/api/routes.js`
- **Esquemas de Validación**: `src/validation/schemas/payment.schema.js`

## 2. Variables de Entorno

La configuración de Daimo requiere las siguientes variables en el archivo `.env`:

- `DAIMO_API_KEY`: La clave de API para autenticarse con Daimo.
- `DAIMO_WEBHOOK_SECRET`: Un secreto para verificar la autenticidad de los webhooks entrantes.
- `DAIMO_TREASURY_ADDRESS`: La dirección de la tesorería para recibir los fondos.

## 3. Flujo del Pago (Paso a Paso)

### PASO 1️⃣: INICIACIÓN DEL PAGO

1.  **Acción del Usuario**: El proceso comienza cuando un usuario en el bot de Telegram realiza una acción para comprar un producto o servicio (ej: una suscripción PRIME).
2.  **Llamada al Servicio**: Esta acción invoca una función en `paymentService.js`, especificando `provider: 'daimo'`.
3.  **Creación del Pago**:
    - El `paymentService` llama a la función `createDaimoPayment` ubicada en `src/config/daimo.js`.
    - Esta función realiza una petición `fetch` a la API de Daimo (`https://pay.daimo.com/api/payment`) con los detalles de la transacción (monto, moneda, etc.).
    - **Mecanismo de Fallback**: Si por alguna razón la llamada a la API de Daimo falla, el sistema tiene un plan B y genera una URL a una página de checkout personalizada: `https://easybots.store/daimo-checkout/{payment.id}`.
4.  **Envío al Usuario**: La API de Daimo (o el sistema de fallback) devuelve una `paymentUrl`. El bot envía esta URL al usuario.

### PASO 2️⃣: EL USUARIO REALIZA EL PAGO

1.  El usuario abre la `paymentUrl` en su navegador.
2.  Es dirigido a la pasarela de pago de Daimo, donde completa la transacción utilizando su método de pago preferido (Zelle, CashApp, etc.).

### PASO 3️⃣: CONFIRMACIÓN VÍA WEBHOOK

Este es el paso más crítico, ya que confirma que el pago se ha completado.

1.  **Notificación de Daimo**: Una vez que el estado del pago cambia, Daimo envía una notificación (un request HTTP POST) a una URL preconfigurada en el sistema: `/api/webhooks/daimo`.
2.  **Recepción del Webhook**:
    - La ruta está definida en `src/bot/api/routes.js` y apunta al controlador `webhookController.handleDaimoWebhook`.
3.  **Procesamiento en el Controlador**:
    - **Seguridad (Autenticación)**: Lo primero que hace el `handleDaimoWebhook` es verificar que la petición proviene realmente de Daimo. Para ello, utiliza la función `DaimoService.verifyWebhookSignature`, que valida una firma o token de autorización en los headers del request. Si la firma es inválida, la petición se rechaza con un error `401 Unauthorized`.
    - **Seguridad (Idempotencia)**: Para evitar procesar el mismo evento varias veces (ej: si Daimo reenvía el webhook), el sistema utiliza un bloqueo (`cache.acquireLock`) a través de Redis. Genera una clave única para cada evento (`daimo_{event_id}`) y, si ya existe, ignora el nuevo webhook.
    - **Validación de Datos**: El payload del webhook se valida contra un esquema de Joi definido en `payment.schema.js` para asegurar que la estructura y los datos son correctos.
    - **Llamada a la Lógica de Negocio**: Si todas las comprobaciones de seguridad pasan, el controlador invoca `PaymentService.processDaimoWebhook(req.body)`.
4.  **Activación de la Compra**:
    - La función `processDaimoWebhook` busca el pago en la base de datos interna usando el ID del pago que viene en el webhook.
    - Actualiza el estado del pago a "completado".
    - Llama a la función `activateMembership` (o una similar) para otorgar al usuario el acceso o producto que compró (ej: acceso a canales PRIME).
    - Registra la transacción en la tabla `payment_history` para tener un historial contable.

### PASO 4️⃣: RESPUESTA A DAIMO

1.  Al finalizar el procesamiento del webhook (ya sea con éxito o con un error controlado), el `webhookController` responde a Daimo con un código de estado HTTP.
2.  Si todo fue exitoso, se envía un `200 OK` para que Daimo sepa que la notificación fue recibida y procesada correctamente y no necesita volver a enviarla.
