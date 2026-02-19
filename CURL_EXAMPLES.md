# Monetization API - cURL Examples

## Configuration

```bash
# Set variables
API="http://localhost:3001"
ADMIN_EMAIL="admin@pnptv.app"
ADMIN_PASS="testpassword123"
MODEL_EMAIL="model@pnptv.app"
MODEL_PASS="testpassword123"
```

## 1. Authentication Examples

### Admin Login
```bash
curl -X POST "$API/api/auth/admin-login" \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASS\",
    \"rememberMe\": true
  }"
```

### Model Login (Email)
```bash
curl -X POST "$API/api/auth/model-login" \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d "{
    \"email\": \"$MODEL_EMAIL\",
    \"password\": \"$MODEL_PASS\"
  }"
```

### Model Login (Telegram)
```bash
curl -X POST "$API/api/auth/model-login" \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d "{
    \"telegramId\": \"123456789\"
  }"
```

### Register Model
```bash
curl -X POST "$API/api/auth/register-model" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"newmodel@example.com\",
    \"password\": \"securepassword123\",
    \"username\": \"newmodel123\"
  }"
```

### Check Auth Status
```bash
curl -X GET "$API/api/auth/status" \
  -b cookies.txt
```

### Check Admin Status
```bash
curl -X GET "$API/api/auth/admin-check" \
  -b cookies.txt
```

### Check Model Status
```bash
curl -X GET "$API/api/auth/model-check" \
  -b cookies.txt
```

### Logout
```bash
curl -X POST "$API/api/auth/logout" \
  -H "Content-Type: application/json" \
  -b cookies.txt
```

## 2. Subscription Examples

### Get User Plans
```bash
curl -X GET "$API/api/subscriptions/plans?role=user" \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "id": "uuid",
        "name": "PRIME",
        "slug": "prime-user",
        "role": "user",
        "priceUsd": 9.99,
        "priceCop": 49950,
        "billingCycle": "monthly",
        "features": {
          "unlimitedStreams": true,
          "exclusiveContent": true,
          "noAds": true,
          "priorityChat": true
        },
        "revenueSplitPercentage": 20,
        "isActive": true
      }
    ],
    "count": 1
  }
}
```

### Get Model Plans
```bash
curl -X GET "$API/api/subscriptions/plans?role=model" \
  -H "Content-Type: application/json"
```

### Get My Subscription
```bash
curl -X GET "$API/api/subscriptions/my-subscription" \
  -b cookies.txt
```

### Create Checkout
```bash
# First get a plan ID
PLAN_ID="00000000-0000-0000-0000-000000000001"

curl -X POST "$API/api/subscriptions/checkout" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d "{
    \"planId\": \"$PLAN_ID\",
    \"paymentMethod\": \"epayco\"
  }"

# Response includes checkout URL to redirect to
```

### Cancel Subscription
```bash
curl -X POST "$API/api/subscriptions/cancel" \
  -H "Content-Type: application/json" \
  -b cookies.txt
```

### Get Payment History
```bash
curl -X GET "$API/api/subscriptions/history?limit=20&offset=0" \
  -b cookies.txt
```

### Check Feature Access
```bash
curl -X GET "$API/api/subscriptions/feature-access?feature=unlimitedStreams" \
  -b cookies.txt
```

## 3. Model Dashboard Examples

### Get Dashboard Stats
```bash
curl -X GET "$API/api/model/dashboard" \
  -b cookies.txt
```

Response:
```json
{
  "success": true,
  "data": {
    "stats": {
      "earnings": {
        "totalRecords": 5,
        "earningsTypes": 2,
        "pendingUsd": 125.50,
        "paidUsd": 450.00,
        "totalEarningsUsd": 575.50,
        "totalPlatformFeesUsd": 143.88
      },
      "content": {
        "totalItems": 3,
        "totalViews": 1250,
        "totalPurchases": 15
      },
      "streaming": {
        "totalStreams": 8,
        "activeStreams": 1,
        "totalViewers": 523,
        "streamingDays": 7
      }
    }
  }
}
```

## 4. Content Management Examples

### Upload Paid Content
```bash
curl -X POST "$API/api/model/content/upload" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d "{
    \"title\": \"Exclusive Behind-the-Scenes Video\",
    \"description\": \"30 minutes of exclusive content\",
    \"contentType\": \"video\",
    \"contentUrl\": \"https://s3.example.com/video-123.mp4\",
    \"thumbnailUrl\": \"https://s3.example.com/thumb-123.jpg\",
    \"priceUsd\": 9.99,
    \"priceCop\": 49950,
    \"isExclusive\": true
  }"
```

### Get My Content
```bash
curl -X GET "$API/api/model/content" \
  -b cookies.txt
```

### Delete Content
```bash
CONTENT_ID="uuid-here"

curl -X DELETE "$API/api/model/content/$CONTENT_ID" \
  -b cookies.txt
```

### Get Content Analytics
```bash
CONTENT_ID="uuid-here"

curl -X GET "$API/api/model/content/$CONTENT_ID/analytics" \
  -b cookies.txt
```

Response:
```json
{
  "success": true,
  "data": {
    "analytics": {
      "content": {
        "id": "uuid",
        "title": "My Video",
        "priceUsd": 9.99,
        "viewCount": 125,
        "purchaseCount": 12
      },
      "dailyStats": [
        {
          "date": "2026-02-19",
          "purchases": 3,
          "revenueUsd": 29.97,
          "revenueCop": 149850
        }
      ]
    }
  }
}
```

## 5. Earnings Examples

### Get Earnings Summary
```bash
curl -X GET "$API/api/model/earnings" \
  -b cookies.txt
```

Response:
```json
{
  "success": true,
  "data": {
    "summary": {
      "pendingUsd": 125.50,
      "paidUsd": 450.00,
      "totalEarningsUsd": 575.50,
      "totalPlatformFeesUsd": 143.88
    },
    "byType": [
      {
        "type": "content_sale",
        "count": 12,
        "totalUsd": 99.88,
        "pendingCount": 2,
        "paidCount": 10
      },
      {
        "type": "subscription",
        "count": 3,
        "totalUsd": 15.00,
        "pendingCount": 1,
        "paidCount": 2
      }
    ],
    "trends": [
      {
        "date": "2026-02-19",
        "transactionCount": 2,
        "revenueUsd": 19.98
      }
    ]
  }
}
```

## 6. Withdrawal Examples

### Check Withdrawable Amount
```bash
curl -X GET "$API/api/model/withdrawal/available" \
  -b cookies.txt
```

Response:
```json
{
  "success": true,
  "data": {
    "withdrawable": {
      "totalUsd": 125.50,
      "totalCop": 627500,
      "itemCount": 5,
      "earnings": [
        {
          "id": "uuid",
          "amountUsd": 99.88,
          "amountCop": 499400,
          "earningsType": "content_sale",
          "sourceType": "content_purchase",
          "createdAt": "2026-02-19T10:30:00Z"
        }
      ]
    }
  }
}
```

### Request Withdrawal
```bash
curl -X POST "$API/api/model/withdrawal/request" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d "{
    \"method\": \"bank_transfer\"
  }"
```

Response:
```json
{
  "success": true,
  "data": {
    "withdrawal": {
      "id": "uuid",
      "modelId": "uuid",
      "amountUsd": 125.50,
      "amountCop": 627500,
      "method": "bank_transfer",
      "status": "pending",
      "requestedAt": "2026-02-19T14:30:00Z"
    },
    "earningsCount": 5
  }
}
```

### Get Withdrawal History
```bash
curl -X GET "$API/api/model/withdrawal/history" \
  -b cookies.txt

# Filter by status
curl -X GET "$API/api/model/withdrawal/history?status=pending" \
  -b cookies.txt
```

## 7. Profile Examples

### Update Model Profile
```bash
curl -X PUT "$API/api/model/profile" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d "{
    \"bio\": \"Professional content creator\",
    \"avatarUrl\": \"https://example.com/avatar.jpg\",
    \"bankAccountOwner\": \"John Doe\",
    \"bankAccountNumber\": \"1234567890\",
    \"bankCode\": \"001\"
  }"
```

## 8. Streaming Examples

### Check Streaming Limits
```bash
curl -X GET "$API/api/model/streaming/limits" \
  -b cookies.txt
```

Response:
```json
{
  "success": true,
  "data": {
    "limits": {
      "canStream": true,
      "streamsPerWeekLimit": 1,
      "currentCount": 0,
      "remaining": 1,
      "reason": "Within limit"
    }
  }
}
```

## 9. Error Responses

### Unauthorized (Missing Auth)
```bash
curl -X GET "$API/api/model/dashboard"

# Response: 401
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### Forbidden (Wrong Role)
```bash
# User trying to access model endpoint
curl -X GET "$API/api/model/dashboard" \
  -b user_cookies.txt

# Response: 403
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied. Required roles: model, admin, superadmin"
  }
}
```

### Invalid Input
```bash
curl -X POST "$API/api/auth/admin-login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"test@example.com\"}"

# Response: 400
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Email and password are required"
  }
}
```

## 10. Batch Operations

### Test All Auth Endpoints
```bash
#!/bin/bash

echo "Testing Auth Endpoints..."

API="http://localhost:3001"

# Register
echo "1. Register model..."
curl -X POST "$API/api/auth/register-model" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\",\"password\":\"test123456\",\"username\":\"testuser\"}"

# Login
echo -e "\n2. Login..."
curl -X POST "$API/api/auth/model-login" \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d "{\"email\":\"test@example.com\",\"password\":\"test123456\"}"

# Check status
echo -e "\n3. Check status..."
curl -X GET "$API/api/auth/status" -b cookies.txt

# Logout
echo -e "\n4. Logout..."
curl -X POST "$API/api/auth/logout" \
  -H "Content-Type: application/json" \
  -b cookies.txt

echo -e "\n✓ Auth tests complete"
```

## Tips

1. **Save cookies**: Use `-c cookies.txt` to save and `-b cookies.txt` to load
2. **Pretty JSON**: Add `| jq` to format output
3. **Verbose**: Add `-v` flag to see headers
4. **Custom headers**: Use `-H "Key: value"` for each header
5. **Data from file**: Use `-d @file.json` instead of inline JSON

## Common Issues

### CSRF Error
Ensure you're using the same session cookie for requests

### 404 on Routes
Ensure routes are registered in `/src/bot/api/routes.js`

### Database Connection
Check PostgreSQL is running and DATABASE_URL is correct

### Session Timeout
Session expires after 24 hours. Log in again if needed
