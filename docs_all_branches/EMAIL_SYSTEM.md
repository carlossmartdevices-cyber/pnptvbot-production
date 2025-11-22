# Sistema de Emails Dual - PNPtv

## 📧 Descripción General

El sistema de emails de PNPtv está configurado para enviar **dos emails automáticos** con cada compra exitosa, cada uno desde un dominio diferente para propósitos específicos:

### 1. Email de Factura (Invoice) 💼
- **Dominio:** `easybots.store`
- **De:** `billing@easybots.store`
- **Propósito:** Enviar factura de pago
- **Contenido:**
  - Número de factura
  - Detalles del plan
  - Monto pagado
  - Fecha de transacción
  - PDF adjunto (opcional)

### 2. Email de Bienvenida (Welcome) 🎬
- **Dominio:** `pnptv.app`
- **De:** `welcome@pnptv.app`
- **Propósito:** Dar bienvenida e instrucciones de acceso
- **Contenido:**
  - Bienvenida personalizada
  - Detalles de la suscripción
  - Instrucciones de acceso al bot
  - Características del servicio
  - Enlace directo al bot de Telegram

## 🔧 Configuración

### Variables de Entorno Requeridas

#### EasyBots (Facturación)
```bash
EASYBOTS_SMTP_HOST=smtp.gmail.com          # Servidor SMTP
EASYBOTS_SMTP_PORT=587                      # Puerto SMTP
EASYBOTS_SMTP_SECURE=false                  # TLS (false para 587, true para 465)
EASYBOTS_SMTP_USER=billing@easybots.store   # Usuario SMTP
EASYBOTS_SMTP_PASS=your_password            # Contraseña SMTP
EASYBOTS_FROM_EMAIL=billing@easybots.store  # Email de origen
```

#### PNPtv (Bienvenida)
```bash
PNPTV_SMTP_HOST=smtp.gmail.com              # Servidor SMTP
PNPTV_SMTP_PORT=587                         # Puerto SMTP
PNPTV_SMTP_SECURE=false                     # TLS (false para 587, true para 465)
PNPTV_SMTP_USER=welcome@pnptv.app           # Usuario SMTP
PNPTV_SMTP_PASS=your_password               # Contraseña SMTP
PNPTV_FROM_EMAIL=welcome@pnptv.app          # Email de origen
```

### Proveedores SMTP Compatibles

El sistema usa **nodemailer** y es compatible con cualquier servidor SMTP:

- ✅ Gmail (smtp.gmail.com)
- ✅ SendGrid (smtp.sendgrid.net)
- ✅ Amazon SES
- ✅ Mailgun
- ✅ Postmark
- ✅ Servidor SMTP personalizado

## 📨 Flujo de Envío

```
Pago Exitoso (ePayco Webhook)
       ↓
Activar Suscripción
       ↓
Crear/Actualizar Subscriber
       ↓
┌──────────────────────────────┐
│  Enviar Emails en Paralelo   │
├──────────────────────────────┤
│                              │
│  1. Email de Factura         │
│     └─ easybots.store        │
│                              │
│  2. Email de Bienvenida      │
│     └─ pnptv.app             │
│                              │
└──────────────────────────────┘
       ↓
Webhook retorna success
```

## 💻 Uso Programático

### Enviar Email de Factura

```javascript
const EmailService = require('./services/emailservice');

await EmailService.sendInvoiceEmail({
  to: 'customer@example.com',
  customerName: 'Juan Pérez',
  invoiceNumber: 'INV-12345',
  amount: 29.99,
  planName: 'Premium Monthly',
  invoicePdf: pdfBuffer, // Optional
});
```

### Enviar Email de Bienvenida

```javascript
await EmailService.sendWelcomeEmail({
  to: 'customer@example.com',
  customerName: 'Juan Pérez',
  planName: 'Premium Monthly',
  duration: 30,
  expiryDate: new Date('2025-12-31'),
  language: 'es', // 'es' o 'en'
});
```

## 🌐 Soporte Multiidioma

Los emails de bienvenida están disponibles en **inglés** y **español**:

- **Español (es):** Texto en español, formato de fecha español
- **English (en):** English text, US date format

El idioma se determina automáticamente desde:
1. Parámetro `language` explícito
2. Campo `user.language` en la base de datos
3. Default: español ('es')

## 🎨 Plantillas de Email

### Email de Factura
- Diseño profesional corporativo
- Colores: Púrpura (#667eea)
- Incluye logo de Easy Bots
- Tabla de detalles de factura
- Footer con información de contacto

### Email de Bienvenida
- Diseño moderno y atractivo
- Gradiente púrpura (667eea → 764ba2)
- Badge de bienvenida
- Instrucciones paso a paso
- Lista de características
- Botón CTA para abrir el bot
- Footer con información de contacto

## 🔒 Manejo de Errores

El sistema está diseñado para ser **no-crítico**:
- Si falla el envío de emails, **no bloquea el webhook**
- Los errores se registran en logs pero no afectan la activación de suscripción
- Cada email se envía en su propio bloque `try-catch`
- Los fallos se loguean como "non-critical"

```javascript
try {
  await EmailService.sendInvoiceEmail({...});
} catch (emailError) {
  logger.error('Error sending invoice email (non-critical):', {
    error: emailError.message,
  });
  // El webhook continúa exitosamente
}
```

## 📊 Logs y Monitoreo

### Logs de Éxito
```
Invoice email sent successfully { to: 'customer@example.com', invoiceNumber: 'INV-12345', messageId: '<...>' }
Welcome email sent successfully { to: 'customer@example.com', planId: 'premium_monthly', language: 'es', messageId: '<...>' }
```

### Logs de Error
```
Error sending invoice email (non-critical): { error: 'Connection timeout', refPayco: 'ABC123' }
Error sending welcome email (non-critical): { error: 'Invalid credentials', refPayco: 'ABC123' }
```

### Logs de Configuración
```
EasyBots email transporter initialized
PNPtv email transporter initialized
```

## 🧪 Testing

### Verificar Configuración
```bash
# Los logs de inicio mostrarán:
EasyBots email transporter initialized
PNPtv email transporter initialized

# Si no está configurado:
EasyBots SMTP not configured, invoice emails will not be sent
PNPtv SMTP not configured, welcome emails will not be sent
```

### Test Manual
```javascript
// En un script de test
const EmailService = require('./src/bot/services/emailservice');

// Test invoice
await EmailService.sendInvoiceEmail({
  to: 'test@example.com',
  customerName: 'Test User',
  invoiceNumber: 'TEST-001',
  amount: 10.00,
  planName: 'Test Plan',
});

// Test welcome
await EmailService.sendWelcomeEmail({
  to: 'test@example.com',
  customerName: 'Test User',
  planName: 'Test Plan',
  duration: 30,
  expiryDate: new Date(),
  language: 'es',
});
```

## 🔐 Seguridad

### Mejores Prácticas
1. **Usa contraseñas de aplicación** (no contraseñas de usuario regular)
2. **Habilita 2FA** en las cuentas de email
3. **Configura SPF/DKIM/DMARC** para los dominios
4. **Usa variables de entorno** para credenciales
5. **Monitorea logs** de envíos fallidos

### Gmail App Passwords
Si usas Gmail:
1. Habilita 2FA en tu cuenta
2. Ve a https://myaccount.google.com/apppasswords
3. Genera una contraseña de aplicación
4. Usa esa contraseña en `SMTP_PASS`

## 📋 Checklist de Configuración

- [ ] Configurar SMTP para EasyBots
- [ ] Configurar SMTP para PNPtv
- [ ] Agregar variables de entorno al servidor
- [ ] Verificar DNS (SPF/DKIM/DMARC)
- [ ] Ejecutar `npm install` para instalar nodemailer
- [ ] Reiniciar el bot para aplicar cambios
- [ ] Verificar logs de inicialización
- [ ] Realizar prueba de pago en modo test
- [ ] Confirmar recepción de ambos emails
- [ ] Verificar que los emails no lleguen a spam

## 🛠️ Troubleshooting

### Los emails no se envían
1. Verificar que las variables de entorno estén configuradas
2. Revisar logs: `EasyBots email transporter initialized`
3. Verificar credenciales SMTP
4. Verificar que el puerto no esté bloqueado (587/465)

### Los emails llegan a spam
1. Configurar SPF record en DNS
2. Configurar DKIM signing
3. Configurar DMARC policy
4. Usar dominios verificados
5. Evitar lenguaje spam en asuntos

### Error "Invalid login"
1. Verificar usuario/contraseña SMTP
2. Si es Gmail, usar App Password
3. Verificar que la cuenta no esté bloqueada

### Error "Connection timeout"
1. Verificar firewall no bloquea puerto SMTP
2. Verificar SMTP_HOST es correcto
3. Intentar puerto alternativo (465 vs 587)

## 📚 Referencias

- [Nodemailer Documentation](https://nodemailer.com/)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)
- [SPF Records](https://www.cloudflare.com/learning/dns/dns-records/dns-spf-record/)
- [DKIM Configuration](https://www.cloudflare.com/learning/dns/dns-records/dns-dkim-record/)
