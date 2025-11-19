# Quick Start - Configuración Multi-App

## ✅ Todo Configurado

El servidor ya está configurado para ejecutar múltiples aplicaciones sin conflictos.

## 🚀 Cómo Usarlo

### Opción 1: Usar el Ecosystem File (Recomendado)

```bash
cd /root/pnptvbot-production

# Detener todas las apps actuales
pm2 stop all

# Iniciar con ecosystem config
pm2 start ecosystem.config.js

# Guardar configuración
pm2 save
```

### Opción 2: Continuar con PM2 Actual

Si prefieres seguir usando los comandos actuales:

```bash
# El bot ya está configurado con:
# - REDIS_DB: 0
# - REDIS_KEY_PREFIX: pnptv:
# - POSTGRES_DATABASE: pnptvbot

pm2 restart pnptv-bot --update-env
```

## 🔍 Verificar Todo Funciona

```bash
# Ver estado de las apps
pm2 status

# Ver logs
pm2 logs --lines 30

# Verificar Redis isolation
redis-cli -n 0 KEYS "*" | head -5  # pnptv-bot keys
redis-cli -n 1 KEYS "*" | head -5  # social-hub keys
```

## 📚 Documentación Completa

Ver `/root/PM2_MULTI_APP_SETUP.md` para detalles completos.

## 🎯 Configuración Actual

| App        | Puerto | Redis DB | Key Prefix | PostgreSQL DB |
|------------|--------|----------|------------|---------------|
| pnptv-bot  | 3000   | 0        | pnptv:     | pnptvbot      |
| social-hub | 3001   | 1        | social:    | socialhub     |
