# Comprehensive Report: Removed Bot Functionality

## Overview
This document details all bot rules, menus, configurations, and automated behaviors that have been disabled. Each section includes function descriptions and the actual text messages that were sent to users.

---

## 1. GROUP WELCOME & ONBOARDING SYSTEM

### 1.1 New Member Welcome Messages

**Function:** `handleNewMembers()`
- Triggered when users join the group
- Created/updated user in database
- Sent personalized welcome message to notifications topic (3135)

**Welcome Message Text (English):**
```
👋 Hey @username, welcome to PNPtv!

This place is simple: real people, real vibes, no filters. Before you jump in, here's how you're entering today:

⭐ Your current membership:

[PRIME Member / Free Member]

🔥 What you get right now:

• Group access
• Short content
• Free Music Library
• 3 views in Nearby Members

💎 If you go PRIME, you unlock:

• Full-length videos from Santino, Lex, and the community
• Unlimited Nearby Members
• Zoom Calls + Live Performances
• Premium Music & Podcasts
• Exclusive content you won't see anywhere else

Send /menu or /start to see what the bot can do.
```

**Welcome Message Text (Spanish):**
```
👋 Ey @username, bienvenidx a PNPtv!

Aquí la vuelta es simple: gente real, buena vibra, cero filtro. Antes de meterte de lleno, mira cómo entras hoy:

⭐ Tu membresía actual:

[PRIME Member / Free Member]

🔥 Lo que tienes por ahora:

• Acceso al grupo
• Contenido corto
• Music Library gratis
• 3 vistas en Nearby

💎 Si te haces PRIME, desbloqueas:

• Videos completos de Santino, Lex y la comunidad
• Nearby ilimitado
• Zoom Calls + Live Performances
• Música + Podcasts premium
• Contenido que no sale en ningún otro lado

Envía /menu o /start para ver lo que el bot puede hacer.
```

### 1.2 Badge Selection System

**Function:** `sendBadgeSelectionMessage()`
- Prompted users to select their "tribe" badge
- 4 badge options with emojis

**Badge Selection Message (English):**
```
👑 You belong to… (pick your tribe)

Tell us what kind of chaos you are, and we'll give you your first badge.
It saves instantly.
```

**Badge Selection Message (Spanish):**
```
👑 Perteneces a… (elige tu tribu)

Dime qué clase de desmadre eres, y te doy tu primera insignia.
Se guarda al toque.
```

**Badge Options:**
1. 🔥 Meth Alpha
2. 🧜 Chem Mermaids
3. 💉 Slam Slut
4. 👑 Spun Royal

### 1.3 Congratulations Messages

**Function:** `sendCongratsMessage()`
- Sent after badge selection
- Announced new member with their chosen badge

**Congratulations Text (English):**
```
🎉 Que chimba papi! First badge unlocked.

@username is a [Badge Name]
and officially part of the PNPtv! family.
```

**Congratulations Text (Spanish):**
```
🎉 Que chimba papi! Primera insignia desbloqueada.

@username es [Badge Name]
y oficialmente parte de la familia PNPtv!
```

### 1.4 Action Buttons

**Function:** `sendActionButtons()`
- Prompted new users to subscribe or book calls

**Action Buttons Message (English):**
```
🚀 Want more?

Explore everything PNPtv! has for you:
```
Buttons:
- ⭐ Subscribe to PNPtv! PRIME
- 📲 Book a Call with Performers

**Action Buttons Message (Spanish):**
```
🚀 ¿Quieres más?

Explora todo lo que PNPtv! tiene para ti:
```
Buttons:
- ⭐ Suscríbete a PNPtv! PRIME
- 📲 Reserva una Llamada con Performers

### 1.5 Rules Menu

**Function:** `sendRulesMenu()`
- Provided quick access to community rules

**Rules Menu Text (English):**
```
📋 Check out the group rules:
```
Button: 📘 View Group Rules

**Rules Menu Text (Spanish):**
```
📋 Lee las reglas del grupo:
```
Button: 📘 Ver Reglas del Grupo

---

## 2. COMMUNITY RULES SYSTEM

### 2.1 Rules Display

**Function:** `handleViewRules()`
- Displayed community guidelines

**Rules Text (English):**
```
📘 Quick Rules:

• Respect people
• No spam
• Consent always
• No external selling
• Do not share links
• Take care of yourself and others

Full list of rules and terms and conditions on our site.
```

**Rules Text (Spanish):**
```
📘 Reglas rápidas del grupo:

• Respeto
• Nada de spam
• Consentimiento siempre
• No ventas externas
• No compartas links
• Cuídate y cuida a los demás

Lista completa de reglas y términos en nuestro sitio.
```

### 2.2 Moderation Rules (Detailed)

**Function:** `handleRules()`
- Comprehensive rules display with moderation settings

**Detailed Rules Text:**
```
📋 **Group Rules**

Welcome to **[Group Name]**!

Please follow these rules:

🔗 **Links:** Not allowed (will be deleted)
📢 **Spam:** No excessive caps, emojis, or repeated characters
💬 **Flooding:** Maximum 5 messages in 10 seconds

⚠️ **Warning System:**
• You will receive up to 3 warnings
• After 3 warnings, you will be removed from the group
• Use /warnings to check your current warnings

Thank you for helping keep this group safe and friendly! 🙏
```

---

## 3. MODERATION COMMANDS

### 3.1 User Commands

**Command:** `/rules`
- Displayed group rules and moderation policies

**Command:** `/warnings`
- Showed user's warning count and history

**Warnings Display Text:**
```
✅ **No Warnings**

You have no warnings in this group. Keep up the good behavior!
```

OR

```
⚠️ **Your Warnings**

You have **[N]** warning(s) in this group.
Maximum warnings: **3**

**Recent warnings:**
1. [Reason] - [Date]
2. [Reason] - [Date]
3. [Reason] - [Date]

⚠️ You have **[N]** warning(s) remaining before being removed.
```

### 3.2 Admin Commands

**Command:** `/moderation [on|off|status]`
- Toggled moderation features on/off
- Displayed current moderation settings

**Status Display:**
```
**📊 Moderation Status**

🔗 Anti-Links: ✅ Enabled / ❌ Disabled
📢 Anti-Spam: ✅ Enabled / ❌ Disabled
💬 Anti-Flood: ✅ Enabled / ❌ Disabled
🚫 Profanity Filter: ✅ Enabled / ❌ Disabled

⚠️ Max Warnings: 3
💬 Flood Limit: 5 messages / 10s

✅ Allowed Domains: [list]
```

**Command:** `/setlinks [strict|warn|allow]`
- Configured link posting policy

**Command:** `/ban [reason]`
- Banned user from group

**Ban Confirmation:**
```
🚫 **[Username]** has been banned.

**Reason:** [reason]
```

**Command:** `/unban`
- Removed ban from user

**Unban Confirmation:**
```
✅ User has been unbanned and can rejoin the group.
```

**Command:** `/clearwarnings`
- Cleared user's warnings

**Confirmation:**
```
✅ Warnings cleared for **[Username]**.
```

**Command:** `/modlogs [limit]`
- Viewed moderation action history

**Mod Logs Display:**
```
📋 **Moderation Logs** (Last [N])

**1.** [Action]
   User: [User ID]
   Reason: [Reason]
   Date: [Date Time]

**2.** [Action]
   User: [User ID]
   Reason: [Reason]
   Date: [Date Time]
```

**Command:** `/modstats`
- Displayed moderation statistics

**Mod Stats Display:**
```
📊 **Moderation Statistics**

⚠️ Total Warnings: [N]
👥 Users with Warnings: [N]
🚫 Total Bans: [N]
⚡ Recent Actions (24h): [N]
```

**Command:** `/userhistory <user_id>`
- Viewed username change history

**Username History Display:**
```
📋 **Username History**

👤 **User ID:** [ID]
📊 **Total Changes:** [N]

**1.** [Date Time]
   From: @[old_username]
   To: @[new_username]
   🚩 **FLAGGED:** [Reason]
```

**Command:** `/usernamechanges [limit]`
- Viewed recent username changes in group

**Username Changes Display:**
```
📋 **Recent Username Changes**

📊 **Last [N] changes:**

**1.** User ID: [ID]
   [Date]: @[old] → @[new]
   🚩 FLAGGED

Use /userhistory <user_id> to see full history for a specific user.
```

**Command:** `/globalban [reason]`
- Banned user from ALL groups and channels

**Global Ban Confirmation:**
```
🌍 **[Username]** has been **GLOBALLY BANNED**.

**Reason:** [reason]

⚠️ This user is now blocked from all groups and channels using this bot.
```

**Command:** `/globalunban`
- Removed global ban

**Global Unban Confirmation:**
```
✅ **[Username]** has been **GLOBALLY UNBANNED**.

This user can now access all groups and channels again.
```

**Command:** `/globalbans`
- Listed all globally banned users

**Global Bans List:**
```
🌍 **Globally Banned Users**

📊 **Total:** [N] users

**1.** User ID: [ID]
   📅 Banned: [Date Time]
   📝 Reason: [Reason]
   👤 By: Admin ID [ID]
```

**Command:** `/noncompliant`
- Viewed users without compliant profiles

**Non-Compliant Users Display:**
```
⚠️ **Non-Compliant Users**

📊 **Total:** [N] users

**1.** User ID: [ID]
   ⏰ Warned: [Date Time]
   ⏳ Hours remaining: [N]h
   ❌ Issues: [List of issues]
   🚫 PURGED
```

**Command:** `/sendcompliancewarnings`
- Sent compliance warning to entire group

**Compliance Warning Message:**
```
📋 **Profile Compliance Requirements**

All members must have:

✅ **A Telegram username** (@username)

**Why?** To ensure proper identification.

**How to set a username:**
1. Open Telegram Settings
2. Tap on "Username"
3. Choose a unique username (@yourname)
4. Return to this group

⏰ **Deadline: 48 hours**

Users who don't comply will be automatically removed from the group.
```

**Command:** `/purgenoncompliant`
- Manually kicked all non-compliant users

**Purge Results:**
```
🚫 **Purge Complete**

✅ Purged: [N] users
❌ Errors: [N] users

Note: Users have been kicked from the group.
```

---

## 4. AUTO-MODERATION SYSTEM

### 4.1 Warning Messages

**Function:** `handleWarn()` / `handleWarnAndDelete()`

**Group Warning Message:**
```
⚠️ **Warning**

👤 [Username]
📋 [Reason]
⚠️ Warning **[N]** of **3**

You have [N] warning(s) remaining before being removed from the group.
```

OR

```
Maximum warnings reached. You will be removed from the group.
```

**Private Warning Message:**
```
⚠️ **Warning**

You received a warning in **[Group Name]**

📋 **Reason:** [Reason]
⚠️ **Warning [N] of 3**

You have **[N] warning(s)** remaining.

Please follow the group rules to avoid being removed.
```

### 4.2 Kick/Ban Messages

**Function:** `kickUser()`

**Kick Notification:**
```
🚫 User Kicked

👤 **[Username]** has been removed from the group.
📋 **Reason:** [Reason]
⚠️ Maximum warnings (3) reached.
```

**Moderation Reasons:**
- Flooding (too many messages)
- Spam detection (caps, emojis, repeated chars)
- Unauthorized links
- Profanity
- Banned user

---

## 5. SUBSCRIPTION REMINDERS

### 5.1 3-Day Reminder

**Function:** `send3DayReminders()`

**Bot Message:**
```
🔔 **Subscription Reminder**

Hi [Name]! 👋

Your **[Plan Name]** subscription expires in **3 days** on [Date].

Renew now to keep enjoying:
✨ Exclusive content
📺 Live streams
💬 Premium features
🎵 Music & Podcasts

[🔄 Renovar Suscripción] button
```

**Email Subject:** "Your PNPtv subscription expires in 3 days"

### 5.2 1-Day Reminder

**Function:** `send1DayReminders()`

**Bot Message:**
```
⏰ **Urgent: Subscription Expiring Tomorrow**

Hi [Name]!

Your **[Plan Name]** subscription expires **tomorrow** on [Date].

Don't lose access to your favorite content!

[🔄 Renovar Suscripción] button
```

**Email Subject:** "Last chance! Your PNPtv subscription expires tomorrow"

---

## 6. CALL REMINDERS

### 6.1 24-Hour Reminder

**Function:** `sendReminder()` - 24h

**Reminder Message:**
```
📅 **Call Reminder - Tomorrow**

Hi [User]!

Your video call is scheduled for **tomorrow**:

👤 Performer: [Name]
📅 Date: [Date]
⏰ Time: [Time]
⏱️ Duration: [Duration] minutes

🔗 Meeting Link: [URL]

[📅 Reschedule] button

See you soon! 💙
```

### 6.2 1-Hour Reminder

**Reminder Message:**
```
⏰ **Call Reminder - In 1 Hour**

Your video call starts in **1 hour**!

👤 Performer: [Name]
📅 Date: [Date]
⏰ Time: [Time]

🔗 Meeting Link: [URL]

Get ready! 🎥
```

### 6.3 15-Minute Reminder

**Reminder Message:**
```
🚨 **Call Starting Soon - 15 Minutes**

Your video call starts in **15 minutes**!

👤 Performer: [Name]
🔗 Meeting Link: [URL]

Join now to test your connection! 📹
```

---

## 7. GROUP MENU SYSTEM

### 7.1 Group Menu

**Function:** `showGroupMenu()`

**Menu Header (English):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👋 Hey @username!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🙌 This is your quick member panel.

🔒 Reminder: all core PNPtv! features work through the bot chat to protect your privacy.

From here you can:
• 📞 Contact an Admin
• 📋 View community rules
• 💬 Access the bot chat
```

**Menu Header (Spanish):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👋 ¡Hola @username!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🙌 Este es tu panel rápido de miembros.

🔒 Recuerda: las funciones principales de PNPtv! se manejan directamente desde el chat del bot para proteger tu privacidad.

Desde aquí puedes:
• 📞 Contactar a un Admin
• 📋 Ver reglas de la comunidad
• 💬 Acceder al chat del bot
```

### 7.2 Contact Admin

**Function:** `handleGroupContactAdmin()`

**Contact Admin Message (English):**
```
📞 **Contact an Admin**

To contact a group administrator, please:

1. Mention one of the administrators in the group chat
2. Or send a direct message to the bot with your query using the "PNPtv! Bot Chat" button

Administrators will respond as soon as possible.
```

**Contact Admin Message (Spanish):**
```
📞 **Contactar a un Admin**

Para contactar a un administrador del grupo, por favor:

1. Menciona a uno de los administradores en el chat del grupo
2. O envía un mensaje directo al bot con tu consulta usando el botón "Chat Bot PNPtv!"

Los administradores responderán lo antes posible.
```

---

## 8. MESSAGE AUTO-DELETE SYSTEM

### 8.1 Auto-Delete Timers

**Function:** `chatCleanupMiddleware()`

**Deleted Automatically:**
- Bot commands: 5 minutes
- Bot replies in groups: 5 minutes (unless marked as broadcast)
- System messages (joins/leaves): 5 minutes
- Warning messages: 10 seconds
- Kick notifications: 30 seconds
- Private bot messages: Deleted immediately on next user interaction

### 8.2 Group Behavior Overrides

**Function:** `groupBehaviorMiddleware()`

**Topic 3135 Routing:**
- All bot messages routed to "Notifications" topic (3135)
- Auto-delete after 3 minutes
- Commands redirected to Notifications topic

**Personal Info Detection:**
Detected keywords (English & Spanish):
- my email, mi email, mi correo
- my phone, mi teléfono
- my password, mi contraseña
- credit card, tarjeta de crédito
- billing, factura
- login, credentials, iniciar sesión

**Redirect Message:**
```
🔒 This question contains personal information. Please contact me privately to protect your privacy.
```

```
🔒 Esta pregunta contiene información personal. Por favor, contáctame en privado para proteger tu privacidad.
```

### 8.3 Command Redirection

**Function:** `commandRedirectionMiddleware()`

**Redirect Notice:**
```
💬 Bot commands are processed in the **Notifications** topic →
```

```
💬 Los comandos del bot se procesan en el tema **Notifications** →
```

---

## 9. TOPIC PERMISSIONS SYSTEM

### 9.1 Permission Violations

**Function:** `topicPermissionsMiddleware()`

**Command Not Allowed:**
```
⚠️ Commands are not allowed in **[Topic Name]**.
```

```
⚠️ Los comandos no están permitidos en **[Topic Name]**.
```

**Insufficient Access:**
```
🔒 You don't have access to **[Topic Name]**.

Requires: [Subscription/Role requirement]
```

```
🔒 No tienes acceso a **[Topic Name]**.

Requiere: [Subscription/Role requirement]
```

**Rate Limit Exceeded:**
```
⏱️ You're posting too fast in **[Topic Name]**.

Please wait before posting again.
```

```
⏱️ Estás publicando demasiado rápido en **[Topic Name]**.

Por favor espera antes de publicar de nuevo.
```

**Admin-Only Posting:**
```
⚠️ **[Topic Name]** is for admin posts only.

✅ You can reply to existing posts.
```

```
⚠️ **[Topic Name]** es solo para publicaciones de administradores.

✅ Puedes responder a las publicaciones existentes.
```

### 9.2 Auto-Mute System

**Function:** `checkAutoMute()`

**3-Strike Mute (1 hour):**
```
🔇 You've been temporarily muted in this topic due to multiple violations.

Duration: 1 hour
```

```
🔇 Has sido silenciado temporalmente en este tema por múltiples violaciones.

Duración: 1 hora
```

### 9.3 Post Approval System

**Function:** `handleApprovalQueue()`

**User Notification:**
```
📤 Your post to **[Topic Name]** has been submitted for approval.

⏳ An admin will review it soon.
📧 You'll be notified when it's approved or rejected.
```

```
📤 Tu publicación en **[Topic Name]** ha sido enviada para aprobación.

⏳ Un administrador la revisará pronto.
📧 Recibirás una notificación cuando sea aprobada o rechazada.
```

**Admin Approval Request:**
```
🔔 **Post Approval Request for [Topic Name]**

👤 User: @username
🆔 ID: [User ID]

📝 **Content:**
[Message content]

Approve this post?

[✅ Approve] [❌ Reject]
```

**Approval Confirmation:**
```
✅ Your post has been approved and published!
```

**Rejection Notification:**
```
❌ Your post was not approved.

Please ensure your content follows community guidelines.
```

---

## 10. GROUP CLEANUP SERVICE

### 10.1 Spam Detection

**Function:** `isSpamMessage()`

**Flagged as Spam:**
- Commands (except /menu, /start, /help)
- Non-English/Spanish text (> 10 chars)
- Multiple URLs (> 2 links)
- Excessive special characters (> 30%)
- All caps messages (> 70% uppercase)

**Cleanup Schedule:**
- 12:00 UTC daily
- 00:00 UTC (midnight) daily
- Messages older than 12 hours deleted

**Cleanup Log Message:**
```
Spam message deleted
Reason: [unauthorized_command | non_english_spanish | excessive_urls | excessive_special_chars | all_caps]
Age: [N]h
```

---

## 11. NOTIFICATION TEXTS SUMMARY

### Welcome Messages
- New member welcome (2 languages)
- Badge selection prompt
- Congratulations on badge selection
- Action buttons (Subscribe/Book Call)
- Rules menu button

### Rules & Moderation
- Community rules (quick & detailed)
- Moderation status display
- Warning messages (group & private)
- Kick/ban notifications
- Compliance warnings

### Reminders
- Subscription reminders (3-day & 1-day)
- Call reminders (24h, 1h, 15min)

### Admin Tools
- Moderation logs
- Statistics displays
- Username history
- Non-compliant users list
- Global ban lists

### Access Control
- Permission denied messages
- Rate limit warnings
- Auto-mute notifications
- Post approval workflow

### Auto-Delete
- Command redirect notices
- Personal info warnings
- All auto-delete scheduled messages

---

## 12. CONFIGURATION SETTINGS

### Environment Variables Affected
- `ENABLE_GROUP_CLEANUP` - Group cleanup service
- `ENABLE_CRON` - Scheduled reminders
- `GROUP_ID` - Target group for notifications
- `NOTIFICATIONS_TOPIC_ID` - Topic 3135 routing

### Database Collections Used
- Moderation settings
- User warnings
- Bans (group & global)
- Username history
- Topic configurations
- Non-compliant users
- Approval queue

---

## SUMMARY STATISTICS

**Total Functions Disabled:** 50+
**Total Commands Removed:** 17
**Total Middleware Disabled:** 8
**Total Services Disabled:** 3
**Total Scheduled Jobs Disabled:** 5
**Notification Message Types:** 30+
**Languages Supported:** 2 (English, Spanish)

All functionality has been completely disabled while maintaining code structure for potential future re-enablement.
