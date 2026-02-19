# Authentication Testing - CURL Examples

**Base URL:** `http://localhost:3001`
**Production URL:** `https://pnptv.app`

All examples use localhost. Replace with production domain as needed.

---

## Email Authentication

### 1. Register New User

```bash
curl -X POST http://localhost:3001/api/webapp/auth/register \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePassword123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

**Expected Response (201 Created):**
```json
{
  "authenticated": true,
  "pnptvId": "pnptv-123abc",
  "user": {
    "id": "user-id-123",
    "pnptvId": "pnptv-123abc",
    "firstName": "John",
    "lastName": "Doe",
    "email": "newuser@example.com",
    "subscriptionStatus": "free"
  }
}
```

---

### 2. Login with Email

```bash
curl -X POST http://localhost:3001/api/webapp/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePassword123",
    "rememberMe": false
  }'
```

**Expected Response (200 OK):**
```json
{
  "authenticated": true,
  "pnptvId": "pnptv-123abc",
  "token": "eyJhbGc...(JWT token)...xyz",
  "user": {
    "id": "user-id-123",
    "pnptvId": "pnptv-123abc",
    "username": "john_doe",
    "firstName": "John",
    "lastName": "Doe",
    "email": "newuser@example.com",
    "subscriptionStatus": "free",
    "role": "user"
  }
}
```

**Using the JWT token for API calls:**
```bash
curl -X GET http://localhost:3001/api/webapp/auth/status \
  -H "Authorization: Bearer eyJhbGc...(JWT token)...xyz"
```

---

### 3. Login with Remember-Me (30 days)

```bash
curl -X POST http://localhost:3001/api/webapp/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePassword123",
    "rememberMe": true
  }'
```

**Note:** Cookie will have `Max-Age: 2592000` (30 days) instead of 86400 (1 day)

---

### 4. Check Auth Status

```bash
curl -X GET http://localhost:3001/api/webapp/auth/status \
  -b cookies.txt
```

**If Authenticated (200 OK):**
```json
{
  "authenticated": true,
  "user": {
    "id": "user-id-123",
    "pnptvId": "pnptv-123abc",
    "username": "john_doe",
    "firstName": "John",
    "lastName": "Doe",
    "photoUrl": null,
    "subscriptionStatus": "free",
    "acceptedTerms": false,
    "language": "en",
    "role": "user"
  }
}
```

**If Not Authenticated (200 OK):**
```json
{
  "authenticated": false
}
```

---

### 5. Logout

```bash
curl -X POST http://localhost:3001/api/webapp/auth/logout \
  -b cookies.txt \
  -c cookies.txt
```

**Expected Response (200 OK):**
```json
{
  "success": true
}
```

---

## Password Reset Flow

### 1. Request Password Reset Email

```bash
curl -X POST http://localhost:3001/api/webapp/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com"
  }'
```

**Expected Response (200 OK - always, to prevent email enumeration):**
```json
{
  "success": true
}
```

**Note:** Email is sent with reset link. Token is valid for 1 hour.

---

### 2. Reset Password with Token

```bash
curl -X POST http://localhost:3001/api/webapp/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "a1b2c3d4e5f6...(32-byte hex token from email)",
    "password": "NewPassword123"
  }'
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Password updated successfully. You can now log in."
}
```

---

## Telegram OAuth Flow

### 1. Start Telegram OAuth (Browser Redirect)

```bash
curl -X GET http://localhost:3001/api/webapp/auth/telegram/start
```

**Response (302 Redirect):**
```
Location: https://oauth.telegram.org/auth?bot_id=8571930103&origin=http://localhost:3001&request_access=write&return_to=http://localhost:3001/api/webapp/auth/telegram/callback
```

User follows this URL, authenticates with Telegram, then gets redirected to callback.

---

### 2. Telegram OAuth Callback (Automatic from Telegram)

Telegram redirects user to:
```
http://localhost:3001/api/webapp/auth/telegram/callback?
  id=123456789
  first_name=John
  last_name=Doe
  username=johndoe
  photo_url=https://t.me/i/...
  auth_date=1708400000
  hash=abc123...
```

**Response (302 Redirect):**
```
Location: /prime-hub/
```

Session is created and user is logged in.

---

### 3. Test Telegram OAuth with Mock Data (Development Only)

In development with `SKIP_TELEGRAM_HASH_VERIFICATION=true`:

```bash
curl -X GET "http://localhost:3001/api/webapp/auth/telegram/callback?id=123456789&first_name=John&last_name=Doe&username=johndoe&hash=mockhash&auth_date=$(date +%s)" \
  -b cookies.txt \
  -c cookies.txt \
  -L
```

---

## X/Twitter OAuth Flow

### 1. Start X OAuth (Get Authorization URL)

```bash
curl -X GET http://localhost:3001/api/webapp/auth/x/start \
  -b cookies.txt \
  -c cookies.txt
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "url": "https://twitter.com/i/oauth2/authorize?response_type=code&client_id=...&code_challenge=...&code_challenge_method=S256&..."
}
```

User visits this URL, authenticates with X/Twitter, gets redirected to callback.

---

### 2. X OAuth Callback (Automatic from X)

X redirects to:
```
http://localhost:3001/api/webapp/auth/x/callback?code=abc123&state=xyz789
```

**Response (302 Redirect):**
```
Location: /prime-hub/
```

---

## Error Scenarios

### 1. Duplicate Email on Registration

```bash
curl -X POST http://localhost:3001/api/webapp/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "existing@example.com",
    "password": "SecurePassword123",
    "firstName": "Jane"
  }'
```

**Expected Response (409 Conflict):**
```json
{
  "error": "An account with this email already exists. Please log in."
}
```

---

### 2. Short Password on Registration

```bash
curl -X POST http://localhost:3001/api/webapp/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "short",
    "firstName": "John"
  }'
```

**Expected Response (400 Bad Request):**
```json
{
  "error": "Password must be at least 8 characters"
}
```

---

### 3. Invalid Email Format

```bash
curl -X POST http://localhost:3001/api/webapp/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "not-an-email",
    "password": "SecurePassword123",
    "firstName": "John"
  }'
```

**Expected Response (400 Bad Request):**
```json
{
  "error": "Invalid email address"
}
```

---

### 4. Incorrect Password on Login

```bash
curl -X POST http://localhost:3001/api/webapp/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "newuser@example.com",
    "password": "WrongPassword123"
  }'
```

**Expected Response (401 Unauthorized):**
```json
{
  "error": "Incorrect password."
}
```

---

### 5. Non-Existent Email on Login

```bash
curl -X POST http://localhost:3001/api/webapp/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "nonexistent@example.com",
    "password": "anyPassword"
  }'
```

**Expected Response (401 Unauthorized):**
```json
{
  "error": "No account found with this email. Please register first."
}
```

---

### 6. Missing Required Fields

```bash
curl -X POST http://localhost:3001/api/webapp/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "test@example.com"
  }'
```

**Expected Response (400 Bad Request):**
```json
{
  "error": "Email and password are required"
}
```

---

## Cookie Management

### View Cookies After Login

```bash
# Save cookies to file after login
curl -X POST http://localhost:3001/api/webapp/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePassword123"
  }'

# View cookies
cat cookies.txt
```

**Expected cookies.txt:**
```
# Netscape HTTP Cookie File
# This file contains cookies used by curl! Edit at your own risk.

.localhost.local    TRUE    /    FALSE    1708486400    connect.sid    s%3A...
```

### Use Cookies in Subsequent Requests

```bash
# All requests will use the session cookie
curl -X GET http://localhost:3001/api/webapp/auth/status \
  -b cookies.txt
```

---

## JWT Token Usage

### Decode JWT Token (Linux/Mac)

```bash
# Extract token from login response
TOKEN="eyJhbGc..."

# Decode (without signature verification)
echo $TOKEN | cut -d. -f2 | base64 -d | jq

# Output:
# {
#   "id": "user-id-123",
#   "pnptvId": "pnptv-123abc",
#   "email": "newuser@example.com",
#   "username": "john_doe",
#   "role": "user",
#   "iat": 1708313600
# }
```

### Use JWT in API Requests

```bash
TOKEN="eyJhbGc..."

# As Authorization header
curl -X GET http://localhost:3001/api/webapp/profile \
  -H "Authorization: Bearer $TOKEN"

# Or as custom header
curl -X GET http://localhost:3001/api/webapp/profile \
  -H "X-Access-Token: $TOKEN"
```

---

## Session Testing

### Session Persistence Test

```bash
#!/bin/bash

# 1. Register user
curl -X POST http://localhost:3001/api/webapp/auth/register \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "testuser@example.com",
    "password": "TestPassword123",
    "firstName": "Test"
  }'

# 2. Check auth status (should be authenticated)
curl -X GET http://localhost:3001/api/webapp/auth/status \
  -b cookies.txt

# 3. Logout
curl -X POST http://localhost:3001/api/webapp/auth/logout \
  -b cookies.txt \
  -c cookies.txt

# 4. Check auth status (should not be authenticated)
curl -X GET http://localhost:3001/api/webapp/auth/status \
  -b cookies.txt
```

---

## Performance Testing

### Load Test Authentication Endpoints

```bash
# Using Apache Bench (installed: apt-get install apache2-utils)

# Test login endpoint with 100 concurrent requests
ab -n 1000 -c 100 -p login.json -T application/json http://localhost:3001/api/webapp/auth/login

# Test status endpoint
ab -n 1000 -c 100 http://localhost:3001/api/webapp/auth/status
```

**login.json:**
```json
{
  "email": "test@example.com",
  "password": "TestPassword123"
}
```

---

## Testing Checklist

- [ ] Email registration with new account
- [ ] Email login with correct password
- [ ] Email login with incorrect password
- [ ] Auth status check (authenticated)
- [ ] Auth status check (not authenticated)
- [ ] Logout functionality
- [ ] Remember-me cookie duration (30 days)
- [ ] Forget password email sending
- [ ] Password reset with valid token
- [ ] Password reset with expired token
- [ ] Telegram OAuth flow (development)
- [ ] X/Twitter OAuth flow (if credentials available)
- [ ] Error handling for duplicate emails
- [ ] Error handling for invalid inputs
- [ ] Session persistence across requests
- [ ] Cookie management and clearing
- [ ] JWT token generation and validation
- [ ] Cross-domain CORS (if applicable)

---

## Troubleshooting

### Issue: "Telegram login is not configured"

**Solution:** Ensure `BOT_TOKEN` is set in `.env`:
```bash
echo $BOT_TOKEN
# Should output: 8571930103:AAHIxAeI2CEqgF3arK4D4dZNHFYxgNa_nt0
```

---

### Issue: "Hash verification failed for Telegram user"

**Solution:**
1. **Development:** Set `SKIP_TELEGRAM_HASH_VERIFICATION=true` in `.env`
2. **Production:** Ensure BotFather domain is set: `/setdomain pnptv.app`

---

### Issue: "Session failed to save"

**Solution:** Ensure Redis is running:
```bash
redis-cli ping
# Should return: PONG
```

---

### Issue: "Email service not configured"

**Solution:** Ensure SMTP credentials in `.env`:
```bash
echo $SMTP_HOST
echo $SMTP_USER
echo $SMTP_PASSWORD
```

---

### Issue: Cookies not being sent in requests

**Solution:** Ensure cookies.txt exists and use `-b` flag:
```bash
curl -X GET http://localhost:3001/api/webapp/auth/status \
  -b cookies.txt  # <-- This is required
```

---

## Notes

- All timestamps in responses are ISO 8601 format
- Email addresses are case-insensitive (normalized to lowercase)
- Session cookies are HttpOnly and Secure in production
- Tokens expire after 24 hours
- Password reset tokens expire after 1 hour
- Rate limiting may be applied in production (check response headers)

---

## Response Time SLAs

- Register: < 500ms
- Login: < 500ms (includes password hashing)
- Auth Status: < 50ms
- Logout: < 100ms
- Forgot Password: < 2000ms (includes email sending)
- Reset Password: < 500ms

---

**Last Updated:** 2026-02-19
