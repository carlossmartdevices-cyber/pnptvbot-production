#!/bin/bash
# Instalación rápida del sistema de pagos
# Configurado para: pnptv_bot database

set -e

echo "🚀 Instalación Rápida - Sistema de Pagos PNPtv"
echo "=============================================="
echo ""

# Configuración de base de datos
DB_NAME="pnptv_bot"
DB_USER="postgres"
DB_PASS="pnptv2024"
DB_HOST="localhost"
DB_PORT="5432"

# Verificar directorio destino
if [ -z "$1" ]; then
    echo "❌ Error: Debes especificar la ruta de tu bot"
    echo ""
    echo "Uso: ./install-quick.sh /ruta/a/tu/bot"
    echo "Ejemplo: ./install-quick.sh /root/mi-bot"
    exit 1
fi

BOT_PATH="$1"

if [ ! -d "$BOT_PATH" ]; then
    echo "❌ El directorio $BOT_PATH no existe"
    exit 1
fi

echo "📁 Bot destino: $BOT_PATH"
echo "🗄️  Base de datos: $DB_NAME"
echo ""

# Crear directorios si no existen
echo "📦 Creando estructura de directorios..."
mkdir -p "$BOT_PATH/src/bot/services"
mkdir -p "$BOT_PATH/src/bot/api/controllers"
mkdir -p "$BOT_PATH/src/bot/api/webhooks"
mkdir -p "$BOT_PATH/src/config"
mkdir -p "$BOT_PATH/public"
mkdir -p "$BOT_PATH/database/migrations"

# Copiar archivos
echo "📋 Copiando archivos del sistema de pagos..."

# Servicios
cp -v src/bot/services/paymentService.js "$BOT_PATH/src/bot/services/" 2>/dev/null && echo "  ✅ paymentService.js" || echo "  ⚠️  paymentService.js no encontrado"

# Configuraciones
cp -v src/config/daimo.js "$BOT_PATH/src/config/" 2>/dev/null && echo "  ✅ daimo.js" || echo "  ⚠️  daimo.js no encontrado"
cp -v src/config/epayco.js "$BOT_PATH/src/config/" 2>/dev/null && echo "  ✅ epayco.js" || echo "  ⚠️  epayco.js no encontrado"

# API
cp -v src/bot/api/controllers/paymentController.js "$BOT_PATH/src/bot/api/controllers/" 2>/dev/null && echo "  ✅ paymentController.js" || echo "  ⚠️  paymentController.js no encontrado"
cp -v src/bot/api/routes.js "$BOT_PATH/src/bot/api/" 2>/dev/null && echo "  ✅ routes.js" || echo "  ⚠️  routes.js no encontrado"

# Webhooks
cp -v src/bot/api/webhooks/*.js "$BOT_PATH/src/bot/api/webhooks/" 2>/dev/null && echo "  ✅ webhooks copiados" || echo "  ⚠️  webhooks no encontrados"

# Páginas públicas
cp -v public/daimo-checkout.html "$BOT_PATH/public/" 2>/dev/null && echo "  ✅ daimo-checkout.html" || echo "  ⚠️  daimo-checkout.html no encontrado"
cp -v public/lifetime-pass.html "$BOT_PATH/public/" 2>/dev/null && echo "  ✅ lifetime-pass.html" || echo "  ⚠️  lifetime-pass.html no encontrado"

# Migraciones
cp -v database/migrations/*.sql "$BOT_PATH/database/migrations/" 2>/dev/null && echo "  ✅ migraciones SQL" || echo "  ⚠️  migraciones no encontradas"

echo ""
echo "🗄️  Ejecutando migraciones en base de datos..."

# Ejecutar migraciones
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f database/migrations/000_setup_payments.sql 2>&1

if [ $? -eq 0 ]; then
    echo "  ✅ Migraciones ejecutadas correctamente"
else
    echo "  ⚠️  Error al ejecutar migraciones (puede que ya existan las tablas)"
fi

# Configurar .env
echo ""
echo "🔐 Configurando variables de entorno..."

if [ ! -f "$BOT_PATH/.env" ]; then
    # Crear nuevo .env
    cp .env.example "$BOT_PATH/.env"
    echo "  ✅ Archivo .env creado"
    echo "  ⚠️  IMPORTANTE: Debes configurar las credenciales de ePayco y Daimo"
else
    # Agregar al .env existente
    echo "" >> "$BOT_PATH/.env"
    echo "# ============================================" >> "$BOT_PATH/.env"
    echo "# SISTEMA DE PAGOS - Agregado $(date)" >> "$BOT_PATH/.env"
    echo "# ============================================" >> "$BOT_PATH/.env"
    cat .env.example | grep -v "^#" | grep -v "^$" | grep -v "POSTGRES" >> "$BOT_PATH/.env"
    echo "  ✅ Variables agregadas a .env existente"
    echo "  ⚠️  Revisa y completa las credenciales de ePayco y Daimo"
fi

echo ""
echo "✅ ¡Instalación completada!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 PASOS SIGUIENTES:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1️⃣  Configura las credenciales en $BOT_PATH/.env:"
echo ""
echo "   # ePayco (Colombia)"
echo "   EPAYCO_PUBLIC_KEY=tu_key"
echo "   EPAYCO_PRIVATE_KEY=tu_key"
echo "   EPAYCO_P_CUST_ID=tu_id"
echo "   EPAYCO_P_KEY=tu_p_key"
echo ""
echo "   # Daimo Pay (Crypto)"
echo "   DAIMO_API_KEY=tu_key"
echo "   DAIMO_APP_ID=tu_app_id"
echo "   DAIMO_TREASURY_ADDRESS=tu_wallet"
echo ""
echo "2️⃣  Agrega las rutas a tu archivo de rutas principal:"
echo ""
echo "   const paymentController = require('./controllers/paymentController');"
echo "   app.get('/api/payment/:paymentId', paymentController.getPayment);"
echo "   app.get('/daimo/:paymentId', (req, res) => {"
echo "     res.sendFile(path.join(__dirname, '../../../public/daimo-checkout.html'));"
echo "   });"
echo ""
echo "3️⃣  Configura los webhooks en los proveedores:"
echo ""
echo "   ePayco: https://dashboard.epayco.com/configuracion/webhooks"
echo "   URL: https://tudominio.com/api/webhooks/epayco"
echo ""
echo "   Daimo: https://pay.daimo.com/dashboard/settings"
echo "   URL: https://tudominio.com/api/webhooks/daimo"
echo ""
echo "4️⃣  Reinicia tu bot:"
echo ""
echo "   pm2 restart tu-bot"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 Documentación completa: README.md"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
