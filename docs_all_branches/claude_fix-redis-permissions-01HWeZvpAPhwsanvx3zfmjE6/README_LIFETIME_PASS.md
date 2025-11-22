# 🔥 PNPtv Lifetime Pass System

Sistema completo de landing page + bot de Telegram para vender membresías permanentes de PNPtv.

## 🎯 ¿Qué es esto?

Este sistema te permite vender acceso permanente a PNPtv a través de una landing page profesional que se integra automáticamente con tu bot de Telegram. Los clientes compran, reciben un código, lo activan en el bot, y obtienen acceso de por vida.

## ✨ Características

- 🌐 **Landing page bilingüe** (Español/Inglés) con diseño moderno
- 💳 **Múltiples enlaces de pago** con gestión automática
- 🔑 **Códigos de activación únicos** generados automáticamente
- 🤖 **Activación instantánea** vía comando de Telegram
- 📊 **Tracking completo** en Firestore
- 🔒 **Seguridad integrada** con validaciones
- 📱 **100% responsive** para móviles

## 📸 Preview

```
┌─────────────────────────────────────────┐
│  🔥 PNPtv Lifetime Pass 🔥              │
│  Paga una vez. Acceso para siempre.    │
│                                         │
│  🇪🇸 Español   🇺🇸 English             │
│                                         │
│  💎 Acceso de Por Vida                  │
│       $80 USD                           │
│  Pago único - Sin renovaciones          │
│                                         │
│  📹 Videos HD/4K                        │
│  🔥 Contenido PNP Real                  │
│  📍 Quién Está Cerca                    │
│  🤖 Bot Avanzado                        │
│                                         │
│  [💳 Pagar Ahora 1]                     │
│  [💳 Pagar Ahora 2]                     │
│  [💳 Pagar Ahora 3]                     │
│                                         │
│  🔑 Activación Post-Pago                │
│  Envía tu código a @pnptv_bot           │
└─────────────────────────────────────────┘
```

## 🚀 Quick Start

### 1. Configuración Básica

```bash
# 1. Configurar Firebase
nano public/firebase-config.js
# (Pega tus credenciales de Firebase)

# 2. Ejecutar setup
node scripts/setup-lifetime-pass.js

# 3. Reiniciar bot
docker-compose down && docker-compose build bot && docker-compose up -d
```

### 2. Acceder a la Landing Page

```
http://localhost:3000/lifetime-pass
```

### 3. Generar Códigos para Clientes

```bash
node scripts/setup-lifetime-pass.js generate-codes cliente@email.com
```

### 4. Cliente Activa Membresía

```
1. Cliente abre Telegram
2. Busca @pnptv_bot
3. Envía: /activate ABC123XYZ
4. ✅ Membresía activada!
```

## 📁 Estructura de Archivos

```
pnptvbot-production/
│
├── public/
│   ├── lifetime-pass.html          # Landing page principal
│   └── firebase-config.js          # Configuración de Firebase
│
├── src/bot/handlers/payments/
│   ├── index.js                    # Handler de pagos
│   └── activation.js               # Handler de activación (/activate)
│
├── scripts/
│   ├── setup-lifetime-pass.js      # Script de configuración
│   ├── email-template.html         # Template de email (ES)
│   └── email-template-en.html      # Template de email (EN)
│
├── docs/
│   ├── LIFETIME_PASS_SETUP.md      # Documentación completa
│   └── firestore.rules             # Reglas de seguridad
│
├── LIFETIME_PASS_QUICKSTART.md     # Guía rápida
└── README_LIFETIME_PASS.md         # Este archivo
```

## 🗄️ Colecciones de Firestore

El sistema usa 3 colecciones:

### 1. `paymentLinks`
Almacena enlaces de pago disponibles.

```javascript
{
  url: "https://pay.example.com/abc123",
  used: false,
  product: "lifetime-pass",
  price: 80,
  currency: "USD",
  createdAt: Timestamp
}
```

### 2. `activationCodes`
Códigos únicos de activación.

```javascript
{
  code: "A1B2C3D4E5F6",
  product: "lifetime-pass",
  used: false,
  email: "customer@example.com",
  createdAt: Timestamp,
  usedAt: null,
  usedBy: null
}
```

### 3. `activationLogs`
Registro de todas las activaciones.

```javascript
{
  userId: 123456789,
  username: "usuario",
  code: "A1B2C3D4E5F6",
  product: "lifetime-pass",
  activatedAt: Timestamp,
  success: true
}
```

## 🛠️ Scripts Disponibles

### Setup Inicial
```bash
node scripts/setup-lifetime-pass.js
```
Crea las colecciones y datos de ejemplo.

### Agregar Enlaces de Pago
```bash
node scripts/setup-lifetime-pass.js add-links \
  https://pay.example.com/link1 \
  https://pay.example.com/link2
```

### Generar Códigos de Activación
```bash
# Un código
node scripts/setup-lifetime-pass.js generate-codes customer@email.com

# Múltiples códigos
node scripts/setup-lifetime-pass.js generate-codes \
  customer1@email.com \
  customer2@email.com \
  customer3@email.com
```

## 🤖 Comandos del Bot

### `/activate CODE`
Activa una membresía usando un código.

```
/activate A1B2C3D4E5F6
```

### `/checkcode CODE` (Admin only)
Verifica el estado de un código.

```
/checkcode A1B2C3D4E5F6
```

## 🔄 Workflow Completo

```
1. Cliente visita landing page
   ↓
2. Hace clic en enlace de pago
   ↓
3. Completa el pago
   ↓
4. Recibes notificación de pago
   ↓
5. Generas código de activación
   ↓
6. Envías código por email al cliente
   ↓
7. Cliente abre Telegram y envía /activate CODE
   ↓
8. Bot valida y activa membresía
   ↓
9. Cliente obtiene acceso permanente
```

## 📧 Envío de Emails

Usa los templates en `/scripts/`:

- `email-template.html` (Español)
- `email-template-en.html` (English)

Reemplaza `{{ACTIVATION_CODE}}` con el código generado.

## 🔒 Seguridad

### Configuración de Firestore Rules

Copia las reglas de `/docs/firestore.rules` a Firebase Console.

**Opción Recomendada:** Server-side only

```javascript
match /paymentLinks/{linkId} {
  allow read: if true;
  allow write: if false;
}

match /activationCodes/{code} {
  allow read, write: if false;
}
```

### Validaciones del Bot

- ✅ Código alfanumérico 6-20 caracteres
- ✅ Verificación de código existente
- ✅ Verificación de uso previo
- ✅ Verificación de expiración
- ✅ Logging completo
- ✅ Rollback automático en caso de error

## 🎨 Personalización

### Cambiar Precio

Edita `public/lifetime-pass.html`:

```html
<div class="price">$80 USD</div>
```

### Cambiar URL del Bot

Edita `public/lifetime-pass.html`:

```html
<a href="https://t.me/TU_BOT">
```

### Cambiar Colores

Edita estilos en `public/lifetime-pass.html`:

```css
/* Gradiente principal */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Gradiente de precio */
background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);

/* Color dorado */
color: #ffd700;
```

## 📊 Monitoreo

### Ver Activaciones Recientes

Firebase Console → Firestore → `activationLogs`

```
Ordenar por: activatedAt (desc)
Filtrar: success == true
```

### Ver Códigos Disponibles

```
Collection: activationCodes
Filtrar: used == false
```

### Ver Enlaces Disponibles

```
Collection: paymentLinks
Filtrar: used == false
Filtrar: product == "lifetime-pass"
```

## 🐛 Troubleshooting

### Landing page no carga
```bash
# Verifica que el servidor esté corriendo
docker logs pnptv-bot

# Verifica Firebase config
cat public/firebase-config.js
```

### Código no funciona
```bash
# Verifica el código en Firestore
# Firebase Console → Firestore → activationCodes → [CODIGO]

# Usa /checkcode como admin
/checkcode ABC123
```

### Bot no responde
```bash
# Ver logs
docker logs pnptv-bot --tail 100 -f

# Reiniciar bot
docker-compose restart bot
```

## 📚 Documentación

- **Quick Start:** [LIFETIME_PASS_QUICKSTART.md](LIFETIME_PASS_QUICKSTART.md)
- **Documentación Completa:** [docs/LIFETIME_PASS_SETUP.md](docs/LIFETIME_PASS_SETUP.md)
- **Firestore Rules:** [docs/firestore.rules](docs/firestore.rules)

## ✅ Checklist de Producción

- [ ] Actualizar `firebase-config.js` con credenciales reales
- [ ] Configurar Firestore security rules
- [ ] Agregar enlaces de pago reales
- [ ] Configurar HTTPS/SSL
- [ ] Actualizar URL del bot en landing page
- [ ] Probar activación end-to-end
- [ ] Configurar envío de emails
- [ ] Configurar monitoreo
- [ ] Backup de Firestore
- [ ] Documentar proceso interno

## 🚦 URLs

En producción:

- Landing page: `https://tu-dominio.com/`
- Lifetime pass: `https://tu-dominio.com/lifetime-pass`
- Promo: `https://tu-dominio.com/promo`
- Health check: `https://tu-dominio.com/health`

## 🔧 Configuración Avanzada

### Automatizar Generación de Códigos

Crea un webhook que genere códigos automáticamente después de cada pago.

### Integrar con Email Service

Configura SendGrid, Mailgun o AWS SES para envío automático de emails.

### Analytics

Agrega Google Analytics o Mixpanel para tracking de conversiones.

## 💡 Tips

1. **Genera códigos inmediatamente** después de recibir confirmación de pago
2. **Monitorea activaciones** diariamente en Firestore
3. **Mantén enlaces frescos** - agrega nuevos enlaces regularmente
4. **Backup Firestore** - configura backups automáticos
5. **Testing** - prueba el flujo completo antes de lanzar

## 🆘 Soporte

- 📖 Documentación: `/docs/LIFETIME_PASS_SETUP.md`
- 🐛 Logs: `docker logs pnptv-bot`
- 🔥 Firebase Console: https://console.firebase.google.com
- 💬 Issues: https://github.com/tu-repo/issues

## 📈 Roadmap

Próximas funcionalidades:

- [ ] Dashboard de administración
- [ ] Generación automática de códigos post-pago
- [ ] Integración con Stripe/PayPal
- [ ] Sistema de emails automatizado
- [ ] Analytics dashboard
- [ ] Códigos con descuento
- [ ] Sistema de referidos
- [ ] API REST completa

## 📝 Changelog

### v1.0.0 (2024-11-16)
- ✅ Landing page bilingüe completa
- ✅ Sistema de activación con códigos
- ✅ Integración con Telegram bot
- ✅ Scripts de administración
- ✅ Documentación completa
- ✅ Templates de email
- ✅ Firestore security rules

## 📄 Licencia

MIT License - Ver LICENSE file para más detalles.

## 👥 Créditos

Desarrollado para PNPtv Team.

---

**¿Necesitas ayuda?** Lee la [documentación completa](docs/LIFETIME_PASS_SETUP.md) o contacta al equipo de desarrollo.
