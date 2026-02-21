#!/bin/bash

echo "=================================================="
echo "Element Integration Test Suite"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function
test_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}: $2"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗ FAIL${NC}: $2"
    ((TESTS_FAILED++))
  fi
}

echo "1. Checking Infrastructure"
echo "---"

# Check PDS
echo -n "PDS container status: "
PDS_STATUS=$(docker ps | grep "bluesky-pds-uiup-pds-1" | grep "healthy")
if [ ! -z "$PDS_STATUS" ]; then
  echo -e "${GREEN}HEALTHY${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}NOT HEALTHY${NC}"
  ((TESTS_FAILED++))
fi

# Check Element
echo -n "Element container status: "
ELEMENT_STATUS=$(docker ps | grep "element-x8g9-element-1" | grep "Up")
if [ ! -z "$ELEMENT_STATUS" ]; then
  echo -e "${GREEN}UP${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}DOWN${NC}"
  ((TESTS_FAILED++))
fi

# Check PDS health endpoint - port may vary
echo -n "PDS health check: "
PDS_PORT=$(docker ps | grep "bluesky-pds-uiup-pds-1" | grep -oP '\d+(?=->3000)' | head -1)
if [ ! -z "$PDS_PORT" ]; then
  PDS_HEALTH=$(curl -s http://127.0.0.1:$PDS_PORT/xrpc/_health 2>/dev/null | grep -o "version")
  if [ ! -z "$PDS_HEALTH" ]; then
    echo -e "${GREEN}RESPONDING${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}NOT RESPONDING${NC}"
    ((TESTS_FAILED++))
  fi
else
  echo -e "${RED}PORT NOT FOUND${NC}"
  ((TESTS_FAILED++))
fi

echo ""
echo "2. Checking Backend Files"
echo "---"

# Check ElementService
echo -n "ElementService.js exists: "
if [ -f "/root/pnptvbot-production/apps/backend/bot/services/ElementService.js" ]; then
  echo -e "${GREEN}YES${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}NO${NC}"
  ((TESTS_FAILED++))
fi

# Check elementRoutes
echo -n "elementRoutes.js exists: "
if [ -f "/root/pnptvbot-production/apps/backend/bot/api/routes/elementRoutes.js" ]; then
  echo -e "${GREEN}YES${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}NO${NC}"
  ((TESTS_FAILED++))
fi

# Check elementController
echo -n "elementController.js exists: "
if [ -f "/root/pnptvbot-production/apps/backend/bot/api/controllers/elementController.js" ]; then
  echo -e "${GREEN}YES${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}NO${NC}"
  ((TESTS_FAILED++))
fi

# Check elementRoutes is imported in routes.js
echo -n "elementRoutes imported in routes.js: "
IMPORTED=$(grep -c "elementRoutes" /root/pnptvbot-production/apps/backend/bot/api/routes.js)
if [ $IMPORTED -ge 2 ]; then
  echo -e "${GREEN}YES${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}NO${NC}"
  ((TESTS_FAILED++))
fi

echo ""
echo "3. Checking Frontend Files"
echo "---"

# Check elementClient
echo -n "elementClient.js exists: "
if [ -f "/root/pnptvbot-production/webapps/prime-hub/src/api/elementClient.js" ]; then
  echo -e "${GREEN}YES${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}NO${NC}"
  ((TESTS_FAILED++))
fi

# Check ElementSetupCard
echo -n "ElementSetupCard.jsx exists: "
if [ -f "/root/pnptvbot-production/webapps/prime-hub/src/components/ElementSetupCard.jsx" ]; then
  echo -e "${GREEN}YES${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}NO${NC}"
  ((TESTS_FAILED++))
fi

echo ""
echo "4. Checking Syntax"
echo "---"

# Check JavaScript syntax
cd /root/pnptvbot-production/apps/backend

echo -n "ElementService.js syntax: "
if node -c bot/services/ElementService.js 2>/dev/null; then
  echo -e "${GREEN}VALID${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}INVALID${NC}"
  ((TESTS_FAILED++))
fi

echo -n "elementRoutes.js syntax: "
if node -c bot/api/routes/elementRoutes.js 2>/dev/null; then
  echo -e "${GREEN}VALID${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}INVALID${NC}"
  ((TESTS_FAILED++))
fi

echo -n "elementController.js syntax: "
if node -c bot/api/controllers/elementController.js 2>/dev/null; then
  echo -e "${GREEN}VALID${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}INVALID${NC}"
  ((TESTS_FAILED++))
fi

echo ""
echo "5. Checking PDS Configuration"
echo "---"

# Check PDS .env file
echo -n "PDS .env exists: "
if [ -f "/docker/bluesky-pds-uiup/.env" ]; then
  echo -e "${GREEN}YES${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}NO${NC}"
  ((TESTS_FAILED++))
fi

# Check PDS_PLC_ROTATION_KEY is valid hex
echo -n "PDS_PLC_ROTATION_KEY is valid: "
PDS_KEY=$(grep "PDS_PLC_ROTATION_KEY" /docker/bluesky-pds-uiup/.env | cut -d'=' -f2)
if [[ $PDS_KEY =~ ^[0-9a-f]{64}$ ]]; then
  echo -e "${GREEN}YES (64-char hex)${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}NO (not 64-char hex)${NC}"
  ((TESTS_FAILED++))
fi

# Check PDS_SIGNING_KEY_K256_PRIVATE_KEY_HEX is valid hex
echo -n "PDS_SIGNING_KEY is valid: "
SIGN_KEY=$(grep "PDS_SIGNING_KEY_K256_PRIVATE_KEY_HEX" /docker/bluesky-pds-uiup/.env | cut -d'=' -f2)
if [[ $SIGN_KEY =~ ^[0-9a-f]{64}$ ]]; then
  echo -e "${GREEN}YES (64-char hex)${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}NO (not 64-char hex)${NC}"
  ((TESTS_FAILED++))
fi

# Check SMTP URL is URL-encoded
echo -n "PDS_EMAIL_SMTP_URL is URL-encoded: "
SMTP_URL=$(grep "PDS_EMAIL_SMTP_URL" /docker/bluesky-pds-uiup/.env | grep "%23")
if [ ! -z "$SMTP_URL" ]; then
  echo -e "${GREEN}YES${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}NO${NC}"
  ((TESTS_FAILED++))
fi

echo ""
echo "=================================================="
echo "Test Results Summary"
echo "=================================================="
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Add ElementSetupCard to Dashboard"
  echo "2. Configure ELEMENT_HOMESERVER in .env.production"
  echo "3. Rebuild React SPA: cd webapps/prime-hub && npm run build"
  echo "4. Restart application: pm2 restart pnptv-bot"
  echo "5. Test login flow via Telegram OAuth"
  echo ""
  exit 0
else
  echo -e "${RED}✗ Some tests failed. See details above.${NC}"
  exit 1
fi
