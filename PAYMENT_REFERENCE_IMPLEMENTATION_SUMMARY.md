# Payment Reference Implementation - Summary

## ✅ What Has Been Completed

### 1. Code Implementation
- ✅ Modified `PaymentModel.updateStatus()` to support reference field mapping
- ✅ Updated all ePayco webhook processing to store `x_ref_payco` as reference
- ✅ Updated all Daimo webhook processing to store transaction hash as reference
- ✅ Bot restarted - changes are now live and active

### 2. Tools Created
Four new scripts have been created to manage payment references:

1. **`prime-members-with-references.js`** - View all PRIME members with their payment references
2. **`add-payment-reference.js`** - Manually add a reference to a single payment
3. **`find-payment-by-reference.js`** - Search for payments by ePayco reference
4. **`batch-add-references.js`** - Add multiple references at once
5. **`process-epayco-refund.js`** - Process refunds via ePayco API

### 3. Documentation
- ✅ Created `PAYMENT_REFERENCE_TRACKING.md` with comprehensive documentation
- ✅ Includes usage examples, troubleshooting, and refund workflows

## 🔄 Current Status

### Automatic Tracking (NEW PAYMENTS)
✅ **ALL future payments will automatically store payment references**
- ePayco payments: Store x_ref_payco
- Daimo payments: Store transaction hash
- No manual intervention needed

### Existing Payments (OLD)
⚠️ **110 active PRIME members - none have references stored yet**
- These are legacy payments from before this feature
- Can be added manually if needed for support/refunds

## 📋 How to Handle the Two Refunds You Mentioned

You mentioned two ePayco references need refunds:
- **320358448**
- **320357719**

### Option 1: Process Refunds Directly (Recommended)

Since these are ePayco reference numbers, you can process refunds directly without needing them in the database first:

```bash
# Process first refund
node scripts/process-epayco-refund.js 320358448

# Process second refund
node scripts/process-epayco-refund.js 320357719
```

**What the script does:**
1. Authenticates with ePayco API
2. Calls the refund endpoint for that reference
3. Returns success/failure with detailed info
4. Provides troubleshooting tips if it fails

**If API fails:** The script will tell you to use the manual dashboard method:
1. Go to https://dashboard.epayco.co
2. Search for the transaction by reference
3. Click "Anular" (Cancel/Refund)

### Option 2: Find the Payments First (Optional)

If you want to identify which users these payments belong to:

```bash
# Step 1: Show recent payments to identify users
node scripts/batch-add-references.js

# Step 2: Match payments to references and add them
# (You'll need to look at ePayco dashboard to match user/amount/date)

# Step 3: Once added, you can find the payment details
node scripts/find-payment-by-reference.js 320358448

# Step 4: Process refund
node scripts/process-epayco-refund.js 320358448

# Step 5: Update database
psql -h localhost -p 55432 -U pnptvbot -d pnptvbot -c "
  UPDATE payments 
  SET status = 'refunded' 
  WHERE reference = '320358448';
"
```

## 🎯 Recommended Next Steps

### For the Immediate Refunds:
1. **Process refunds using ePayco API:**
   ```bash
   cd /root/pnptvbot-production
   node scripts/process-epayco-refund.js 320358448
   node scripts/process-epayco-refund.js 320357719
   ```

2. **If successful:** Make note of which users these belong to and notify them

3. **If API fails:** Use manual dashboard refund and document the transaction details

### For Future Reference Tracking:
✅ **Nothing to do!** The system is already set up and will automatically track all future payment references.

### For Existing Payments (Optional):
Only add references to old payments if:
- You need to process refunds (like the two above)
- Customer support needs to look up a specific transaction
- You want historical data completeness

**How to add references for old payments:**
```bash
# Interactive mode - shows recent payments
node scripts/batch-add-references.js

# Or add individual references
node scripts/add-payment-reference.js <payment_id> <epayco_ref>
```

## 📊 Quick Reference Commands

```bash
# View all PRIME members with payment references
node scripts/prime-members-with-references.js

# Find a payment by ePayco reference
node scripts/find-payment-by-reference.js 320358448

# Add a reference to a payment
node scripts/add-payment-reference.js <payment_id> <epayco_ref>

# Process a refund
node scripts/process-epayco-refund.js 320358448

# Batch add references
node scripts/batch-add-references.js
```

## 🔍 Testing

To verify everything is working:

1. **Test with a new payment:**
   - Have someone make a test payment
   - Check that the reference is automatically stored
   - Query: `SELECT * FROM payments WHERE reference IS NOT NULL ORDER BY created_at DESC LIMIT 1;`

2. **Test reference lookup:**
   ```bash
   node scripts/find-payment-by-reference.js <test_reference>
   ```

3. **Test PRIME members report:**
   ```bash
   node scripts/prime-members-with-references.js
   ```

## 💡 Key Points

1. ✅ **Future-proof:** All new payments automatically get references
2. ✅ **No maintenance:** System runs automatically, no ongoing work needed
3. ✅ **Easy refunds:** Can process refunds directly via API or dashboard
4. ✅ **Backward compatible:** Old payments still work, can add references if needed
5. ✅ **Well documented:** Complete documentation in `PAYMENT_REFERENCE_TRACKING.md`

## 🆘 Support & Troubleshooting

If you encounter issues:

1. **Check bot logs:**
   ```bash
   tail -f logs/bot_logs.txt | grep -i payment
   ```

2. **Check database:**
   ```bash
   psql -h localhost -p 55432 -U pnptvbot -d pnptvbot -c "
     SELECT id, user_id, provider, reference, status 
     FROM payments 
     ORDER BY created_at DESC 
     LIMIT 10;
   "
   ```

3. **Review documentation:**
   - `PAYMENT_REFERENCE_TRACKING.md` - Complete technical documentation
   - This file - Quick start summary

## 📧 What to Tell Users

When processing refunds, you can send this message:

**English:**
```
Your refund for ePayco transaction #[REF] has been processed. 
The amount will be returned to your original payment method 
within 5-10 business days. If you have questions, please contact 
support with your transaction reference: [REF]
```

**Spanish:**
```
Tu reembolso para la transacción ePayco #[REF] ha sido procesado.
El monto será devuelto a tu método de pago original en 5-10 días 
hábiles. Si tienes preguntas, contacta a soporte con tu referencia 
de transacción: [REF]
```

---

**Status:** ✅ COMPLETE AND READY TO USE

All code changes have been deployed, the bot has been restarted, and the system is now tracking payment references automatically for all new payments.
