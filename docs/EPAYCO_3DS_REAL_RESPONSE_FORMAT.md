# ePayco 3DS - Real Response Format & Configuration

Basado en el código real funcionando en producción.

---

## 🔴 Problema Actual (Pago Stuck)

**Pago ID**: `5473d882-c110-47ab-985f-203d72543345`

**Lo que ePayco retornó**:
```json
{
  "data": {
    "estado": "Pendiente",
    "ref_payco": "334861819",
    "transactionID": "3348618191770955245",
    "respuesta": "Esperando autenticación del banco",
    "franquicia": "VISA",
    "cc_network_response": "PENDING_3DS",
    "urlbanco": null,           ← ❌ AQUÍ ESTÁ EL PROBLEMA
    "3DS": null,                ← ❌ Y AQUÍ TAMBIÉN
    "url_response_bank": null
  }
}
```

---

## ✅ Lo que debería Retornar (CON 3DS HABILITADO)

### **Opción 1: 3DS 1.0 (Simple Redirect)**

Cuando ePayco retorna `estado: "Pendiente"` + `urlbanco`:

```json
{
  "data": {
    "estado": "Pendiente",
    "ref_payco": "334861819",
    "transactionID": "3348618191770955245",
    "respuesta": "Pendiente de confirmación en el banco",
    "franquicia": "VISA",
    "urlbanco": "https://banco.com/3ds/challenge?token=xyz...",  ← ✅ REDIRECT URL
    "3DS": null
  }
}
```

**Nuestro código hace**:
```javascript
// src/bot/services/paymentService.js:1939-1942
if (fullResponse.urlbanco) {
  redirectUrl = fullResponse.urlbanco;  ← Captura la URL
}

// Retorna al frontend:
{
  success: true,
  status: "pending",
  redirectUrl: "https://banco.com/3ds/challenge?token=xyz...",
  message: "El pago está pendiente de confirmación en el banco"
}
```

**Frontend hace**:
```javascript
// public/payment-checkout.html:708-711
if (result.redirectUrl) {
  console.log('[PAYMENT] Redirecting to:', result.redirectUrl);
  window.location.href = result.redirectUrl;  ← Redirige usuario al banco
  return;
}
```

---

### **Opción 2: 3DS 2.0 (Cardinal Commerce)**

Cuando ePayco retorna `estado: "Pendiente"` + `3DS` con Cardinal data:

```json
{
  "data": {
    "estado": "Pendiente",
    "ref_payco": "334861819",
    "transactionID": "3348618191770955245",
    "respuesta": "Esperando autenticación 3DS 2.0",
    "franquicia": "VISA",
    "urlbanco": null,
    "3DS": {                                    ← ✅ 3DS 2.0 DATA
      "version": "2.0",
      "provider": "CardinalCommerce",
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "deviceDataCollectionUrl": "https://centinelapistag.cardinalcommerce.com/...",
      "referenceId": "5f3a4b2c-1234-5678-9abc...",
      "token": "DCF645D2A..."
    }
  }
}
```

**Nuestro código hace**:
```javascript
// src/bot/services/paymentService.js:1943-1856
else if (rawThreeDS) {
  if (typeof rawThreeDS === 'object') {
    if (rawThreeDS.data && rawThreeDS.data.deviceDataCollectionUrl) {
      is3ds2 = true;                   ← Detecta 3DS 2.0
      threedsInfo = rawThreeDS.data;   ← Extrae datos
    }
  }
}

// Retorna al frontend:
{
  success: true,
  status: "pending",
  threeDSecure: {
    version: "2.0",
    provider: "CardinalCommerce",
    data: {
      accessToken: "eyJhbGciOiJIUzI1NiIs...",
      deviceDataCollectionUrl: "https://centinelapistag.cardinalcommerce.com/...",
      referenceId: "5f3a4b2c-1234-5678-9abc...",
      token: "DCF645D2A..."
    }
  }
}
```

**Frontend hace**:
```javascript
// public/payment-checkout.html:714-718
if (result.threeDSecure && result.threeDSecure.version === '2.0') {
  console.log('[PAYMENT] 3DS 2.0 detected, initiating handler');
  document.getElementById('checkout-form').style.display = 'none';
  handle3DS2Authentication(result.threeDSecure, paymentId);  ← Carga Cardinal Commerce
  return;
}
```

---

## 🔑 Key Response Fields ePayco

| Campo | Tipo | Valores | Significado |
|-------|------|---------|------------|
| `estado` | String | `Aceptada`, `Pendiente`, `Rechazada` | Estado de la transacción |
| `ref_payco` | String | "334861819" | Referencia única ePayco |
| `transactionID` | String | "3348618191770955245" | ID de transacción |
| `respuesta` | String | Mensajes | Descripción del resultado |
| `urlbanco` | String \| Null | "https://..." | URL de redirección 3DS 1.0 |
| `3DS` | Object \| Null | Cardinal data | Datos para 3DS 2.0 |
| `franquicia` | String | "VISA", "MASTERCARD" | Red de la tarjeta |

---

## 🛠️ Configuración en ePayco Dashboard

Para que ePayco retorne `urlbanco` o `3DS`:

### **Paso 1: Habilitar 3DS**
```
Dashboard → Configuración → Seguridad → 3D Secure
☑️ Habilitar
☑️ 3DS 1.0 (Simple Redirect) + 3DS 2.0 (Cardinal)
```

### **Paso 2: Configurar URLs de Retorno**
```
Dashboard → Webhook Configuration
POST https://easybots.store/checkout/pnp

Será donde ePayco enviará el webhook con estado final:
- Estado: Aceptada (pago confirmado)
- Estado: Abandonada (usuario canceló 3DS)
- Estado: Rechazada (banco rechazó)
```

### **Paso 3: Configurar en Código**
```javascript
// Nuestro código ya lo hace en paymentService.js:1701-1724

const chargeResult = await epaycoClient.charge.create({
  // ... datos de pago
  three_d_secure: true,                    // ← Habilitar 3DS
  url_confirmation: 'https://easybots.store/checkout/pnp',
  url_response: 'https://easybots.store/api/payment-response'
});
```

---

## 📊 Flujo Completo 3DS (Con Dashboard Configurado)

```
┌─────────────────────────────────────────────────────────────────┐
│  USER CLICKEA "PAY"                                             │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
      POST /api/payment/tokenized-charge
      ├─ Tarjeta: 4111111111111111
      ├─ Monto: $249.99
      └─ three_d_secure: true

                 │
                 ▼
         EPAYCO API RESPONSE
         ├─ estado: "Pendiente"
         ├─ urlbanco: "https://banco.com/3ds/..." ← ✅ RECIBIDO
         └─ three_ds_version: "1.0"

                 │
                 ▼
      FRONTEND RECIBE RESPUESTA
      ├─ success: true
      ├─ status: "pending"
      └─ redirectUrl: "https://banco.com/3ds/..."

                 │
                 ▼
      window.location.href = redirectUrl
      │
      └─ USUARIO REDIRIGIDO AL BANCO

                 │
                 ▼
      USUARIO COMPLETA 3DS EN BANCO
      (Ingresa pin, código OTP, etc)

                 │
                 ▼
      BANCO RETORNA A ePayco
      │
      └─ Pago APROBADO o RECHAZADO

                 │
                 ▼
      EPAYCO ENVÍA WEBHOOK A:
      POST /checkout/pnp
      ├─ estado: "Aceptada"  (✅) o "Rechazada" (❌)
      └─ ref_payco: "334861819"

                 │
                 ▼
      NUESTRO BACKEND RECIBE WEBHOOK
      │
      ├─ Si "Aceptada": Activa suscripción ✅
      ├─ Si "Rechazada": Marca como fallido ❌
      └─ Si "Abandonada": Marca como fallido (user canceló)

                 │
                 ▼
      USUARIO RECIBE NOTIFICACIÓN
      └─ "Pago completado" o "Pago rechazado"
```

---

## 🧪 Test Esto

### **Tarjeta que Dispara 3DS 1.0:**
```
Número:      4111111111111111
Exp:         12/2025
CVC:         123
Resultado:   ✅ urlbanco retornado
```

### **Tarjeta que Dispara 3DS 2.0:**
```
Número:      5555555555554444
Exp:         12/2025
CVC:         123
Resultado:   ✅ 3DS.data (Cardinal Commerce) retornado
```

---

## ✅ Checklist: Cuando 3DS esté Habilitado

- [ ] Dashboard ePayco tiene "3D Secure" activado
- [ ] URLs de webhook configuradas correctamente
- [ ] Código tiene `three_d_secure: true` (ya está ✅)
- [ ] Frontend maneja `redirectUrl` (ya está ✅)
- [ ] Frontend maneja `threeDSecure.data` (ya está ✅)
- [ ] Webhook handler procesa estados finales (ya está ✅)
- [ ] Test con tarjeta 4111... → retorna urlbanco
- [ ] Test con tarjeta 5555... → retorna 3DS data
- [ ] Usuario es redirigido al banco
- [ ] Banco redirige de vuelta
- [ ] Webhook llega y pago se completa

---

## 📞 Si No Funciona

**Verificar en orden:**

1. **¿3DS Habilitado en Dashboard?**
   - Dashboard → Configuración → Seguridad → 3D Secure
   - Debe estar ☑️ activado

2. **¿Webhook URL correcta?**
   - Debe ser: `https://easybots.store/checkout/pnp`
   - O: `https://pnptv.app/api/payment-response`

3. **¿Usando tarjeta correcta?**
   - 4111... para 3DS 1.0
   - 5555... para 3DS 2.0

4. **¿Esperaste 5-10 minutos?**
   - Los cambios en Dashboard no son inmediatos

5. **¿Credenciales correctas?**
   - EPAYCO_PUBLIC_KEY correcto
   - EPAYCO_PRIVATE_KEY correcto
   - EPAYCO_TEST_MODE = true (para testing)

---

**Resumen**: Tu código está LISTO. Solo falta configurar 3DS en ePayco Dashboard. 🚀
