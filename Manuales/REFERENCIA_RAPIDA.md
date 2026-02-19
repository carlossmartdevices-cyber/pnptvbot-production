# ⚡ REFERENCIA RÁPIDA - TODOS LOS COMANDOS

**Consolidado de**:
- `QUICK_START_REFERENCE.md`
- `ENV_VARIABLES_REQUIRED.md`
- `PUERTOS_DISTRIBUCION.md`
- `RUTAS_HABILITADAS.md`

**Versión**: 1.0
**Fecha**: 2026-02-13
**Uso**: Para DevOps/Admins/Desarrolladores

---

## 📑 TABLA DE CONTENIDOS

1. [Variables de Entorno](#variables-de-entorno)
2. [Comandos Docker](#comandos-docker)
3. [Comandos PM2](#comandos-pm2)
4. [Puertos y Networking](#puertos-y-networking)
5. [Rutas Habilitadas](#rutas-habilitadas)
6. [Load Testing](#load-testing)
7. [Debugging](#debugging)
8. [Emergencias](#emergencias)

---

## VARIABLES DE ENTORNO

### Esenciales (NUNCA vacías)

```bash
# Telegram Bot
TELEGRAM_BOT_TOKEN=8261865441:AAG...         # De @BotFather
BOT_USERNAME=PNPLatinoTV_bot
ADMIN_ID=8370209084                          # Tu ID personal

# Base de Datos (PostgreSQL)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=pnptvbot
POSTGRES_PASSWORD=Apelo801050#              # ⚠️ Usar entre comillas en .env
POSTGRES_DB=pnptv_sandbox
DATABASE_URL=postgresql://pnptvbot:Apelo801050%23@localhost:5432/pnptv_sandbox
# Nota: %23 = # URL-encoded

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# JWT & Seguridad
JWT_SECRET=459c0de1110aa702fa9cca2a3f8d8e4c020853052245a6d034345e0f24214847
ENCRYPTION_KEY=7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8
```

### Pagos

```bash
# ePayco
EPAYCO_PUBLIC_KEY=xxxxx
EPAYCO_PRIVATE_KEY=xxxxx                    # NUNCA en logs!
EPAYCO_TEST_MODE=true                       # true=sandbox, false=producción

# Daimo Pay
DAIMO_API_KEY=xxxxx
DAIMO_SECRET=xxxxx
```

### Email

```bash
# SendGrid (recomendado)
SENDGRID_API_KEY=SG_xxxxx

# O SMTP genérico
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu@email.com
SMTP_PASSWORD=password
SMTP_SECURE=false
EMAIL_FROM=noreply@pnptv.app
```

### Canales/Grupos de Telegram

```bash
GROUP_ID=-1001234567890                     # Grupo comunitario
PRIME_CHANNEL_ID=-1002997324714            # Canal PRIME (membresía)
SUPPORT_GROUP_ID=-1001234567890             # Grupo soporte
NOTIFICATION_CHANNEL_ID=-1001234567890      # Canal notificaciones admin
WALL_OF_FAME_TOPIC_ID=123                   # Tema en grupo
```

### IA & Servicios

```bash
OPENAI_API_KEY=sk-xxxxx
GROK_API_KEY=sk-xxxxx

# LibreTranslate (traducción)
TRANSLATE_API_URL=http://localhost:5000
```

### Otros

```bash
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
```

---

## COMANDOS DOCKER

### Iniciar Stack Completo

```bash
# Detalle: descarga imágenes, crea contenedores, inicia servicios
docker-compose up -d

# Verificar estado
docker-compose ps

# Ver logs en tiempo real
docker-compose logs -f bot
docker-compose logs -f postgres
```

### Build y Reconstruir

```bash
# Build sin usar cache (cuando hay cambios grandes)
docker-compose build --no-cache bot

# Reconstruir y reiniciar
docker-compose up -d --build bot
```

### Parar y Limpiar

```bash
# Parar todos los servicios (mantiene datos)
docker-compose stop

# Parar contenedor específico
docker-compose stop bot

# Detener y eliminar contenedores (mantiene volúmenes/datos)
docker-compose down

# Limpiar TODO (contenedores, imágenes, volúmenes - ⚠️ BORRA DATOS)
docker-compose down -v
```

### Acceder a Contenedor

```bash
# Bash en contenedor
docker-compose exec bot bash

# PostgreSQL psql
docker-compose exec postgres psql -U pnptvbot -d pnptv_sandbox

# Redis CLI
docker-compose exec redis redis-cli
```

### Ver Logs

```bash
# Últimas 50 líneas
docker-compose logs --tail=50 bot

# Seguir en tiempo real
docker-compose logs -f

# Con timestamps
docker-compose logs --timestamps bot
```

---

## COMANDOS PM2

### Iniciar Aplicación

```bash
# Iniciar desde ecosystem.config.js
pm2 start ecosystem.config.js

# Iniciar app específica
pm2 start ecosystem.config.js --only pnptv-bot

# Iniciar con configuración env_production
pm2 start ecosystem.config.js --env production
```

### Monitoreo

```bash
# Ver estado actual
pm2 status

# Ver detalles
pm2 show pnptv-bot

# Monitor en tiempo real (type 'q' para salir)
pm2 monit
```

### Logs

```bash
# Ver logs (últimas líneas)
pm2 logs pnptv-bot

# Ver logs con formato
pm2 logs pnptv-bot --lines 100

# Logs de error específicamente
pm2 logs pnptv-bot --err
```

### Control

```bash
# Reiniciar app
pm2 restart pnptv-bot

# Parar app
pm2 stop pnptv-bot

# Recargar con zero downtime
pm2 reload pnptv-bot

# Eliminar PM2
pm2 delete pnptv-bot

# Ver historial de restarts
pm2 show pnptv-bot
```

### Autostart

```bash
# Guardar configuración para autostart
pm2 startup

# Remover autostart
pm2 unstartup
```

---

## PUERTOS Y NETWORKING

### Host (Internet)

```
80    → HTTP (redirige a 443)
443   → HTTPS (Nginx main)
8081  → Nginx HTTP (sandbox)
8444  → Nginx HTTPS (sandbox)
```

### Docker Network (Interno - NO expuesto)

```
localhost:3000   pnptv-bot (Hub API)
localhost:3001   pnptv-bot (Bot API)
localhost:5432   PostgreSQL
localhost:6379   Redis
localhost:8008   Matrix Synapse
localhost:8448   Matrix Federation
localhost:3000   Mastodon
localhost:9000   Authentik
```

### Verificar Puertos

```bash
# Qué está escuchando en puerto 443
sudo lsof -i :443

# Qué está escuchando en puerto 3001
sudo lsof -i :3001

# Verificar conectividad a puerto
nc -zv localhost 3001

# Health check
curl -I http://localhost:3001/health
```

---

## RUTAS HABILITADAS

### Bot Telegram

```
POST /webhook/telegram              Recibe mensajes de bot
GET  /health                        Estado del bot
```

### API REST

```
GET  /api/payments/{id}             Detalles de pago
POST /api/payments/create           Crear pago
POST /api/webhooks/epayco           Webhook ePayco
POST /api/webhooks/daimo            Webhook Daimo

GET  /api/users/{id}                Información de usuario
PUT  /api/users/{id}                Actualizar usuario
POST /api/users/{id}/extend-subscription   Extender suscripción
```

### Páginas Públicas

```
GET  /payment/{paymentId}           Landing page pago
GET  /lifetime100                   Oferta lifetime
GET  /policies_en.html              Políticas EN
GET  /policies_es.html              Políticas ES
```

---

## LOAD TESTING

### Tests de Rendimiento (45 minutos totales)

#### 1. Redis Benchmark (15 min)

```bash
REDIS_URL=redis://localhost:6379/0 \
  node load-tests/redis-benchmark.js
```

**Prueba**:
- SET/GET performance
- Throughput
- Latencia

**Reporte**: `load-test-reports/[timestamp]/redis-report.json`

---

#### 2. PostgreSQL Benchmark (20 min)

```bash
DATABASE_URL="postgresql://pnptvbot:Apelo801050%23@localhost:5432/pnptv_sandbox" \
  node load-tests/postgres-benchmark.js
```

**Prueba**:
- INSERT/SELECT performance
- Connection pooling
- Query latencia

**Reporte**: `load-test-reports/[timestamp]/postgres-report.json`

---

#### 3. Artillery Load Test (10 min)

```bash
# Instalar (una sola vez)
npm install -g artillery

# Ejecutar
API_URL=http://localhost:3001 \
  artillery run load-tests/artillery-config.yml
```

**Prueba**:
- HTTP requests/segundo
- Response time percentiles
- Error rate

**Reporte**: `artillery-report.html`

---

#### 4. K6 Load Test (10 min - si k6 está instalado)

```bash
# Instalar k6 (una sola vez)
# Ubuntu: sudo apt-get install -y apt-transport-https
# Luego: curl https://dl.k6.io/gpg.key | sudo apt-key add -
#        echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6-stable.list
#        sudo apt-get update
#        sudo apt-get install k6

# Ejecutar
K6_VUS=50 K6_DURATION=10m \
  k6 run load-tests/k6-load-test.js
```

---

### Ejecutar Todos los Tests

```bash
cd /root/pnptvbot-production
bash run-all-load-tests.sh

# Tiempo total: ~45 minutos
# Reportes en: load-test-reports/
```

---

## DEBUGGING

### Base de Datos

```bash
# Conectar a PostgreSQL
psql -h localhost -U pnptvbot -d pnptv_sandbox

# Consultas útiles
SELECT * FROM users WHERE id = 123456789;
SELECT * FROM payments ORDER BY created_at DESC LIMIT 10;
SELECT COUNT(*) FROM subscriptions WHERE status = 'active';

# Backups
pg_dump -U pnptvbot -h localhost pnptv_sandbox > backup.sql

# Restaurar
psql -U pnptvbot -h localhost pnptv_sandbox < backup.sql
```

### Redis

```bash
# Conectar a Redis
redis-cli

# Comandos útiles
KEYS *                    # Ver todas las keys
GET pnptv:user:123       # Obtener valor
DEL pnptv:user:123       # Eliminar
FLUSHDB                  # Limpiar TODO (¡cuidado!)
INFO stats               # Estadísticas
```

### Logs

```bash
# Logs de aplicación
tail -f /app/logs/bot.log

# Buscar errores
grep ERROR /app/logs/bot.log | tail -20

# Búsqueda específica
grep "user_id=123456" /app/logs/bot.log

# Logs nginx
tail -f /var/log/nginx/pnptv-access.log
tail -f /var/log/nginx/pnptv-error.log
```

### Network

```bash
# Verificar conectividad a servicios externos
curl -I https://api.epayco.co
curl -I https://api.telegram.org

# Test DNS
nslookup pnptv.app
dig pnptv.app
```

---

## EMERGENCIAS

### El Bot No Responde

```bash
# 1. Verificar si está corriendo
docker-compose ps bot
ps aux | grep node

# 2. Ver logs
docker-compose logs --tail=100 bot

# 3. Verificar puerto
lsof -i :3001

# 4. Reiniciar
docker-compose restart bot

# 5. Si nada funciona - reconstruir
docker-compose down
docker-compose up -d --build
```

### Base de Datos Corrupta

```bash
# 1. Verificar conexión
docker-compose exec postgres pg_isready

# 2. Ver logs PostgreSQL
docker-compose logs postgres

# 3. Restaurar backup
docker-compose exec postgres pg_restore -d pnptv_sandbox backup.dump

# 4. Verificar integridad
docker-compose exec postgres psql -U pnptvbot -d pnptv_sandbox -c "SELECT COUNT(*) FROM users;"
```

### Fuera de Espacio en Disco

```bash
# Ver uso
df -h

# Limpiar Docker
docker system prune -a

# Ver tamaño de logs
du -sh /var/log/

# Rotar logs manualmente
logrotate -f /etc/logrotate.d/
```

### SSL Certificate Expirado

```bash
# Verificar fecha vencimiento
openssl s_client -connect pnptv.app:443 -showcerts 2>/dev/null | \
  openssl x509 -noout -dates

# Renovar Let's Encrypt (manual)
docker-compose exec certbot certbot renew --force-renewal

# Recargar Nginx
docker-compose exec nginx nginx -s reload
```

### Ataque DDoS o Spam

```bash
# Ver IPs conectadas
netstat -an | grep ESTABLISHED | wc -l

# Ver IPs más frecuentes
netstat -an | grep ESTABLISHED | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -rn

# Banear IP en UFW
sudo ufw deny from 192.168.1.100

# Verificar Cloudflare está activo
curl -I https://pnptv.app | grep cf-ray
```

---

## MONITOREO PROACTIVO

### Health Checks Automáticos

```bash
# Crear cron job para monitoreo
crontab -e

# Añadir línea:
*/5 * * * * curl -f http://localhost:3001/health || systemctl restart docker

# Verificar cron jobs
crontab -l
```

### Alertas por Email

```bash
# Si servicio cae, enviar email
*/10 * * * * if ! curl -f http://localhost:3001/health 2>/dev/null; then \
  echo "Bot down" | mail -s "ALERTA: Bot no responde" admin@pnptv.app; \
fi
```

---

## CHECKLIST DE RUTINA DIARIA

```
MAÑANA:
[ ] Verificar: docker-compose ps
[ ] Revisar logs: Errores en las últimas 24h?
[ ] Revisar alertas: ¿DDoS? ¿Tráfico anormal?

TARDE:
[ ] Verificar: /stats en admin
[ ] Revisar: Pagos procesados hoy
[ ] Revisar: Backups completaron

NOCHE:
[ ] Garantizar: Health checks OK
[ ] Verificar: SSL certificate válido
[ ] Revisar: Sistema recursos (CPU, RAM, Disk)
```

---

**Guías Completas**:
- 🔒 [GUIA_INFRAESTRUCTURA_SEGURIDAD.md](/root/GUIA_INFRAESTRUCTURA_SEGURIDAD.md)
- 🚀 [GUIA_DESPLIEGUE_OPERACIONES.md](/root/GUIA_DESPLIEGUE_OPERACIONES.md)
- 💳 [GUIA_PAGOS_INTEGRACIONES.md](/root/GUIA_PAGOS_INTEGRACIONES.md)

**Documentación Técnica**:
- 📖 [MANUAL_COMPLETO_PNPTV_BOT.md](/root/MANUAL_COMPLETO_PNPTV_BOT.md)
