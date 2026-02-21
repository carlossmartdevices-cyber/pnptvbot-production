# 🔒 Nginx Setup Con SSL/TLS (Let's Encrypt) — Guía Completa

**Date**: February 21, 2026
**Status**: Production-Ready
**Domain**: pnptv.app

---

## 📋 Pre-requisitos

- [ ] Servidor VPS con acceso root/sudo
- [ ] Dominio apuntando a tu VPS (DNS configurado)
- [ ] Puerto 80 y 443 abiertos en firewall
- [ ] Nginx instalado
- [ ] Node.js/PM2 ejecutándose en puerto 3001

---

## 🔧 Paso 1: Instalar Certbot y Plugin de Nginx

### En Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
```

### En CentOS/RHEL:

```bash
sudo yum install -y certbot python3-certbot-nginx
```

---

## 🚀 Paso 2: Obtener Certificado SSL (Let's Encrypt)

### Opción A: Certbot Automático (Recomendado)

```bash
sudo certbot certonly --standalone -d pnptv.app -d www.pnptv.app --agree-tos --register-unsafely-without-email
```

**Qué hace:**
- Obtiene certificado de Let's Encrypt
- Valida que eres dueño del dominio
- Guarda certificados en `/etc/letsencrypt/live/pnptv.app/`

### Opción B: Certbot con DNS (Si tienes muchos subdominios)

```bash
sudo certbot certonly --manual -d pnptv.app -d www.pnptv.app --agree-tos
```

Te pedirá crear registros DNS TXT. Sigue las instrucciones.

### Verificar Certificado

```bash
sudo ls -la /etc/letsencrypt/live/pnptv.app/

# Deberías ver:
# fullchain.pem   (el certificado completo)
# privkey.pem     (tu clave privada)
# chain.pem       (para OCSP stapling)
# cert.pem        (certificado)
```

---

## 📝 Paso 3: Copiar Nginx Config

```bash
# Copiar config de producción
sudo cp nginx-production.conf /etc/nginx/sites-available/pnptv-production

# Crear enlace simbólico (habilitar sitio)
sudo ln -s /etc/nginx/sites-available/pnptv-production /etc/nginx/sites-enabled/pnptv-production

# Deshabilitar default si existe
sudo rm -f /etc/nginx/sites-enabled/default

# Verificar sintaxis
sudo nginx -t
```

---

## ⚙️ Paso 4: Configurar Rate Limiting en Nginx

Nginx necesita zonas de rate limiting definidas en el bloque `http`. Edita:

```bash
sudo nano /etc/nginx/nginx.conf
```

Dentro del bloque `http { }` (después de `include /etc/nginx/mime.types;`), agrega:

```nginx
# ============== AGREGAR ESTO ==============

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=2r/s;

# ==========================================
```

Tu `nginx.conf` debería verse así:

```nginx
http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=2r/s;

    # ... resto de configuración ...

    include /etc/nginx/sites-enabled/*;
}
```

Verifica sintaxis:

```bash
sudo nginx -t
```

---

## 🔄 Paso 5: Recargar Nginx (Zero-Downtime)

```bash
sudo systemctl reload nginx

# Verificar estado
sudo systemctl status nginx

# Ver que está escuchando en puerto 443
sudo netstat -tlnp | grep nginx
```

---

## 🧪 Paso 6: Verificar SSL/TLS

### Test 1: Verificar HTTPS funciona

```bash
curl -I https://pnptv.app/health
# Deberías ver: HTTP/2 200 (o HTTP/1.1 200)
```

### Test 2: Verificar certificado SSL

```bash
openssl s_client -connect pnptv.app:443 -servername pnptv.app

# O usando curl:
curl -vI https://pnptv.app/ 2>&1 | grep -A 5 "certificate"
```

### Test 3: Verificar seguridad SSL (SSL Labs)

Visita: https://www.ssllabs.com/ssltest/analyze.html?d=pnptv.app

Deberías obtener puntuación A o A+

### Test 4: Verificar redirección HTTP → HTTPS

```bash
curl -I http://pnptv.app/

# Deberías ver:
# HTTP/1.1 301 Moved Permanently
# Location: https://pnptv.app/...
```

---

## 🔐 Paso 7: Verificar Headers de Seguridad

```bash
# Verificar HSTS
curl -I https://pnptv.app/ | grep -i "strict-transport"

# Verificar CSP
curl -I https://pnptv.app/ | grep -i "content-security"

# Verificar X-Frame-Options
curl -I https://pnptv.app/ | grep -i "x-frame"

# Todos deberían retornar resultados
```

---

## 🔄 Paso 8: Configurar Auto-Renovación de Certificado

Let's Encrypt certificates expiran cada 90 días. Certbot puede renovarlos automáticamente.

### Verificar renovación automática

```bash
# Crear timer systemd para renovación automática
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Verificar estado
sudo systemctl status certbot.timer

# Ver próxima renovación
sudo systemctl list-timers certbot.timer
```

### Probar renovación manual (sin renovar realmente)

```bash
sudo certbot renew --dry-run
```

---

## 🧪 Paso 9: Prueba de Flujo Completo

### Test 1: Acceso Público a /auth/

```bash
curl -I https://pnptv.app/auth/
# Expected: HTTP/2 200 (sin auth requerido)
```

### Test 2: Acceso Protegido a /hub/ (debería redirigir)

```bash
curl -I https://pnptv.app/hub/
# Expected: HTTP/2 302 (redirige a /auth/)
```

### Test 3: Login y Acceso Protegido

```bash
# 1. Login
curl -X POST https://pnptv.app/api/webapp/auth/email/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  -c cookies.txt

# 2. Acceder a ruta protegida con cookies
curl -I https://pnptv.app/hub/ -b cookies.txt
# Expected: HTTP/2 200 (ahora tiene acceso)
```

### Test 4: Verificar CORS restrictivo

```bash
# Sin origin permitido
curl -H "Origin: https://evil.com" https://pnptv.app/api/profile
# Expected: NO Access-Control-Allow-Origin header

# Con origin permitido
curl -H "Origin: https://pnptv.app" https://pnptv.app/api/profile
# Expected: Access-Control-Allow-Origin: https://pnptv.app
```

---

## 📊 Paso 10: Monitorear Logs

```bash
# Ver logs de acceso en tiempo real
sudo tail -f /var/log/nginx/pnptv-access.log

# Ver logs de error
sudo tail -f /var/log/nginx/pnptv-error.log

# Filtrar solo errores
sudo grep "error" /var/log/nginx/pnptv-error.log | tail -20

# Ver rate limiting (429 Too Many Requests)
sudo grep "429" /var/log/nginx/pnptv-access.log
```

---

## 🔍 Troubleshooting

### Problema: "Connection refused" en 443

```bash
# Verificar que Nginx está escuchando
sudo netstat -tlnp | grep 443

# Verificar firewall
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Problema: Certificado no se encuentra

```bash
# Verificar que los archivos existen
sudo ls -la /etc/letsencrypt/live/pnptv.app/

# Si no existen, obtener nuevo certificado
sudo certbot certonly --standalone -d pnptv.app -d www.pnptv.app
```

### Problema: "SSL_ERROR_HANDSHAKE_FAILURE_ALERT"

```bash
# Verificar certificado es válido
sudo openssl x509 -in /etc/letsencrypt/live/pnptv.app/cert.pem -text -noout

# Verificar key permisos
sudo chmod 644 /etc/letsencrypt/live/pnptv.app/fullchain.pem
sudo chmod 600 /etc/letsencrypt/live/pnptv.app/privkey.pem

# Recargar Nginx
sudo systemctl reload nginx
```

### Problema: "ERR_HTTP2_PROTOCOL_ERROR"

```bash
# Verificar HTTP/2 está en listen directive
sudo grep "listen.*http2" /etc/nginx/sites-available/pnptv-production

# Si no está, editar config:
# listen 443 ssl http2;
```

### Problema: "Too many redirects"

```bash
# Verificar auth_request config
sudo grep -n "auth_request" /etc/nginx/sites-available/pnptv-production

# Verificar que /api/webapp/auth/verify es accesible
curl -I https://pnptv.app/api/webapp/auth/verify
# Expected: 401 Unauthorized (sin cookies)
```

---

## 📋 Checklist de Verificación Completa

- [ ] Certificado SSL válido en `/etc/letsencrypt/live/pnptv.app/`
- [ ] Nginx config verificada: `sudo nginx -t` ✅
- [ ] Nginx reloaded: `sudo systemctl reload nginx` ✅
- [ ] HTTP redirige a HTTPS: `curl -I http://pnptv.app/` → 301
- [ ] HTTPS funciona: `curl -I https://pnptv.app/` → 200
- [ ] HTTP/2 activado: `curl -I https://pnptv.app/ | grep HTTP` → HTTP/2
- [ ] Gzip activo: `curl -I https://pnptv.app/assets/index.js | grep gzip`
- [ ] HSTS header presente: `curl -I https://pnptv.app/ | grep HSTS`
- [ ] CORS restrictivo: Probado con origin diferente
- [ ] Auth requerido en /hub/: `curl -I https://pnptv.app/hub/` → 302
- [ ] Rate limiting funciona: 11 requests rápidos → algunos son 429
- [ ] Logs limpios: `sudo tail -20 /var/log/nginx/pnptv-error.log`
- [ ] Certbot timer activo: `sudo systemctl status certbot.timer`
- [ ] App Node.js en 3001: `curl http://127.0.0.1:3001/health`

---

## 🔄 Renovación Manual de Certificado (Si es necesario)

```bash
# Renovar ahora
sudo certbot renew --force-renewal

# O renovar solo un dominio
sudo certbot certonly --force-renewal -d pnptv.app -d www.pnptv.app

# Recargar Nginx
sudo systemctl reload nginx

# Verificar nuevo certificado
openssl x509 -enddate -noout -in /etc/letsencrypt/live/pnptv.app/cert.pem
```

---

## 🎯 Resultado Final

✅ Tu servidor PNPtv estará protegido con:

| Característica | Status |
|---|---|
| **HTTPS/TLS** | ✅ Let's Encrypt (automático) |
| **HTTP/2** | ✅ Multiplexado (más rápido) |
| **Gzip** | ✅ 60-70% compresión |
| **HSTS** | ✅ Fuerza HTTPS |
| **CSP** | ✅ Previene XSS |
| **CORS** | ✅ Restringido a dominios permitidos |
| **Rate Limiting** | ✅ Previene brute force |
| **OCSP Stapling** | ✅ TLS más rápido |
| **Auto-Renovación** | ✅ Certificado automático cada 90 días |

---

## 🚀 Próximo Paso

Ahora ejecuta el deployment:

```bash
cd /root/pnptvbot-production
sudo bash DEPLOY.sh
```

¡Listo! Tu PNPtv estará en producción con SSL completo. 🎉

---

**Creado**: February 21, 2026
**Por**: Claude Code Agent
**Status**: ✅ Production-Ready
