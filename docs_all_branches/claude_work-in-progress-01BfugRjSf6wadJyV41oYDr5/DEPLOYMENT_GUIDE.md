# Guía de Deployment - PNPtv Telegram Bot

Esta guía te llevará paso a paso para deployar el bot de Telegram en producción.

---

## 📋 Pre-requisitos

Antes de comenzar, asegúrate de tener:

- [x] Servidor Linux (Ubuntu 20.04+ o Debian 11+ recomendado)
- [x] Acceso root o sudo
- [x] Dominio configurado apuntando a tu servidor (pnptv.app)
- [x] Puerto 80 y 443 abiertos en el firewall
- [x] Node.js 18+ instalado
- [x] Redis instalado
- [x] Git instalado

---

## 🚀 Paso 1: Preparar el Servidor

### 1.1 Actualizar el sistema

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Instalar Node.js 18+

```bash
# Agregar repositorio de NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Instalar Node.js
sudo apt install -y nodejs

# Verificar instalación
node --version  # Debe mostrar v18.x o superior
npm --version
```

### 1.3 Instalar Redis

```bash
# Instalar Redis
sudo apt install -y redis-server

# Configurar Redis para iniciar automáticamente
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Verificar que Redis está corriendo
redis-cli ping  # Debe responder "PONG"
```

### 1.4 Instalar Nginx

```bash
# Instalar Nginx
sudo apt install -y nginx

# Habilitar y arrancar Nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Verificar estado
sudo systemctl status nginx
```

### 1.5 Instalar PM2 (Process Manager)

```bash
# Instalar PM2 globalmente
sudo npm install -g pm2

# Configurar PM2 para iniciar al boot
pm2 startup
# Seguir las instrucciones que aparecen
```

---

## 📦 Paso 2: Clonar y Configurar el Proyecto

### 2.1 Crear usuario para la aplicación (opcional pero recomendado)

```bash
# Crear usuario pnptv
sudo adduser --system --group --no-create-home pnptv

# O usar tu usuario actual
```

### 2.2 Clonar el repositorio

```bash
# Navegar al directorio de aplicaciones
cd /opt

# Clonar el repositorio
sudo git clone https://github.com/carlossmartdevices-cyber/pnptvbot-production.git pnptv-bot

# Cambiar permisos
sudo chown -R $USER:$USER /opt/pnptv-bot
cd /opt/pnptv-bot
```

### 2.3 Checkout a la rama correcta

```bash
# Ver ramas disponibles
git branch -a

# Checkout a la rama de trabajo
git checkout claude/work-in-progress-01BfugRjSf6wadJyV41oYDr5

# O merge a main si está listo
# git checkout main
# git merge claude/work-in-progress-01BfugRjSf6wadJyV41oYDr5
```

### 2.4 Instalar dependencias

```bash
npm install --production
```

### 2.5 Configurar variables de entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar archivo .env
nano .env
```

**Configuración mínima requerida:**

```env
# Bot Configuration
BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz  # Tu token de BotFather
BOT_USERNAME=pnptv_bot
BOT_WEBHOOK_DOMAIN=https://pnptv.app
BOT_WEBHOOK_PATH=/webhook/telegram

# Environment
NODE_ENV=production
PORT=3000

# Firebase Configuration (REQUERIDO)
FIREBASE_PROJECT_ID=tu-proyecto-firebase
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nTU_CLAVE_PRIVADA\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@tu-proyecto.iam.gserviceaccount.com
FIREBASE_DATABASE_URL=https://tu-proyecto.firebaseio.com

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Payment Providers (opcional si no usas pagos aún)
EPAYCO_PUBLIC_KEY=tu_clave_publica
EPAYCO_PRIVATE_KEY=tu_clave_privada
EPAYCO_TEST_MODE=false

# Sentry (opcional - monitoreo de errores)
SENTRY_DSN=https://tu-dsn@sentry.io/proyecto

# Admin Users (IDs de Telegram)
ADMIN_USER_IDS=123456789,987654321
```

**Guardar:** Ctrl+O, Enter, Ctrl+X

### 2.6 Crear directorios necesarios

```bash
mkdir -p logs uploads
chmod 755 logs uploads
```

---

## 🔧 Paso 3: Configurar Nginx

### 3.1 Copiar configuración de Nginx

```bash
# Copiar archivo de configuración
sudo cp nginx/pnptv.app.conf /etc/nginx/sites-available/pnptv.app

# Crear enlace simbólico
sudo ln -s /etc/nginx/sites-available/pnptv.app /etc/nginx/sites-enabled/pnptv.app

# Eliminar configuración default si existe
sudo rm -f /etc/nginx/sites-enabled/default
```

### 3.2 Agregar rate limiting al nginx.conf

```bash
# Editar nginx.conf
sudo nano /etc/nginx/nginx.conf
```

Agregar dentro del bloque `http { }`:

```nginx
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=webhook_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=20r/s;
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=50r/s;

# Connection limiting
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;
```

### 3.3 Configurar SSL con Let's Encrypt

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtener certificado SSL
sudo certbot --nginx -d pnptv.app -d www.pnptv.app

# Seguir las instrucciones:
# - Ingresar email
# - Aceptar términos
# - Elegir opción 2 (Redirect HTTP to HTTPS)

# Verificar renovación automática
sudo certbot renew --dry-run
```

### 3.4 Probar y recargar Nginx

```bash
# Probar configuración
sudo nginx -t

# Si todo está OK, recargar
sudo systemctl reload nginx

# Ver estado
sudo systemctl status nginx
```

---

## 🎯 Paso 4: Iniciar la Aplicación con PM2

### 4.1 Crear archivo ecosystem de PM2

```bash
nano ecosystem.config.js
```

Contenido:

```javascript
module.exports = {
  apps: [{
    name: 'pnptv-bot',
    script: 'src/bot/core/bot.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
```

### 4.2 Iniciar aplicación

```bash
# Iniciar con PM2
pm2 start ecosystem.config.js

# Ver logs en tiempo real
pm2 logs pnptv-bot

# Ver estado
pm2 status

# Guardar configuración de PM2
pm2 save
```

### 4.3 Configurar PM2 para auto-inicio

```bash
# Generar script de startup
pm2 startup

# Ejecutar el comando que PM2 te muestre (ejemplo):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u usuario --hp /home/usuario

# Guardar configuración
pm2 save
```

---

## ✅ Paso 5: Verificación

### 5.1 Verificar que todo está corriendo

```bash
# Estado de servicios
sudo systemctl status nginx
sudo systemctl status redis-server
pm2 status

# Verificar puerto 3000
sudo netstat -tlnp | grep 3000
# O
sudo ss -tlnp | grep 3000
```

### 5.2 Probar endpoints

```bash
# Health check local
curl http://localhost:3000/health

# Health check externo
curl https://pnptv.app/health

# Debe responder algo como:
# {
#   "status": "ok",
#   "timestamp": "2025-11-15T...",
#   "uptime": 123.45,
#   "dependencies": {
#     "redis": "ok",
#     "firestore": "ok"
#   }
# }
```

### 5.3 Configurar webhook de Telegram

```bash
# Desde tu máquina local o servidor, ejecutar:
curl -X POST "https://api.telegram.org/bot<TU_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://pnptv.app/webhook/telegram"}'

# Verificar webhook configurado
curl "https://api.telegram.org/bot<TU_BOT_TOKEN>/getWebhookInfo"
```

### 5.4 Probar el bot

1. Abre Telegram
2. Busca tu bot (@pnptv_bot o tu username)
3. Envía `/start`
4. Deberías recibir respuesta

---

## 📊 Paso 6: Monitoreo

### 6.1 Ver logs

```bash
# Logs de PM2
pm2 logs pnptv-bot

# Logs de la aplicación
tail -f logs/combined-*.log
tail -f logs/error-*.log

# Logs de Nginx
sudo tail -f /var/log/nginx/pnptv-access.log
sudo tail -f /var/log/nginx/pnptv-error.log
```

### 6.2 Monitoreo con PM2

```bash
# Dashboard de PM2
pm2 monit

# Métricas
pm2 status
pm2 info pnptv-bot
```

### 6.3 Configurar Logrotate para logs de aplicación

```bash
sudo nano /etc/logrotate.d/pnptv-bot
```

Contenido:

```
/opt/pnptv-bot/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 usuario usuario
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

---

## 🔄 Paso 7: Actualización y Mantenimiento

### 7.1 Actualizar la aplicación

```bash
cd /opt/pnptv-bot

# Pull últimos cambios
git pull origin claude/work-in-progress-01BfugRjSf6wadJyV41oYDr5

# Instalar nuevas dependencias
npm install --production

# Reiniciar aplicación
pm2 restart pnptv-bot

# Ver logs
pm2 logs pnptv-bot --lines 50
```

### 7.2 Backup

```bash
# Crear script de backup
nano /opt/pnptv-bot/scripts/backup.sh
```

Contenido:

```bash
#!/bin/bash
BACKUP_DIR="/backups/pnptv-bot"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup de .env
cp /opt/pnptv-bot/.env $BACKUP_DIR/.env.$DATE

# Backup de logs
tar -czf $BACKUP_DIR/logs-$DATE.tar.gz /opt/pnptv-bot/logs/

# Mantener solo últimos 7 días
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name ".env.*" -mtime +7 -delete

echo "Backup completado: $DATE"
```

```bash
# Dar permisos
chmod +x /opt/pnptv-bot/scripts/backup.sh

# Agregar a crontab (backup diario a las 2 AM)
crontab -e
# Agregar línea:
# 0 2 * * * /opt/pnptv-bot/scripts/backup.sh >> /var/log/pnptv-backup.log 2>&1
```

---

## 🚨 Troubleshooting

### Error: Cannot find module

```bash
cd /opt/pnptv-bot
rm -rf node_modules package-lock.json
npm install --production
pm2 restart pnptv-bot
```

### Error: Redis connection

```bash
# Verificar Redis
sudo systemctl status redis-server
redis-cli ping

# Reiniciar Redis si es necesario
sudo systemctl restart redis-server
```

### Error 502 Bad Gateway

```bash
# Verificar que la app está corriendo
pm2 status
curl http://localhost:3000/health

# Verificar logs de Nginx
sudo tail -f /var/log/nginx/pnptv-error.log

# Verificar logs de la app
pm2 logs pnptv-bot --lines 50
```

### Error: Firestore authentication

```bash
# Verificar variables de entorno
cat .env | grep FIREBASE

# Verificar formato de la clave privada (debe tener \n)
# Regenerar clave si es necesario desde Firebase Console
```

---

## 🔒 Seguridad

### Firewall

```bash
# Instalar UFW si no está
sudo apt install -y ufw

# Configurar reglas
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# Habilitar firewall
sudo ufw enable

# Ver estado
sudo ufw status
```

### Fail2Ban (opcional - protección contra brute force)

```bash
# Instalar Fail2Ban
sudo apt install -y fail2ban

# Configurar
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local

# Habilitar
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 📞 Soporte

Si encuentras problemas:

1. Revisa los logs: `pm2 logs pnptv-bot`
2. Verifica el health check: `curl https://pnptv.app/health`
3. Revisa la documentación: `OPTIMIZATION_REPORT.md`
4. Abre un issue en GitHub

---

## ✅ Checklist Final

- [ ] Servidor actualizado
- [ ] Node.js 18+ instalado
- [ ] Redis instalado y corriendo
- [ ] Nginx instalado y configurado
- [ ] SSL configurado con Let's Encrypt
- [ ] Proyecto clonado en /opt/pnptv-bot
- [ ] Variables de entorno configuradas (.env)
- [ ] Dependencias instaladas
- [ ] PM2 configurado y corriendo
- [ ] Health check respondiendo OK
- [ ] Webhook de Telegram configurado
- [ ] Bot responde en Telegram
- [ ] Logs rotándose correctamente
- [ ] Backup configurado
- [ ] Firewall configurado

---

**¡Deployment Completado! 🎉**

Tu bot de Telegram PNPtv está ahora corriendo en producción.
