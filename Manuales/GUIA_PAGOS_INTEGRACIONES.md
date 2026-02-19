# 💳 GUÍA CONSOLIDADA - PAGOS & INTEGRACIONES

**Consolidado de**:
- `EPAYCO_FUNCIONAMIENTO_Y_FIXES.md` (397 líneas)
- `DIAGNOSTICO_INTEGRACIONES_PAGO.md` (389 líneas)
- `USER_MANAGEMENT_API.md` (361 líneas)

**Versión**: 1.0
**Fecha**: 2026-02-13
**Estado**: Production Ready
**Clasificación**: OPERACIONAL - Pagos & Desarrolladores

---

## 📑 TABLA DE CONTENIDOS

1. [Sistema de Pagos Integrado](#sistema-de-pagos-integrado)
2. [ePayco: Funcionamiento Completo](#epayco-funcionamiento-completo)
3. [3D Secure (3DS)](#3d-secure-3ds)
4. [Flujo de Pago Detallado](#flujo-de-pago-detallado)
5. [Webhooks y Validación](#webhooks-y-validación)
6. [Troubleshooting de Pagos](#troubleshooting-de-pagos)
7. [Diagnóstico de Integraciones](#diagnóstico-de-integraciones)
8. [API de Gestión de Usuarios](#api-de-gestión-de-usuarios)

---

## SISTEMA DE PAGOS INTEGRADO

### Proveedores Soportados

| Proveedor | Tipo | Región | Moneda | Estado |
|-----------|------|--------|--------|--------|
| **ePayco** | Gateway | Latinoamérica | COP | ✅ Activo |
| **Daimo Pay** | Wallet | Colombia | COP | ✅ Activo |
| **Stripe** | Gateway | Mundial | USD/EUR | 📋 Planeado |

### Variables de Entorno

```bash
# ePayco
EPAYCO_PUBLIC_KEY=xxxxx           # Clave pública
EPAYCO_PRIVATE_KEY=xxxxx          # Clave privada (SECRET!)
EPAYCO_TEST_MODE=true/false       # Ambiente sandbox/producción

# Daimo Pay
DAIMO_API_KEY=xxxxx               # API key
DAIMO_SECRET=xxxxx                # Secret (webhook validation)

# Configuración general
PAYMENT_WEBHOOK_URL=https://pnptv.app/api/webhooks/epayco
```

---

## EPAYCO: FUNCIONAMIENTO COMPLETO

### ¿Qué es ePayco?

**ePayco** = Gateway de pago colombiano

```
Características:
├─ Soporta: Tarjetas crédito/débito
├─ Transferencias bancarias
├─ Pagos en efectivo (dataphone)
├─ 3D Secure 2.0 (Cardinal Commerce)
├─ Moneda: COP (Pesos colombianos)
├─ Región: Colombia + Latinoamérica
└─ Documentación: https://developer.epayco.co
```

### Endpoints de ePayco

| Método | Endpoint | Uso |
|--------|----------|-----|
| `POST` | `/payment/v1/charge/create` | Crear transacción |
| `GET` | `/payment/v1/charge/[refPayco]` | Consultar status |
| `POST` | `/bank/request/create` | Transferencia bancaria |

### Variables de Configuración

```javascript
// Inicializar cliente ePayco
const epayco = new epayco_client({
  apiKey: process.env.EPAYCO_PUBLIC_KEY,
  privateKey: process.env.EPAYCO_PRIVATE_KEY,
  lang: 'ES',  // ES o EN
  test: process.env.EPAYCO_TEST_MODE === 'true'  // CRÍTICO!
});
```

---

## 3D SECURE (3DS)

### ¿Qué es 3DS?

**3D Secure** = Autenticación adicional para tarjetas

```
Flujo tradicional:
Número tarjeta → Procesar → ✅ Pago

Flujo 3DS:
Número tarjeta → Enviar banco → Usuario verifica en app bancaria
                                → ✅ Pago o ❌ Rechazado
```

### Configuración en ePayco

**IMPORTANTE**: 3DS se configura en **ePayco Dashboard**, NO en código

```
Configuración en Dashboard:
├─ Ir a: Configuración → Seguridad → 3D Secure
├─ Habilitar: ☑ 3D Secure
├─ Activar: ✓
└─ Guardar cambios
```

### Cómo Activar 3DS en ePayco Dashboard

```
1. Login a https://secure.epayco.co
2. Menú: Configuración
3. Tab: Seguridad
4. Sección: 3D Secure
5. Click: "Habilitar"
6. Aceptar términos
7. Guardar
8. ✅ 3DS activado
```

### Código de Ejemplo (Crear Pago con 3DS)

```javascript
// Crear charge (pago) con 3DS
const charge = await epayco.charge.create({
  bank: "1070",  // Código banco
  doctype: "CC",  // Cédula Ciudadanía
  docnumber: "1234567890",
  name: "Juan Pérez",
  email: "juan@example.com",
  phone: "3001234567",
  bill: "INV-001",
  description: "30-Day Pass",
  value: "29.99",  // En COP
  currency: "COP",
  test: false,  // NO USAR test=true aquí, usa variable ENV
  three_d_secure: true,  // HABILITAR 3DS
  extra1: userId,
  extra2: planId,
  extra3: paymentId
});

// Respuesta cuando 3DS es requerido:
// {
//   "estado": "Pendiente",
//   "urlbanco": "https://...",  // Redirect aquí
//   "x_ref_payco": "ref123",
//   ...
// }
```

### Estados de Transacción 3DS

| Estado | Significado | Acción |
|--------|-----------|--------|
| `Aceptada` | Pago completado | ✅ Activar suscripción |
| `Rechazada` | Usuario rechazó | ❌ Notificar usuario |
| `Pendiente` | Esperando autenticación | ⏳ Mostrar URL de banco |

### Flujo Cuando 3DS es Requerido

```
1. Usuario hace clic "Pagar"
   ↓
2. Backend crea charge en ePayco
   ↓
3. ePayco responde: "Pendiente" + urlbanco
   ↓
4. Enviar a usuario: "Completa verificación en tu banco"
   ↓
5. Mostrar URL de ePayco (iframe o nueva pestaña)
   ↓
6. Usuario autentica en app bancaria
   ↓
7. ePayco redirige a callback
   ↓
8. Backend valida webhook de ePayco
   ↓
9. Si "Aceptada" → Activar suscripción
```

---

## FLUJO DE PAGO DETALLADO

### Paso 1: Usuario Selecciona Plan

```
Bot de Telegram → Usuario: /plans
   ↓
Bot muestra: 7-Day Pass ($X), 30-Day Pass ($Y), etc.
   ↓
Usuario click: "Comprar 30-Day Pass"
   ↓
Bot crea Payment (BD): status = "pending"
```

### Paso 2: Enviar a Landing Page

```
Bot genera URL:
https://pnptv.app/payment/{paymentId}
   ↓
Bot envía: "Click aquí para pagar: [enlace]"
   ↓
Usuario hace click → Navegador abre landing page
```

### Paso 3: Landing Page (Frontend)

**Archivo**: `public/payment-checkout.html`

```html
1. GET /api/payment/{paymentId}
   → Backend devuelve detalles del plan
   ↓
2. Mostrar resumen:
   ├─ Icono del plan
   ├─ Nombre
   ├─ Precio
   └─ Características
   ↓
3. Formulario:
   ├─ Nombre
   ├─ Email
   ├─ Tipo documento (CC/Pasaporte/etc)
   └─ Número documento
   ↓
4. Usuario completa formulario
   ↓
5. Click: "Pagar"
```

### Paso 4: Inicializar ePayco SDK

```javascript
// En landing page (frontend)
const epayco_settings = {
  key: "PUBLIC_KEY_FROM_ENV",  // No incluir SECRET!
  test: false  // Producción
};

epayco.checkout({
  name: "30-Day Pass",
  description: "Suscripción 30 días",
  currency: "COP",
  amount: "29990",  // En centavos (COP)
  email: formData.email,
  external: paymentId,
  invoice: paymentId,
  confirmation: "https://pnptv.app/api/webhooks/epayco",
  response: "https://pnptv.app/payment/success",
  ...
});
```

### Paso 5: Usuario Entra Datos Tarjeta

```
Popup ePayco:
├─ Número tarjeta
├─ Vigencia (MM/YY)
├─ CVC
└─ Nombre titular

Importante: Datos NO pasan por nuestro servidor
(PCI DSS compliance)
```

### Paso 6: Autenticación 3DS (Si Aplica)

```
Si 3DS configurado en dashboard:
   ↓
1. ePayco verifica con banco
2. Si necesario → Redirige a app bancaria
3. Usuario verifica (biometría/PIN)
4. Banco confirma a ePayco
5. ePayco procesa pago
```

### Paso 7: Webhook de ePayco

**POST**: `/api/webhooks/epayco`

```javascript
{
  x_transaction_state: "Aceptada",      // Éxito
  x_ref_payco: "123456789",             // ID único
  x_approval_code: "123456",            // Código aprobación
  x_amount: "29990",                    // Monto en centavos
  x_currency_code: "COP",
  x_extra1: userId,
  x_extra2: planId,
  x_extra3: paymentId,
  x_customer_email: "juan@example.com",
  x_signature: "SHA256HASH"             // Validar!
}
```

### Paso 8: Validar y Procesar

```javascript
// En backend

// 1. VALIDAR FIRMA
const isValid = validateSignature(payload, privateKey);
if (!isValid) {
  logger.error('WEBHOOK INVÁLIDO - POSIBLE ATAQUE');
  return 403;  // Rechazar
}

// 2. ACTUALIZAR PAYMENT
await Payment.update(paymentId, {
  status: 'completed',
  epayco_ref: x_ref_payco,
  transaction_state: x_transaction_state
});

// 3. ACTIVAR SUSCRIPCIÓN
if (x_transaction_state === 'Aceptada') {
  await User.updateSubscription(userId, {
    status: 'active',
    planId: planId,
    expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  });
}

// 4. ENVIAR NOTIFICACIONES
await emailService.sendInvoiceEmail(...)
await bot.telegram.sendMessage(userId, '✅ Pago recibido!')
await businessNotificationService.notifyPayment(...)

// 5. RESPONDER a ePayco
return 200;  // OK
```

---

## WEBHOOKS Y VALIDACIÓN

### Validación de Firma SHA256

```javascript
// Estructura del payload a validar
const stringToSign =
  x_ref_payco +
  '^' +
  x_transaction_state +
  '^' +
  x_amount +
  '^' +
  x_currency_code +
  '^' +
  x_approval_code +
  '^' +
  privateKey;

// Calcular SHA256
const calculatedSignature = sha256(stringToSign).toUpperCase();

// Comparar
if (calculatedSignature !== x_signature) {
  logger.error('FIRMA INVÁLIDA');
  return 403;
}
```

### Seguridad de Webhooks

```
✅ SÍ:
├─ Validar firma SHA256 de todos los webhooks
├─ Usar HTTPS (TLS 1.2+)
├─ Revisar x_transaction_state
├─ Registrar todos los webhooks recibidos
└─ Retry si falla procesamiento

❌ NO:
├─ Confiar en headers (pueden falsificarse)
├─ Usar HTTP sin encriptación
├─ Procesar sin validación
└─ Olvidar registrar para auditoría
```

---

## TROUBLESHOOTING DE PAGOS

### ❌ Problema: "Tarjeta Rechazada"

**Mensaje ePayco**: `Tarjeta restringida por el centro de autorizaciones`

**Causa más común**: `EPAYCO_TEST_MODE` configurado incorrectamente

**Solución**:
```bash
# Si usas tarjetas de TEST (4111111111111111):
EPAYCO_TEST_MODE=true

# Si usas tarjetas REALES:
EPAYCO_TEST_MODE=false
```

**Verificar**:
```javascript
console.log('Test mode:', process.env.EPAYCO_TEST_MODE);
```

---

### ❌ Problema: "Webhook no recibido"

**Síntoma**: Pago completado en ePayco pero suscripción no se activa

**Causas posibles**:
1. URL de webhook incorrecta
2. Firewall bloqueando
3. SSL certificate inválido
4. Banda ancha del servidor

**Verificar**:
```bash
# 1. URL configurada en ePayco
Login → Configuración → Integraciones → Webhooks
URL debe ser: https://pnptv.app/api/webhooks/epayco

# 2. SSL válido
curl -I https://pnptv.app/api/webhooks/epayco
# Debe responder 200/405 (no 502/SSL error)

# 3. Logs del servidor
tail -f /app/logs/webhook.log
# Buscar: "Webhook received"
```

**Solución**:
```
1. Actualizar URL en ePayco Dashboard
2. Esperar propagación (5-10 min)
3. Reintentar pago
```

---

### ❌ Problema: "3DS no funciona"

**Síntoma**: Pago completado SIN enviar a banco

**Causa**: 3DS no habilitado en ePayco Dashboard

**Solución**:
```
1. Login a ePayco: https://secure.epayco.co
2. Configuración → Seguridad
3. Buscar: "3D Secure"
4. Click: "Habilitar"
5. Guardar
6. Esperar 5 minutos
7. Reintentar pago
```

---

### ❌ Problema: "Webhook con firma inválida"

**Síntoma**: 🚨 ALERTA DE SEGURIDAD en logs

**Mensaje**: `FIRMA INVÁLIDA - POSIBLE ATAQUE`

**Causa**:
- Webhook falsificado (ataque)
- Private key incorrecta en BD
- Versión antigua de ePayco-SDK

**Acción**:
```
1. ALERTAR a admin inmediatamente
2. Revisar IP de webhook
3. Verificar EPAYCO_PRIVATE_KEY
4. Revisar logs de ePayco Dashboard
5. Si es ataque → Contactar a ePayco
```

---

## DIAGNÓSTICO DE INTEGRACIONES

### API de Estado

**Endpoint**: `GET /api/payments/health`

```json
{
  "epayco": {
    "status": "connected",
    "test_mode": false,
    "last_sync": "2026-02-13T14:30:00Z"
  },
  "daimo": {
    "status": "connected",
    "last_sync": "2026-02-13T14:25:00Z"
  },
  "database": {
    "status": "ok",
    "connections": 5
  }
}
```

### Verificación de Configuración

```bash
# Verificar variables
echo $EPAYCO_PUBLIC_KEY     # No debe estar vacío
echo $EPAYCO_TEST_MODE      # Debe ser true o false
echo $PAYMENT_WEBHOOK_URL   # Debe ser HTTPS

# Verificar conectividad
curl -X GET https://api.epayco.co/health
# Esperar: 200 OK
```

---

## API DE GESTIÓN DE USUARIOS

### Endpoints Principales

#### **GET** `/api/users/:id`

Obtener información de usuario

```bash
curl -H "Authorization: Bearer TOKEN" \
  https://pnptv.app/api/users/123456789
```

**Response**:
```json
{
  "id": 123456789,
  "username": "@juan",
  "email": "juan@example.com",
  "subscription_status": "active",
  "plan_id": "30-day-pass",
  "plan_expiry": "2026-03-13T14:30:00Z",
  "tier": "Prime"
}
```

#### **PUT** `/api/users/:id`

Actualizar usuario

```bash
curl -X PUT \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nuevo@example.com",
    "subscription_status": "free"
  }' \
  https://pnptv.app/api/users/123456789
```

#### **POST** `/api/users/:id/extend-subscription`

Extender suscripción

```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "days": 30,
    "reason": "admin-extension"
  }' \
  https://pnptv.app/api/users/123456789/extend-subscription
```

#### **POST** `/api/users/:id/activate-code`

Activar código promocional

```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "PROMO2026"
  }' \
  https://pnptv.app/api/users/123456789/activate-code
```

### Autenticación

```
Header: Authorization: Bearer [JWT_TOKEN]

Obtener token:
POST /api/auth/login
{
  "username": "admin",
  "password": "password"
}

Response:
{
  "token": "eyJhbGc..."
}
```

---

## CHECKLIST DE PAYOS EN PRODUCCIÓN

```
CONFIGURACIÓN:
[ ] EPAYCO_PUBLIC_KEY configurada
[ ] EPAYCO_PRIVATE_KEY configurada (SECRET!)
[ ] EPAYCO_TEST_MODE = false
[ ] PAYMENT_WEBHOOK_URL = https://...

INTEGRACIONES:
[ ] ePayco cuenta activa
[ ] 3DS habilitado en Dashboard
[ ] Webhook URL registrada en ePayco
[ ] Certificado SSL válido

VERIFICACIONES:
[ ] Pago de prueba completado exitosamente
[ ] Webhook recibido en backend
[ ] Suscripción activada automáticamente
[ ] Email de factura enviado
[ ] Notificación en Telegram recibida
[ ] Admin notificado

SEGURIDAD:
[ ] Firma SHA256 validada
[ ] Private key no en logs
[ ] Rate limiting activo
[ ] Inputs sanitizados
[ ] HTTPS forzado
```

---

**Para Infraestructura**: Ver `GUIA_INFRAESTRUCTURA_SEGURIDAD.md`

**Para Despliegue**: Ver `GUIA_DESPLIEGUE_OPERACIONES.md`

**Para Referencia Rápida**: Ver `REFERENCIA_RAPIDA.md`
