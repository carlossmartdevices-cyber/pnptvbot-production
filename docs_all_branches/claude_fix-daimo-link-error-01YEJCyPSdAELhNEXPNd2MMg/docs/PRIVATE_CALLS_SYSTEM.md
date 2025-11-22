# Private 1:1 Calls System

## Overview

Sistema completo de llamadas privadas 1:1 con pago integrado, gestión de disponibilidad, agendamiento y notificaciones.

## Características

✅ **Llamadas 1:1 de 45 minutos**
✅ **Pago con Daimo** (Zelle, CashApp, Venmo, Revolut, Wise)
✅ **Precio**: $100 USD en USDC (Optimism)
✅ **Videollamadas HD** con Daily.co
✅ **Sistema de disponibilidad** para admin
✅ **Broadcast automático** a usuarios
✅ **Agendamiento** post-pago
✅ **Recordatorios** automáticos

---

## Configuración

### 1. Variables de Entorno

Agregar a tu `.env`:

```bash
# Daily.co API (para videollamadas)
DAILY_API_KEY=tu_daily_api_key_aqui

# Daimo Pay (ya configurado)
DAIMO_TREASURY_ADDRESS=0xTuDireccionOptimism
DAIMO_WEBHOOK_SECRET=tu_webhook_secret
```

### 2. Obtener Daily.co API Key

1. Ve a https://www.daily.co/
2. Crea una cuenta gratuita
3. Ve a Dashboard > Developers > API Keys
4. Copia tu API key
5. Agrégala a `DAILY_API_KEY` en `.env`

**Plan Gratuito de Daily.co:**
- ✅ 10,000 minutos gratis por mes
- ✅ Hasta 20 participantes por llamada
- ✅ Grabación en la nube
- ✅ Chat y screen sharing
- ✅ Sin descargas requeridas

### 3. Registro de Handlers

Asegúrate de que los handlers estén registrados en tu bot:

```javascript
// En src/bot/core/bot.js o donde registres tus handlers

const registerCallManagementHandlers = require('../handlers/admin/callManagement');
const registerPrivateCallHandlers = require('../handlers/user/privateCalls');

// Registrar handlers
registerCallManagementHandlers(bot);
registerPrivateCallHandlers(bot);
```

---

## Flujo de Uso

### Para el Admin

#### 1. Marcar Disponibilidad

**Opción A: Comando Rápido**
```
/available
```
- Marca como disponible por 24 horas
- Opción para broadcastear inmediatamente

**Opción B: Menú Admin**
1. Ir al menú de admin
2. Seleccionar "📞 Call Management"
3. Click en "🟢 Mark Available"

#### 2. Broadcast de Disponibilidad

**Opción A: Comando Rápido**
```
/broadcast
```

**Opción B: Desde el menú**
1. "📞 Call Management" > "📢 Broadcast Availability"

El mensaje broadcast incluye:
- Notificación de disponibilidad
- Descripción del servicio
- Precio y duración
- Botón "Book 1:1 Call"

#### 3. Ver Llamadas Programadas

En el menú de admin:
- "📞 Call Management" > "📋 View Upcoming Calls"

#### 4. Marcar como No Disponible

En el menú de admin:
- "📞 Call Management" > "🔴 Mark Unavailable"

---

### Para el Usuario

#### 1. Reservar una Llamada

Usuario recibe broadcast o va al menú:
1. Click en "📞 Book 1:1 Call"
2. Ve información del servicio
3. Click en "💳 Pay & Book Now"

#### 2. Pagar

1. Se genera link de pago de Daimo
2. Usuario elige su app preferida:
   - Zelle
   - CashApp
   - Venmo
   - Revolut
   - Wise
3. Completa el pago en su app

#### 3. Agendar

Después del pago:
1. Usuario recibe notificación de pago exitoso
2. Click en "📅 Schedule Call Now"
3. Envía fecha y hora en formato:
   ```
   25/01/2025
   15:00 EST
   ```
4. Recibe confirmación con link de videollamada

#### 4. Unirse a la Llamada

- Usuario recibe recordatorio 15 min antes
- Click en link de Daily.co
- Llamada comienza automáticamente en el navegador

---

## Arquitectura del Sistema

### Modelos

**CallModel** (`src/models/callModel.js`)
- `create()` - Crear reserva de llamada
- `getById()` - Obtener llamada por ID
- `getByUser()` - Llamadas de un usuario
- `getByStatus()` - Llamadas por estado
- `updateStatus()` - Actualizar estado
- `setAvailability()` - Marcar disponibilidad del admin
- `getAvailability()` - Obtener disponibilidad actual
- `getUpcoming()` - Llamadas próximas
- `getStatistics()` - Estadísticas de llamadas

**Colecciones de Firestore:**
- `privateCalls` - Todas las llamadas reservadas
- `callAvailability` - Estado de disponibilidad del admin

### Servicios

**CallService** (`src/bot/services/callService.js`)
- `createMeetingRoom()` - Crear sala de Daily.co
- `bookCall()` - Reservar llamada
- `setAvailability()` - Marcar disponibilidad
- `getAvailability()` - Obtener disponibilidad
- `broadcastAvailability()` - Notificar a todos los usuarios
- `sendCallReminder()` - Enviar recordatorio
- `getUpcomingCalls()` - Llamadas próximas
- `cancelCall()` - Cancelar llamada
- `completeCall()` - Marcar llamada como completada
- `getStatistics()` - Estadísticas

**PaymentService** (actualizado)
- Maneja el plan especial `private_call_45min`
- `notifyCallPaymentSuccess()` - Notificación especial para llamadas
- Integración con Daimo Pay

### Handlers

**Admin Handlers** (`src/bot/handlers/admin/callManagement.js`)
- Menú de gestión de llamadas
- Marcar disponibilidad
- Broadcast de disponibilidad
- Ver llamadas programadas

**User Handlers** (`src/bot/handlers/user/privateCalls.js`)
- Ver información del servicio
- Pagar con Daimo
- Agendar llamada
- Ver mis llamadas

---

## API de Daily.co

### Crear Sala de Videollamada

```javascript
POST https://api.daily.co/v1/rooms
Headers:
  Authorization: Bearer {DAILY_API_KEY}
  Content-Type: application/json

Body:
{
  "name": "pnptv-call-{callId}",
  "properties": {
    "max_participants": 2,
    "enable_chat": true,
    "enable_screenshare": true,
    "enable_recording": "cloud",
    "exp": {timestamp_48hrs_from_now},
    "eject_at_room_exp": true
  }
}

Response:
{
  "url": "https://company.daily.co/pnptv-call-{callId}",
  "name": "pnptv-call-{callId}",
  ...
}
```

### Características de la Sala

- **2 participantes máximo** (1:1)
- **Chat habilitado**
- **Screen sharing habilitado**
- **Grabación en la nube** (opcional)
- **Expira en 48 horas**
- **Auto-expulsión** cuando expira

---

## Estados de Llamada

| Estado | Descripción | Visible para |
|--------|-------------|--------------|
| `pending` | Pago completado, esperando agendamiento | Usuario, Admin |
| `confirmed` | Llamada agendada con fecha/hora | Usuario, Admin |
| `completed` | Llamada finalizada | Admin |
| `cancelled` | Llamada cancelada | Admin |

---

## Estructura de Datos

### Call Document (Firestore)

```javascript
{
  id: "uuid",
  userId: "123456789",
  userName: "John Doe",
  userUsername: "johndoe",
  paymentId: "payment_uuid",
  scheduledDate: "25/01/2025",
  scheduledTime: "15:00 EST",
  duration: 45,
  amount: 100,
  status: "confirmed",
  meetingUrl: "https://company.daily.co/pnptv-call-uuid",
  reminderSent: false,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Availability Document (Firestore)

```javascript
{
  adminId: "987654321",
  available: true,
  message: "I'm now available for 1:1 calls!",
  validUntil: Timestamp,
  updatedAt: Timestamp
}
```

---

## Comandos de Admin

| Comando | Descripción |
|---------|-------------|
| `/available` | Marcar como disponible por 24 horas |
| `/broadcast` | Enviar notificación de disponibilidad a todos |

---

## Notificaciones

### 1. Broadcast de Disponibilidad

Enviado a todos los usuarios activos cuando el admin marca disponibilidad.

```
🎉 Great News!

📞 I'm now available for Private 1:1 Calls!

💎 What you get:
• 45 minutes of personalized consultation
• Direct video call (HD quality)
• Expert advice and guidance
• Flexible scheduling

💰 Price: $100 USD

🚀 Limited slots available!
Book your call now before they're gone.

[📞 Book 1:1 Call]
```

### 2. Confirmación de Pago

Enviado inmediatamente después del pago exitoso.

```
✅ Payment Confirmed!

Amount: 100 USDC

🎉 Your 1:1 call has been purchased!

📅 Next Step: Schedule your call

Click the button below to schedule your 45-minute call.

[📅 Schedule Call Now]
```

### 3. Confirmación de Agendamiento

Enviado después de agendar la llamada.

```
✅ Call Booked Successfully!

📅 Date: 25/01/2025
⏰ Time: 15:00 EST
⏱ Duration: 45 minutes

🔗 Join Link:
https://company.daily.co/pnptv-call-{id}

📧 You'll receive a reminder 15 minutes before the call.

See you soon! 👋

[📅 Add to Calendar]
```

### 4. Recordatorio de Llamada

Enviado 15 minutos antes de la llamada.

```
🔔 Reminder: Private Call in 15 minutes

📅 Date: 25/01/2025
⏰ Time: 15:00 EST
⏱ Duration: 45 minutes

🔗 Join here: https://company.daily.co/pnptv-call-{id}

See you soon! 👋

[🎥 Join Call Now]
```

---

## Broadcast System

### Características

- **Rate Limiting**: Envía en lotes de 20 mensajes
- **Delay**: 1 segundo entre lotes
- **Error Handling**: Continúa si falla un envío
- **Reporting**: Reporte de éxitos/fallos

### Ejemplo de Uso

```javascript
const results = await CallService.broadcastAvailability(
  bot.telegram,
  message
);

// Results:
// {
//   sent: 245,
//   failed: 5,
//   total: 250
// }
```

---

## Cron Jobs (Opcional)

Para recordatorios automáticos, agrega a `scripts/cron.js`:

```javascript
const cron = require('node-cron');
const CallService = require('../src/bot/services/callService');

// Check for calls starting in 15 minutes
cron.schedule('*/5 * * * *', async () => {
  const calls = await CallService.getUpcomingCalls();
  const now = new Date();
  const in15min = new Date(now.getTime() + 15 * 60000);

  for (const call of calls) {
    const callTime = new Date(call.scheduledDate + ' ' + call.scheduledTime);

    // Send reminder if call is in 15 minutes and reminder not sent
    if (callTime <= in15min && callTime > now && !call.reminderSent) {
      await CallService.sendCallReminder(bot, call, 15);
    }
  }
});
```

---

## Troubleshooting

### Daily.co room creation fails

1. Verify `DAILY_API_KEY` is set correctly
2. Check Daily.co dashboard for API limits
3. Review logs for error messages
4. Fallback: Generic meeting URL is used

### Broadcasts not sending

1. Check `UserModel.getAllActive()` returns users
2. Verify users have `chatId` or `id` field
3. Review logs for failed sends
4. Check Telegram rate limits

### Payment not triggering schedule

1. Verify webhook is receiving payments
2. Check `planId === 'private_call_45min'`
3. Ensure `chatId` is included in payment metadata
4. Review logs for notification errors

---

## Recomendaciones

### Videollamadas: Daily.co vs Zoom

| Característica | Daily.co ✅ | Zoom |
|----------------|------------|------|
| No requiere descarga | ✅ | ❌ |
| API moderna | ✅ | ⚠️ |
| Fácil integración | ✅ | ⚠️ |
| Plan gratuito generoso | ✅ (10k min) | ⚠️ |
| HD quality | ✅ | ✅ |
| Grabación | ✅ | ✅ |
| Screen sharing | ✅ | ✅ |

**Recomendación**: **Daily.co** para mejor experiencia de usuario.

**Alternativa**: Si ya tienes Zoom configurado, puedes usarlo modificando `callService.js`:

```javascript
// Replace createMeetingRoom with:
static async createMeetingRoom(callData) {
  // Use existing Zoom integration
  const zoomMeeting = await createZoomMeeting({
    topic: `Private Call with ${callData.userName}`,
    duration: 45,
  });

  return zoomMeeting.join_url;
}
```

---

## Código de Referencia

- **Call Model**: `src/models/callModel.js`
- **Call Service**: `src/bot/services/callService.js`
- **Admin Handlers**: `src/bot/handlers/admin/callManagement.js`
- **User Handlers**: `src/bot/handlers/user/privateCalls.js`
- **Payment Service**: `src/bot/services/paymentService.js` (líneas 60-76, 440-556)

---

## Soporte

- **Daily.co Support**: https://www.daily.co/support
- **Daily.co Docs**: https://docs.daily.co/
- **Daimo Pay**: Ver `docs/DAIMO_PAY_INTEGRATION.md`

---

**Last Updated**: 2025-01-16
**Version**: 1.0.0
