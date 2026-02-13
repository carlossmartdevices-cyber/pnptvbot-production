# Payment Reference Tracking Documentation

## Overview
Payment reference tracking has been implemented to store ePayco references (Ref.Payco) and Daimo transaction hashes in the `payments` table. This allows easier identification of transactions for refunds, support, and auditing.

## What Was Changed

### 1. Database Schema
The `payments` table already had a `reference` field (VARCHAR). No schema changes were needed.

### 2. Code Changes

#### `/src/models/paymentModel.js`
- Updated `updateStatus()` method to map `epaycoRef`, `paymentReference`, and `daimoEventId` to the `reference` column
- Added logging for metadata when updating payment status

#### `/src/bot/services/paymentService.js`
- **ePayco webhook processing**: All status updates now include `epaycoRef: x_ref_payco` to store the ePayco reference
  - Applied to: completed, failed, pending, fraud_blocked, and cancelled statuses
- **Daimo webhook processing**: All status updates now include `daimoEventId: source?.txHash || id` to store the transaction hash
  - Applied to: completed, failed, and pending statuses

### 3. New Scripts Created

#### `scripts/prime-members-with-references.js`
**Purpose**: Generate a report of all active PRIME members with their payment reference information

**Usage**:
```bash
node scripts/prime-members-with-references.js
```

**Output**:
- Total active PRIME members count
- Statistics on references (with/without)
- Detailed list of each member with:
  - Telegram ID and username
  - Plan and expiry date
  - Payment reference (if available)
  - Provider and payment details

#### `scripts/add-payment-reference.js`
**Purpose**: Manually add payment references to existing payment records

**Usage**:
```bash
node scripts/add-payment-reference.js <payment_id> <epayco_reference>
```

**Example**:
```bash
node scripts/add-payment-reference.js 1df99d7b-b9ef-4c18-9d44-3ecf1591551a 320358448
```

**Use Case**: For old payments that don't have references stored yet

#### `scripts/find-payment-by-reference.js`
**Purpose**: Search for payment records by ePayco reference

**Usage**:
```bash
node scripts/find-payment-by-reference.js <epayco_reference>
```

**Example**:
```bash
node scripts/find-payment-by-reference.js 320358448
```

**Output**: All payment records matching the reference, including user ID, amount, status, and dates

#### `scripts/process-epayco-refund.js`
**Purpose**: Process refunds through the ePayco REST API

**Usage**:
```bash
node scripts/process-epayco-refund.js <ref_payco>
```

**Example**:
```bash
node scripts/process-epayco-refund.js 320358448
node scripts/process-epayco-refund.js 320357719
```

**Features**:
- Authenticates with ePayco API using credentials from `.env`
- Calls the refund endpoint
- Provides detailed error messages with troubleshooting tips
- Suggests manual dashboard refund as fallback

**Alternative Method**: Manual refund via dashboard
1. Login to https://dashboard.epayco.co
2. Search for transaction by reference
3. Click "Anular" (Cancel/Refund)

## How It Works

### For New Payments (Automatic)

1. **User initiates payment** → Payment record created with status `pending`

2. **ePayco webhook received** → Webhook contains `x_ref_payco` field

3. **Payment status updated** → `reference` field automatically populated with `x_ref_payco`

4. **Future lookups** → Can query by reference field to find payment and user

### For Existing Payments (Manual)

Old payments don't have references stored. Use the manual script:

```bash
# Find the payment ID for a user
psql -h localhost -p 55432 -U pnptvbot -d pnptvbot -c "
  SELECT id, user_id, amount, status 
  FROM payments 
  WHERE user_id = '7111801456' 
  ORDER BY created_at DESC 
  LIMIT 1;
"

# Add the reference
node scripts/add-payment-reference.js <payment_id> <ref_payco>
```

## Database Queries

### Get all payments with references
```sql
SELECT 
  id, 
  user_id, 
  provider, 
  reference, 
  amount, 
  status, 
  completed_at
FROM payments 
WHERE reference IS NOT NULL
ORDER BY completed_at DESC;
```

### Find payment by ePayco reference
```sql
SELECT * FROM payments WHERE reference = '320358448';
```

### Count payments with/without references
```sql
SELECT 
  COUNT(*) FILTER (WHERE reference IS NOT NULL) as with_reference,
  COUNT(*) FILTER (WHERE reference IS NULL) as without_reference
FROM payments 
WHERE status = 'completed';
```

## Refund Workflow

### Step 1: Find the payment
```bash
node scripts/find-payment-by-reference.js 320358448
```

### Step 2: Process the refund
```bash
node scripts/process-epayco-refund.js 320358448
```

### Step 3: Update payment status in database
```bash
psql -h localhost -p 55432 -U pnptvbot -d pnptvbot -c "
  UPDATE payments 
  SET status = 'refunded', updated_at = NOW()
  WHERE reference = '320358448';
"
```

### Step 4: Deactivate user subscription (if needed)
```bash
psql -h localhost -p 55432 -U pnptvbot -d pnptvbot -c "
  UPDATE users 
  SET subscription_status = 'cancelled', 
      plan_expiry = NOW()
  WHERE id = '<user_id>';
"
```

### Step 5: Notify the user
Send a message via Telegram explaining the refund has been processed.

## Current Status

### Statistics (as of implementation)
- Total Active PRIME Members: 110
- Payments with Reference: 0 (all were created before this feature)
- Payments without Reference: 110 (legacy payments)

### Impact
- ✅ All **future** payments will automatically store references
- ⚠️ **Existing** payments need manual reference addition if needed
- ✅ Bot restarted and changes deployed

## Troubleshooting

### Payment reference not showing
1. Check if payment was created **after** this update was deployed
2. Verify webhook was received: Check logs for "Processing ePayco webhook"
3. Manually add reference using `add-payment-reference.js`

### Refund API fails
- Check ePayco credentials in `.env` file
- Verify reference exists in ePayco dashboard
- Check if transaction is eligible for refund (not already refunded, within refund window)
- Use manual dashboard refund as fallback

### Can't find payment by reference
- Check if reference was added to the database
- Try searching by payment_id field instead
- Query users table to find most recent payment for user

## Related Files
- `/src/models/paymentModel.js` - Payment data model
- `/src/bot/services/paymentService.js` - Payment processing logic
- `/src/bot/api/controllers/webhookController.js` - Webhook handlers
- `/scripts/prime-members-with-references.js` - Prime members report
- `/scripts/add-payment-reference.js` - Manual reference addition
- `/scripts/find-payment-by-reference.js` - Search by reference
- `/scripts/process-epayco-refund.js` - Automated refund processing

## Environment Variables Required
```env
EPAYCO_PUBLIC_KEY=<your_public_key>
EPAYCO_PRIVATE_KEY=<your_private_key>
EPAYCO_P_CUST_ID=<your_customer_id>
EPAYCO_TEST_MODE=false
```

## Support
For questions or issues with payment reference tracking:
1. Check this documentation
2. Review payment service logs: `tail -f logs/bot_logs.txt | grep -i payment`
3. Query database directly to verify reference storage
4. Contact development team if issues persist
