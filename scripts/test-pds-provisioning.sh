#!/bin/bash

# Test PDS Provisioning System
# Comprehensive test suite for PDS functionality

set -e

echo "=================================="
echo "PDS Provisioning Test Suite"
echo "=================================="

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_BASE="http://localhost:3001"
TIMEOUT=10

# Helper functions
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local expected_code=${4:-200}
    local data=$5

    echo -ne "Testing: $description... "

    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -b cookies.txt \
            -H "Content-Type: application/json" \
            --max-time "$TIMEOUT" \
            "$API_BASE$endpoint" 2>/dev/null || echo "000")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -b cookies.txt \
            -H "Content-Type: application/json" \
            -d "$data" \
            --max-time "$TIMEOUT" \
            "$API_BASE$endpoint" 2>/dev/null || echo "000")
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "$expected_code" ]; then
        echo -e "${GREEN}✓${NC}"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗ (HTTP $http_code, expected $expected_code)${NC}"
        echo "$body"
        return 1
    fi

    echo ""
    return 0
}

# Check if server is running
echo -e "${BLUE}Checking if server is running at $API_BASE...${NC}"
if ! curl -s -f "$API_BASE/health" > /dev/null 2>&1; then
    echo -e "${RED}Error: Server is not running at $API_BASE${NC}"
    echo "Start the server with: npm start"
    exit 1
fi

echo -e "${GREEN}✓ Server is running${NC}"
echo ""

# Test 1: Check auth status
echo -e "${BLUE}=== Test 1: Authentication ===${NC}"
test_endpoint GET "/api/auth/check-status" "Check auth status" 200 || true
echo ""

# Test 2: Get PDS info (unauthenticated)
echo -e "${BLUE}=== Test 2: PDS Info Endpoint ===${NC}"
test_endpoint GET "/api/pds/info" "Get PDS info (should be 401 if not authenticated)" 401 || true
echo ""

# Test 3: Health check (unauthenticated)
echo -e "${BLUE}=== Test 3: PDS Health Check ===${NC}"
test_endpoint GET "/api/pds/health" "Check PDS health (should be 401 if not authenticated)" 401 || true
echo ""

# Test 4: Retry provision (unauthenticated)
echo -e "${BLUE}=== Test 4: Retry Provisioning ===${NC}"
test_endpoint POST "/api/pds/retry-provision" "Retry provisioning (should be 401 if not authenticated)" 401 || true
echo ""

# Test 5: Database migration check
echo -e "${BLUE}=== Test 5: Database Migration ===${NC}"

DB_USER="${POSTGRES_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_NAME="${POSTGRES_DB:-pnptv_db}"

if command -v psql &> /dev/null; then
    echo "Checking database tables..."

    # Check if tables exist
    tables=("user_pds_mapping" "pds_provisioning_log" "pds_health_checks" "pds_credential_backups" "pds_provisioning_queue")

    for table in "${tables[@]}"; do
        if psql -U "$DB_USER" -h "$DB_HOST" -d "$DB_NAME" -tc "SELECT 1 FROM information_schema.tables WHERE table_name='$table'" 2>/dev/null | grep -q 1; then
            echo -e "  ${GREEN}✓${NC} Table: $table"
        else
            echo -e "  ${RED}✗${NC} Table: $table (missing - run migration)"
        fi
    done
else
    echo -e "${YELLOW}psql not found, skipping database checks${NC}"
fi

echo ""

# Test 6: Service file checks
echo -e "${BLUE}=== Test 6: Service Files ===${NC}"

files=(
    "apps/backend/bot/services/PDSProvisioningService.js"
    "apps/backend/bot/api/controllers/pdsController.js"
    "apps/backend/bot/api/routes/pdsRoutes.js"
    "webapps/prime-hub/src/pages/PDSSetup.jsx"
    "webapps/prime-hub/src/components/PDSStatus.jsx"
    "webapps/prime-hub/src/components/DecentralizedIdentity.jsx"
    "webapps/prime-hub/src/api/pdsClient.js"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $file"
    else
        echo -e "  ${RED}✗${NC} $file (missing)"
    fi
done

echo ""

# Test 7: Environment variables
echo -e "${BLUE}=== Test 7: Environment Variables ===${NC}"

required_vars=(
    "PDS_ENCRYPTION_KEY"
    "PDS_DOMAIN"
    "PDS_MODE"
)

for var in "${required_vars[@]}"; do
    value=${!var}
    if [ -n "$value" ]; then
        # Show masked value for security
        if [ "$var" = "PDS_ENCRYPTION_KEY" ]; then
            echo -e "  ${GREEN}✓${NC} $var (set, length: ${#value})"
        else
            echo -e "  ${GREEN}✓${NC} $var = $value"
        fi
    else
        echo -e "  ${YELLOW}!${NC} $var (not set)"
    fi
done

echo ""

# Test 8: Configuration file
echo -e "${BLUE}=== Test 8: Configuration File ===${NC}"

if [ -f ".pds.config.local.json" ]; then
    echo -e "  ${GREEN}✓${NC} .pds.config.local.json exists"
    if command -v jq &> /dev/null; then
        jq '.pds | keys[]' .pds.config.local.json 2>/dev/null | sed 's/^/    /'
    fi
else
    echo -e "  ${YELLOW}!${NC} .pds.config.local.json not found"
fi

echo ""

# Test 9: Logging
echo -e "${BLUE}=== Test 9: Service Logging ===${NC}"

if grep -q "PDSProvisioningService" apps/backend/bot/api/handlers/telegramAuthHandler.js 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} PDSProvisioningService integrated in telegramAuthHandler"
else
    echo -e "  ${RED}✗${NC} PDSProvisioningService not found in telegramAuthHandler"
fi

if grep -q "pdsRoutes" apps/backend/bot/api/routes.js 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} PDS routes registered in main routes file"
else
    echo -e "  ${RED}✗${NC} PDS routes not registered"
fi

echo ""

# Test 10: Load testing simulation
echo -e "${BLUE}=== Test 10: Load Simulation ===${NC}"

echo "Simulating concurrent requests (5 requests)..."

success=0
failed=0

for i in {1..5}; do
    (
        curl -s -X GET \
            -b cookies.txt \
            -H "Content-Type: application/json" \
            --max-time "$TIMEOUT" \
            "$API_BASE/api/pds/health" > /dev/null 2>&1 && \
            echo -e "  ${GREEN}✓${NC} Request $i succeeded" || \
            echo -e "  ${RED}✗${NC} Request $i failed"
    ) &
done

wait

echo ""

# Summary
echo -e "${BLUE}=== Test Summary ===${NC}"

echo ""
echo -e "${GREEN}PDS Provisioning tests completed!${NC}"
echo ""
echo "Manual testing commands:"
echo ""
echo "1. Get PDS info (requires authentication):"
echo "   curl -b cookies.txt http://localhost:3001/api/pds/info | jq ."
echo ""
echo "2. Check PDS health:"
echo "   curl -b cookies.txt http://localhost:3001/api/pds/health | jq ."
echo ""
echo "3. Retry provisioning:"
echo "   curl -X POST -b cookies.txt http://localhost:3001/api/pds/retry-provision | jq ."
echo ""
echo "4. Get provisioning log:"
echo "   curl -b cookies.txt 'http://localhost:3001/api/pds/provisioning-log?limit=10' | jq ."
echo ""
echo "5. Get health checks:"
echo "   curl -b cookies.txt 'http://localhost:3001/api/pds/health-checks?limit=10' | jq ."
echo ""
echo "Database inspection:"
echo "   psql -U postgres -d pnptv_db -c \"SELECT * FROM user_pds_mapping LIMIT 5;\""
echo "   psql -U postgres -d pnptv_db -c \"SELECT * FROM pds_provisioning_log ORDER BY created_at DESC LIMIT 10;\""
echo ""
