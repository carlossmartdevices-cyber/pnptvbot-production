#!/bin/bash
# Script para exportar el sistema de pagos completo de PNPtv Bot
# Uso: ./export-payment-system.sh [directorio_destino]

EXPORT_DIR="${1:-./payment-system-export}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EXPORT_PATH="${EXPORT_DIR}_${TIMESTAMP}"

echo "🚀 Exportando sistema de pagos a: $EXPORT_PATH"
mkdir -p "$EXPORT_PATH"

# ==================== ARCHIVOS CORE ====================
echo "📦 Copiando archivos principales..."

# Servicios de pago
mkdir -p "$EXPORT_PATH/src/bot/services"
cp src/bot/services/paymentService.js "$EXPORT_PATH/src/bot/services/"

# Modelos de pago
mkdir -p "$EXPORT_PATH/src/models"
cp src/models/payment.js "$EXPORT_PATH/src/models/"
cp src/models/subscription.js "$EXPORT_PATH/src/models/"

# Configuraciones de proveedores
mkdir -p "$EXPORT_PATH/src/config"
cp src/config/daimo.js "$EXPORT_PATH/src/config/"
cp src/config/epayco.js "$EXPORT_PATH/src/config/" 2>/dev/null || echo "⚠️  epayco.js no encontrado"

# ==================== HANDLERS ====================
echo "🎮 Copiando handlers de pago..."

mkdir -p "$EXPORT_PATH/src/bot/handlers/payment"
cp -r src/bot/handlers/payment/* "$EXPORT_PATH/src/bot/handlers/payment/" 2>/dev/null || echo "⚠️  Handlers de payment no encontrados"

# ==================== API ====================
echo "🌐 Copiando API de pagos..."

# Controllers
mkdir -p "$EXPORT_PATH/src/bot/api/controllers"
cp src/bot/api/controllers/paymentController.js "$EXPORT_PATH/src/bot/api/controllers/"

# Webhooks
mkdir -p "$EXPORT_PATH/src/bot/api/webhooks"
cp src/bot/api/webhooks/epayco.js "$EXPORT_PATH/src/bot/api/webhooks/" 2>/dev/null
cp src/bot/api/webhooks/daimo.js "$EXPORT_PATH/src/bot/api/webhooks/" 2>/dev/null

# Routes (extraer solo rutas de pago)
cp src/bot/api/routes.js "$EXPORT_PATH/src/bot/api/" 2>/dev/null

# ==================== FRONTEND ====================
echo "🎨 Copiando páginas de checkout..."

mkdir -p "$EXPORT_PATH/public"
cp public/daimo-checkout.html "$EXPORT_PATH/public/" 2>/dev/null
cp public/lifetime-pass.html "$EXPORT_PATH/public/" 2>/dev/null
cp public/payment-checkout.html "$EXPORT_PATH/public/" 2>/dev/null || echo "⚠️  payment-checkout.html no encontrado"

# ==================== MIGRACIONES DB ====================
echo "🗄️  Copiando migraciones de base de datos..."

mkdir -p "$EXPORT_PATH/database/migrations"
cp database/migrations/*payment*.sql "$EXPORT_PATH/database/migrations/" 2>/dev/null
cp database/migrations/*subscription*.sql "$EXPORT_PATH/database/migrations/" 2>/dev/null

# ==================== DOCUMENTACIÓN ====================
echo "📚 Generando documentación..."

cat > "$EXPORT_PATH/README.md" << 'EOF'
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
EOF

# ==================== VARIABLES DE ENTORNO ====================
echo "🔐 Extrayendo variables de entorno necesarias..."

cat > "$EXPORT_PATH/.env.example" << 'EOF'
# ============================================
# CONFIGURACIÓN DE PAGOS - EJEMPLO
# ============================================

# URLs del Bot
BOT_WEBHOOK_DOMAIN=https://tudominio.com
EPAYCO_WEBHOOK_PATH=/api/webhooks/epayco
DAIMO_WEBHOOK_PATH=/api/webhooks/daimo

# ePayco - Payment Gateway (Colombia)
# Obtén tus credenciales en: https://dashboard.epayco.com
EPAYCO_PUBLIC_KEY=tu_public_key_aqui
EPAYCO_PRIVATE_KEY=tu_private_key_aqui
EPAYCO_P_CUST_ID=tu_customer_id
EPAYCO_P_KEY=tu_p_key_aqui
EPAYCO_TEST_MODE=false  # true para pruebas, false para producción

# Daimo Pay - Crypto Payment Gateway (USDC)
# Obtén tus credenciales en: https://pay.daimo.com
DAIMO_API_KEY=tu_api_key_aqui
DAIMO_APP_ID=tu_app_id
DAIMO_TREASURY_ADDRESS=tu_wallet_address
DAIMO_REFUND_ADDRESS=tu_wallet_address
DAIMO_WEBHOOK_SECRET=tu_webhook_secret

# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=tu_database
POSTGRES_USER=tu_usuario
POSTGRES_PASSWORD=tu_password
POSTGRES_SSL=false

# Redis (opcional, para caché)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Bot Configuration
NODE_ENV=production
PORT=3000
EOF

# ==================== SQL DE MIGRACIONES ====================
echo "🗄️  Creando migraciones SQL consolidadas..."

cat > "$EXPORT_PATH/database/migrations/000_setup_payments.sql" << 'EOF'
-- ============================================
-- MIGRACIÓN: Sistema de Pagos Completo
-- ============================================

-- Tabla de pagos
CREATE TABLE IF NOT EXISTS payments (
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
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_provider ON payments(provider);
CREATE INDEX idx_payments_transaction_ref ON payments(transaction_ref);

-- Tabla de suscripciones
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  plan_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  expires_at TIMESTAMP NOT NULL,
  payment_id INTEGER REFERENCES payments(id),
  auto_renew BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_expires_at ON subscriptions(expires_at);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para verificar suscripciones activas
CREATE OR REPLACE FUNCTION is_subscription_active(p_user_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  subscription_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM subscriptions 
    WHERE user_id = p_user_id 
    AND status = 'active' 
    AND expires_at > NOW()
  ) INTO subscription_exists;
  
  RETURN subscription_exists;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE payments IS 'Registro de todos los pagos del sistema';
COMMENT ON TABLE subscriptions IS 'Gestión de suscripciones de usuarios';
COMMENT ON FUNCTION is_subscription_active IS 'Verifica si un usuario tiene suscripción activa';
EOF

# ==================== SCRIPT DE INSTALACIÓN ====================
echo "⚙️  Creando script de instalación..."

cat > "$EXPORT_PATH/install.sh" << 'EOF'
#!/bin/bash
# Script de instalación del sistema de pagos

set -e

echo "🚀 Instalador del Sistema de Pagos PNPtv"
echo "=========================================="
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado"
    echo "Instala Node.js 16 o superior: https://nodejs.org"
    exit 1
fi
echo "✅ Node.js $(node -v) detectado"

# Verificar PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL no está instalado"
    echo "Instala PostgreSQL 13 o superior"
    exit 1
fi
echo "✅ PostgreSQL detectado"

# Verificar directorio destino
read -p "📁 Ruta de tu bot (ej: /root/mi-bot): " BOT_PATH
if [ ! -d "$BOT_PATH" ]; then
    echo "❌ El directorio $BOT_PATH no existe"
    exit 1
fi

echo ""
echo "📦 Copiando archivos..."

# Copiar archivos
cp -r src/* "$BOT_PATH/src/" 2>/dev/null || mkdir -p "$BOT_PATH/src" && cp -r src/* "$BOT_PATH/src/"
cp -r public/* "$BOT_PATH/public/" 2>/dev/null || mkdir -p "$BOT_PATH/public" && cp -r public/* "$BOT_PATH/public/"
cp -r database "$BOT_PATH/" 2>/dev/null || mkdir -p "$BOT_PATH/database" && cp -r database/* "$BOT_PATH/database/"

echo "✅ Archivos copiados"

# Copiar .env.example
if [ ! -f "$BOT_PATH/.env" ]; then
    cp .env.example "$BOT_PATH/.env"
    echo "✅ Archivo .env creado (debes configurarlo)"
else
    echo "⚠️  .env ya existe, revisa .env.example para variables necesarias"
fi

echo ""
echo "🗄️  Configuración de Base de Datos"
read -p "Nombre de tu base de datos: " DB_NAME
read -p "Usuario de PostgreSQL: " DB_USER
read -sp "Contraseña: " DB_PASS
echo ""

# Ejecutar migraciones
echo "📊 Ejecutando migraciones..."
PGPASSWORD=$DB_PASS psql -U $DB_USER -d $DB_NAME -f database/migrations/000_setup_payments.sql

echo ""
echo "✅ ¡Instalación completada!"
echo ""
echo "📋 Pasos siguientes:"
echo "1. Edita $BOT_PATH/.env con tus credenciales de ePayco y Daimo"
echo "2. Configura nginx para los webhooks (ver README.md)"
echo "3. Registra las URLs de webhooks en los proveedores:"
echo "   - ePayco: https://dashboard.epayco.com/configuracion/webhooks"
echo "   - Daimo: https://pay.daimo.com/dashboard/settings"
echo "4. Reinicia tu bot: pm2 restart tu-bot"
echo ""
echo "📚 Lee README.md para más detalles"
EOF

chmod +x "$EXPORT_PATH/install.sh"

# ==================== RESUMEN ====================
echo ""
echo "✅ ¡Exportación completada!"
echo ""
echo "📦 Paquete creado en: $EXPORT_PATH"
echo ""
echo "📁 Contenido:"
echo "  ├── src/                    # Código fuente"
echo "  │   ├── bot/services/       # Servicios de pago"
echo "  │   ├── bot/handlers/       # Handlers de Telegram"
echo "  │   ├── bot/api/            # API y webhooks"
echo "  │   ├── models/             # Modelos de BD"
echo "  │   └── config/             # Configuraciones"
echo "  ├── public/                 # Páginas de checkout"
echo "  ├── database/migrations/    # SQL para crear tablas"
echo "  ├── README.md               # Documentación completa"
echo "  ├── .env.example            # Variables de entorno"
echo "  └── install.sh              # Script de instalación"
echo ""
echo "🚀 Para instalar en otro bot:"
echo "  1. cd $EXPORT_PATH"
echo "  2. ./install.sh"
echo "  3. Seguir las instrucciones en README.md"
echo ""
echo "📦 Para comprimir y transferir:"
echo "  tar -czf payment-system.tar.gz -C $EXPORT_PATH ."
echo ""
