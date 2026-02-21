#!/bin/bash

##############################################################################
# PNPtv Nginx + SSL Setup Script
# Instala y configura Nginx con Let's Encrypt SSL
# Date: February 21, 2026
##############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[⚠]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

# Check if running as root
if [ "$EUID" -ne 0 ]; then
   log_error "Este script debe ejecutarse como root"
   echo "Usa: sudo bash setup-ssl.sh"
   exit 1
fi

##############################################################################
# CONFIGURATION
##############################################################################

DOMAIN="${1:-pnptv.app}"
SECONDARY_DOMAIN="www.$DOMAIN"
CERT_PATH="/etc/letsencrypt/live/$DOMAIN"
NGINX_CONFIG_SRC="nginx-production.conf"
NGINX_CONFIG_DEST="/etc/nginx/sites-available/pnptv-production"

log_info "=== PNPtv Nginx + SSL Setup ==="
log_info "Domain: $DOMAIN"
log_info "Secondary: $SECONDARY_DOMAIN"
echo ""

##############################################################################
# STEP 1: Install Prerequisites
##############################################################################

log_info "=== PASO 1: Instalar Nginx y Certbot ==="

# Update package list
apt-get update > /dev/null 2>&1

# Install Nginx if not present
if ! command -v nginx &> /dev/null; then
    log_info "Instalando Nginx..."
    apt-get install -y nginx > /dev/null 2>&1
    log_success "Nginx instalado"
else
    log_success "Nginx ya instalado"
fi

# Install Certbot if not present
if ! command -v certbot &> /dev/null; then
    log_info "Instalando Certbot..."
    apt-get install -y certbot python3-certbot-nginx > /dev/null 2>&1
    log_success "Certbot instalado"
else
    log_success "Certbot ya instalado"
fi

##############################################################################
# STEP 2: Obtain SSL Certificate
##############################################################################

log_info "=== PASO 2: Obtener Certificado SSL ==="

if [ -d "$CERT_PATH" ]; then
    log_warning "Certificado ya existe en $CERT_PATH"
    read -p "¿Deseas renovarlo? (s/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        log_info "Renovando certificado..."
        certbot certonly --force-renewal -d "$DOMAIN" -d "$SECONDARY_DOMAIN" --standalone --agree-tos --register-unsafely-without-email 2>&1 | tail -5
        log_success "Certificado renovado"
    fi
else
    log_info "Obteniendo certificado SSL para $DOMAIN..."
    certbot certonly --standalone -d "$DOMAIN" -d "$SECONDARY_DOMAIN" --agree-tos --register-unsafely-without-email || {
        log_error "Error al obtener certificado"
        echo "Verifica que:"
        echo "  1. El dominio apunta a este servidor"
        echo "  2. Los puertos 80 y 443 están abiertos"
        echo "  3. No hay otro servicio en puerto 80"
        exit 1
    }
    log_success "Certificado obtenido"
fi

# Verify certificate files
log_info "Verificando archivos de certificado..."
if [ ! -f "$CERT_PATH/fullchain.pem" ] || [ ! -f "$CERT_PATH/privkey.pem" ]; then
    log_error "Archivos de certificado no encontrados"
    exit 1
fi
log_success "Certificados verificados"

##############################################################################
# STEP 3: Copy Nginx Configuration
##############################################################################

log_info "=== PASO 3: Configurar Nginx ==="

if [ ! -f "$NGINX_CONFIG_SRC" ]; then
    log_error "Archivo $NGINX_CONFIG_SRC no encontrado"
    exit 1
fi

log_info "Copiando configuración Nginx..."
cp "$NGINX_CONFIG_SRC" "$NGINX_CONFIG_DEST"
log_success "Configuración copiada"

# Create symbolic link to enable site
log_info "Habilitando sitio..."
ln -sf "$NGINX_CONFIG_DEST" /etc/nginx/sites-enabled/pnptv-production
rm -f /etc/nginx/sites-enabled/default
log_success "Sitio habilitado"

##############################################################################
# STEP 4: Configure Rate Limiting
##############################################################################

log_info "=== PASO 4: Configurar Rate Limiting ==="

NGINX_HTTP_CONF="/etc/nginx/nginx.conf"

# Check if rate limiting zones already exist
if ! grep -q "limit_req_zone.*api" "$NGINX_HTTP_CONF"; then
    log_info "Agregando zonas de rate limiting..."

    # Insert rate limiting after mime types line
    sed -i '/^[[:space:]]*default_type/a\
\
    # Rate limiting zones\
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;\
    limit_req_zone $binary_remote_addr zone=auth:10m rate=2r/s;' "$NGINX_HTTP_CONF"

    log_success "Rate limiting configurado"
else
    log_success "Rate limiting ya configurado"
fi

##############################################################################
# STEP 5: Test Nginx Configuration
##############################################################################

log_info "=== PASO 5: Verificar Nginx ==="

if ! nginx -t 2>&1 | grep -q "successful"; then
    log_error "Nginx configuration tiene errores:"
    nginx -t
    exit 1
fi
log_success "Configuración válida"

##############################################################################
# STEP 6: Start/Reload Nginx
##############################################################################

log_info "=== PASO 6: Iniciar Nginx ==="

systemctl enable nginx
if systemctl is-active --quiet nginx; then
    log_info "Reloading Nginx (zero-downtime)..."
    systemctl reload nginx
    log_success "Nginx reloaded"
else
    log_info "Iniciando Nginx..."
    systemctl start nginx
    log_success "Nginx iniciado"
fi

sleep 2

##############################################################################
# STEP 7: Configure Auto-Renewal
##############################################################################

log_info "=== PASO 7: Configurar Auto-Renovación ==="

systemctl enable certbot.timer
systemctl start certbot.timer
log_success "Auto-renovación configurada"

##############################################################################
# STEP 8: Verification Tests
##############################################################################

log_info "=== PASO 8: Verificar SSL ==="

sleep 2

# Test 1: HTTPS
log_info "Test 1: Verificando HTTPS..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" != "000" ]; then
    log_success "HTTPS funciona (HTTP $HTTP_CODE)"
else
    log_warning "No se puede conectar a HTTPS yet (app quizás no está corriendo)"
fi

# Test 2: HTTP Redirect
log_info "Test 2: Verificando redirección HTTP → HTTPS..."
REDIRECT=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN/ 2>/dev/null || echo "000")
if [ "$REDIRECT" = "301" ] || [ "$REDIRECT" = "302" ]; then
    log_success "Redirección configurada"
else
    log_warning "Redirección no verificada (HTTP $REDIRECT)"
fi

# Test 3: Certificate validity
log_info "Test 3: Verificando validez del certificado..."
EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_PATH/cert.pem" 2>/dev/null | cut -d= -f2)
if [ ! -z "$EXPIRY" ]; then
    log_success "Certificado válido hasta: $EXPIRY"
else
    log_error "No se pudo leer fecha de expiración"
fi

##############################################################################
# SUMMARY
##############################################################################

log_success "=== SETUP COMPLETADO ==="
echo ""
echo "✅ Nginx + SSL configurado correctamente"
echo ""
echo "Información del sitio:"
echo "  Dominio: https://$DOMAIN"
echo "  Certificado: $CERT_PATH"
echo "  Config: $NGINX_CONFIG_DEST"
echo "  Logs: /var/log/nginx/pnptv-*.log"
echo ""
echo "Próximos pasos:"
echo "  1. Verificar que la app Node.js está en puerto 3001"
echo "  2. Ejecutar: cd /root/pnptvbot-production && sudo bash DEPLOY.sh"
echo "  3. Visitar: https://$DOMAIN"
echo ""
echo "Renovación automática de certificado:"
echo "  Status: $(systemctl is-active certbot.timer)"
echo "  Próxima renovación: $(systemctl list-timers certbot.timer --pretty 2>/dev/null | tail -1)"
echo ""
log_success "¡Listo para producción! 🚀"
