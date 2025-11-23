# API Documentation

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://yourdomain.com`

## Authentication

Most endpoints are public or use Telegram user authentication. Admin endpoints require admin privileges.

## Endpoints

### Health Check

```http
GET /health
```

Returns the health status of the bot.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600
}
```

### Statistics

```http
GET /api/stats
```

Returns user statistics.

**Response:**

```json
{
  "total": 1000,
  "active": 250,
  "free": 750,
  "conversionRate": 25.0
}
```

### ePayco Webhook

```http
POST /api/webhooks/epayco
```

Receives payment confirmations from ePayco.

**Request Body:**

```json
{
  "x_ref_payco": "123456",
  "x_transaction_state": "Aceptada",
  "x_extra1": "payment_id",
  "x_extra2": "user_id",
  "x_extra3": "plan_id"
}
```

**Response:**

```
200 OK
```

### Daimo Webhook

```http
POST /api/webhooks/daimo
```

Receives payment confirmations from Daimo.

**Request Body:**

```json
{
  "transaction_id": "tx_123456",
  "status": "completed",
  "signature": "webhook_signature",
  "metadata": {
    "paymentId": "payment_id",
    "userId": "user_id",
    "planId": "plan_id"
  }
}
```

**Response:**

```
200 OK
```

### Payment Response Page

```http
GET /api/payment-response?ref=123&status=success
```

Displays payment result page to user after completing payment.

**Query Parameters:**

- `ref` (string): Payment reference
- `status` (string): Payment status (`success`, `failed`)

**Response:**

HTML page showing payment result.

## Webhook Security

### ePayco

ePayco webhooks should be validated using the transaction reference and comparing with your database records.

### Daimo

Daimo webhooks include a signature that must be verified:

```javascript
const crypto = require('crypto');

function verifyDaimoSignature(webhookData, secret) {
  const { signature, ...data } = webhookData;
  const payload = JSON.stringify(data);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  return signature === expectedSignature;
}
```

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message description"
}
```

**Common Status Codes:**

- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `429` - Too Many Requests (Rate Limited)
- `500` - Internal Server Error

## Rate Limiting

API endpoints are rate limited to prevent abuse:

- **Window**: 15 minutes
- **Max Requests**: 100 per IP
- **Response**: 429 Too Many Requests

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1234567890
```

## CORS

CORS is enabled for all origins. In production, configure specific origins:

```javascript
app.use(cors({
  origin: 'https://yourdomain.com',
  credentials: true
}));
```

## Request/Response Examples

### Successful Payment Flow

1. **User Initiates Payment**

Bot generates payment URL and sends to user.

2. **User Completes Payment**

Payment provider redirects to `/api/payment-response?ref=123&status=success`

3. **Provider Sends Webhook**

```http
POST /api/webhooks/epayco
Content-Type: application/json

{
  "x_ref_payco": "123456",
  "x_transaction_state": "Aceptada",
  "x_extra1": "pay_abc123",
  "x_extra2": "123456789",
  "x_extra3": "premium"
}
```

4. **Bot Processes Webhook**

- Validates payment
- Updates user subscription
- Sends confirmation to user

5. **Response**

```http
200 OK
```

## Bot Commands via API

While the bot primarily uses Telegram's native commands, you can trigger actions programmatically:

### Send Message to User

```javascript
const axios = require('axios');

await axios.post(
  `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
  {
    chat_id: userId,
    text: 'Your message here',
    parse_mode: 'Markdown'
  }
);
```

### Set Webhook

```javascript
await axios.post(
  `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
  {
    url: 'https://yourdomain.com/pnp/webhook/telegram',
    allowed_updates: ['message', 'callback_query']
  }
);
```

## Monitoring Endpoints

### Logs

Logs are stored in `logs/` directory:

- `combined-YYYY-MM-DD.log`
- `error-YYYY-MM-DD.log`

### Metrics

Use `/health` endpoint for uptime monitoring.

For detailed metrics, integrate with:
- Prometheus
- DataDog
- New Relic

## Testing

### cURL Examples

**Health Check:**
```bash
curl http://localhost:3000/health
```

**Stats:**
```bash
curl http://localhost:3000/api/stats
```

**Test Webhook (Development):**
```bash
curl -X POST http://localhost:3000/api/webhooks/epayco \
  -H "Content-Type: application/json" \
  -d '{
    "x_ref_payco": "test123",
    "x_transaction_state": "Aceptada",
    "x_extra1": "test_payment",
    "x_extra2": "123456789",
    "x_extra3": "premium"
  }'
```

### Postman Collection

A Postman collection is available in `docs/postman/` for testing all endpoints.

## Webhooks Best Practices

1. **Idempotency**: Webhooks may be delivered multiple times. Handle duplicates gracefully.

2. **Async Processing**: Process webhooks asynchronously to avoid timeouts.

3. **Error Handling**: Return 200 OK even if processing fails (log errors internally).

4. **Signature Verification**: Always verify webhook signatures before processing.

5. **Retries**: Payment providers may retry failed webhooks. Implement proper status tracking.

## Support

For API support:
- Email: api@pnptv.com
- Telegram: @pnptv_dev
- Documentation: https://docs.pnptv.com/api
