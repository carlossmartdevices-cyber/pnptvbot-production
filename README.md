# 🤖 PNPtv Bot - Plataforma Premium de Telegram

> **Bot de Telegram avanzado con sistema integrado de pagos, suscripciones premium, videollamadas, streaming en vivo y radio en línea.**

[![Node.js](https://img.shields.io/badge/Node.js-v20.19.5-green?logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v17-blue?logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-6+-red?logo=redis)](https://redis.io/)
[![Tests Passing](https://img.shields.io/badge/Tests-244%2F244-brightgreen)](./tests)
[![License](https://img.shields.io/badge/License-MIT-yellow)](./LICENSE)

---

## 🌟 Características Principales

### 💳 Sistema de Pagos Integrado
- **ePayco**: Transferencias bancarias directas en COP
- **Daimo Pay**: Pagos en USDC (Venmo, CashApp, Zelle, Revolut, Wise)
- Validación automática de transacciones
- Gestión de suscripciones automáticas

### 👥 Gestión Avanzada de Usuarios
- Perfiles personalizados con ubicación
- Sistema de búsqueda de usuarios cercanos
- Historial de actividad
- Seguimiento de suscripción

### 📞 Videollamadas Privadas
- Llamadas 1-a-1 encriptadas
- Videollamadas grupales
- Sistema de reserva de horarios
- Notificaciones automáticas

### 🎬 Streaming en Vivo
- Transmisión desde Hangouts y Zoom
- Chat en tiempo real
- Control de participantes
- Grabación de sesiones

### 📻 Radio en Línea
- Streaming de música 24/7
- Control remoto de reproducción
- Notificaciones de canciones
- Biblioteca personalizada

### 🛡️ Moderación Automática
- Detección inteligente de spam
- Bloqueo de usuarios no autorizados
- Límites de mensajes por minuto
- Sistema de baneos globales
- Validación de perfiles

### 🎮 Gamificación
- Sistema de puntos y recompensas
- Logros y badges
- Leaderboards globales
- Promociones especiales

---

## 📊 Estadísticas del Proyecto

```
📁 Líneas de Código: 50,000+
✅ Tests: 244/244 pasando (100%)
🔒 Endpoints Seguros: 15+
⚡ Response Time: <100ms (promedio)
🚀 Uptime: 99.9%
💾 BD: PostgreSQL 17
📦 Dependencias: 45+
```

---

## 🚀 Inicio Rápido

### Requisitos Previos
```
Node.js v20.19.5
PostgreSQL 17 (puerto 55432)
Redis 6+ (puerto 6380)
Nginx (para reverse proxy)
```

### Instalación en 5 minutos

```bash
# 1. Clonar repositorio
git clone https://github.com/carlossmartdevices-cyber/pnptvbot-production.git
cd pnptvbot-production

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 4. Inicializar base de datos
npm run db:init

# 5. Ejecutar tests
npm test

# 6. Iniciar bot
npm run dev
# O en producción con PM2:
pm2 start ecosystem.config.js
```

**¡Listo!** El bot debería estar conectado en ~30 segundos.

---

## 📚 Documentación

| Documento | Descripción | Tiempo |
|-----------|-------------|--------|
| [📖 Documentación Completa](./DOCUMENTACION_COMPLETA.md) | Guía de referencia exhaustiva | 20 min |
| [🚀 Quick Start Deploy](./QUICK_START_DEPLOY.md) | Comandos para deploy rápido | 5 min |
| [🏗️ Arquitectura](./CODEBASE_ARCHITECTURE.md) | Estructura del código | 15 min |
| [💳 Sistema de Pagos](./DAIMO_IMPLEMENTATION_SUMMARY.md) | Integración de pagos | 15 min |
| [📦 Deploy Producción](./DEPLOYMENT_GUIDE.md) | Guía completa de deployment | 30 min |
| [🔒 Seguridad](./ADDITIONAL_SECURITY_MEASURES.md) | Medidas de seguridad | 15 min |
| [📋 Índice Completo](./DOCUMENTATION_INDEX.md) | Todos los documentos | - |

**¿Primer día?** Comienza con: [INICIO_AQUI.md](./INICIO_AQUI.md)

---

## 📁 Estructura del Proyecto

```
pnptvbot-production/
├── src/
│   ├── bot/                    # Núcleo del bot
│   │   ├── api/               # Rutas y controllers HTTP
│   │   ├── handlers/          # Manejadores de eventos
│   │   ├── middleware/        # Autenticación, autorización
│   │   ├── services/          # Lógica de negocio
│   │   └── core/              # Núcleo del bot
│   ├── config/                # Configuraciones (DB, Pagos, etc)
│   ├── models/                # Modelos de datos
│   └── utils/                 # Funciones de utilidad
├── tests/                     # Tests unitarios e integración
├── database/                  # Scripts y migraciones de BD
├── public/                    # Archivos estáticos (HTML, CSS)
├── .env                       # Variables de entorno
├── package.json               # Dependencias
└── jest.config.js             # Configuración de tests
```

---

## 🔧 Comandos Principales

```bash
# Desarrollo
npm run dev              # Inicia en modo desarrollo con auto-reload
npm test                 # Ejecuta todos los tests
npm run lint             # Valida código con ESLint

# Base de datos
npm run db:init          # Inicializa base de datos
npm run db:migrate       # Ejecuta migraciones
npm run db:seed          # Carga datos de prueba

# Producción
pm2 start ecosystem.config.js    # Inicia con PM2
pm2 logs pnptvbot                # Ver logs en tiempo real
pm2 status                       # Ver estado de procesos
pm2 monit                        # Monitorear recursos

# Deployment
npm run build            # Construir para producción
npm run deploy           # Deploy a producción
npm run redeploy         # Redeploy con limpieza de cache
```

---

## 🌐 Endpoints Principales

### Public
```
GET  /health                        # Health check
POST /api/webhooks/telegram         # Webhook de Telegram
```

### Pagos
```
POST /api/payments/create           # Crear pago
POST /api/webhooks/epayco           # Webhook ePayco
POST /api/webhooks/daimo            # Webhook Daimo
```

### Usuarios
```
GET  /api/users/:userId             # Obtener usuario
POST /api/users/update              # Actualizar perfil
GET  /api/users/nearby              # Usuarios cercanos
```

---

## 💳 Sistema de Pagos

### Flujo de Pago Daimo Pay

```
1. Usuario selecciona plan premium
2. Se genera payment intent con metadata
3. Usuario redirigido a Daimo Pay checkout
4. Selecciona app (Venmo, CashApp, Zelle, etc)
5. Completa pago en USDC
6. Webhook valida y activa suscripción
7. Bot confirma al usuario
```

### Planes Disponibles
| Plan | Precio | Duración | Características |
|------|--------|----------|-----------------|
| PREMIUM | $10 USD / 40k COP | 30 días | Videollamadas, Live TV, Radio |
| LIFETIME | $99 USD | Indefinido | Todos los premium + prioridad |

---

## 🔒 Seguridad

### ✅ Medidas Implementadas
- ✅ Validación HMAC-SHA256 de webhooks
- ✅ Encriptación SSL/TLS en todas las conexiones
- ✅ Rate limiting (30 req/min por usuario)
- ✅ Prevención de SQL injection
- ✅ Sanitización de inputs
- ✅ JWT tokens para API
- ✅ Control de acceso basado en roles (RBAC)
- ✅ Audit logging de todas las transacciones
- ✅ Verificación de usuario de Telegram
- ✅ IP whitelist para endpoints críticos

---

## 📊 Monitoreo y Logs

### Acceso a Logs
```bash
# Logs en tiempo real
pm2 logs pnptvbot

# Últimos 100 líneas
tail -100 all_logs.txt

# Filtrar por error
pm2 logs pnptvbot | grep -i error

# Logs de pago específico
pm2 logs pnptvbot | grep "pay_"
```

### Archivos de Log
- `all_logs.txt` - Todos los eventos
- `bot_logs.txt` - Logs del bot de Telegram
- `latest-100-logs.txt` - Últimos 100 eventos

---

## 🧪 Testing

### Ejecutar Tests
```bash
# Todos los tests
npm test

# Tests específicos
npm test -- paymentService

# Con coverage
npm test -- --coverage

# En modo watch
npm test -- --watch
```

### Resultados Esperados
```
Test Suites: 16 passed, 16 total
Tests:       244 passed, 244 total
Snapshots:   0 total
Time:        8.456 s
```

---

## 🐛 Troubleshooting

### Bot no inicia
```bash
# Verificar logs
pm2 logs pnptvbot

# Verificar PostgreSQL
pg_isready -h localhost -p 55432

# Reiniciar
pm2 restart pnptvbot
```

### Webhooks no se reciben
```bash
# Verificar Nginx
sudo nginx -t

# Ver configuración
sudo cat /etc/nginx/sites-enabled/default | grep webhook

# Reiniciar Nginx
sudo systemctl reload nginx
```

### Tests fallando
```bash
# Limpiar cache
npm cache clean --force
rm -rf node_modules
npm install

# Reiniciar BD de pruebas
npm run db:seed:test

# Ejecutar tests
npm test
```

👉 **¿Más problemas?** Ver sección Troubleshooting en [DOCUMENTACION_COMPLETA.md](./DOCUMENTACION_COMPLETA.md)

---

## 🤝 Contribuyendo

1. Fork el repositorio
2. Crea una rama: `git checkout -b feature/nueva-caracteristica`
3. Commit cambios: `git commit -m 'Agrega nueva caracteristica'`
4. Push a rama: `git push origin feature/nueva-caracteristica`
5. Abre un Pull Request

**Por favor asegúrate de:**
- ✅ Pasar todos los tests (`npm test`)
- ✅ Seguir convenciones de código
- ✅ Documentar cambios

Ver [CONTRIBUTING.md](./CONTRIBUTING.md) para más detalles.

---

## 📞 Soporte

- 📧 **Email**: support@pnptv.app
- 🐛 **Issues**: [GitHub Issues](https://github.com/carlossmartdevices-cyber/pnptvbot-production/issues)
- 💬 **Telegram**: [@PNPtvbot](https://t.me/PNPtvbot)

---

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ver [LICENSE](./LICENSE) para más detalles.

---

## ✨ Cambios Recientes

### v1.0.0 (26 Nov 2025)
- ✨ Integración completa de Daimo Pay (USDC)
- ✨ Migración Firebase → PostgreSQL completada
- ✨ 244/244 tests pasando
- ✨ Sistema de seguridad de pagos implementado
- 🐛 Correcciones de webhook Daimo
- 📚 Documentación completa

### v0.9.0
- Soporte para ePayco
- Sistema de moderación automática
- Radio en línea
- Streaming en vivo desde Hangouts

---

## 📈 Roadmap

### Q1 2025
- [ ] Integración con Stripe
- [ ] Soporte para criptomonedas adicionales
- [ ] Analytics dashboard
- [ ] Mobile app iOS

### Q2 2025
- [ ] AI chatbot assistant
- [ ] Machine learning para moderación
- [ ] Integración con Discord
- [ ] API pública v2

---

## 🌟 Stats

- ⭐ **Stars**: [Ver en GitHub](https://github.com/carlossmartdevices-cyber/pnptvbot-production)
- 📦 **Descargas**: Disponible via GitHub
- 👥 **Contribuidores**: Activos
- 📅 **Última Actualización**: 26 Nov 2025

---

## 🎯 ¿Próximos Pasos?

**Para Nuevos Desarrolladores:**
1. Lee [INICIO_AQUI.md](./INICIO_AQUI.md)
2. Configura tu entorno local
3. Ejecuta `npm test` para verificar todo funciona
4. Comienza a explorar el código

**Para Deployment:**
1. Lee [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
2. Ejecuta [QUICK_START_DEPLOY.md](./QUICK_START_DEPLOY.md)
3. Verifica con health check: `curl https://easybots.store/health`

**Para Integración de Pagos:**
1. Lee [DAIMO_IMPLEMENTATION_SUMMARY.md](./DAIMO_IMPLEMENTATION_SUMMARY.md)
2. Configura variables de entorno
3. Ejecuta tests de pago
4. Deploy a producción

---

<div align="center">

**Made with ❤️ for the PNPtv community**

[⬆ Volver al Inicio](#-pnptv-bot---plataforma-premium-de-telegram)

</div>
