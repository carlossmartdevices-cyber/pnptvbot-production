# Sistema de Pagos PNPtv Bot - Exportación

## 🎯 Contenido

Este paquete contiene todo el sistema de pagos del bot PNPtv, incluyendo:

- ✅ Integración con **ePayco** (Colombia)
- ✅ Integración con **Daimo Pay** (Crypto USDC)
- ✅ Páginas de checkout personalizadas
- ✅ Webhooks de confirmación
- ✅ Gestión de suscripciones
- ✅ Migraciones de base de datos

## 📋 Requisitos Previos

1. Node.js >= 16
2. PostgreSQL >= 13
3. Redis (opcional, para caché)
4. Cuentas en:
   - [ePayco](https://dashboard.epayco.com)
   - [Daimo Pay](https://pay.daimo.com)

## 🚀 Instalación

### 1. Copiar Archivos

```bash
# Copiar todos los archivos a tu proyecto
cp -r src/* /ruta/a/tu/bot/src/
cp -r public/* /ruta/a/tu/bot/public/
cp -r database/migrations/* /ruta/a/tu/bot/database/migrations/
```

### 2. Variables de Entorno

Añade a tu archivo `.env`:

```env
# URLs del Bot
BOT_WEBHOOK_DOMAIN=https://tudominio.com
EPAYCO_WEBHOOK_PATH=/api/webhooks/epayco
DAIMO_WEBHOOK_PATH=/api/webhooks/daimo

# ePayco (Modo Producción)
EPAYCO_PUBLIC_KEY=tu_public_key
EPAYCO_PRIVATE_KEY=tu_private_key
EPAYCO_P_CUST_ID=tu_customer_id
EPAYCO_P_KEY=tu_p_key
EPAYCO_TEST_MODE=false

# Daimo Pay
DAIMO_API_KEY=tu_api_key
DAIMO_APP_ID=tu_app_id
DAIMO_TREASURY_ADDRESS=tu_wallet_address
DAIMO_REFUND_ADDRESS=tu_wallet_address
DAIMO_WEBHOOK_SECRET=tu_webhook_secret

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=tu_database
POSTGRES_USER=tu_usuario
POSTGRES_PASSWORD=tu_password
```

### 3. Ejecutar Migraciones

```bash
# Conectar a PostgreSQL
psql -U tu_usuario -d tu_database

# Ejecutar migraciones
\i database/migrations/001_payments.sql
\i database/migrations/002_subscriptions.sql
```

### 4. Instalar Dependencias NPM

```bash
npm install axios moment
```

### 5. Configurar Rutas en tu Bot

En tu archivo principal de rutas (ej: `src/bot/api/routes.js`):

```javascript
const paymentController = require('./controllers/paymentController');
const epaycoWebhook = require('./webhooks/epayco');
const daimoWebhook = require('./webhooks/daimo');

// API de pagos
app.get('/api/payment/:paymentId', paymentController.getPayment);

// Checkout pages
app.get('/daimo/:paymentId', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/daimo-checkout.html'));
});

// Webhooks
app.post('/api/webhooks/epayco', epaycoWebhook);
app.post('/api/webhooks/daimo', daimoWebhook);
```

### 6. Configurar Nginx (Producción)

```nginx
server {
    listen 443 ssl;
    server_name tudominio.com;

    # Webhook de ePayco
    location /api/webhooks/epayco {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
    }

    # Webhook de Daimo
    location /api/webhooks/daimo {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
    }

    # Checkout pages
    location /daimo/ {
        proxy_pass http://localhost:3000;
    }
}
```

### 7. Configurar Webhooks en los Proveedores

**ePayco:**
1. Ve a: https://dashboard.epayco.com/configuracion/webhooks
2. URL: `https://tudominio.com/api/webhooks/epayco`
3. Eventos: Confirmación, Aprobación, Rechazo

**Daimo Pay:**
1. Ve a: https://pay.daimo.com/dashboard/settings
2. URL: `https://tudominio.com/api/webhooks/daimo`
3. Secret: Guarda el webhook secret en `.env`

## 🧪 Pruebas

### Probar ePayco (Modo Test)

```bash
# En .env, cambia:
EPAYCO_TEST_MODE=true

# Usa tarjeta de prueba:
# Número: 4575623182290326
# CVV: 123
# Fecha: Cualquier fecha futura
```

### Probar Daimo Pay

```bash
# Usa wallet de prueba en Optimism Sepolia testnet
# O pequeñas cantidades en mainnet
```

## 📊 Estructura de Base de Datos

### Tabla: payments

```sql
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  plan_id VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  provider VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  payment_url TEXT,
  destination_address VARCHAR(255),
  transaction_ref VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

### Tabla: subscriptions

```sql
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  plan_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  expires_at TIMESTAMP NOT NULL,
  payment_id INTEGER REFERENCES payments(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🔧 Uso en tu Bot

### Crear un pago

```javascript
const paymentService = require('./services/paymentService');

// Opción 1: ePayco
const payment = await paymentService.createPayment(
  userId,
  'monthly-pass',
  'epayco'
);

// Opción 2: Daimo Pay
const payment = await paymentService.createPayment(
  userId,
  'lifetime-pass',
  'daimo'
);

// Enviar link al usuario
await ctx.reply(`Paga aquí: ${payment.paymentUrl}`);
```

### Verificar suscripción

```javascript
const subscription = await subscriptionModel.getActiveSubscription(userId);

if (subscription && new Date() < new Date(subscription.expires_at)) {
  // Usuario tiene acceso
} else {
  // Usuario no tiene acceso
}
```

## 💰 Planes Predefinidos

Puedes configurar tus planes en `src/bot/services/paymentService.js`:

```javascript
const PLANS = {
  'monthly-pass': { price: 24.99, duration: 30 },
  'quarterly-pass': { price: 59.99, duration: 90 },
  'annual-pass': { price: 199.99, duration: 365 },
  'lifetime-pass': { price: 299.99, duration: null }
};
```

## 🐛 Solución de Problemas

### Webhook no recibe confirmaciones

1. Verifica que el dominio sea HTTPS
2. Revisa logs: `pm2 logs tu-bot`
3. Prueba el endpoint: `curl https://tudominio.com/api/webhooks/epayco`

### Pagos no se marcan como completados

1. Revisa la tabla `payments` en PostgreSQL
2. Verifica que el webhook esté configurado correctamente
3. Chequea logs de errores en los proveedores

### Daimo no genera checkout page

1. Verifica que `DAIMO_API_KEY` sea válido
2. Confirma que la ruta `/daimo/:paymentId` esté configurada
3. Revisa que `daimo-checkout.html` exista en `/public`

## 📞 Soporte

- ePayco: https://dashboard.epayco.com/support
- Daimo Pay: https://discord.gg/daimo

## 📄 Licencia

Este código es propiedad de PNPtv. Uso autorizado para clonación interna.

---

✅ **Sistema probado en producción desde Noviembre 2024**
✅ **7+ pagos completados exitosamente**
✅ **Integración con Telegram Bot API**
