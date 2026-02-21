#!/bin/bash

##############################################################################
# One-Click Bluesky Setup - Test Script
# Tests the Bluesky setup API endpoints
#
# Usage: ./scripts/test-bluesky-setup.sh [api_url] [session_cookie]
##############################################################################

# Default values
API_URL="${1:-http://localhost:3001}"
SESSION_COOKIE="${2:-pnptv_session=test_session}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}Bluesky Setup API Test Suite${NC}"
echo -e "${BLUE}==========================================${NC}\n"

echo -e "${YELLOW}Configuration:${NC}"
echo "API URL: $API_URL"
echo "Session Cookie: $SESSION_COOKIE"
echo ""

# Color helpers
pass() {
  echo -e "${GREEN}✓ $1${NC}"
}

fail() {
  echo -e "${RED}✗ $1${NC}"
}

warn() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

section() {
  echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Test 1: GET /api/bluesky/status (no account yet)
section "Test 1: Check Bluesky Status (no account)"

RESPONSE=$(curl -s -X GET "$API_URL/api/bluesky/status" \
  -H "Content-Type: application/json" \
  -b "$SESSION_COOKIE")

if echo "$RESPONSE" | grep -q '"success":true'; then
  pass "Status endpoint responding"

  if echo "$RESPONSE" | grep -q '"setup":false'; then
    pass "Correctly indicates no Bluesky account"
  else
    warn "Unexpected response: $RESPONSE"
  fi
else
  if echo "$RESPONSE" | grep -q '"success":false'; then
    warn "Not authenticated - this is expected if no valid session"
  else
    fail "Unexpected response: $RESPONSE"
  fi
fi

# Test 2: Database query - check migration
section "Test 2: Database Migration Verification"

if command -v psql &> /dev/null; then
  # Check if tables exist
  TABLES=$(psql -U postgres -d pnptv_db -t -c "
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_name IN ('bluesky_profile_syncs', 'bluesky_events', 'bluesky_connection_requests')
  " 2>/dev/null)

  if [ "$TABLES" = " 3" ]; then
    pass "All Bluesky tables created"
  else
    fail "Missing Bluesky tables in database"
  fi

  # Check if columns exist in user_pds_mapping
  COLUMNS=$(psql -U postgres -d pnptv_db -t -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name = 'user_pds_mapping' AND column_name LIKE 'bluesky_%'
  " 2>/dev/null)

  if [ "$COLUMNS" -ge 6 ]; then
    pass "user_pds_mapping columns added ($COLUMNS columns)"
  else
    fail "Missing Bluesky columns in user_pds_mapping"
  fi
else
  warn "psql not available, skipping database checks"
fi

# Test 3: Backend routes exist
section "Test 3: Backend Routes"

# Check if routes file exists
if [ -f "apps/backend/bot/api/routes/blueskyRoutes.js" ]; then
  pass "blueskyRoutes.js file exists"

  # Check if registered in main routes
  if grep -q "blueskyRoutes" apps/backend/bot/api/routes.js; then
    pass "Bluesky routes registered in main routes.js"
  else
    fail "Bluesky routes not registered"
  fi
else
  fail "blueskyRoutes.js not found"
fi

# Test 4: Frontend components
section "Test 4: Frontend Components"

FILES=(
  "webapps/prime-hub/src/api/blueskyClient.js"
  "webapps/prime-hub/src/components/BlueskySetupCard.jsx"
  "webapps/prime-hub/src/components/BlueskySuccessModal.jsx"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    pass "$file exists"
  else
    fail "$file missing"
  fi
done

# Test 5: Service files
section "Test 5: Backend Services"

if [ -f "apps/backend/bot/services/BlueskyAutoSetupService.js" ]; then
  pass "BlueskyAutoSetupService.js exists"

  # Check if key methods exist
  if grep -q "static async createBlueskyAccountOnClick" apps/backend/bot/services/BlueskyAutoSetupService.js; then
    pass "createBlueskyAccountOnClick method exists"
  else
    fail "createBlueskyAccountOnClick method not found"
  fi

  if grep -q "static async autoSetupBluesky" apps/backend/bot/services/BlueskyAutoSetupService.js; then
    pass "autoSetupBluesky method exists"
  else
    fail "autoSetupBluesky method not found"
  fi
else
  fail "BlueskyAutoSetupService.js not found"
fi

# Test 6: Controller
section "Test 6: API Controller"

if [ -f "apps/backend/bot/api/controllers/blueskyController.js" ]; then
  pass "blueskyController.js exists"

  # Check endpoints
  if grep -q "const setupBlueskyAccount" apps/backend/bot/api/controllers/blueskyController.js; then
    pass "setupBlueskyAccount endpoint exists"
  else
    fail "setupBlueskyAccount endpoint not found"
  fi
else
  fail "blueskyController.js not found"
fi

# Test 7: Documentation
section "Test 7: Documentation"

if [ -f "BLUESKY_SIMPLE_SETUP.md" ]; then
  pass "Member guide (BLUESKY_SIMPLE_SETUP.md) exists"
else
  warn "Member guide missing"
fi

if [ -f "BLUESKY_ADMIN_GUIDE.md" ]; then
  pass "Admin guide (BLUESKY_ADMIN_GUIDE.md) exists"
else
  warn "Admin guide missing"
fi

# Test 8: API endpoint connectivity (if running)
section "Test 8: API Endpoint Connectivity"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$API_URL/health")

if [ "$HTTP_STATUS" = "200" ]; then
  pass "API is running (HTTP 200)"

  # Try to call Bluesky endpoints
  STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$API_URL/api/bluesky/status" \
    -b "$SESSION_COOKIE")

  if [ "$STATUS_CODE" = "401" ] || [ "$STATUS_CODE" = "200" ]; then
    pass "Bluesky status endpoint is accessible (HTTP $STATUS_CODE)"
  else
    warn "Unexpected status code: $STATUS_CODE"
  fi
else
  warn "API not responding (HTTP $HTTP_STATUS) - is it running?"
fi

# Test 9: Migration file
section "Test 9: Database Migration File"

if [ -f "database/migrations/071_bluesky_one_click_setup.sql" ]; then
  pass "Migration file exists"

  # Check for key table definitions
  if grep -q "CREATE TABLE.*bluesky_profile_syncs" database/migrations/071_bluesky_one_click_setup.sql; then
    pass "Migration includes bluesky_profile_syncs table"
  else
    fail "Migration missing bluesky_profile_syncs table"
  fi
else
  fail "Migration file not found"
fi

# Test 10: Environment configuration
section "Test 10: Environment Configuration"

if [ -f ".env.production" ]; then
  if grep -q "BLUESKY_" .env.production; then
    pass "Bluesky variables configured in .env.production"
  else
    warn "No Bluesky configuration in .env.production"
  fi
elif [ -f ".env" ]; then
  if grep -q "BLUESKY_" .env; then
    pass "Bluesky variables configured in .env"
  else
    warn "No Bluesky configuration in .env"
  fi
else
  warn "No .env files found"
fi

# Summary
section "Test Summary"

echo -e "${GREEN}All critical checks completed.${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Deploy the changes: pm2 restart pnptv-bot"
echo "2. Check logs: pm2 logs pnptv-bot | grep Bluesky"
echo "3. Test in dashboard: Look for Bluesky card"
echo ""
echo -e "${GREEN}For more info, see BLUESKY_ADMIN_GUIDE.md${NC}"
