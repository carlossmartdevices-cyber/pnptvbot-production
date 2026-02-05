# Domain Configuration Guide

## Domain Separation

### pnptv.app - Bot & API Backend
**Purpose:** Telegram bot webhooks and API endpoints

**Endpoints:**
- `/webhook/telegram` - Telegram bot webhook (POST)
- `/api/payment-response` - Payment success/failure page (GET) - User-facing redirect

### easybots.store - Payment Webhooks & Checkout
**Purpose:** Payment provider webhooks and checkout pages

**Endpoints:**
- `/api/webhooks/epayco` - ePayco payment confirmations (POST)
- `/api/webhooks/daimo` - Daimo payment confirmations (POST)
- `/payment/{id}` - Checkout pages (GET)

## Environment Variables

```env
# Telegram Bot
BOT_WEBHOOK_DOMAIN=https://pnptv.app

# Payment Checkout Pages
CHECKOUT_DOMAIN=https://easybots.store

# Payment Provider Webhooks (server-to-server callbacks)
EPAYCO_WEBHOOK_DOMAIN=https://easybots.store
```

## ePayco Configuration

When creating ePayco checkout, configure:
- **Confirmation URL** (webhook callback): `https://easybots.store/api/webhooks/epayco`
- **Response URL** (user redirect): `https://pnptv.app/api/payment-response`

These are DIFFERENT domains because:
1. Webhook callbacks (server-to-server) go to easybots.store
2. User redirects (browser) go to pnptv.app

## Current Issue

The payment response URL is hardcoded to use `EPAYCO_WEBHOOK_DOMAIN` but should use `BOT_WEBHOOK_DOMAIN` since it's a user-facing page, not a webhook callback.

**Fix needed:** Update `paymentController.js` line 122 to use `BOT_WEBHOOK_DOMAIN` for response URL.
