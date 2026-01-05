# Payment Screenshots - Quick Reference

Quick reference guide for capturing payment flow screenshots.

## 🚀 Quick Start

```bash
# Run interactive helper
node scripts/capture-payment-screenshots.js

# View checklist only
node scripts/capture-payment-screenshots.js --method=epayco

# Generate test URLs
node scripts/capture-payment-screenshots.js --generate-urls
```

## 📊 Screenshot Summary

| Category | Count | Description |
|----------|-------|-------------|
| **Common** | 8 | Initial subscription flow (all methods) |
| **ePayco** | 14 | Credit/debit card payments |
| **Daimo** | 13 | Crypto/USDC payments |
| **PayPal** | 10 | PayPal payments |
| **Post-Payment** | 8 | Confirmations, emails, access |
| **Admin** | 3 | Admin dashboard views |
| **Errors** | 5 | Error scenarios |
| **TOTAL** | **61+** | Complete documentation |

## 🎯 Priority Screenshots

### Must-Have (Core Flow)
1. `/subscribe` command → Plan selection
2. Payment method buttons (3 options)
3. Checkout pages (ePayco, Daimo, PayPal)
4. Success confirmations (Telegram)
5. PRIME channel invite link

### Important (User Experience)
6. Language variants (EN/ES for ePayco)
7. Mobile views (responsive layouts)
8. Email confirmations (invoice + welcome)
9. Payment history view
10. Subscription status

### Nice-to-Have (Edge Cases)
11. Error messages
12. Admin views
13. Different payment app options (Daimo)
14. Funding source variants (PayPal)

## 🔑 Test Credentials

### ePayco
```
Success Card: 4575623182290326
CVV: 123, Expiry: 12/25

Declined Card: 4151611527583283
CVV: 123, Expiry: 12/25
```

### Daimo
```
Network: Optimism (Chain ID: 10)
Token: USDC
Address: 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85
Testnet: Optimism Goerli (Chain ID: 420)
```

### PayPal
```
Dashboard: https://developer.paypal.com/dashboard/
Use sandbox test accounts
```

## 📱 Capture Guidelines

### Desktop Screenshots
- **Resolution**: 1920x1080
- **Browser**: Chrome/Firefox latest
- **Format**: PNG

### Mobile Screenshots
- **Device**: iPhone/Android (actual or emulator)
- **Resolution**: Native device resolution
- **Format**: PNG

### Quality Checklist
- [ ] No real personal information visible
- [ ] Clear and readable text
- [ ] Consistent test user across all screenshots
- [ ] Proper lighting/contrast
- [ ] No browser extensions visible (use incognito)

## 🗂️ File Organization

```
docs/screenshots/payment-flow/
├── common/           # 01-04: Initial flow
├── epayco/           # 05-14: ePayco flow
├── daimo/            # 15-25: Daimo flow
├── paypal/           # 26-35: PayPal flow
├── post-payment/     # 36-43: Post-payment
├── admin/            # 44-46: Admin views
└── errors/           # 47-51: Errors
```

## 🔄 Workflow

### Step 1: Setup
```bash
# Ensure bot is running
npm start

# Or use staging environment
# Set BOT_WEBHOOK_DOMAIN to staging URL
```

### Step 2: Create Test Payment
1. Open Telegram
2. Send `/subscribe` to bot
3. Select plan (e.g., Trial)
4. Choose payment method
5. Copy checkout URL

### Step 3: Capture Screenshots
1. Open URL in browser
2. Take screenshot (initial state)
3. Fill form with test data
4. Take screenshot (filled state)
5. Submit payment
6. Take screenshot (processing)
7. Take screenshot (success/failure)
8. Return to Telegram
9. Take screenshot (confirmation message)

### Step 4: Organize
1. Rename file using naming convention
2. Move to appropriate folder
3. Update progress checklist

## 📋 Quick Checklist

### Common Flow (All Methods)
- [ ] 01: `/subscribe` command
- [ ] 02: Plans list
- [ ] 03a-e: Each plan selected (5 screenshots)
- [ ] 04: Payment methods

### ePayco (14 screenshots)
- [ ] Desktop checkout
- [ ] Mobile checkout
- [ ] Spanish version
- [ ] English version
- [ ] Form states (empty, filled, error)
- [ ] Success/failure

### Daimo (13 screenshots)
- [ ] Checkout page
- [ ] 8 payment app options
- [ ] QR code
- [ ] Wallet connection
- [ ] Success

### PayPal (10 screenshots)
- [ ] Checkout
- [ ] Login
- [ ] Review
- [ ] 3 funding sources
- [ ] Success
- [ ] Cancelled

### Post-Payment (8 screenshots)
- [ ] Invoice email
- [ ] Welcome emails (EN/ES)
- [ ] Channel invite
- [ ] Payment history
- [ ] Subscription status

## 🎨 Screenshot Naming

```
{step}_{method}_{description}.png

Examples:
✓ 01_common_start_command.png
✓ 06_epayco_checkout_desktop.png
✓ 17a_daimo_option_zelle.png
✓ 30b_paypal_funding_card.png
✗ screenshot1.png (bad)
✗ payment-flow.png (bad)
```

## 🔗 Resources

- **Full Documentation**: [PAYMENT_FLOW_SCREENSHOTS.md](./PAYMENT_FLOW_SCREENSHOTS.md)
- **Helper Script**: `scripts/capture-payment-screenshots.js`
- **Screenshot Directory**: `docs/screenshots/payment-flow/`

## 💡 Tips

1. **Use Incognito Mode**: Avoid browser extensions in screenshots
2. **Consistent Test User**: Use same name/email across all screenshots
3. **Clear Cache**: Between captures to show fresh state
4. **Note Timestamps**: Some UIs show timestamps - these are okay
5. **Multiple Languages**: Capture both EN/ES where applicable
6. **Device Variety**: Show both desktop and mobile views

## ⚡ Common Commands

```bash
# Start bot locally
npm start

# Run in test mode
NODE_ENV=test npm start

# View all payment methods
# In Telegram: /subscribe

# Check progress
node scripts/capture-payment-screenshots.js
# Select: 4. View progress report

# View checklist for specific method
node scripts/capture-payment-screenshots.js
# Select: 1. View screenshot checklist
# Enter: epayco (or daimo, paypal)
```

## 🎯 Today's Goal

Start with these **10 essential screenshots**:

1. ✓ `/subscribe` command response
2. ✓ Plans list
3. ✓ Payment method buttons
4. ✓ ePayco checkout (desktop)
5. ✓ ePayco success
6. ✓ Daimo checkout
7. ✓ PayPal checkout
8. ✓ Telegram confirmation (any method)
9. ✓ Invoice email
10. ✓ PRIME channel invite

**Time estimate**: ~2-3 hours for core screenshots

---

## 📞 Need Help?

- **Full docs**: See [PAYMENT_FLOW_SCREENSHOTS.md](./PAYMENT_FLOW_SCREENSHOTS.md)
- **Technical issues**: Check [EPAYCO_INTEGRATION.md](./EPAYCO_INTEGRATION.md), [DAIMO_PAY_INTEGRATION.md](./DAIMO_PAY_INTEGRATION.md)
- **Test environment**: Ensure `.env` has correct test mode settings

---

**Last Updated**: 2026-01-05
**Status**: Ready to begin screenshot capture
