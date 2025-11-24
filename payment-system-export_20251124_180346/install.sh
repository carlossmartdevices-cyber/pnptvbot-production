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
