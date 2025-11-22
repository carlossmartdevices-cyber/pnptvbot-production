# PNPtv WebApp API Documentation

Comprehensive API reference for the PNPtv WebApp backend.

## Base URL

```
Production: https://your-domain.com/api
Development: http://localhost:3000/api
```

## Authentication

Most endpoints require authentication using NextAuth.js session cookies.

### Headers

```http
Content-Type: application/json
Cookie: next-auth.session-token=<session-token>
```

## Error Responses

All endpoints return errors in the following format:

```json
{
  "error": "Error message",
  "details": [] // Optional validation errors
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

---

## Authentication

### POST `/auth/signup`

Create a new user account with email/password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "displayName": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "displayName": "John Doe"
  }
}
```

**Rate Limit:** 5 requests per 15 minutes

---

## User Management

### POST `/user/complete-onboarding`

Complete the user onboarding process.

**Request Body:**
```json
{
  "language": "en",
  "email": "user@example.com" // optional
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_id",
    "onboardingCompleted": true
  }
}
```

### GET `/users/nearby`

Get nearby users based on location.

**Query Parameters:**
- `lat` (number, required) - User latitude
- `lng` (number, required) - User longitude
- `radius` (number, default: 10) - Search radius in kilometers

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "user": {
        "id": "user_id",
        "displayName": "John Doe",
        "photoURL": "https://...",
        "bio": "User bio",
        "latitude": 40.7128,
        "longitude": -74.0060
      },
      "distance": 2.5
    }
  ]
}
```

---

## Payments & Subscriptions

### POST `/payments/create-checkout`

Create a checkout session for subscription payment.

**Request Body:**
```json
{
  "planId": "premium",
  "paymentMethod": "epayco" // or "daimo"
}
```

**Response:**
```json
{
  "success": true,
  "paymentId": "payment_id",
  "checkoutUrl": "https://checkout.epayco.co/..."
}
```

### POST `/webhooks/epayco`

ePayco payment webhook (called by ePayco servers).

**Request Body:** ePayco webhook payload

**Response:**
```json
{
  "success": true
}
```

---

## Live Streaming

### GET `/live/streams`

Get all active live streams.

**Response:**
```json
{
  "success": true,
  "streams": [
    {
      "id": "stream_id",
      "title": "My Live Stream",
      "description": "Stream description",
      "category": "music",
      "isLive": true,
      "viewerCount": 42,
      "host": {
        "id": "user_id",
        "displayName": "John Doe",
        "photoURL": "https://..."
      }
    }
  ]
}
```

### POST `/live/create`

Create a new live stream.

**Request Body:**
```json
{
  "title": "My Live Stream",
  "description": "Stream description",
  "category": "music" // music, talk, gaming, education, entertainment, other
}
```

**Response:**
```json
{
  "success": true,
  "stream": {
    "id": "stream_id",
    "title": "My Live Stream",
    "streamKey": "unique_stream_key",
    "isLive": false
  }
}
```

**Requires:** Premium subscription

### POST `/live/broadcast/token`

Get Agora RTC token for broadcasting.

**Request Body:**
```json
{
  "streamId": "stream_id"
}
```

**Response:**
```json
{
  "success": true,
  "appId": "agora_app_id",
  "channelName": "stream_key",
  "token": "agora_token",
  "uid": 0
}
```

### POST `/live/streams/[streamId]/start`

Start broadcasting a stream.

**Response:**
```json
{
  "success": true,
  "stream": {
    "id": "stream_id",
    "isLive": true,
    "startedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST `/live/streams/[streamId]/end`

End a live stream.

**Response:**
```json
{
  "success": true,
  "stream": {
    "id": "stream_id",
    "isLive": false,
    "endedAt": "2024-01-01T01:00:00.000Z"
  },
  "duration": 3600
}
```

### GET `/live/streams/[streamId]/stats`

Get stream statistics.

**Response:**
```json
{
  "success": true,
  "viewerCount": 42,
  "isLive": true,
  "duration": 1800
}
```

---

## Zoom Rooms

### GET `/zoom/rooms`

Get all active Zoom rooms.

**Response:**
```json
{
  "success": true,
  "rooms": [
    {
      "id": "room_id",
      "title": "Team Meeting",
      "description": "Weekly standup",
      "meetingId": "meeting_id",
      "maxParticipants": 10,
      "participantCount": 5,
      "isActive": true,
      "startTime": "2024-01-01T00:00:00.000Z",
      "host": {
        "id": "user_id",
        "displayName": "John Doe"
      }
    }
  ]
}
```

### POST `/zoom/create`

Create a new Zoom room.

**Request Body:**
```json
{
  "title": "Team Meeting",
  "description": "Weekly standup",
  "maxParticipants": 10,
  "duration": 60,
  "requirePasscode": true,
  "passcode": "1234"
}
```

**Response:**
```json
{
  "success": true,
  "room": {
    "id": "room_id",
    "title": "Team Meeting",
    "meetingId": "unique_meeting_id",
    "passcode": "1234",
    "isActive": true
  }
}
```

**Requires:** Premium subscription

### POST `/zoom/join`

Get Zoom SDK signature for joining a room.

**Request Body:**
```json
{
  "roomId": "room_id"
}
```

**Response:**
```json
{
  "success": true,
  "meetingNumber": "meeting_id",
  "signature": "zoom_sdk_signature",
  "userName": "John Doe",
  "passcode": "1234"
}
```

---

## AI Chat

### POST `/support/chat`

Send a message to the AI assistant (Cristina).

**Request Body:**
```json
{
  "message": "How do I start a live stream?",
  "history": [
    {
      "role": "user",
      "content": "Previous message"
    },
    {
      "role": "assistant",
      "content": "Previous response"
    }
  ]
}
```

**Response:**
```json
{
  "message": "To start a live stream, you need a PRIME subscription. Click on 'Go Live' and..."
}
```

**Rate Limit:** 10 requests per minute

---

## Monetization

### POST `/tips/send`

Send a tip to another user.

**Request Body:**
```json
{
  "recipientId": "user_id",
  "amount": 10.00,
  "message": "Great stream!" // optional
}
```

**Response:**
```json
{
  "success": true,
  "tip": {
    "id": "tip_id",
    "amount": 10.00,
    "platformFee": 0.50,
    "creatorAmount": 9.50,
    "message": "Great stream!",
    "from": {
      "id": "sender_id",
      "displayName": "Jane Doe"
    },
    "to": {
      "id": "recipient_id",
      "displayName": "John Doe"
    }
  }
}
```

**Rate Limit:** 5 requests per minute

### GET `/creator/revenue`

Get creator revenue statistics.

**Query Parameters:**
- `range` (string) - Time range: `week`, `month`, `year`, `all`

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalEarnings": 1250.00,
    "monthlyEarnings": 350.00,
    "totalTips": 42,
    "uniqueTippers": 15,
    "averageTip": 29.76,
    "topTippers": [
      {
        "user": {
          "displayName": "Jane Doe",
          "photoURL": "https://..."
        },
        "totalAmount": 250.00,
        "tipCount": 10
      }
    ],
    "recentTips": [
      {
        "id": "tip_id",
        "amount": 25.00,
        "message": "Amazing content!",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "from": {
          "displayName": "Jane Doe"
        }
      }
    ]
  }
}
```

---

## Admin

### GET `/admin/stats`

Get admin dashboard statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalUsers": 1250,
    "activeUsers": 850,
    "premiumUsers": 320,
    "freeUsers": 930,
    "totalRevenue": 15000.00,
    "monthlyRevenue": 4500.00,
    "activeStreams": 12,
    "totalStreams": 450
  }
}
```

**Requires:** Admin role

### POST `/admin/broadcast`

Send a broadcast message to users.

**Request Body:**
```json
{
  "message": "Important announcement",
  "target": "all", // "all", "premium", "free"
  "scheduledFor": "2024-01-01T12:00:00.000Z" // optional
}
```

**Response:**
```json
{
  "success": true,
  "count": 1250,
  "broadcastId": "broadcast_id"
}
```

**Requires:** Admin role

---

## Health Check

### GET `/health`

Check application health and database connectivity.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "database": "connected"
}
```

---

## Rate Limiting

All API endpoints are rate-limited to prevent abuse:

- **Authentication:** 5 requests per 15 minutes
- **Payments:** 3 requests per minute
- **Tips:** 5 requests per minute
- **AI Chat:** 10 requests per minute
- **General API:** 100 requests per minute

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

---

## Webhooks

### ePayco Webhook

**Endpoint:** `POST /webhooks/epayco`

Receives payment notifications from ePayco.

**Signature Verification:** SHA256 HMAC

### Daimo Webhook

**Endpoint:** `POST /webhooks/daimo`

Receives crypto payment notifications from Daimo.

**Signature Verification:** Timing-safe comparison

---

## Best Practices

1. **Always use HTTPS** in production
2. **Store API keys securely** in environment variables
3. **Implement retry logic** for failed requests
4. **Handle rate limits** gracefully
5. **Validate webhook signatures** to prevent fraud
6. **Use idempotency keys** for payments
7. **Log all errors** for debugging
8. **Monitor API usage** and set up alerts

---

## Examples

### JavaScript/TypeScript

```typescript
// Fetch nearby users
const response = await fetch('/api/users/nearby?lat=40.7128&lng=-74.0060&radius=5', {
  credentials: 'include', // Include session cookie
});

const data = await response.json();
console.log(data.users);
```

### Python

```python
import requests

# Send tip
response = requests.post(
    'https://your-domain.com/api/tips/send',
    json={
        'recipientId': 'user_123',
        'amount': 10.00,
        'message': 'Great content!'
    },
    cookies={'next-auth.session-token': 'session_token'}
)

print(response.json())
```

### cURL

```bash
# Create live stream
curl -X POST https://your-domain.com/api/live/create \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=session_token" \
  -d '{
    "title": "My Live Stream",
    "category": "music"
  }'
```

---

## Support

For API issues or questions:
- Review this documentation
- Check the [Deployment Guide](./DEPLOYMENT.md)
- Contact support team
