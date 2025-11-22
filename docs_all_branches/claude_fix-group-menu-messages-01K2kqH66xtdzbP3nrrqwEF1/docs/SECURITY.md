# Security Documentation

## Payment Security Improvements

This document outlines the security improvements implemented for payment processing and webhook handling.

## Critical Security Requirements

### Production Environment Variables

The following environment variables are **REQUIRED** in production and must be configured before deployment:

#### Payment Provider Secrets

```bash
# ePayco - CRITICAL for webhook signature verification
EPAYCO_PRIVATE_KEY=your_epayco_private_key

# Daimo - CRITICAL for webhook signature verification
DAIMO_WEBHOOK_SECRET=your_daimo_webhook_secret
```

**Important:** If these secrets are not configured in production:
- Webhook signature verification will **FAIL**
- The application will throw a `ConfigurationError`
- Webhooks will be **REJECTED** to prevent security breaches

### Development vs Production Behavior

#### Development Mode (`NODE_ENV=development`)
- Allows webhook processing without signature verification if secrets are missing
- Logs warning messages for missing configuration
- Intended for local testing only

#### Production Mode (`NODE_ENV=production`)
- **ENFORCES** signature verification
- **REJECTS** webhooks if secrets are missing
- Throws `ConfigurationError` if critical secrets are not configured
- All security checks are strictly enforced

## Security Features Implemented

### 1. Webhook Signature Verification

#### ePayco Webhooks
- Verifies HMAC-SHA256 signature using `EPAYCO_PRIVATE_KEY`
- Signature format: `{cust_id}^{secret}^{ref_payco}^{transaction_id}^{amount}`
- Rejects webhooks with missing or invalid signatures
- Prevents webhook replay and tampering attacks

**Location:** `src/bot/services/paymentService.js:414-448`

#### Daimo Webhooks
- Verifies HMAC-SHA256 signature using `DAIMO_WEBHOOK_SECRET`
- Signature computed over JSON payload
- Rejects webhooks with missing or invalid signatures
- Protects against unauthorized payment notifications

**Location:** `src/bot/services/paymentService.js:378-407`

### 2. Webhook Payload Validation

#### ePayco Required Fields
- `x_ref_payco` - Payment reference
- `x_transaction_state` - Transaction status
- `x_extra1` - Payment ID
- `x_extra2` - User ID
- `x_extra3` - Plan ID

#### Daimo Required Fields
- `transaction_id` - Transaction identifier
- `status` - Payment status
- `metadata` - Object containing:
  - `paymentId`
  - `userId`
  - `planId`

**Location:** `src/bot/api/controllers/webhookController.js:9-48`

### 3. Rate Limiting

#### API Rate Limiting
- **Window:** 15 minutes
- **Limit:** 100 requests per IP
- **Applied to:** All `/api/*` routes

#### Webhook Rate Limiting (Enhanced)
- **Window:** 5 minutes
- **Limit:** 50 requests per IP
- **Applied to:**
  - `/api/webhooks/epayco`
  - `/api/webhooks/daimo`
- **Headers:** Standard rate limit headers enabled

**Location:** `src/bot/api/routes.js:30-47`

### 4. Idempotency Protection

- Uses Redis locks with transaction ID as unique key
- **Lock TTL:** 2 minutes (optimized from 5 minutes)
- Prevents duplicate payment processing
- Handles webhook retries gracefully

**Location:** `src/bot/services/paymentService.js:197-203, 282-288`

### 5. Error Handling & Logging

#### Security-Focused Error Messages
- Internal errors return generic "Internal server error" message
- Detailed errors logged server-side only
- Prevents information disclosure to attackers

#### Comprehensive Logging
- Transaction IDs logged for all payment operations
- Failed signature verification attempts logged with details
- Stack traces captured for debugging
- Structured logging for security events

**Location:** `src/bot/api/controllers/webhookController.js:55-110`

### 6. Retry Logic with Exponential Backoff

- Maximum 3 retry attempts for external API calls
- Exponential backoff: 1s, 2s, 4s (capped at 10s)
- Timeout: 10 seconds for Daimo API calls
- Prevents cascading failures

**Location:** `src/bot/services/paymentService.js:30-50`

## Security Testing

### Integration Tests

Run webhook validation tests:
```bash
npm test tests/integration/webhookController.test.js
```

Tests cover:
- Payload validation for both providers
- Missing required fields
- Invalid metadata structure
- Error handling
- Response format consistency
- Security (no internal error exposure)

### Unit Tests

Run payment service security tests:
```bash
npm test tests/unit/services/paymentService.security.test.js
```

Tests cover:
- Signature verification for both providers
- Missing signature handling
- Production vs development behavior
- Tampered data detection
- Retry logic with exponential backoff
- Configuration error handling

## Infrastructure Security

### Docker Security

#### Multi-Stage Builds
- Separate builder and production stages
- Minimal production image size
- Only production dependencies in final image

#### Non-Root User
- Runs as `nodejs:1001` user (not root)
- Prevents privilege escalation attacks
- Proper file permissions

#### Signal Handling
- Uses `tini` as init system
- Proper process signal handling
- Clean shutdown on SIGTERM

**Location:** `Dockerfile:1-59`

### Health Checks

Enhanced health check endpoint:
- Checks Redis connection
- Checks PostgreSQL connection
- Returns 503 if dependencies unhealthy
- Proper timeout and retry configuration

**Location:** `src/bot/api/routes.js:50-83`

## Deployment Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Configure `EPAYCO_PRIVATE_KEY` in production environment
- [ ] Configure `DAIMO_WEBHOOK_SECRET` in production environment
- [ ] Verify database connection settings
- [ ] Verify Redis connection settings
- [ ] Test webhook endpoints with valid signatures
- [ ] Monitor health check endpoint
- [ ] Review and configure rate limiting thresholds
- [ ] Enable Sentry or error monitoring
- [ ] Review firewall rules for ports 3000 and 6379
- [ ] Ensure SSL/TLS is configured for webhook endpoints
- [ ] Test payment flow end-to-end

## Monitoring

### Key Metrics to Monitor

1. **Webhook Failures**
   - Invalid signature attempts
   - Missing required fields
   - Rate limit violations

2. **Payment Processing**
   - Failed payments
   - Duplicate payment attempts
   - Lock timeouts

3. **Infrastructure Health**
   - Redis connection failures
   - Database connection failures
   - API response times

### Log Search Patterns

Search for security events:
```bash
# Failed signature verification
grep "Invalid.*webhook signature" logs/app.log

# Missing configuration in production
grep "CRITICAL.*not configured" logs/app.log

# Rate limit violations
grep "Rate limit exceeded" logs/app.log

# Duplicate payment attempts
grep "already processing (idempotency)" logs/app.log
```

## Incident Response

### Suspicious Webhook Activity

1. Check signature verification logs
2. Review rate limiting logs
3. Verify webhook source IP addresses
4. Temporarily increase rate limiting if under attack
5. Contact payment provider if compromise suspected

### Configuration Issues

1. Check environment variables are set
2. Verify secrets are correct
3. Review application logs for configuration errors
4. Restart application after fixing configuration

## Security Best Practices

1. **Rotate Secrets Regularly**
   - Change `EPAYCO_PRIVATE_KEY` every 90 days
   - Change `DAIMO_WEBHOOK_SECRET` every 90 days
   - Update provider dashboards after rotation

2. **Use HTTPS Only**
   - All webhook endpoints must use HTTPS
   - Configure SSL/TLS certificates
   - Enforce HTTPS in payment provider settings

3. **Monitor Logs**
   - Set up alerts for failed signature verification
   - Monitor rate limit violations
   - Review payment failures daily

4. **Test Security**
   - Run security tests before each deployment
   - Test with invalid signatures
   - Verify rate limiting works

5. **Keep Dependencies Updated**
   - Update Node.js regularly
   - Update npm packages monthly
   - Monitor security advisories

## Contact

For security issues, please contact the development team immediately.

**DO NOT** commit secrets to version control.
**DO NOT** share secrets in logs or error messages.
**DO NOT** disable security features in production.
