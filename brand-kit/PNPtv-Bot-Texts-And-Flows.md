# PNPtv! Bot — Complete Texts & Flows Guide

This document contains **every user-facing text, inline button, callback action, and flow** in the PNPtv! Telegram bot, organized by feature area.

---

## Table of Contents

1. [Onboarding Flow](#1-onboarding-flow)
2. [Main Menu](#2-main-menu)
3. [Subscription & Payment Flows](#3-subscription--payment-flows)
4. [Profile & Settings](#4-profile--settings)
5. [Nearby Users](#5-nearby-users)
6. [PNP Live (Private Shows)](#6-pnp-live-private-shows)
7. [Meet & Greet](#7-meet--greet)
8. [Private Calls](#8-private-calls)
9. [Hangouts (Video Calls)](#9-hangouts-video-calls)
10. [Videorama (Media Center)](#10-videorama-media-center)
11. [Live Streaming](#11-live-streaming)
12. [Jitsi Video Rooms](#12-jitsi-video-rooms)
13. [PRIME Members Area](#13-prime-members-area)
14. [Cristina AI Assistant](#14-cristina-ai-assistant)
15. [Support & Tickets](#15-support--tickets)
16. [Subscription Management](#16-subscription-management)
17. [Group Features](#17-group-features)
18. [Wall of Fame & Cult System](#18-wall-of-fame--cult-system)
19. [Leaderboard](#19-leaderboard)
20. [Promo Codes](#20-promo-codes)
21. [Admin Panel](#21-admin-panel)
22. [Deep Links](#22-deep-links)
23. [i18n Locale Keys](#23-i18n-locale-keys)
24. [Error & Warning Messages](#24-error--warning-messages)

---

## 1. Onboarding Flow

**Trigger:** `/start` (new user or incomplete onboarding)
**File:** `src/bot/handlers/user/onboarding.js`, `src/bot/handlers/start.js`

### Step 1: Language Selection

**Text:**
```
Welcome to PNPtv! Please select your language / Por favor selecciona tu idioma:
```

**Buttons:**
| Label | Callback Data |
|-------|--------------|
| `🇺🇸 English` | `set_lang_en` |
| `🇪🇸 Español` | `set_lang_es` |

---

### Step 2: Age Verification

**Text (EN):**
```
🔞 Age Verification

You must be 18 or older to use PNPtv.

Choose a verification method:
```

**Text (ES):**
```
🔞 Verificación de Edad

Debes tener 18 años o más para usar PNPtv.

Elige un método de verificación:
```

**Buttons:**
| Label | Callback Data |
|-------|--------------|
| `📸 Verify with Photo` / `📸 Verificar con Foto` | `age_verify_photo` |
| `✅ Confirm Manually` / `✅ Confirmar Manualmente` | `age_verify_manual` |

**Photo verification:** Uses AI to estimate age from selfie. Photo is NOT stored — deleted immediately.

**Manual confirmation buttons:**
| Label | Callback Data |
|-------|--------------|
| `✅ Yes, I am 18+` / `✅ Sí, tengo 18+` | `age_confirm_yes` |
| `❌ No` | `age_confirm_no` |

**If under 18 (EN):** `❌ Sorry, you must be 18 or older to use this service.`
**If under 18 (ES):** `❌ Lo sentimos, debes tener 18 años o más para usar este servicio.`

---

### Step 3: Terms & Privacy

**Text (EN):**
```
Please read and accept our Terms of Service and Privacy Policy
```

**Links:** `https://pnptv.app/terms` and `https://pnptv.app/privacy`

**Button:**
| Label | Callback Data |
|-------|--------------|
| `✅ Confirm` / `✅ Confirmar` | `accept_terms` |

---

### Step 4: Email

**Text (EN):**
```
📧 Please provide your email address:

⚠️ Email is required to complete your registration. We need your email in case the community
gets deleted for reasons out of our control, so we can communicate with you and provide
important updates.
```

**Text (ES):**
```
📧 Por favor proporciona tu dirección de email:

⚠️ El email es obligatorio para completar tu registro. Necesitamos tu email en caso de que
la comunidad sea eliminada por razones fuera de nuestro control, para poder comunicarnos
contigo y proporcionarte actualizaciones importantes.
```

**Button:**
| Label | Callback Data |
|-------|--------------|
| `📧 Provide Email` / `📧 Proporcionar Email` | `provide_email` |

User sends text message with email. Validation: 5-254 characters, RFC compliant.

**If duplicate email (EN):**
```
⚠️ Email Already Linked

The email `{email}` is already linked to another account.

You can try another email or contact support.
```

**Recovery button:**
| Label | Callback Data |
|-------|--------------|
| `✏️ Use another email` / `✏️ Usar otro email` | `onboarding_retry_email` |

**Success (EN):** `✅ Email received! Thank you.`
**Success (ES):** `✅ ¡Email recibido! Gracias.`

---

### Step 5: Location Sharing (Optional)

**Text (EN):**
```
📍 Share Location (Optional)

Want other members to find you on the Who is Nearby? map?

💡 This is completely optional and you can change it later in your profile.

🔒 Your privacy is protected: It will only show your approximate location to other
members who have also enabled this feature.

👥 Benefits:
• Connect with other cloudy papis near you
• Find slam buddies in your area
• Discover the local PNP scene

🌍 How it works:
• You only share your location when using the Who is Nearby? feature
• You can turn it off anytime
• Only visible to other verified members
```

**Text (ES):**
```
📍 Compartir Ubicación (Opcional)

¿Quieres que otros miembros te encuentren en el mapa de ¿Quién está Cercano??

💡 Esto es completamente opcional y puedes cambiarlo más tarde en tu perfil.

🔒 Tu privacidad está protegida: Solo mostrará tu ubicación aproximada a otros miembros
que también hayan activado esta función.

👥 Beneficios:
• Conecta con otros papis cloudy cerca de ti
• Encuentra slam buddies en tu área
• Descubre la escena local de PNP

🌍 ¿Cómo funciona?:
• Solo compartes tu ubicación cuando usas la función ¿Quién está Cercano?
• Puedes desactivarlo en cualquier momento
• Solo es visible para otros miembros verificados
```

**Buttons:**
| Label | Callback Data |
|-------|--------------|
| `📍 Yes, Share My Location` / `📍 Sí, Compartir Mi Ubicación` | `share_location_yes` |
| `🚫 No Thanks` / `🚫 No Gracias` | `share_location_no` |

**Confirmation (EN):** `✅ Location sharing enabled! You'll appear on the Nearby map.`
**Declined (EN):** `🔒 Location sharing disabled. You can enable it anytime in your profile.`

---

### Step 6: Onboarding Complete

**Text (EN):**
```
🎉 You're all set!

Welcome to the PNPtv community. Here's your exclusive one-time use link to access the free group:

🔗 Join the group ({link})

⏰ This link expires in 24 hours.
📱 Join now to access all content.
```

**Text (ES):**
```
🎉 ¡Estás listo!

Te damos la bienvenida a la comunidad PNPtv. Aquí está tu enlace exclusivo de acceso único
para el grupo gratuito:

🔗 Únete al grupo ({link})

⏰ Este enlace expira en 24 horas.
📱 Únete ahora para acceder a todo el contenido.
```

**If invite link fails (EN):**
```
⚠️ There was an issue generating your access link.

Don't worry, our support team will help you. Please contact:

🔗 https://t.me/pnptv_support

📞 Our team will give you manual access to the group within 5 minutes.
```

After completion → **Main Menu**

---

## 2. Main Menu

**Trigger:** `/menu` command or `back_to_main` callback
**File:** `src/bot/handlers/user/menu.js`

### PRIME Members Menu

**Text (EN):**
```
🎬 You are PRIME!

Thank you for being PRIME, papi! 🔥

Tap the buttons below and enjoy everything we've prepared for you —
videos, Nearby, lives, shows, and more.

Cristina, our AI assistant, is here to guide you and answer questions.
```

**Text (ES):**
```
🎬 ¡Eres PRIME!

¡Gracias por ser PRIME, papi! 🔥

Toca los botones de abajo y disfruta de todo lo que hemos preparado para ti —
videos, Nearby, lives, shows, y más.

Cristina, nuestra asistente IA, está aquí para guiarte y responder tus preguntas.
```

**Buttons:**
| Label | Type | Target |
|-------|------|--------|
| `PNP Latino TV \| Watch now` | URL | `https://t.me/+GDD0AAVbvGM3MGEx` |
| `PNP Live \| Latino Men on Webcam` | Callback | `PNP_LIVE_START` |
| `PNP tv App \| PRIME area` | Callback | `menu_pnp_tv_app` |
| `👤 My Profile` / `👤 Mi Perfil` | Callback | `show_profile` |
| `🆘 Help and support` / `🆘 Ayuda y soporte` | Callback | `show_support` |

---

### FREE Members Menu

**Text (EN):**
```
🎬 Welcome to PNPtv!

@{username} we love having you in the PNPtv Community! 💜

Hit Unlock PRIME to get even more cloudy fun — full-length videos,
lives, Nearby, and all member features.

Cristina, our AI assistant, is here to guide you and answer questions.
```

**Text (ES):**
```
🎬 ¡Bienvenido a PNPtv!

@{username} ¡Nos encanta tenerte en la comunidad PNPtv! 💜

Dale a Desbloquear PRIME para obtener aún más diversión cloudy — videos completos,
lives, Nearby, y todas las funciones de miembros.

Cristina, nuestra asistente IA, está aquí para guiarte y responder tus preguntas.
```

**Buttons:**
| Label | Callback Data |
|-------|--------------|
| `💎 PRIME Membership Plans` / `💎 Planes de Membresía PRIME` | `show_subscription_plans` |
| `📍 PNP Nearby` | `menu_nearby` |
| `🎬 Exclusive Content` / `🎬 Contenido Exclusivo` | `menu_content` |
| `👤 My Profile` / `👤 Mi Perfil` | `show_profile` |
| `🆘 Help & Support` / `🆘 Ayuda y Soporte` | `show_support` |

---

### PNP tv App Submenu (PRIME only)

**Text (EN):** `📱 PNP tv App — Choose an option from the PRIME area:`
**Text (ES):** `📱 PNP tv App — Selecciona una opción del área PRIME:`

**Buttons:**
| Label | Callback Data |
|-------|--------------|
| `🎥 Videorama` | `menu_videorama` |
| `📹 Hangouts` | `hangouts_menu` |
| `📡 Live Streams` | `show_live` |
| `📻 PNPtv Radio` | `menu_radio` |
| `⬅️ Back` / `⬅️ Atrás` | `back_to_main` |

---

### Group Menu (Restricted)

**Text (EN):** `PNPtv - Choose an option:`
**Text (ES):** `PNPtv - Selecciona una opción:`

**Buttons:**
| Label | Callback Data |
|-------|--------------|
| `💎 Subscribe to PRIME` / `💎 Suscribirse a PRIME` | `show_subscription_plans` |
| `📍 Nearby` / `📍 Cercanos` | `menu_nearby` |
| `🎥 PNPtv Main Room` | URL to Jitsi room |
| `💬 Support` / `💬 Soporte` | `show_support` |

**Group Redirect Message (EN):**
```
👋 Hello! You've been redirected from the group.

You can now use the bot in this private chat.

📋 Use /menu to navigate all available features.

⚠️ Remember: The group is NOT for customer service. Repeated violations will result in penalties.
```

---

## 3. Subscription & Payment Flows

**Trigger:** `/subscribe` or `show_subscription_plans` callback
**File:** `src/bot/handlers/payments/index.js`

### Plan Selection

**Header (EN):**
```
💎 Subscription Plans

Choose the plan that's right for you:
```

**Header (ES):**
```
💎 Planes de Suscripción

Elige el plan que mejor se ajuste a ti:
```

**Plan buttons format:** `[Name] | [Duration] days | $[Price]`

| Plan | Callback Data | Price | Duration |
|------|--------------|-------|----------|
| Week Pass | `select_plan_week_pass` | $14.99 | 7 days |
| Monthly Pass | `select_plan_monthly_pass` | $24.99 | 30 days |
| Crystal Pass (3-Month) | `select_plan_crystal_pass` | $49.99 | 90 days |
| 6-Month Pass | `select_plan_six_months_pass` | $74.99 | 180 days |
| Yearly Pass | `select_plan_yearly_pass` | $99.99 | 365 days |
| Lifetime Pass | `select_plan_lifetime_pass` | $249.99 | Permanent |

---

### Active Subscription Warning

**Text (EN):**
```
⚠️ You already have an active subscription

You cannot purchase a new subscription while you have an active one.

To avoid double payments, please wait until your current subscription
expires or contact support to change your plan.
```

**Text (ES):**
```
⚠️ Ya tienes una suscripción activa

No puedes comprar una nueva suscripción mientras tengas una activa.

Para evitar pagos duplicados, por favor espera a que tu suscripción actual
expire o contacta soporte para cambiar tu plan.
```

---

### Plan Details Screen

Shows plan name, price, duration, and up to 8 feature items.

**Payment buttons:**
| Label | Callback Data |
|-------|--------------|
| `💳 Pay with ePayco` / `💳 Pagar con ePayco` | `pay_epayco_{plan_id}` |
| `🪙 Pay with Daimo` / `🪙 Pagar con Daimo` | `pay_daimo_{plan_id}` |
| `⬅️ Back` / `⬅️ Atrás` | `back_to_main` |

---

### ePayco Payment Flow

**Recurring plans** (Monthly, Crystal, 6-Month, Yearly) → redirect to ePayco subscription landing page:
```
https://subscription-landing.epayco.co/plan/{epaycoId}?extra1={userId}&extra2={planId}&extra3={paymentId}
```

**One-time plans** (Week Pass, Lifetime Pass) → custom checkout page with card form:
```
https://easybots.site/payment/{paymentId}
```

---

### Daimo (Crypto) Payment Flow

**Text (EN):**
```
🪙 Pay in Crypto with Daimo Pay

Plan: {planName}
Price: ${price} USDC

You can complete your subscription using crypto through our Daimo Pay checkout —
fast, secure, discreet, and perfect for members who prefer private, borderless payments.

💳 Daimo Pay accepts USDC, and you can pay using popular wallets such as:
Binance • Coinbase Wallet • MetaMask • Trust Wallet • Kraken Wallet • OKX Wallet •
Bybit Wallet, and more.

📱 Or pay using the most popular payment apps, including:
{paymentApps}

Just choose your wallet or app, confirm the transaction, and you're done.

✅ Once your payment is confirmed, you'll automatically receive:
• Your PRIME access message
• Your invoice
• Your onboarding instructions

💬 If you need help during checkout, just message Cristina, our AI assistant —
she'll guide you step by step or pass you to Santino if needed.
```

**Text (ES):**
```
🪙 Paga en Crypto con Daimo Pay

Plan: {planName}
Precio: ${price} USDC

Completa tu suscripción usando crypto a través de nuestro checkout de Daimo Pay —
rápido, seguro, discreto y perfecto para miembros que prefieren pagos privados y sin fronteras.

💳 Daimo Pay acepta USDC, y puedes pagar usando wallets populares como:
Binance • Coinbase Wallet • MetaMask • Trust Wallet • Kraken Wallet • OKX Wallet •
Bybit Wallet, y más.

📱 O paga usando las apps de pago más populares:
{paymentApps}

Solo elige tu wallet o app, confirma la transacción, y listo.

✅ Una vez confirmado tu pago, recibirás automáticamente:
• Tu mensaje de acceso PRIME
• Tu factura
• Tus instrucciones de onboarding

💬 Si necesitas ayuda durante el checkout, escríbele a Cristina, nuestra asistente AI —
ella te guiará paso a paso o te conectará con Santino si es necesario.
```

**Daimo button:**
| Label | Type | Target |
|-------|------|--------|
| `🪙 Complete Payment` / `🪙 Completar Pago` | URL | Daimo checkout URL |

---

### Payment Confirmation (Enhanced)

**File:** `src/bot/services/messageTemplates.js`

**Text (EN):**
```
🎉 Thank you for your purchase and for supporting PNPtv!

✅ Your membership is activated automatically—no waiting, no manual approval.

📦 What's included in your membership:

• Videorama – Video, music, and podcast playlists
• Hangouts – Community video call rooms
• PNP Television Live – Live streams and exclusive recordings

📋 Purchase Details:
• Plan: {planName}
• Amount: ${amount} USD
• Provider: {providerName}
• Purchase Date: {date}
• Valid until: {expiryStr}
• Transaction ID: {transactionId}

📢 Important notice
Our channel was recently reported, and we are re-uploading content.
We are back in production, and new content is being released continuously.

💰 Refund policy (Regular sales)
Because activation is automatic, you may request a refund within 30 minutes
AFTER PURCHASE if you are not satisfied.
Approved refunds may take up to 15 business days to be processed.

🌟 Welcome to PRIME!

👉 Access the exclusive channel here:
🔗 Join PRIME ({inviteLink})

💎 Enjoy all premium content and exclusive benefits.

📚 How to use PNPtv?
👉 Complete guide: https://pnptv.app/how-to-use

📱 Use /menu to see all available features.

Thank you for supporting an independent, community-powered project! 🔥
```

**Text (ES):**
```
🎉 ¡Gracias por tu compra y por apoyar a PNPtv!

✅ Tu membresía ha sido activada automáticamente—sin espera, sin aprobación manual.

📦 Lo que incluye tu membresía:

• Videorama – Listas de reproducción de videos, música y podcasts
• Hangouts – Salas de videollamadas comunitarias
• PNP Television Live – Transmisiones en vivo y grabaciones exclusivas

📋 Detalles de tu compra:
• Plan: {planName}
• Monto: ${amount} USD
• Proveedor: {providerName}
• Fecha de compra: {date}
• Válido hasta: {expiryStr}
• ID de Transacción: {transactionId}

📢 Aviso importante
Nuestro canal fue reportado recientemente y estamos volviendo a subir contenido.
Ya estamos en producción y se está lanzando nuevo contenido continuamente.

💰 Política de reembolso (ventas regulares)
Como la activación es automática, puedes solicitar un reembolso dentro de los
30 minutos DESPUÉS DE LA COMPRA si no estás satisfecho.
Los reembolsos aprobados pueden tardar hasta 15 días hábiles en procesarse.

🌟 ¡Bienvenido a PRIME!

👉 Accede al canal exclusivo aquí:
🔗 Ingresar a PRIME ({inviteLink})

💎 Disfruta de todo el contenido premium y beneficios exclusivos.

📚 ¿Cómo usar PNPtv?
👉 Guía completa: https://pnptv.app/how-to-use

📱 Usa /menu para ver todas las funciones disponibles.

¡Gracias por apoyar un proyecto independiente y impulsado por la comunidad! 🔥
```

---

### Lifetime Pass Confirmation

**Text (EN):**
```
🎉 Congratulations! Your Lifetime Pass has been successfully activated.

✅ Your membership is now PERMANENT
✅ Unlimited access to all content
✅ No expiration dates
✅ All premium features unlocked

🔥 Enjoy:
• Full HD/4K videos
• Exclusive PNP content
• "Who's Nearby" feature
• Priority 24/7 support
• Free future updates

📚 How to use PNPtv?
👉 Complete guide: https://pnptv.app/how-to-use

📱 Use /menu to see all available features.

Welcome to the PNPtv community! 🎊
```

---

### Lifetime100 Promo (Manual Payment)

**Text (EN):**
```
📝 Manual payment required

For Lifetime100 Promo, please send your payment receipt to support.
You can purchase at: https://pnptv.app/lifetime100
```

**Text (ES):**
```
📝 Pago manual requerido

Para el Lifetime100 Promo, por favor envía tu recibo de pago a soporte.
Puedes comprar en: https://pnptv.app/lifetime100
```

---

## 4. Profile & Settings

**File:** `src/bot/handlers/user/profile.js`, `src/bot/handlers/user/settings.js`

### Profile View

**Trigger:** `show_profile` callback

Displays: Username, Bio, Profile photo, Membership status (PRIME/FREE), Registration date, Interests, Looking For, Tribe, Social links

**Header (EN):** `💎 Membership: PRIME` or `🆓 Membership: FREE`

**Buttons:**
| Label | Callback Data |
|-------|--------------|
| `✏️ Edit Profile` / `✏️ Editar Perfil` | `show_edit_profile_overview` |
| `📋 View Full Profile` / `📋 Ver Perfil Completo` | `view_full_profile` |
| `🔙 Back` / `🔙 Atrás` | `back_to_main` |

---

### Edit Profile Overview

**Buttons:**
| Label | Callback Data |
|-------|--------------|
| `📝 Edit Bio` / `📝 Editar Bio` | `edit_bio` |
| `🖼️ Edit Photo` / `🖼️ Editar Foto` | `edit_photo` |
| `🏳️‍🌈 Edit Interests` / `🏳️‍🌈 Editar Intereses` | `edit_interests` |
| `🎯 Looking For` / `🎯 Buscando` | `edit_looking_for` |
| `🏳️‍🌈 Edit Tribe` / `🏳️‍🌈 Editar Tribu` | `edit_tribe` |
| `📍 Edit Location` / `📍 Editar Ubicación` | `edit_location` |
| `🏙️ Edit City` / `🏙️ Editar Ciudad` | `edit_city` |
| `🌍 Edit Country` / `🌍 Editar País` | `edit_country` |
| `📱 Edit TikTok` | `edit_tiktok` |
| `🐦 Edit X/Twitter` | `edit_twitter` |
| `📘 Edit Facebook` | `edit_facebook` |
| `📷 Edit Instagram` | `edit_instagram` |
| `⬅️ Back` / `⬅️ Atrás` | `back_to_main` |

---

### Edit Profile Prompts

| Field | Prompt (EN) | Prompt (ES) |
|-------|------------|------------|
| Tribe | `🏳️‍🌈 What's your tribe? Examples: Bear, Otter, Jock, Twink, Daddy, etc. Send your tribe or "delete" to remove:` | `🏳️‍🌈 ¿Cuál es tu tribu? Ejemplos: Bear, Otter, Jock, Twink, Daddy, etc. Envía tu tribu o "borrar" para eliminar:` |
| Looking For | `🔎 What are you looking for? Examples: "A slam buddy", "Cloudy friends", "Serious relationship", "Casual fun" Send or "delete" to remove:` | `🔎 ¿Qué estás buscando? Ejemplos: "Un slam buddy", "Amigos cloudy", "Relación seria", "Diversión casual" Envía o "borrar" para eliminar:` |
| City | `🏙️ What city are you in? Send your city name or "delete" to remove:` | `🏙️ ¿En qué ciudad estás? Envía el nombre de tu ciudad o "borrar" para eliminar:` |
| Country | `🌍 What country are you in? Send your country name or "delete" to remove:` | `🌍 ¿En qué país estás? Envía el nombre de tu país o "borrar" para eliminar:` |
| Bio | `📝 Send your bio (max 500 characters)` | `📝 Envía tu bio (máximo 500 caracteres)` |
| Interests | `🎯 Send your interests (comma separated)` | `🎯 Envía tus intereses (separados por comas)` |
| TikTok | `📱 Send your TikTok username (without @) or "delete" to remove:` | `📱 Envía tu usuario de TikTok (sin @) o "borrar" para eliminar:` |
| X/Twitter | `🐦 Send your X/Twitter username (without @) or "delete" to remove:` | `🐦 Envía tu usuario de X/Twitter (sin @) o "borrar" para eliminar:` |
| Instagram | `📷 Send your Instagram username (without @) or "delete" to remove:` | `📷 Envía tu usuario de Instagram (sin @) o "borrar" para eliminar:` |
| Facebook | `📘 Send your Facebook username or "delete" to remove:` | `📘 Envía tu nombre de usuario de Facebook o "borrar" para eliminar:` |

**Confirmations:** `✅ Updated` / `✅ Actualizado`, `✅ Removed` / `✅ Eliminado`

---

### Settings Menu

**Trigger:** `show_settings` callback

**Buttons:**
| Label | Callback Data |
|-------|--------------|
| `🇺🇸/🇪🇸 Change Language` / `🇺🇸/🇪🇸 Cambiar Idioma` | `settings_language` |
| `🔔 Notifications` / `🔔 Notificaciones` | `settings_notifications` |
| `🔒 Privacy` / `🔒 Privacidad` | `settings_privacy` |
| `ℹ️ About` / `ℹ️ Acerca de` | `settings_about` |
| `⬅️ Back` / `⬅️ Atrás` | `back_to_main` |

**Language change buttons:**
| Label | Callback Data |
|-------|--------------|
| `🇺🇸 English` | `change_lang_en` |
| `🇪🇸 Español` | `change_lang_es` |
| `← Back` | `show_settings` |

---

## 5. Nearby Users

**Trigger:** `menu_nearby` callback or `/start nearby`
**File:** `src/bot/handlers/user/nearbyUnified.js`

### Nearby Menu

**Text (EN):**
```
📍 Nearby Users

Want to meet cloudy papis near you? 👀
```

**Buttons:**
| Label | Callback Data / Type |
|-------|---------------------|
| `📍 Find Users Nearby` | `show_nearby` |
| `🗺️ View Map` | Web App: `https://pnptv.app/nearby-map` |
| `📍 Edit Location` | `edit_location` |
| `👥 View Nearby Members` | `list_nearby_members` |

### Nearby Users List

```
🔥 Nearby Users 🔥

Found {count} users within {radius} km 👀

🥇 John - 0.5 km away
🥈 Mike - 1.2 km away
🥉 Carlos - 2.1 km away
...
```

Each user has button: `View {Username}` → callback: `view_user_{user_id}`

### User Profile Card (from Nearby)

**Action buttons:**
| Label | Callback Data |
|-------|--------------|
| `💬 Send Message` | Opens Telegram DM |
| `❤️ Add to Favorites` | `add_favorite_{user_id}` |
| `🚫 Block User` | `block_user_{user_id}` |
| `⬅️ Back` | `show_nearby` |

**No results (EN):** `😢 No Results — No users found within {X} km`
**No results (ES):** `😢 Sin Resultados — No se encontraron usuarios dentro de {X} km`

---

## 6. PNP Live (Private Shows)

**Trigger:** `PNP_LIVE_START` callback or `/start pnp_live`
**File:** `src/bot/handlers/user/pnpLiveHandler.js`

### Model Selection

**Text (EN):**
```
📹 PNP Live - Private Shows

🔥 Connect with our performers for exclusive private shows.

🟢 Online Now | ⚪ Available

Select an option to continue:
```

**Text (ES):**
```
📹 PNP Live - Shows Privados

🔥 Conecta con nuestros performers para shows privados exclusivos.

🟢 Online Ahora | ⚪ Disponibles

Selecciona una opción para continuar:
```

**Buttons:**
| Label | Callback Data |
|-------|--------------|
| `{ModelName} 🟢 ⭐{rating}` | `pnp_select_model_{model_id}` |
| `💰 From $60 - 30 min` | `pnp_show_pricing` |
| `🔍 View All Models` | `pnp_show_all_models` |

### Pricing Tiers

| Tier | Duration | Price |
|------|----------|-------|
| Standard | 30 min | $60 |
| Extended | 60 min | $120 |
| Premium | 90 min | $180 |
| VIP | 2 hours | $250 |

### Booking Confirmation

```
🎭 Call with {ModelName}

You've selected a private show with {ModelName}.

💰 Price: ${price} USD
Duration: {duration} minutes
Payment: ePayco/Daimo/Other methods

Proceed to payment to book your show.
```

**Payment buttons:**
| Label | Callback Data |
|-------|--------------|
| `💳 Pay with ePayco` | `pnp_pay_epayco_{model_id}_{tier}` |
| `🪙 Pay with Crypto` | `pnp_pay_crypto_{model_id}_{tier}` |
| `⬅️ Back` | `PNP_LIVE_START` |

---

## 7. Meet & Greet

**Trigger:** `meetgreet_menu` callback
**File:** `src/bot/handlers/user/meetGreetHandler.js`

### Meet & Greet Menu

**Text (EN/ES):** Similar to PNP Live, offers virtual 1-on-1 meet & greet sessions with performers.

**Pricing tiers:** Same as PNP Live ($60-$250)

**Buttons:**
| Label | Callback Data |
|-------|--------------|
| `📅 Book Meet & Greet` | `meetgreet_book_{model_id}` |
| `💳 Pay with ePayco` | `meetgreet_pay_epayco_{booking_id}` |
| `🪙 Pay with Crypto` | `meetgreet_pay_crypto_{booking_id}` |
| `⬅️ Back` | `back_to_main` |

---

## 8. Private Calls

**Trigger:** `private_calls_menu` callback
**File:** `src/bot/handlers/user/privateCalls.js`

### Private Calls Flow

**Price:** $100 for a 1-on-1 video call with a performer

**Payment methods:** Zelle, CashApp, Venmo (via Daimo Pay)

**Buttons:**
| Label | Callback Data |
|-------|--------------|
| `📞 Book Private Call` | `private_call_book_{performer_id}` |
| `💳 Pay & Book ($100)` | `private_call_pay_{booking_id}` |
| `⬅️ Back` | `back_to_main` |

---

## 9. Hangouts (Video Calls)

**Trigger:** `hangouts_menu` callback
**File:** `src/bot/handlers/user/hangoutsHandler.js`

### Hangouts Menu

**Text (EN):**
```
🎥 PNP Hangouts

Video calls and community rooms.

📞 Active Calls: {number}
🏠 Main Rooms: {number}

Choose an option:
```

**Buttons:**
| Label | Callback Data |
|-------|--------------|
| `🎥 Create Video Call` / `🎥 Crear Videollamada` | `create_video_call` |
| `📋 My Calls` / `📋 Mis Llamadas` | `my_active_calls` |
| `🏠 {RoomName} ({current}/{max})` | `join_main_room_{room_id}` |
| `⬅️ Main Menu` / `⬅️ Menú Principal` | `back_to_main` |

### Create Video Call Flow

1. Bot asks for call title
2. Bot asks for description (optional — type "skip")
3. Creates public/private call
4. Generates Jitsi/Agora meeting link
5. Shares with specified participants

---

## 10. Videorama (Media Center)

**Trigger:** `menu_videorama` callback
**File:** `src/bot/handlers/user/videoramaHandler.js`

### Videorama Menu

**Text (EN):**
```
🎶 PNP Videorama

Your media center with videos, music and podcasts.

📹 Videos: {count}
🎵 Music: {count}
🎙️ Podcasts: {count}
```

**Buttons:**
| Label | Callback Data / Type |
|-------|---------------------|
| `📹 Videos` | `videorama_videos` |
| `🎵 Music` | `videorama_music` |
| `🎙️ Podcasts` | `videorama_podcasts` |
| `📻 PNPtv Radio` | `menu_radio` |
| `🎬 Open Videorama` | Web App: `https://pnptv.app/videorama-app` |
| `⬅️ Main Menu` | `back_to_main` |

**Radio buttons:**
| Label | Type |
|-------|------|
| `📻 Listen to Radio` | Web App: `https://pnptv.app/radio` |

---

## 11. Live Streaming

**Trigger:** `show_live` callback
**File:** `src/bot/handlers/media/live.js`, `src/bot/handlers/media/livestream.js`

### Live Menu

**Text (ES):**
```
🎤 Transmisiones en Vivo

¡Mira o inicia tu propio show en vivo! 🔥

Cristina, nuestra asistente IA, está aquí para ayudarte.

Elige una opción abajo 💜
```

**Buttons:**
| Label | Callback Data |
|-------|--------------|
| `🎤 Start Live Stream` / `🎤 Iniciar Transmisión` | `live_start` |
| `📺 Watch Streams` / `📺 Ver Transmisiones` | `live_view` |
| `📁 Browse Categories` / `📁 Categorías` | `live_browse_categories` |
| `🎬 VODs` | `live_view_vods` |
| `📊 My Streams` / `📊 Mis Transmisiones` | `live_my_streams` |

### Stream Categories

| Category | Emoji |
|----------|-------|
| Music | 🎵 |
| Gaming | 🎮 |
| Talk Show | 🎙 |
| Education | 📚 |
| Entertainment | 🎭 |
| Sports | ⚽ |
| News | 📰 |
| Other | 📁 |

Callback pattern: `live_category_{category}`

### Show Types & Pricing

| Type | Price | Callback |
|------|-------|----------|
| Regular Show | $10 | `live_price_10` |
| VIP Show | $20 | `live_price_20` |
| Free | $0 | `live_paid_no` |

### During Stream Buttons

| Label | Callback Data |
|-------|--------------|
| `📺 Watch Stream` | URL to stream |
| `❤️ Like` | `live_like_{streamId}` |
| `💬 Comments` | `live_comments_{streamId}` |
| `🔗 Share` | `live_share_{streamId}` |
| `🔔 Follow` / `🔕 Unfollow` | `live_subscribe_{streamerId}` / `live_unsubscribe_{streamerId}` |
| `👋 Leave` | `live_leave_{streamId}` |
| `💬 Add Comment` | `live_add_comment_{streamId}` |
| `🛑 End Stream` (host) | `live_end_{streamId}` |

---

## 12. Jitsi Video Rooms

**Trigger:** `show_jitsi` callback or `/jitsi`
**File:** `src/bot/handlers/media/jitsi.js`

### Jitsi Menu

**Text (ES):**
```
📹 Salas de Jitsi Meet

Crea salas de videollamadas para tus reuniones.

🏠 Mini - hasta 10 personas
🏢 Mediana - hasta 50 personas
🌐 Ilimitada - sin límite
```

**Buttons:**
| Label | Callback Data |
|-------|--------------|
| `➕ Create Room` / `➕ Crear Sala` | `jitsi_create` |
| `🔗 Join Room` / `🔗 Unirse a Sala` | `jitsi_join` |
| `📋 My Rooms` / `📋 Mis Salas` | `jitsi_my_rooms` |
| `🌐 Active Rooms` / `🌐 Salas Activas` | `jitsi_active` |

### Room Tiers

| Tier | Max People | Callback |
|------|-----------|----------|
| 🏠 Mini | 10 | `jitsi_tier_mini` |
| 🏢 Medium | 50 | `jitsi_tier_medium` |
| 🌐 Unlimited | No limit | `jitsi_tier_unlimited` |

### Privacy Selection

| Label | Callback Data |
|-------|--------------|
| `🌍 Public` / `🌍 Pública` | `jitsi_privacy_public` |
| `🔒 Private` / `🔒 Privada` | `jitsi_privacy_private` |

**Premium required (ES):** `🔒 Acceso Premium Requerido — Las salas de Jitsi están disponibles solo para miembros premium.`

---

## 13. PRIME Members Area

**File:** `src/bot/handlers/media/membersArea.js`

### Non-PRIME Lock Screen

**Text (ES):**
```
🔒 Área de Miembros PRIME

Esta área está disponible solo para miembros PRIME.

✨ Con PRIME obtienes acceso a:
• Salas de Video Llamadas
• Shows en Vivo
• Radio PNPtv!
• Y mucho más...
```

**Buttons:**
| Label | Callback Data |
|-------|--------------|
| `⭐ Get PRIME` / `⭐ Obtener PRIME` | `show_subscription_plans` |
| `🔙 Back` / `🔙 Atrás` | `back_to_main` |

### PRIME Members Welcome

**Text (ES):** `💎 Área de Miembros PRIME — ¡Bienvenido al área exclusiva para miembros PRIME!`

**Buttons:**
| Label | Callback Data / Type |
|-------|---------------------|
| `🎥 Watch Videos` / `🎥 Ver Videos` | URL: `https://t.me/+BcIn29RC-xExMzAx` |
| `📹 Video Call Rooms` / `📹 Salas de Video Llamadas` | URL: Jitsi room link |
| `🎬 Live Shows` / `🎬 Shows en Vivo` | `show_live_shows` |

---

## 14. Cristina AI Assistant

**Trigger:** Send "Hey Cristina" or "Ey Cristina" in group/private chat
**File:** `src/bot/handlers/support/cristinaAI.js`

### How It Works

- Uses Grok AI model (`grok-3`) for responses
- Maintains conversation history per user
- In groups, redirects to private chat with the bot
- Can answer questions about PNPtv features, plans, and general queries

### Group Redirect

**Text (ES):**
```
🧜‍♀️ @{username} gracias por usar nuestro bot. Por favor revisa @{botUsername} para mas información.

Recuerda enviar "Ey Cristina" si tienes alguna pregunta.
```

**Text (EN):**
```
🧜‍♀️ @{username} thank you for using our bot. Please check @{botUsername} for more info.

Remember to send "Hey Cristina" if you have a question.
```

**Button:**
| Label | Type |
|-------|------|
| `💬 Open Bot` / `💬 Abrir Bot` | URL to bot |

### Personal Info Redirect

**Text (ES):** `Esta pregunta contiene información personal. Por favor, contáctame en privado para proteger tu privacidad.`
**Text (EN):** `This question contains personal information. Please contact me privately to protect your privacy.`

---

## 15. Support & Tickets

**File:** `src/bot/handlers/user/support.js`, `src/bot/handlers/support/supportRouting.js`

### Support Command

**Trigger:** `/support` or `show_support` callback

**Text (EN):**
```
💬 Create Support Ticket

Please describe your issue or question.
A support agent will reply as soon as possible.
```

**Text (ES):**
```
💬 Crear Ticket de Soporte

Por favor, describe tu problema o pregunta.
Un agente de soporte te responderá lo antes posible.
```

### Support Routing System

Features:
- Quick answers for common questions
- SLA tracking
- Ticket escalation
- Admin notification in support group

---

## 16. Subscription Management

**Trigger:** `/subscription` command
**File:** `src/bot/handlers/user/subscriptionManagement.js`

### Active Recurring Subscription

**Text (EN):**
```
📋 Your Recurring Subscription

✅ Status: Active
💎 Plan: {planName}
💰 Price: ${amount} USD/month
💳 Card: {cardFranchise} ****{last4}
📅 Next renewal: {periodEnd}
```

**Buttons:**
| Label | Callback Data |
|-------|--------------|
| `❌ Cancel Subscription` / `❌ Cancelar Suscripción` | `subscription_cancel_menu` |
| `💳 Update Payment Method` / `💳 Actualizar Método de Pago` | `subscription_update_card` |
| `⬅️ Back to Menu` / `⬅️ Volver al Menú` | `main_menu` |

### Status Indicators

| Status | Emoji | EN | ES |
|--------|-------|----|----|
| active | ✅ | Active | Activa |
| trialing | 🎁 | Trial | Período de prueba |
| past_due | ⚠️ | Past Due | Pago pendiente |
| cancelled | ❌ | Cancelled | Cancelada |

### One-Time Subscription

**Text (EN):**
```
📋 Your PRIME Membership

✅ Status: Active (one-time payment)
📅 Expires: {expiryDate}

🔄 Want automatic renewal?
Enable monthly subscription to never lose access.
```

**Button:**
| Label | Callback Data |
|-------|--------------|
| `🔄 Enable Auto-Renewal` / `🔄 Activar Auto-Renovación` | `subscription_setup_recurring` |

### No Subscription

**Text (EN):**
```
📋 Subscription

You don't have an active PRIME membership.

🔄 Options:
• One-time purchase with /prime
• Monthly automatic subscription
```

### Cancel Subscription

**Text (EN):**
```
❌ Cancel Subscription

Are you sure you want to cancel your subscription?

Options:
• Cancel at period end: Keep access until {periodEnd}
• Cancel immediately: Lose access now

⚠️ You can reactivate anytime before the period ends.
```

**Buttons:**
| Label | Callback Data |
|-------|--------------|
| `📅 Cancel at Period End` | `subscription_cancel_end` |
| `🛑 Cancel Immediately` | `subscription_cancel_now` |
| `⬅️ Go Back` | `subscription_manage` |

### Setup Monthly Subscription

**Text (EN):**
```
🔄 Setup Monthly Subscription

📋 Plan: {planName}
💰 Price: ${price} USD/month
🔄 Renewal: Automatic every month

Benefits:
• Never lose PRIME access
• Cancel anytime
• No long-term commitment

To continue, you need to add a credit/debit card.
```

### Add Card

**Text (EN):**
```
💳 Add Payment Method

Click the button below to securely add your card.

🔒 Your data is protected with SSL encryption.
💳 We accept Visa, Mastercard, and American Express.
```

---

## 17. Group Features

**File:** `src/config/groupMessages.js`, `src/bot/handlers/user/groupWelcome.js`

### Auto-Moderation Reasons

| Reason | Message |
|--------|---------|
| Muted | You are currently muted |
| Forwarded | Forwarded messages are not allowed in this group |
| Spam | Spam detected (duplicate messages) |
| Flood | Too many messages too quickly |
| Links | Links are not allowed in this group |
| Profanity | Inappropriate language detected |

### Group Rules

**EN:**
```
📘 PNPtv Rules:

• 🔞 Must be 18+
• 🤝 Respect all members
• 🚫 No spam
• 🔗 No links allowed
• ⚠️ 3 strikes = ban
• 💬 Stay on topic
• 🤖 No bots
```

**ES:**
```
📘 Reglas de PNPtv:

• 🔞 Debes tener 18+ años
• 🤝 Respeto entre miembros
• 🚫 Sin spam
• 🔗 Sin enlaces
• ⚠️ 3 strikes = ban
• 💬 Mantente en tema
• 🤖 Sin bots
```

### Feature Coming Soon

**EN:** `🚧 This feature is coming soon! Stay tuned for updates.`
**ES:** `🚧 ¡Esta función estará disponible pronto! Mantente atento a las actualizaciones.`

### Live Streams Coming Soon

**EN:** `🚧 COMING OUT THIS WEEKEND`
**ES:** `🚧 ESTRENO EL FIN DE SEMANA`

---

## 18. Wall of Fame & Cult System

**File:** `src/bot/handlers/group/wallOfFame.js`

### How It Works

The Wall of Fame is a dedicated TOPIC in the main group. When users share photos/videos, they are automatically posted to the Wall of Fame with member profile information. Monthly rankings determine "Cult" badge winners.

### Cult Badges

| Badge | Award | Prize |
|-------|-------|-------|
| 🥇 High Legend of the Cult | Most interactions (reactions received) | 3 free PRIME days |
| Tribute of the Cult | 2nd place | Invitation to Santino's private hangout |
| The Loyal Disciple | 3rd place | Invitation to Lex's private hangout |

### Cult Events (Monthly)

| Event | When | Duration |
|-------|------|----------|
| Lex's Hangout | 2nd Saturday, 20:00-22:00 UTC | 2 hours |
| Santino's Hangout | 2nd Saturday, 22:00-00:00 UTC | 2 hours |
| The Meth Gala | Last Saturday, 20:00 UTC | Open-ended |

### Wall of Fame Member Caption

```
👑 Featured Member

Name: {displayName}
Username: @{username}
Bio: {bio}
Looking for: {lookingFor}
Interests: {interests}
Social Media: 📸 Instagram | 𝕏 X | 🎵 TikTok | ▶️ YouTube | ✈️ Telegram

✨ Featured on Wall of Fame
```

### Cult Buttons

| Label | Callback Data |
|-------|--------------|
| `✅ Activate 3-Day PRIME` / `✅ Activar PRIME 3 días` | `cult_claim_prime_{monthKey}` |
| `🗓️ Register for Santino's Hangout` | `cult_register_santino_{monthKey}` |
| `🗓️ Register for Lex's Hangout` | `cult_register_lex_{monthKey}` |
| `🎉 Register for The Meth Gala` | `cult_register_gala_{monthKey}` |

### Registration Confirmation

**EN:**
```
✅ Registration confirmed

📅 Date: {date}
🕗 Time: {time}

We will send reminders 1 week before, 3 days before, and on the day.
```

**ES:**
```
✅ Registro confirmado

📅 Fecha: {date}
🕗 Hora: {time}

Te enviaremos recordatorios 1 semana antes, 3 días antes y el día del evento.
```

**Toast messages:**
- PRIME claimed (ES): `¡PRIME activado! 🎉`
- Already claimed (ES): `PRIME ya fue activado.`
- Expired (ES): `Este premio ya expiró.`
- Registered (ES): `¡Registrado!`

---

## 19. Leaderboard

**Trigger:** `/leaderboard`, `/ranking`, or `/top`
**File:** `src/bot/handlers/group/leaderboard.js`

### Leaderboard Display

```
🏆 Ranking de {TopicName}

📸 Usuarios con más fotos/videos:
🥇 @user1 — 45
🥈 @user2 — 32
🥉 @user3 — 28
4. @user4 — 15
...

❤️ Contenido más popular:
🥇 @user1 — 120 reactions
...

👍 Usuarios que más reaccionan:
🥇 @user1 — 89
...

Actualizado en tiempo real • ¡Sigue compartiendo!
```

**Errors:**
- Topic-only: `⚠️ Este comando solo funciona en temas del grupo.`
- Disabled: `⚠️ El ranking no está habilitado en este tema.`

---

## 20. Promo Codes

**Trigger:** `/start promo_{CODE}` deep link
**File:** `src/bot/handlers/payments/promoHandler.js`

### Promo Flow

1. User clicks promo deep link
2. Bot shows discounted plan details
3. User selects payment method
4. Payment processed with discount applied

### Activation Code Flow

**File:** `src/bot/handlers/payments/activation.js`

**Invalid code (EN):** `❌ Invalid code. Please check that you entered the code correctly.`
**Already used (EN):** `❌ This code has already been used. Each code can only be activated once.`
**Expired (EN):** `❌ This code has expired. Please contact support for help.`

**Lifetime100 receipt request (EN):**
```
📝 Please attach your payment receipt as a reply to this message.

You can send an image or document.
```

**Receipt confirmation (EN):** `✅ Receipt received. Our team will review and activate your account soon.`

---

## 21. Admin Panel

**Trigger:** `/admin` (admin users only)
**File:** `src/bot/handlers/admin/index.js` (3000+ lines)

### Admin Home Menu

**Sections:**
| Label | Callback Data |
|-------|--------------|
| `📊 Dashboard` | `admin_dashboard` |
| `👥 Users Management` | `admin_users` |
| `💰 Payments & Analytics` | `admin_payments` |
| `📢 Broadcasts` | `admin_broadcast` |
| `🐦 X/Twitter Posts` | `admin_xpost` |
| `📱 Content Management` | `admin_content` |
| `🛡️ Moderation` | `admin_moderation` |
| `⚙️ Settings` | `admin_settings` |

---

### Broadcast Wizard

**Step 1 — Select Audience:**
| Label | Callback Data |
|-------|--------------|
| `Todos (All)` | `broadcast_audience_all` |
| `Premium` | `broadcast_audience_premium` |
| `Free` | `broadcast_audience_free` |
| `Churned (Ex-Premium)` | `broadcast_audience_churned` |
| `Payment Incomplete` | `broadcast_audience_payment_incomplete` |

**Step 2 — Add Media (Optional):** Upload photo/video or skip

**Step 3 — English Text (Optional):** Write or use AI

**Step 4 — Spanish Text (Optional):** Write or use AI

**Step 5 — Buttons:**

Standard button options:
| Label (ES/EN) | Callback Data |
|----------------|--------------|
| `💎 Ver Planes` / `💎 View Plans` | `show_subscription_plans` |
| `⭐ Obtener Premium` / `⭐ Get Premium` | `show_subscription_plans` |
| `🆘 Obtener Ayuda` / `🆘 Get Help` | `show_support` |
| `📢 Compartir` / `📢 Share` | Share button |
| `✨ Explorar Funciones` / `✨ Explore Features` | `back_to_main` |
| `👥 Unirse a la Comunidad` / `👥 Join Community` | Group link |
| `📣 Canal` / `📣 Channel` | Channel link |
| `🆘 Soporte` / `🆘 Support` | `show_support` |
| `📍 Cercanos` / `📍 Nearby` | `menu_nearby` |
| `👤 Mi Perfil` / `👤 My Profile` | `show_profile` |
| `◀️ Atrás` / `◀️ Back` | `back_to_main` |

**Step 6 — Scheduling:** Send now, schedule for specific date/time, or recurring

---

### X Post Wizard

**File:** `src/bot/handlers/admin/xPostWizard.js`

**Menu (ES):**
```
🐦 Panel de Publicación en X

📊 Cuentas activas: {number}
🕐 Posts programados: {number}

Últimos posts:
  ✅ {date} - {preview}...
```

**Buttons:**
| Label | Callback Data |
|-------|--------------|
| `✍️ Crear Nuevo Post` | `xpost_new` |
| `🕐 Ver Programados` | `xpost_view_scheduled` |
| `📜 Historial` | `xpost_view_history` |
| `⚙️ Gestionar Cuentas` | `admin_x_accounts_configure_x` |
| `◀️ Volver al Panel` | `admin_cancel` |

**X Post Steps:**
1. Select account
2. Compose text (max 280 chars) or use AI (Grok)
3. Add media (optional)
4. Preview post
5. Schedule: Send now or schedule for later
6. Confirmation with status

---

## 22. Deep Links

**Supported `/start` parameters:**

| Parameter | Action |
|-----------|--------|
| `activate_lifetime` | Lifetime pass activation request |
| `promo_{CODE}` | Promotional code redemption |
| `plans` / `show_subscription_plans` | Direct to subscription plans |
| `nearby` / `show_nearby` / `show_nearby_unified` | Direct to nearby users |
| `edit_profile` | Direct to profile editing |
| `pnp_live` | Direct to PNP Live section |
| `viewprofile_{USER_ID}` | Direct to specific user profile |
| `group_redirect` | Group-to-PM redirect with instructions |

### Lifetime Activation Request (Deep Link)

**Text (EN):**
```
✅ Activation Request Received

We have received your request to activate the Lifetime Pass.

📋 Details:
• Plan: Lifetime Pass ($100 USD)
• User: {username}

⏱️ Your subscription will be activated within 24 hours.

We will send you a confirmation message when it's ready.

If you have any questions, use /support to contact us.
```

---

## 23. i18n Locale Keys

**Files:** `locales/en/messages.json`, `locales/es/messages.json`

### English Keys (60 keys)

| Key | Text |
|-----|------|
| `welcome` | Welcome message |
| `select_language` | Language selection prompt |
| `language_changed` | Language confirmation |
| `age_verification` | Age verification prompt |
| `age_too_young` | Age rejection message |
| `terms_accept` | Terms acceptance prompt |
| `terms_accepted` | Terms acceptance confirmation |
| `enter_username` | Username prompt |
| `enter_bio` | Bio prompt |
| `enter_location` | Location prompt |
| `profile_complete` | Profile completion message |
| `profile_updated` | Profile update confirmation |
| `subscription_plans` | Subscription header |
| `emailPrompt` | `📧 Please provide your email address:` |
| `emailRequiredNote` | `⚠️ Email is required to complete your registration...` |
| `emailReceived` | `✅ Email received! Thank you.` |
| `emailInvalid` | `❌ Invalid email address. Please enter a valid email.` |
| `locationSharingEnabled` | `✅ Location sharing enabled! You'll appear on the Nearby map.` |
| `locationSharingDisabled` | `🔒 Location sharing disabled. You can enable it anytime in your profile.` |
| `locationSharingToggleEnabled` | `✅ Location sharing turned ON. You'll now appear on the Nearby map!` |
| `locationSharingToggleDisabled` | `🔒 Location sharing turned OFF. You won't appear on the Nearby map.` |
| `lookingForUpdated` | `✅ Looking for updated!` |
| `interestsUpdated` | `✅ Interests updated!` |
| `bioUpdated` | `✅ Bio updated!` |
| `tribeUpdated` | `✅ Tribe updated!` |
| `sendInterests` | `🎯 Send your interests (comma separated)` |
| `sendBio` | `📝 Send your bio (max 500 characters)` |
| `sendTribe` | `🏳️‍🌈 Send your tribe (e.g., Bear, Otter, Jock)` |
| `invalidInput` | `❌ Invalid input. Please try again.` |
| `admin_only` | `🔒 This command is available for administrators only.` |
| `unauthorized` | `❌ Unauthorized. Admin access required.` |
| `broadcast_sent` | `✅ Broadcast sent to {count} users` |
| `broadcast_failed` | `⚠️ Broadcast completed with {failed} failures` |
| `error_occurred` | `❌ An error occurred. Please try again later.` |
| `rate_limit_exceeded` | `⚠️ You're sending commands too quickly. Please wait a moment and try again.` |

### Spanish Keys (72 keys)

Includes all above keys with Spanish translations, plus additional broadcast button texts.

---

## 24. Error & Warning Messages

### Payment Errors

**ePayco Error (EN):**
```
❌ Payment Processing Error

An error occurred while creating your ePayco payment.
Please try again or contact support if the problem persists.
```

**ePayco Error (ES):**
```
❌ Error al procesar el pago

Ocurrió un error al crear tu pago con ePayco.
Por favor intenta nuevamente o contacta soporte si el problema persiste.
```

**Payment Failed (EN):** `❌ Payment failed. Please try again.`

### General Errors

**Database (EN):** `⚠️ We are experiencing database connectivity issues. Please try again in a few minutes.`

**Generic (EN):** `❌ An error occurred. Please try /start again.`

### Rate Limit

**EN:** `⚠️ You're sending commands too quickly. Please wait a moment and try again.`
**ES:** `⚠️ Estás enviando comandos muy rápido. Por favor espera un momento e intenta de nuevo.`

### Location Required

**EN:** `📍 Location Required — You need to share your location first!`
**ES:** `📍 Ubicación Requerida — ¡Necesitas compartir tu ubicación primero!`

### Locked Feature

**EN:** `🔒 Feature for premium users only. Subscribe to unlock.`
**ES:** `🔒 Función solo para usuarios premium. Suscríbete para acceder.`

### Already PRIME

**EN:** `✅ You are already a PRIME member! Enjoy all features.`

---

## Command Reference

### User Commands

| Command | Description |
|---------|------------|
| `/start` | Begin onboarding or show main menu |
| `/menu` | Show main menu |
| `/subscribe` / `/prime` | Show subscription plans |
| `/subscription` | Manage existing subscription |
| `/support` | Create support ticket |
| `/onboard` | Restart onboarding |
| `/language` | Change language |
| `/profile` | View/edit profile |
| `/nearby` | Find nearby users |
| `/cristina` | Chat with AI assistant |
| `/mycalls` | View call history |
| `/jitsi` | Open Jitsi rooms |
| `/livestream` | Open livestream menu |
| `/leaderboard` / `/ranking` / `/top` | Show group leaderboard |

### Admin Commands

| Command | Description |
|---------|------------|
| `/admin` | Open admin panel |
| `/broadcast` | Start broadcast wizard |
| `/xpost` | Start X post wizard |
| `/users` | User management |

---

## Session Keys Reference

| Key | Purpose |
|-----|---------|
| `ctx.session.language` | User's selected language (`en` / `es`) |
| `ctx.session.onboardingStep` | Current onboarding step |
| `ctx.session.onboardingComplete` | Onboarding completion status |
| `ctx.session.temp` | Temporary wizard/flow data |
| `ctx.session.temp.waitingForEmail` | Email input mode active |
| `ctx.session.temp.emailConflict` | Email duplicate tracking |
| `ctx.session.temp.selectedPlan` | Selected subscription plan |
| `ctx.session.temp.selectedModel` | Selected model for booking |
| `ctx.session.temp.pnpLive` | PNP Live booking data |
| `ctx.session.temp.xPostWizard` | X post wizard state |

---

## Callback Data Pattern Reference

| Pattern | Purpose |
|---------|---------|
| `back_to_main` | Return to main menu |
| `show_profile` | View profile |
| `show_support` | Open support |
| `show_subscription_plans` | View plans |
| `select_plan_{id}` | Select a plan |
| `pay_epayco_{id}` | Pay via ePayco |
| `pay_daimo_{id}` | Pay via Daimo |
| `set_lang_{code}` | Set language (onboarding) |
| `change_lang_{code}` | Change language (settings) |
| `view_user_{id}` | View user profile |
| `add_favorite_{id}` | Add to favorites |
| `block_user_{id}` | Block user |
| `PNP_LIVE_START` | Open PNP Live |
| `pnp_select_model_{id}` | Select performer |
| `menu_nearby` | Open nearby |
| `menu_videorama` | Open videorama |
| `hangouts_menu` | Open hangouts |
| `show_live` | Open live streams |
| `menu_pnp_tv_app` | Open PRIME app area |
| `live_join_{id}` | Join stream |
| `live_like_{id}` | Like stream |
| `jitsi_create` | Create Jitsi room |
| `jitsi_tier_{tier}` | Select room tier |
| `cult_claim_prime_{month}` | Claim PRIME reward |
| `cult_register_{event}_{month}` | Register for cult event |
| `subscription_cancel_menu` | Cancel subscription menu |
| `subscription_update_card` | Update payment card |
| `admin_*` | Admin panel actions |
| `xpost_*` | X post wizard actions |
| `broadcast_*` | Broadcast wizard actions |

---

*This document covers all user-facing texts, inline keyboard buttons, callback data values, and flows in the PNPtv! bot as of February 2026.*
