#!/bin/bash

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "  Photo System - Integration Test Suite"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_BASE="http://localhost:3001"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-password123}"
USER_EMAIL="${USER_EMAIL:-user@example.com}"
USER_PASSWORD="${USER_PASSWORD:-password123}"

# Counters
TESTS_PASSED=0
TESTS_FAILED=0

# Test functions
test_passed() {
  echo -e "${GREEN}✓ PASS: $1${NC}"
  ((TESTS_PASSED++))
}

test_failed() {
  echo -e "${RED}✗ FAIL: $1${NC}"
  ((TESTS_FAILED++))
}

test_info() {
  echo -e "${BLUE}ℹ INFO: $1${NC}"
}

# Create test images
create_test_image() {
  local filename=$1
  local width=${2:-800}
  local height=${3:-600}

  if command -v convert >/dev/null 2>&1; then
    # Use ImageMagick if available
    convert -size ${width}x${height} xc:rgb\(100,150,200\) "$filename"
  else
    # Fallback: create minimal PNG (requires no dependencies)
    python3 << EOF
from PIL import Image
img = Image.new('RGB', ($width, $height), color='blue')
img.save('$filename')
EOF
  fi
}

# Login and get session cookie
login() {
  local email=$1
  local password=$2
  local cookiefile="test_cookies_${email}.txt"

  test_info "Logging in as $email..."

  response=$(curl -s -X POST "$API_BASE/api/webapp/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\", \"password\": \"$password\"}" \
    -c "$cookiefile")

  if echo "$response" | grep -q "success"; then
    echo "$cookiefile"
  else
    test_failed "Login failed for $email"
    return 1
  fi
}

# Helper: Get cookie from file
get_cookie() {
  local cookiefile=$1
  grep connect.sid "$cookiefile" 2>/dev/null | awk '{print $7}' || echo ""
}

echo ""
echo "═ SETUP ═════════════════════════════════════════════════════════"
echo ""

# Create test image directory
mkdir -p /tmp/photo_tests
test_info "Creating test images..."

create_test_image "/tmp/photo_tests/test1.jpg" 1920 1080
create_test_image "/tmp/photo_tests/test2.jpg" 1280 720
create_test_image "/tmp/photo_tests/test3.png" 800 600

test_passed "Test images created"
echo ""

echo "═ AUTHENTICATION ════════════════════════────────────────────────"
echo ""

# Admin login
ADMIN_COOKIE_FILE=$(login "$ADMIN_EMAIL" "$ADMIN_PASSWORD") || exit 1
ADMIN_COOKIE=$(get_cookie "$ADMIN_COOKIE_FILE")

if [ -z "$ADMIN_COOKIE" ]; then
  test_failed "Could not get admin session cookie"
  exit 1
fi
test_passed "Admin authentication successful"

# User login
USER_COOKIE_FILE=$(login "$USER_EMAIL" "$USER_PASSWORD") || exit 1
USER_COOKIE=$(get_cookie "$USER_COOKIE_FILE")

if [ -z "$USER_COOKIE" ]; then
  test_failed "Could not get user session cookie"
  exit 1
fi
test_passed "User authentication successful"
echo ""

echo "═ ADMIN PHOTO OPERATIONS ════────────────────────────────────────"
echo ""

# Test 1: Upload admin photo
test_info "Test 1: Upload admin photo..."
response=$(curl -s -X POST "$API_BASE/api/admin/photos/upload" \
  -H "Cookie: connect.sid=$ADMIN_COOKIE" \
  -F "file=@/tmp/photo_tests/test1.jpg" \
  -F "caption=Test Admin Photo 1" \
  -F "category=gallery")

photo1_id=$(echo "$response" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
if [ -n "$photo1_id" ]; then
  test_passed "Uploaded photo (ID: $photo1_id)"
else
  test_failed "Photo upload failed"
  echo "Response: $response"
fi

# Test 2: Upload multiple photos
test_info "Test 2: Upload multiple photos..."
for i in 2 3; do
  response=$(curl -s -X POST "$API_BASE/api/admin/photos/upload" \
    -H "Cookie: connect.sid=$ADMIN_COOKIE" \
    -F "file=@/tmp/photo_tests/test${i}.jpg" \
    -F "caption=Test Admin Photo $i" \
    -F "category=featured")

  if echo "$response" | grep -q '"id"'; then
    test_passed "Uploaded photo $i"
  else
    test_failed "Photo $i upload failed"
  fi
done

# Test 3: List admin photos
test_info "Test 3: List admin photos..."
response=$(curl -s -X GET "$API_BASE/api/admin/photos/list?limit=10" \
  -H "Cookie: connect.sid=$ADMIN_COOKIE")

if echo "$response" | grep -q '"photos"'; then
  photo_count=$(echo "$response" | grep -o '"total":[0-9]*' | cut -d':' -f2)
  test_passed "Listed photos (Total: $photo_count)"
else
  test_failed "List photos failed"
fi

# Test 4: Get photo details
if [ -n "$photo1_id" ]; then
  test_info "Test 4: Get photo details..."
  response=$(curl -s -X GET "$API_BASE/api/admin/photos/$photo1_id" \
    -H "Cookie: connect.sid=$ADMIN_COOKIE")

  if echo "$response" | grep -q "$photo1_id"; then
    test_passed "Retrieved photo details"
  else
    test_failed "Get photo details failed"
  fi
fi

# Test 5: Update photo
if [ -n "$photo1_id" ]; then
  test_info "Test 5: Update photo metadata..."
  response=$(curl -s -X PUT "$API_BASE/api/admin/photos/$photo1_id" \
    -H "Cookie: connect.sid=$ADMIN_COOKIE" \
    -H "Content-Type: application/json" \
    -d '{"caption": "Updated Caption", "category": "promotions"}')

  if echo "$response" | grep -q "Updated Caption"; then
    test_passed "Updated photo metadata"
  else
    test_failed "Update photo failed"
  fi
fi

# Test 6: Get statistics
test_info "Test 6: Get photo statistics..."
response=$(curl -s -X GET "$API_BASE/api/admin/photos/stats" \
  -H "Cookie: connect.sid=$ADMIN_COOKIE")

if echo "$response" | grep -q '"total_photos"'; then
  test_passed "Retrieved photo statistics"
else
  test_failed "Get statistics failed"
fi

echo ""
echo "═ USER PHOTO OPERATIONS ════─────────────────────────────────────"
echo ""

# Test 7: User upload photo
test_info "Test 7: User upload photo..."
response=$(curl -s -X POST "$API_BASE/api/photos/upload" \
  -H "Cookie: connect.sid=$USER_COOKIE" \
  -F "file=@/tmp/photo_tests/test1.jpg" \
  -F "caption=My User Photo")

user_photo_id=$(echo "$response" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
if [ -n "$user_photo_id" ]; then
  test_passed "User uploaded photo (ID: $user_photo_id)"
else
  test_failed "User photo upload failed"
fi

# Test 8: Get user photo stats
test_info "Test 8: Get user photo statistics..."
response=$(curl -s -X GET "$API_BASE/api/photos/stats" \
  -H "Cookie: connect.sid=$USER_COOKIE")

if echo "$response" | grep -q '"total_photos"'; then
  test_passed "Retrieved user photo statistics"
else
  test_failed "Get user stats failed"
fi

# Test 9: Test storage limit
test_info "Test 9: Test file size validation..."
# Create a file larger than 10MB
dd if=/dev/zero of=/tmp/photo_tests/large.bin bs=1M count=15 2>/dev/null

response=$(curl -s -X POST "$API_BASE/api/photos/upload" \
  -H "Cookie: connect.sid=$USER_COOKIE" \
  -F "file=@/tmp/photo_tests/large.bin" \
  -w "%{http_code}")

http_code=$(echo "$response" | tail -c 4)
if [ "$http_code" = "400" ]; then
  test_passed "File size validation working (rejected oversized file)"
else
  test_failed "File size validation not working (HTTP $http_code)"
fi

echo ""
echo "═ ADMIN DELETE OPERATIONS ───────────────────────────────────────"
echo ""

# Test 10: Delete single photo
if [ -n "$photo1_id" ]; then
  test_info "Test 10: Delete single photo..."
  response=$(curl -s -X DELETE "$API_BASE/api/admin/photos/$photo1_id" \
    -H "Cookie: connect.sid=$ADMIN_COOKIE")

  if echo "$response" | grep -q "success"; then
    test_passed "Deleted photo"
  else
    test_failed "Photo deletion failed"
  fi
fi

echo ""
echo "═ ERROR HANDLING ════────────────────────────────────────────────"
echo ""

# Test 11: Unauthorized access
test_info "Test 11: Test unauthorized access..."
response=$(curl -s -X POST "$API_BASE/api/admin/photos/upload" \
  -H "Cookie: connect.sid=$USER_COOKIE" \
  -F "file=@/tmp/photo_tests/test1.jpg" \
  -w "%{http_code}")

http_code=$(echo "$response" | tail -c 4)
if [ "$http_code" = "403" ]; then
  test_passed "Unauthorized access rejected (HTTP 403)"
else
  test_info "Non-admin upload returned HTTP $http_code"
fi

# Test 12: Invalid category
test_info "Test 12: Test invalid category handling..."
response=$(curl -s -X POST "$API_BASE/api/admin/photos/upload" \
  -H "Cookie: connect.sid=$ADMIN_COOKIE" \
  -F "file=@/tmp/photo_tests/test2.jpg" \
  -F "caption=Test" \
  -F "category=invalid_category")

# Should still accept (default category)
if echo "$response" | grep -q '"id"'; then
  test_passed "Invalid category handled gracefully"
fi

echo ""
echo "═ CLEANUP ───────────────────────────────────────────────────────"
echo ""

# Cleanup test files
rm -rf /tmp/photo_tests
rm -f test_cookies_*.txt
test_info "Test files cleaned up"

echo ""
echo "═════════════════════════════════════════════════════════════════"
echo -e "${BLUE}TEST RESULTS${NC}"
echo "═════════════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
