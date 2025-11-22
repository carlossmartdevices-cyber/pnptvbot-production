# PNPtv Bot - Notification Templates

This document contains all notification templates used in the PNPtv bot for payment confirmations, subscription reminders, and expiration notices.

## Table of Contents

1. [Payment Confirmation](#payment-confirmation)
2. [Subscription Reminders](#subscription-reminders)
3. [Subscription Expired](#subscription-expired)
4. [Email Templates](#email-templates)

---

## Payment Confirmation

### Bot Message (Telegram)

**Trigger:** When a payment is successfully completed
**Channels:** Telegram Bot Message
**File:** `src/bot/services/paymentService.js`

#### Spanish Version:

```
🎉 *¡Bienvenido a PRIME, {customer_name}!*

✅ Tu pago de *{amount} {currency}* por el plan *{plan_name}* fue recibido exitosamente.

📋 *Detalles de tu suscripción:*
• Plan: {plan_name}
• Fecha de inicio: {start_date}
• Próximo pago: *{next_payment_date}*

🔐 *Accede al canal exclusivo PRIME:*
👉 [Ingresar a PRIME Canal 1]({invite_link_1})
👉 [Ingresar a PRIME Canal 2]({invite_link_2})

⚠️ *Importante:* Estos enlaces son de un solo uso y expiran en 7 días.

📅 *Te recordaremos:*
• 3 días antes de tu próximo pago
• 1 día antes de tu próximo pago

💝 ¡Gracias por confiar en PNPtv! Disfruta todos los beneficios y novedades exclusivas.
```

#### Variables:
- `{customer_name}` - Customer's name from payment data
- `{amount}` - Payment amount
- `{currency}` - Currency code (COP, USD, USDC, etc.)
- `{plan_name}` - Display name of the plan
- `{start_date}` - Current date formatted
- `{next_payment_date}` - Calculated expiry date
- `{invite_link_1}`, `{invite_link_2}` - One-time use invite links

---

## Subscription Reminders

### 3-Day Reminder

**Trigger:** 3 days before subscription expiration
**Channels:** Telegram Bot + Email
**Schedule:** Daily at 10:00 AM
**File:** `src/bot/services/subscriptionReminderService.js`

#### Bot Message (Spanish):

```
⏰ *Recordatorio de Suscripción*

Hola {user_name},

Tu suscripción *{plan_name}* expira en *3 días*.

📅 *Fecha de expiración:* {expiry_date}

💎 *No pierdas acceso a:*
• Canales exclusivos PRIME
• Contenido premium sin publicidad
• Salas Zoom ilimitadas
• Transmisiones en vivo exclusivas
• Soporte prioritario

👉 Renueva ahora y mantén todos tus beneficios activos.

⚠️ *Importante:* Si tu suscripción expira, serás removido automáticamente de los canales PRIME a medianoche.
```

**Button:** `🔄 Renovar Suscripción` → Links to subscription plans page

#### Variables:
- `{user_name}` - User's first name
- `{plan_name}` - Plan display name
- `{expiry_date}` - Formatted expiration date

---

### 1-Day Reminder

**Trigger:** 1 day before subscription expiration
**Channels:** Telegram Bot + Email
**Schedule:** Daily at 10:00 AM
**File:** `src/bot/services/subscriptionReminderService.js`

#### Bot Message (Spanish):

```
🚨 *¡ÚLTIMO RECORDATORIO!*

Hola {user_name},

Tu suscripción *{plan_name}* expira en *1 día*.

📅 *Fecha de expiración:* {expiry_date}

💎 *No pierdas acceso a:*
• Canales exclusivos PRIME
• Contenido premium sin publicidad
• Salas Zoom ilimitadas
• Transmisiones en vivo exclusivas
• Soporte prioritario

👉 Renueva ahora y mantén todos tus beneficios activos.

⚠️ *Importante:* Si tu suscripción expira, serás removido automáticamente de los canales PRIME a medianoche.
```

**Button:** `🔄 Renovar Suscripción` → Links to subscription plans page

---

## Subscription Expired

### Farewell Message

**Trigger:** When subscription expires (midnight on expiration day)
**Channels:** Telegram Bot + Email
**Schedule:** Daily at 12:00 AM (midnight)
**File:** `src/bot/services/userService.js`

#### Bot Message (Spanish):

```
💔 *Te vamos a extrañar*

Hola {user_name},

Tu suscripción *{plan_name}* ha expirado y has sido removido de los canales PRIME.

❌ *Has perdido acceso a:*
• Canales exclusivos PRIME
• Contenido premium sin publicidad
• Salas Zoom ilimitadas
• Transmisiones en vivo exclusivas
• Soporte prioritario

🎁 *¡Vuelve a PRIME!*
Renueva hoy y recupera todos tus beneficios inmediatamente. Te estamos esperando.

👉 Siempre serás bienvenido de vuelta. La familia PNPtv te extraña.
```

**Button:** `💎 Volver a PRIME` → Links to subscription plans page

#### Actions Performed:
1. User subscription status updated to "expired"
2. User removed from all PRIME channels (using ban/unban technique)
3. Farewell message sent via bot
4. Farewell email sent (if email available)

---

## Email Templates

All email templates are located in: `src/services/emailService.js`

### 1. Payment Confirmation Email

**Method:** `sendPaymentConfirmation()`
**Subject:** `🎉 ¡Bienvenido a PNPtv PRIME! - Confirmación de Pago`

**Content:**
- Welcome message with success icon (✅)
- Subscription details (plan, amount, dates)
- One-time use invite links to PRIME channels
- List of PRIME benefits
- Automatic reminder schedule information
- Support contact information

### 2. 3-Day Reminder Email

**Method:** `sendSubscriptionReminder()` with `daysRemaining: 3`
**Subject:** `⏰ Tu suscripción PRIME expira en 3 días`

**Content:**
- Alert box with warning color (orange)
- Subscription details (plan, expiry date)
- "Renovar Suscripción" button
- List of benefits to retain
- Warning about losing access

### 3. 1-Day Reminder Email

**Method:** `sendSubscriptionReminder()` with `daysRemaining: 1`
**Subject:** `🚨 ¡Último recordatorio! Tu suscripción expira mañana`

**Content:**
- Alert box with urgent color (red)
- Subscription details (plan, expiry date)
- "Renovar Suscripción" button
- List of benefits to retain
- Urgent warning about losing access

### 4. Subscription Expired Email

**Method:** `sendSubscriptionExpired()`
**Subject:** `💔 Te vamos a extrañar - Tu suscripción PRIME ha expirado`

**Content:**
- Sad icon (💔)
- Notification of expiration and channel removal
- List of lost benefits
- "Volver a PRIME" button
- Welcoming message to return

---

## Email Design Standards

All emails follow these design standards:

### Colors:
- **Primary Blue:** `#2D8CFF` (buttons, headers, accents)
- **Success Green:** `#27ae60` (renewal buttons)
- **Warning Orange:** `#f39c12` (3-day reminders)
- **Urgent Red:** `#e74c3c` (1-day reminders, expiration)
- **Background:** `#f4f4f4` (page background)
- **Container:** `white` (email body)

### Typography:
- **Font Family:** 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif
- **Line Height:** 1.6
- **Body Text:** #333
- **Footer Text:** #666, 12px

### Layout:
- **Max Width:** 600px
- **Padding:** 30px
- **Border Radius:** 10px
- **Box Shadow:** 0 2px 10px rgba(0,0,0,0.1)

### Components:
- **Logo:** 🎬 PNPtv (32px, bold, blue)
- **Buttons:** 50px border-radius, 15px padding, bold
- **Info Boxes:** Light blue background, left border accent
- **Alert Boxes:** Colored background matching urgency level

---

## Environment Variables

Configure these in `.env`:

```bash
# Email Configuration
EMAIL_FROM=noreply@easybots.store
SENDGRID_API_KEY=your_sendgrid_key

# Or use SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_username
SMTP_PASSWORD=your_password
SMTP_SECURE=false

# Bot Configuration
BOT_TOKEN=your_bot_token
BOT_WEBHOOK_DOMAIN=https://easybots.store

# PRIME Channels
PRIME_CHANNEL_ID=-1001947636543,-1002997324714

# Cron Schedules
SUBSCRIPTION_CHECK_CRON=0 0 * * *    # Midnight
REMINDER_3DAY_CRON=0 10 * * *        # 10 AM daily
REMINDER_1DAY_CRON=0 10 * * *        # 10 AM daily
```

---

## Testing Notifications

### Test Payment Confirmation:
```javascript
const PaymentService = require('./src/bot/services/paymentService');
// Process a test webhook with valid data
```

### Test Reminders Manually:
```javascript
const SubscriptionReminderService = require('./src/bot/services/subscriptionReminderService');

// Test 3-day reminders
await SubscriptionReminderService.send3DayReminders();

// Test 1-day reminders
await SubscriptionReminderService.send1DayReminders();
```

### Test Expiration:
```javascript
const UserService = require('./src/bot/services/userService');
// Manually set a user's expiry to past date, then run:
await UserService.processExpiredSubscriptions();
```

---

## Localization

Currently, all templates are in Spanish. To add English support:

1. Create language-specific template methods in services
2. Detect user language from `user.language` field
3. Pass language parameter to template methods
4. Add English translations for all messages

Example:
```javascript
static getBotReminderMessage(name, planName, expiryDate, daysRemaining, lang = 'es') {
  if (lang === 'en') {
    // English template
  } else {
    // Spanish template (default)
  }
}
```

---

## Support

For questions or issues with notifications:
- Email: support@easybots.store
- Check logs: `logs/combined.log`
- Monitor cron jobs: `pm2 logs cron`

---

**Last Updated:** 2025-01-19
**Version:** 1.0.0
