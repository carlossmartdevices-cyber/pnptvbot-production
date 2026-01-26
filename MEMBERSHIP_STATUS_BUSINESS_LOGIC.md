# Membership Status Business Logic

## Overview

This document defines the business logic for user membership status in the PNPtv system.

## Definitions

### Membership Status

1. **Membership Active (Prime)**
   - User holds any active plan (regardless of plan type)
   - Tier: `Prime`
   - Subscription Status: `active`
   - Has access to all premium features

2. **Membership Not Active (Free)**
   - User does NOT hold an active plan
   - Tier: `Free`
   - Subscription Status: `free` or `churned`
   - Has access to free features only

### Special Cases

1. **Churned Status**
   - Churned = Free (for all effects except marketing)
   - Users with `subscription_status = 'churned'` are treated the same as `subscription_status = 'free'`
   - The distinction is only for marketing purposes

2. **Case Standardization**
   - Tier values should use proper capitalization: `Prime`, `Free`
   - Lowercase values like `'free'` should be standardized to `'Free'`

## Business Rules

### Rule 1: Membership Active (Prime)

**Condition:** User has an active plan
```
IF (plan_id IS NOT NULL AND plan_id != '') 
AND (plan_expiry IS NULL OR plan_expiry > NOW())
THEN 
  tier = 'Prime'
  subscription_status = 'active'
```

### Rule 2: Membership Not Active (Free)

**Condition:** User does NOT have an active plan
```
IF (plan_id IS NULL OR plan_id = '')
OR (plan_expiry IS NOT NULL AND plan_expiry <= NOW())
THEN 
  tier = 'Free'
  subscription_status = 'free' OR 'churned'  // Preserve churned for marketing
```

### Rule 3: Churned = Free

**Treatment:**
- Churned users are treated identically to Free users
- The only difference is for marketing analytics
- Both have `tier = 'Free'`
- Churned users keep `subscription_status = 'churned'`
- Free users have `subscription_status = 'free'`

## Implementation

### Database Schema

**Users Table:**
```sql
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  -- ... other fields ...
  tier VARCHAR(50),  -- 'Prime' or 'Free'
  subscription_status VARCHAR(50),  -- 'active', 'free', or 'churned'
  plan_id VARCHAR(100),  -- Plan identifier
  plan_expiry TIMESTAMP,  -- When the plan expires
  -- ... other fields ...
);
```

### SQL Queries

**Get all active members (Prime):**
```sql
SELECT * FROM users
WHERE tier = 'Prime' AND subscription_status = 'active';
```

**Get all free members (including churned):**
```sql
SELECT * FROM users
WHERE tier = 'Free' 
AND (subscription_status = 'free' OR subscription_status = 'churned');
```

**Get only churned members (for marketing):**
```sql
SELECT * FROM users
WHERE tier = 'Free' AND subscription_status = 'churned';
```

## Examples

### Example 1: Active Plan
```
User: Alice
- plan_id: "monthly_premium"
- plan_expiry: 2026-02-28 (future date)
- Result: tier = 'Prime', subscription_status = 'active'
```

### Example 2: Expired Plan
```
User: Bob
- plan_id: "monthly_premium"
- plan_expiry: 2025-12-31 (past date)
- Result: tier = 'Free', subscription_status = 'free' (or 'churned')
```

### Example 3: No Plan
```
User: Charlie
- plan_id: NULL
- plan_expiry: NULL
- Result: tier = 'Free', subscription_status = 'free'
```

### Example 4: Churned User
```
User: David
- plan_id: "monthly_premium"
- plan_expiry: 2025-11-15 (past date)
- subscription_status: 'churned' (preserved from before)
- Result: tier = 'Free', subscription_status = 'churned'
- Treatment: Same as Free users, but marked as churned for marketing
```

## Migration Script

The script `scripts/fix_user_membership_status.js` implements this logic:

1. **Analyzes** current user statuses
2. **Fixes** inconsistent statuses:
   - Users with active plans → Prime + Active
   - Users with expired plans → Free + (Free/Churned)
   - Users without plans → Free + (Free/Churned)
3. **Standardizes** case for tier values
4. **Verifies** results and provides summary

## API Endpoints

### Get User Membership Status

**Request:**
```
GET /api/users/{userId}/membership
```

**Response:**
```json
{
  "userId": "12345",
  "tier": "Prime",
  "subscriptionStatus": "active",
  "isActiveMember": true,
  "hasActivePlan": true,
  "planExpiry": "2026-02-28T00:00:00Z"
}
```

### Update User Membership

**Request:**
```
POST /api/users/{userId}/membership
{
  "planId": "monthly_premium",
  "planExpiry": "2026-02-28T00:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "userId": "12345",
  "tier": "Prime",
  "subscriptionStatus": "active"
}
```

## Business Logic Flowchart

```
START
  │
  ├─ User has active plan?
  │   │
  │   ├─ YES → tier = 'Prime', subscription_status = 'active'
  │   │
  │   └─ NO
  │       │
  │       ├─ Preserve 'churned' status if already set?
  │       │   │
  │       │   ├─ YES → tier = 'Free', subscription_status = 'churned'
  │       │   │
  │       │   └─ NO → tier = 'Free', subscription_status = 'free'
  │
  └─ END
```

## Testing

### Test Cases

1. **Active Plan Test**
   - Input: User with active plan
   - Expected: tier='Prime', subscription_status='active'

2. **Expired Plan Test**
   - Input: User with expired plan
   - Expected: tier='Free', subscription_status='free'

3. **No Plan Test**
   - Input: User with no plan
   - Expected: tier='Free', subscription_status='free'

4. **Churned Preservation Test**
   - Input: User with expired plan and subscription_status='churned'
   - Expected: tier='Free', subscription_status='churned' (preserved)

5. **Case Standardization Test**
   - Input: User with tier='free'
   - Expected: tier='Free' (standardized)

## Monitoring

### Key Metrics

1. **Active Members**: Count of users with tier='Prime' and subscription_status='active'
2. **Free Members**: Count of users with tier='Free' and subscription_status='free'
3. **Churned Members**: Count of users with tier='Free' and subscription_status='churned'
4. **Conversion Rate**: Active Members / Total Members
5. **Churn Rate**: Churned Members / (Active Members + Churned Members)

### Alerts

1. **Inconsistent Status Alert**: Triggered when tier and subscription_status don't match
2. **Plan Expiry Alert**: Triggered when plan_expiry is approaching
3. **Churn Alert**: Triggered when user moves from active to churned

## Maintenance

### Regular Tasks

1. **Daily Sync**: Run `fix_user_membership_status.js` to ensure consistency
2. **Weekly Report**: Generate membership status report
3. **Monthly Audit**: Verify data integrity and fix any inconsistencies

### Troubleshooting

**Issue: User has active plan but shows as Free**
- Check plan_expiry date
- Verify plan_id is not null/empty
- Run fix script to correct

**Issue: User has no plan but shows as Prime**
- Check for null plan_id or expired plan_expiry
- Run fix script to correct

**Issue: Inconsistent tier/subscription_status**
- Run fix script to align statuses
- Check for manual overrides

## Conclusion

This business logic ensures consistent membership status across the system:
- **Prime = Active Member** (has active plan)
- **Free = Not Active** (no plan or expired plan)
- **Churned = Free** (for marketing purposes only)

All users are automatically categorized based on their plan status, ensuring data consistency and proper access control.
