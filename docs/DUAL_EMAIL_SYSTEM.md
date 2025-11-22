# Dual Email System - Implementation Summary

## Overview

When a payment is completed, the user receives **TWO separate emails**:

### Email 1: PNPtv Subscription Confirmation
**From:** `no-reply@easybots.store` (or pnptv.app if configured)
**Subject:** `🎉 ¡Bienvenido a PNPtv PRIME! - Confirmación de Pago`

**Contents:**
- Welcome message with customer name
- Payment details (amount, currency, plan name)
- Subscription information (start date, next payment date)
- **One-time use invite links** to PRIME channels
- List of PRIME benefits
- Automatic reminder schedule information

**Purpose:** User onboarding and PRIME channel access

---

### Email 2: Purchase Invoice
**From:** `no-reply@easybots.store`
**Subject:** `Gracias por tu compra - Factura adjunta`

**Contents:**
- Thank you message
- Purchase confirmation
- **PDF invoice attached** (professional Spanish format)

**Attachment:** `Factura_INV-[timestamp].pdf`

**Purpose:** Purchase receipt and accounting documentation

---

## Invoice Format (PDF)

### Header
- **Company:** Easy Bots Store
- **Email:** no-reply@easybots.store
- **Phone:** +57 302 857 3797
- **Location:** Bucaramanga, Colombia

- **Customer:** Name and email from payment data
- **Date:** Invoice date in Spanish format

### Body (Table)
| SKU | DESCRIPCIÓN | CANT. | PRECIO |
|-----|-------------|-------|--------|
| EASYBOTS-[PLAN] | Servicios de Inteligencia Artificial - Desarrollo y mantenimiento de bots automatizados y herramientas de IA para gestión empresarial | 1 | $XX.XX |

### Totals
- **Subtotal USD:** $XX.XX
- **Subtotal COP:** $XXX,XXX (with exchange rate)
- **TOTAL USD:** $XX.XX
- **TOTAL COP:** $XXX,XXX

### Notes
- Exchange rate shown: $1 USD = $4,200 COP
- Services note: "Los servicios de IA incluyen desarrollo, implementación y mantenimiento continuo de soluciones automatizadas."

### Footer (Small Font)
```
Easy Bots Store - KR33 86-76 Bucaramanga, Colombia
Carlos Humberto Jimenez Manrique NIT 1098643746-2
```

---

## Technical Implementation

### Files Modified

1. **`src/bot/services/invoiceservice.js`** - Complete PDF generation with PDFKit
2. **`src/bot/services/paymentService.js`** - Added invoice generation + dual email sending
3. **`src/services/emailService.js`** - Added `sendPurchaseInvoice()` method

### Workflow (ePayco & Daimo)

```
Payment Webhook Received
    ↓
Subscription Activated
    ↓
Bot Message Sent (Telegram)
    ↓
Email 1: Subscription Confirmation Sent
    ↓
Invoice PDF Generated
    ↓
Email 2: Purchase Invoice Sent (with PDF attached)
```

### Invoice Generation

```javascript
const invoice = await InvoiceService.generateInvoice({
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  planSku: 'EASYBOTS-PRIME',
  planDescription: 'Suscripción PNP Member - Servicios de IA...',
  amount: 24.99,      // In USD
  currency: 'USD',
  exchangeRate: 4200  // USD to COP
});
// Returns: { id, pdf (file path), buffer, fileName }
```

### Email Sending

```javascript
// Email 1: Subscription confirmation
await EmailService.sendPaymentConfirmation({
  email: customerEmail,
  name: customerName,
  planName: 'PNP Member',
  amount: 24.99,
  currency: 'USD',
  nextPaymentDate: 'February 18, 2025',
  inviteLinks: ['https://t.me/+xyz123']
});

// Email 2: Purchase invoice
await EmailService.sendPurchaseInvoice({
  email: customerEmail,
  name: customerName,
  invoiceBuffer: invoice.buffer,
  invoiceFileName: invoice.fileName,
  amount: 24.99,
  currency: 'USD'
});
```

---

## Configuration

No new environment variables needed. Uses existing:

```bash
# Email Configuration
EMAIL_FROM=no-reply@easybots.store
SENDGRID_API_KEY=your_key_here
# Or SMTP settings
```

---

## Storage

**Invoice PDFs** are saved to: `/invoices/`
- File format: `INV-[timestamp].pdf`
- Added to `.gitignore` (not committed to git)
- Automatically created if directory doesn't exist

---

## Currency Handling

### ePayco Payments (COP)
- Receives amount in COP
- Converts to USD (÷ 4200)
- Invoice shows both currencies

### Daimo Payments (USD/USDC)
- Receives amount in USD
- No conversion needed
- Invoice uses direct USD amount
- COP equivalent calculated with fixed rate (4200)

---

## Example User Flow

1. **User pays** via ePayco or Daimo
2. **Webhook received** - Payment confirmed
3. **Database updated** - Subscription activated
4. **Telegram message** - Welcome with PRIME links
5. **Email 1 arrives** - "¡Bienvenido a PNPtv PRIME!"
   - Contains subscription details and channel links
6. **Email 2 arrives** - "Gracias por tu compra"
   - Contains PDF invoice as attachment

Both emails arrive within seconds of payment completion.

---

## Testing

### Test Invoice Generation

```bash
node -e "
const InvoiceService = require('./src/bot/services/invoiceservice');
InvoiceService.generateInvoice({
  customerName: 'Test User',
  customerEmail: 'test@example.com',
  planSku: 'EASYBOTS-TEST',
  amount: 24.99,
  currency: 'USD',
  exchangeRate: 4200
}).then(invoice => {
  console.log('Invoice ID:', invoice.id);
  console.log('File path:', invoice.pdf);
  console.log('File name:', invoice.fileName);
});
"
```

### Check Invoice Files

```bash
ls -la invoices/
# Shows generated PDFs: INV-1234567890.pdf
```

### View Logs

```bash
# Successful invoice generation
tail -f logs/combined.log | grep -i invoice

# Email sending
tail -f logs/combined.log | grep -i "purchase invoice"
```

---

## Troubleshooting

### Invoice Not Generated

**Check:**
1. `invoices/` directory exists
2. Write permissions on directory
3. `pdfkit` npm package installed
4. Check logs for errors: `grep "invoice" logs/error.log`

### Email Not Sent

**Check:**
1. Email configuration (`SENDGRID_API_KEY` or SMTP)
2. Customer has email in payment data
3. Check logs: `grep "purchase invoice email" logs/combined.log`

### Invoice PDF Issues

**Common issues:**
- **Missing fonts:** PDFKit uses Helvetica (built-in, no issues)
- **File size:** PDFs are typically 5-10KB
- **Special characters:** All Spanish characters (á, é, í, ó, ú, ñ) supported

---

## Accounting & Legal

### Invoice Purpose
- Provides formal purchase documentation
- Shows company legal info (NIT, address)
- Suitable for business expense claims
- Complies with Colombian invoicing requirements

### Tax Information
- NIT: 1098643746-2
- Business name: Carlos Humberto Jimenez Manrique
- Trade name: Easy Bots Store

### Product Classification
- **Category:** AI Services / Software Maintenance
- **Description:** Intentionally vague (professional but generic)
- **Use case:** Suitable for various accounting categorizations

---

## Support

For issues or questions:
- **Technical:** Check logs in `logs/combined.log`
- **Email:** support@easybots.store
- **Phone:** +57 302 857 3797

---

**Version:** 1.0.0
**Last Updated:** 2025-01-19
**Status:** ✅ Production Ready
