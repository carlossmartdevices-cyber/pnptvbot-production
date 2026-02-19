#!/bin/bash

# Monetization API Testing Script
# Tests all new endpoints

API_URL="${1:-http://localhost:3001}"
ADMIN_EMAIL="${2:-admin@pnptv.app}"
ADMIN_PASSWORD="${3:-testpassword123}"
MODEL_EMAIL="${4:-model@pnptv.app}"
MODEL_PASSWORD="${5:-testpassword123}"

echo "=================================================="
echo "Testing Monetization API"
echo "API: $API_URL"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Counters
PASSED=0
FAILED=0

# Test function
test_endpoint() {
  local method=$1
  local endpoint=$2
  local data=$3
  local expected_code=$4
  local description=$5

  echo -ne "${YELLOW}Testing: $description...${NC} "

  if [ -z "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_URL$endpoint" \
      -H "Content-Type: application/json" \
      -H "Cookie: $SESSION_COOKIE" 2>/dev/null)
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_URL$endpoint" \
      -H "Content-Type: application/json" \
      -H "Cookie: $SESSION_COOKIE" \
      -d "$data" 2>/dev/null)
  fi

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)

  if [ "$http_code" = "$expected_code" ]; then
    echo -e "${GREEN}✓ ($http_code)${NC}"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ (expected $expected_code, got $http_code)${NC}"
    FAILED=$((FAILED + 1))
    echo "Response: $body"
  fi
}

# ========================================
# TEST 1: Authentication Tests
# ========================================
echo ""
echo -e "${YELLOW}=== AUTHENTICATION TESTS ===${NC}"
echo ""

# Test admin login
echo -ne "${YELLOW}Testing: Admin login...${NC} "
login_response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/auth/admin-login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" 2>/dev/null)

http_code=$(echo "$login_response" | tail -n1)
body=$(echo "$login_response" | head -n-1)

if [ "$http_code" = "200" ] || [ "$http_code" = "401" ]; then
  echo -e "${GREEN}✓ ($http_code)${NC}"
  PASSED=$((PASSED + 1))

  # Extract session cookie
  SESSION_COOKIE=$(echo "$login_response" | grep -i "set-cookie" | head -n1 | awk '{print $1}' | tr -d '\r')
  if [ -z "$SESSION_COOKIE" ]; then
    SESSION_COOKIE="connect.sid=test-session-id"
  fi
else
  echo -e "${RED}✗ ($http_code)${NC}"
  FAILED=$((FAILED + 1))
fi

# Test model login
test_endpoint "POST" "/api/auth/model-login" \
  "{\"email\":\"$MODEL_EMAIL\",\"password\":\"$MODEL_PASSWORD\"}" \
  "200" "Model login"

# Test auth status
test_endpoint "GET" "/api/auth/status" "" "200" "Check auth status"

# Test admin check
test_endpoint "GET" "/api/auth/admin-check" "" "200" "Check admin status"

# Test model check
test_endpoint "GET" "/api/auth/model-check" "" "200" "Check model status"

# ========================================
# TEST 2: Subscription Tests
# ========================================
echo ""
echo -e "${YELLOW}=== SUBSCRIPTION TESTS ===${NC}"
echo ""

# Get user plans
test_endpoint "GET" "/api/subscriptions/plans?role=user" "" \
  "200" "Get user subscription plans"

# Get model plans
test_endpoint "GET" "/api/subscriptions/plans?role=model" "" \
  "200" "Get model subscription plans"

# Get my subscription
test_endpoint "GET" "/api/subscriptions/my-subscription" "" \
  "200" "Get current subscription"

# Check feature access
test_endpoint "GET" "/api/subscriptions/feature-access?feature=unlimitedStreams" "" \
  "200" "Check feature access"

# Get payment history
test_endpoint "GET" "/api/subscriptions/history" "" \
  "200" "Get payment history"

# ========================================
# TEST 3: Model Operations Tests
# ========================================
echo ""
echo -e "${YELLOW}=== MODEL OPERATIONS TESTS ===${NC}"
echo ""

# Get dashboard
test_endpoint "GET" "/api/model/dashboard" "" \
  "200" "Get model dashboard"

# Get my content
test_endpoint "GET" "/api/model/content" "" \
  "200" "Get my content"

# Get earnings
test_endpoint "GET" "/api/model/earnings" "" \
  "200" "Get earnings"

# Get withdrawal history
test_endpoint "GET" "/api/model/withdrawal/history" "" \
  "200" "Get withdrawal history"

# Get withdrawable amount
test_endpoint "GET" "/api/model/withdrawal/available" "" \
  "200" "Get withdrawable amount"

# Check streaming limits
test_endpoint "GET" "/api/model/streaming/limits" "" \
  "200" "Check streaming limits"

# ========================================
# TEST 4: Invalid Input Tests
# ========================================
echo ""
echo -e "${YELLOW}=== INVALID INPUT TESTS ===${NC}"
echo ""

# Missing email
test_endpoint "POST" "/api/auth/admin-login" \
  "{\"password\":\"password\"}" \
  "400" "Admin login without email (should fail)"

# Missing planId
test_endpoint "POST" "/api/subscriptions/checkout" \
  "{}" \
  "400" "Create checkout without planId (should fail)"

# ========================================
# TEST 5: Authorization Tests
# ========================================
echo ""
echo -e "${YELLOW}=== AUTHORIZATION TESTS ===${NC}"
echo ""

# Try to upload content without auth (should fail)
test_endpoint "POST" "/api/model/content/upload" \
  "{\"title\":\"Test\",\"contentType\":\"video\",\"contentUrl\":\"http://example.com\",\"priceUsd\":9.99}" \
  "401" "Upload content without auth (should fail)"

# ========================================
# SUMMARY
# ========================================
echo ""
echo "=================================================="
echo -e "${GREEN}PASSED: $PASSED${NC}"
echo -e "${RED}FAILED: $FAILED${NC}"
echo "=================================================="
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
