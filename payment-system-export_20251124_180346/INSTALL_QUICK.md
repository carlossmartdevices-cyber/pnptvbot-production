# 🚀 Instalación Rápida - Sistema de Pagos

## ⚡ Instalación en 1 Comando

Para instalar el sistema de pagos en tu bot con la base de datos `pnptv_bot`:

```bash
./install-quick.sh /ruta/a/tu/bot
```

**Ejemplo:**
```bash
./install-quick.sh /root/mi-bot
```

## 📋 Lo que hace el instalador automáticamente:

✅ Crea toda la estructura de directorios necesaria  
✅ Copia todos los archivos del sistema de pagos  
✅ Ejecuta las migraciones en la base de datos `pnptv_bot`  
✅ Configura las variables de entorno  

## 🗄️ Base de Datos Configurada

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=pnptv_bot
POSTGRES_USER=postgres
POSTGRES_PASSWORD=pnptv2024
```

## 📦 Archivos que se copiarán:

- `src/bot/services/paymentService.js` - Servicio principal de pagos
- `src/config/daimo.js` - Configuración Daimo Pay
- `src/config/epayco.js` - Configuración ePayco
- `src/bot/api/controllers/paymentController.js` - API de pagos
- `src/bot/api/webhooks/*.js` - Webhooks de confirmación
- `public/daimo-checkout.html` - Página de pago Daimo
- `public/lifetime-pass.html` - Página de pago Lifetime
- `database/migrations/000_setup_payments.sql` - Tablas de BD

## 🔐 Después de la Instalación

1. **Edita el archivo `.env` de tu bot:**

```bash
nano /ruta/a/tu/bot/.env
```

2. **Agrega tus credenciales:**

```env
# ePayco (obtén en: https://dashboard.epayco.com)
EPAYCO_PUBLIC_KEY=tu_public_key
EPAYCO_PRIVATE_KEY=tu_private_key
EPAYCO_P_CUST_ID=tu_customer_id
EPAYCO_P_KEY=tu_p_key
EPAYCO_TEST_MODE=false

# Daimo Pay (obtén en: https://pay.daimo.com)
DAIMO_API_KEY=tu_api_key
DAIMO_APP_ID=tu_app_id
DAIMO_TREASURY_ADDRESS=tu_wallet_address
DAIMO_REFUND_ADDRESS=tu_wallet_address
DAIMO_WEBHOOK_SECRET=tu_webhook_secret
```

3. **Configura los webhooks en los proveedores:**

**ePayco:**
- URL: https://dashboard.epayco.com/configuracion/webhooks
- Webhook: `https://tudominio.com/api/webhooks/epayco`

**Daimo:**
- URL: https://pay.daimo.com/dashboard/settings
- Webhook: `https://tudominio.com/api/webhooks/daimo`

4. **Reinicia tu bot:**

```bash
pm2 restart tu-bot
```

## 🧪 Probar el Sistema

### Verificar que las tablas se crearon:

```bash
psql -U postgres -d pnptv_bot -c "\dt payments"
psql -U postgres -d pnptv_bot -c "\dt subscriptions"
```

### Crear un pago de prueba (en tu bot):

```javascript
const paymentService = require('./services/paymentService');

// Crear pago con ePayco
const payment = await paymentService.createPayment(
  userId,
  'monthly-pass',
  'epayco'
);

// Enviar link al usuario
await ctx.reply(`Paga aquí: ${payment.paymentUrl}`);
```

## 📊 Tablas Creadas

### `payments`
- `id` - ID único del pago
- `user_id` - ID del usuario de Telegram
- `plan_id` - Plan seleccionado
- `amount` - Monto del pago
- `provider` - Proveedor (epayco o daimo)
- `status` - Estado (pending, completed, failed)
- `payment_url` - URL de checkout
- `transaction_ref` - Referencia de transacción

### `subscriptions`
- `id` - ID único de suscripción
- `user_id` - ID del usuario de Telegram
- `plan_id` - Plan activo
- `status` - Estado (active, expired, cancelled)
- `expires_at` - Fecha de expiración
- `payment_id` - Referencia al pago

## ❓ Solución de Problemas

### Error: "psql: command not found"
```bash
# Instalar PostgreSQL client
apt-get install postgresql-client
```

### Error: "Permission denied"
```bash
chmod +x install-quick.sh
```

### Error al conectar a PostgreSQL
Verifica que las credenciales sean correctas:
```bash
psql -U postgres -d pnptv_bot -c "SELECT 1"
```

## 📞 Soporte

Si necesitas ayuda, consulta el `README.md` completo para documentación detallada.

---

✅ **Sistema probado en producción**  
✅ **Compatible con Telegram Bot API**  
✅ **Soporte para ePayco y Daimo Pay**
