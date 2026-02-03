# 🚀 GUÍA RÁPIDA - Generador de Bots de Telegram

## 📦 ¿Qué contiene este repositorio?

Este repositorio incluye:

1. **PNPtv Bot** - Bot completo de gestión de suscriptores (código fuente)
2. **MASTER_BOT_PROMPT_TEMPLATE.md** - Template maestro para generar nuevos bots
3. **PROMPT_EXAMPLES.md** - 5 ejemplos concretos de diferentes tipos de bots
4. **QUICK_START_GUIDE.md** - Esta guía rápida

---

## ⚡ INICIO RÁPIDO - 3 PASOS

### Paso 1️⃣: Elige tu tipo de bot

Lee `PROMPT_EXAMPLES.md` y elige el ejemplo que más se parezca a tu negocio:

- 🍕 **Restaurante** - Pedidos, delivery, reservas
- 🏨 **Alojamiento** - Reservas tipo Airbnb
- 💆 **Servicios** - Citas, terapias, consultorías
- 🛍️ **Tienda** - E-commerce, productos físicos
- 🎫 **Tours** - Experiencias turísticas

¿No encuentras uno similar? Usa el template maestro y personaliza todas las variables.

---

### Paso 2️⃣: Genera las variables

**Opción A - Usar ejemplo predefinido:**

1. Abre `PROMPT_EXAMPLES.md`
2. Busca tu tipo de bot (ej: "EJEMPLO 1: Bot de Restaurante")
3. Copia todo el bloque de variables

**Opción B - Generar variables custom con IA:**

Usa este prompt en Mistral/Claude/ChatGPT:

```
Soy dueño de un negocio de [TU_NEGOCIO_AQUÍ].

Genera TODAS las variables {{VARIABLE}} necesarias para el MASTER_BOT_PROMPT_TEMPLATE.md, adaptadas a mi negocio.

Mi negocio:
- Tipo: [descripción breve]
- Usuarios: [quiénes lo usarán]
- Funcionalidad principal: [qué hace el bot]
- Features clave: [lista 3-5 features]

Dame un JSON estructurado con todos los valores.
```

**Ejemplo de respuesta que obtendrás:**

```json
{
  "TIPO_DE_NEGOCIO": "Salón de Belleza",
  "DESCRIPCION_NEGOCIO": "reservas de citas, gestión de estilistas y servicios de belleza",
  "nombre-bot": "beautybot",
  "modelo_principal": "appointmentModel",
  ...
}
```

---

### Paso 3️⃣: Genera el bot

1. **Abre `MASTER_BOT_PROMPT_TEMPLATE.md`**
2. **Copia todo el contenido**
3. **Reemplaza las variables `{{VARIABLE}}`** con los valores del Paso 2
   - Puedes hacerlo manualmente (buscar y reemplazar)
   - O usar el script helper (ver abajo)
4. **Pega el prompt completo en Mistral/Claude/ChatGPT**
5. **El LLM generará todo el código del bot paso a paso**

---

## 🛠️ MÉTODO AUTOMÁTICO - Script Helper

Si quieres automatizar el reemplazo de variables, usa el script helper:

### Instalación:

```bash
# Instalar Node.js (si no lo tienes)
# Luego ejecuta:
npm install -g bot-generator-helper
```

### Uso:

```bash
# 1. Crea un archivo con tus variables
cat > my-bot-vars.json << EOF
{
  "TIPO_DE_NEGOCIO": "Salón de Belleza",
  "DESCRIPCION_NEGOCIO": "reservas de citas para servicios de belleza",
  "nombre-bot": "beautybot",
  "modelo_principal": "appointmentModel"
}
EOF

# 2. Genera el prompt personalizado
bot-generate --template MASTER_BOT_PROMPT_TEMPLATE.md \
             --vars my-bot-vars.json \
             --output my-beauty-bot-prompt.md

# 3. Copia my-beauty-bot-prompt.md y pégalo en Mistral
```

---

## 🎯 FLUJO COMPLETO RECOMENDADO

### 1. Preparación (5 minutos)

- [ ] Define claramente qué hace tu bot
- [ ] Identifica los roles (user, admin, super_admin)
- [ ] Lista las 3-5 funcionalidades principales
- [ ] Decide qué features son premium vs free

### 2. Generación del Prompt (10 minutos)

**Opción A - Ejemplo predefinido:**
- [ ] Abre `PROMPT_EXAMPLES.md`
- [ ] Copia el ejemplo más cercano
- [ ] Personaliza los valores si es necesario

**Opción B - Prompt custom:**
- [ ] Usa el "Prompt para generar variables" (ver Paso 2 arriba)
- [ ] Revisa el JSON generado
- [ ] Ajusta valores manualmente si es necesario
- [ ] Reemplaza variables en el template

### 3. Generación del Bot (30-60 minutos)

- [ ] Pega el prompt completo en Mistral
- [ ] El LLM generará el código incrementalmente
- [ ] Revisa cada sección generada
- [ ] Haz preguntas/ajustes conforme avanza

### 4. Setup Local (15 minutos)

```bash
# Crea el proyecto
mkdir my-bot
cd my-bot
npm init -y

# Copia el código generado por el LLM
# Crea la estructura de carpetas
mkdir -p src/bot/{core,handlers,services,utils,api}
mkdir -p src/{models,config,utils}

# Instala dependencias (el LLM te dará la lista)
npm install telegraf@^4.15.0 dotenv@^16.3.1 \
  ioredis@^5.3.2 \
  express@^4.18.2 winston@^3.11.0

# Configura variables de entorno
cp .env.example .env
# Edita .env con tus valores
```

### 5. Configuración de Servicios (20 minutos)

- [ ] Crea proyecto en PostgreSQL
- [ ] Configura Redis (local o cloud)
- [ ] Obtén token de Telegram Bot (via @BotFather)
- [ ] Configura proveedores de pago
- [ ] Define IDs de super_admin y admin

### 6. Testing Local (15 minutos)

```bash
# Modo desarrollo (polling)
npm run dev

# Prueba en Telegram:
# 1. Busca tu bot
# 2. Envía /start
# 3. Completa onboarding
# 4. Prueba cada funcionalidad
# 5. Prueba panel de admin
```

### 7. Deployment (30 minutos)

```bash
# Railway (recomendado)
npm i -g railway
railway login
railway init
railway up

# Configura webhook en Telegram
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -d url=https://your-app.railway.app/pnp/webhook/telegram

# Verifica
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

### 8. Post-Deployment (10 minutos)

- [ ] Prueba bot en producción
- [ ] Verifica webhooks de pago funcionan
- [ ] Prueba flujo completo de pago
- [ ] Configura monitoreo (Sentry, logs)
- [ ] Documenta endpoints y configuración

---

## 📊 CHECKLIST DE VERIFICACIÓN

Antes de considerar tu bot completo, verifica:

### Funcionalidad Básica
- [ ] `/start` muestra onboarding
- [ ] Onboarding guarda datos correctamente
- [ ] Menú principal muestra todas las opciones
- [ ] Cambio de idioma funciona
- [ ] Perfil muestra datos del usuario

### Sistema de Roles
- [ ] Super admin puede acceder a `/admin`
- [ ] Admin puede acceder a funciones limitadas
- [ ] Premium user ve features premium
- [ ] Free user tiene limitaciones activas

### Panel de Admin
- [ ] Búsqueda de usuarios funciona
- [ ] Estadísticas muestran datos reales
- [ ] Broadcast envía mensajes correctamente
- [ ] Gestión de entidades principales funciona

### Pagos (si aplica)
- [ ] Usuario puede seleccionar plan
- [ ] Se genera URL de pago
- [ ] Webhook recibe confirmación
- [ ] Suscripción se activa automáticamente
- [ ] Usuario recibe notificación

### Performance
- [ ] Cache funciona (verificar Redis)
- [ ] Respuestas < 2 segundos
- [ ] No hay memory leaks
- [ ] Rate limiting bloquea spam

### Seguridad
- [ ] Variables de entorno configuradas
- [ ] Webhook signatures verificadas
- [ ] Inputs sanitizados
- [ ] HTTPS en producción

---

## 🐛 TROUBLESHOOTING

### Bot no responde

```bash
# Verifica que el bot esté corriendo
curl http://localhost:3000/health

# Verifica webhook
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo

# Revisa logs
tail -f logs/combined.log
```

### Webhooks no llegan

```bash
# Verifica URL pública
curl https://your-domain.com/health

# Webhook debe ser HTTPS
# Railway/Render proveen HTTPS automáticamente

# Re-setea webhook
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -d url=https://your-domain.com/pnp/webhook/telegram
```

### Pagos no se confirman

```bash
# Verifica que webhook de pago esté accesible
curl https://your-domain.com/api/webhooks/epayco

# Revisa logs de webhooks
grep "webhook" logs/combined.log

# Verifica firma en código (signature verification)

# Testea con webhook test en dashboard del proveedor
```

### Redis connection failed

```bash
# Verifica Redis local
redis-cli ping

# Verifica URL en .env
echo $REDIS_URL

# El bot debe funcionar sin Redis (fallback a in-memory)
# pero con performance reducida
```

---

## 🎓 RECURSOS ADICIONALES

### Documentación Oficial
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegraf Framework](https://telegraf.js.org/)
- [PostgreSQL](https://www.postgresql.org/docs/)
- [Redis](https://redis.io/docs/)

### Tutoriales Recomendados
- [Telegram Bot Best Practices](https://core.telegram.org/bots/features)
- [Node.js Security Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)
- [Webhook Security](https://www.twilio.com/blog/webhook-security-best-practices)

### Herramientas Útiles
- [BotFather](https://t.me/botfather) - Crear bots de Telegram
- [Postman](https://www.postman.com/) - Testear APIs
- [ngrok](https://ngrok.com/) - Túnel HTTPS local para testing
- [Redis Commander](https://joeferner.github.io/redis-commander/) - GUI para Redis

---

## 💡 TIPS PROFESIONALES

### 1. Desarrollo Incremental
No intentes construir todo de una vez. Orden recomendado:

1. ✅ Setup básico + onboarding
2. ✅ Menú principal + navegación
3. ✅ Sistema de roles
4. ✅ Feature principal del negocio
5. ✅ Sistema de pagos
6. ✅ Panel de admin
7. ✅ Features adicionales

### 2. Testing Continuo
Prueba cada feature antes de continuar:

```bash
# Usa modo development (polling)
npm run dev

# Interactúa con el bot en Telegram
# Revisa logs en tiempo real
tail -f logs/combined.log
```

### 3. Git desde el Inicio

```bash
git init
git add .
git commit -m "Initial commit - Bot skeleton"

# Crea commits después de cada feature
git commit -m "feat: add payment system"
git commit -m "feat: add admin panel"
```

### 4. Documentación en Paralelo

Documenta conforme desarrollas:
- Actualiza README.md con cada feature nueva
- Documenta configuraciones especiales
- Guarda ejemplos de .env
- Documenta decisiones arquitectónicas importantes

### 5. Monitoreo desde el Día 1

```bash
# Sentry para errores
npm install @sentry/node

# Winston para logs estructurados
npm install winston winston-daily-rotate-file

# Health checks
# Implementa /health endpoint desde el inicio
```

---

## 🎯 PRÓXIMOS PASOS

Ahora que tienes todo configurado:

1. **Genera tu primer bot** usando un ejemplo predefinido
2. **Pruébalo localmente** hasta que funcione perfectamente
3. **Despliega a producción** en Railway/Render
4. **Itera y mejora** basándote en feedback de usuarios
5. **Replica para otros negocios** usando el mismo template

---

## 🤝 SOPORTE

Si tienes preguntas o encuentras problemas:

1. Revisa la sección **TROUBLESHOOTING** arriba
2. Lee la documentación oficial de las herramientas
3. Revisa el código de **PNPtv bot** como referencia
4. Usa el LLM para debugging: "Tengo este error: [pega error], ¿cómo lo soluciono?"

---

## 📝 FEEDBACK

Si usas estos templates, comparte tu experiencia:
- ¿Qué tipo de bot creaste?
- ¿Qué features añadiste?
- ¿Qué mejorarías del template?

---

**¡Éxito con tu bot! 🚀**

Recuerda: El mejor momento para empezar fue ayer. El segundo mejor momento es ahora.
