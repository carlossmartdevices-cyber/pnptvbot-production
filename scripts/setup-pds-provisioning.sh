#!/bin/bash

# Setup PDS Provisioning System
# This script initializes the PDS (Personal Data Server) provisioning system

set -e

echo "=================================="
echo "PDS Provisioning Setup"
echo "=================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running from correct directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found. Run from project root.${NC}"
    exit 1
fi

echo -e "${BLUE}Step 1: Checking dependencies...${NC}"
if ! npm list uuid >/dev/null 2>&1; then
    echo "Installing uuid..."
    npm install uuid
fi

echo -e "${GREEN}✓ Dependencies OK${NC}"

echo ""
echo -e "${BLUE}Step 2: Checking environment variables...${NC}"

# Check required env vars
REQUIRED_VARS=(
    "PDS_ENCRYPTION_KEY"
    "PDS_DOMAIN"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${YELLOW}Missing environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "Add these to your .env file:"
    echo ""
    echo "# PDS Provisioning Configuration"
    echo "PDS_PROVISIONING_ENABLED=true"
    echo "PDS_MODE=local  # Options: local, remote, hybrid"
    echo "PDS_DOMAIN=pnptv.app"
    echo "PDS_ENCRYPTION_KEY=$(head -c 32 /dev/urandom | base64)"
    echo ""
    echo "# If using local PDS:"
    echo "PDS_LOCAL_ENDPOINT=http://127.0.0.1:3000"
    echo "PDS_ADMIN_DID=did:web:admin.pnptv.app"
    echo "PDS_ADMIN_PASSWORD=your-secure-password"
    echo ""
    echo "# If using remote PDS:"
    echo "PDS_REMOTE_PROVIDER=https://pds.bluesky.social"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ Environment variables OK${NC}"

echo ""
echo -e "${BLUE}Step 3: Running database migration...${NC}"

# Get database credentials from environment
DB_USER="${POSTGRES_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-pnptv_db}"

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}psql not found, skipping migration${NC}"
    echo "Run migration manually:"
    echo "psql -U $DB_USER -h $DB_HOST -d $DB_NAME -f apps/backend/migrations/064_user_pds_mapping.sql"
else
    echo "Running migration..."
    psql -U "$DB_USER" -h "$DB_HOST" -d "$DB_NAME" -f apps/backend/migrations/064_user_pds_mapping.sql 2>/dev/null || {
        echo -e "${YELLOW}Migration may have already been applied${NC}"
    }
    echo -e "${GREEN}✓ Migration applied${NC}"
fi

echo ""
echo -e "${BLUE}Step 4: Verifying service files...${NC}"

# Check if service files exist
FILES=(
    "apps/backend/bot/services/PDSProvisioningService.js"
    "apps/backend/bot/api/controllers/pdsController.js"
    "apps/backend/bot/api/routes/pdsRoutes.js"
    "webapps/prime-hub/src/pages/PDSSetup.jsx"
    "webapps/prime-hub/src/components/PDSStatus.jsx"
    "webapps/prime-hub/src/components/DecentralizedIdentity.jsx"
    "webapps/prime-hub/src/api/pdsClient.js"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo -e "  ${RED}✗ $file (missing)${NC}"
    fi
done

echo ""
echo -e "${BLUE}Step 5: Creating PDS configuration...${NC}"

# Create config template if not exists
CONFIG_FILE=".pds.config.local.json"
if [ ! -f "$CONFIG_FILE" ]; then
    cat > "$CONFIG_FILE" << 'EOF'
{
  "pds": {
    "enabled": true,
    "mode": "local",
    "domain": "pnptv.app",
    "encryption": {
      "algorithm": "aes-256-gcm",
      "keyRotationDays": 90
    },
    "providers": {
      "local": {
        "endpoint": "http://127.0.0.1:3000",
        "adminDid": "did:web:admin.pnptv.app",
        "adminPassword": "CHANGE_ME"
      },
      "remote": {
        "endpoint": "https://pds.bluesky.social"
      }
    },
    "healthCheck": {
      "intervalMinutes": 60,
      "timeoutSeconds": 10
    },
    "provisioning": {
      "retryAttempts": 3,
      "retryDelaySeconds": 300,
      "allowAutoRetry": true
    }
  }
}
EOF
    echo -e "${GREEN}✓ Created $CONFIG_FILE${NC}"
else
    echo -e "${YELLOW}$CONFIG_FILE already exists${NC}"
fi

echo ""
echo -e "${BLUE}Step 6: Setting up background worker (optional)...${NC}"

# Check if PM2 is available
if command -v pm2 &> /dev/null; then
    echo "You can optionally run PDS background worker with:"
    echo "  pm2 start scripts/pds-worker.js --name 'pds-worker'"
    echo ""
else
    echo -e "${YELLOW}PM2 not found, background worker will run in main process${NC}"
fi

echo ""
echo -e "${GREEN}=================================="
echo "PDS Setup Complete!"
echo "==================================${NC}"
echo ""
echo "Next steps:"
echo "1. Update your .env with PDS configuration"
echo "2. Restart the application: npm start"
echo "3. Users will auto-provision PDS on next Telegram login"
echo "4. Monitor PDS status in admin dashboard"
echo ""
echo "Documentation:"
echo "  - Backend: apps/backend/bot/services/PDSProvisioningService.js"
echo "  - Frontend: webapps/prime-hub/src/pages/PDSSetup.jsx"
echo "  - API routes: /api/pds/*"
echo ""
echo "Useful commands:"
echo "  - Check PDS info: curl -b cookies.txt http://localhost:3001/api/pds/info"
echo "  - Retry provision: curl -X POST -b cookies.txt http://localhost:3001/api/pds/retry-provision"
echo "  - Health check: curl -b cookies.txt http://localhost:3001/api/pds/health"
echo ""
