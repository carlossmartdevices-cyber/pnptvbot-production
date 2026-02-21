#!/bin/bash

##############################################################################
# One-Click Bluesky Setup - Deployment Script
# This script sets up the Bluesky auto-setup feature for pnptv
#
# Usage: ./scripts/setup-bluesky-oneclick.sh
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}One-Click Bluesky Setup - Deployment${NC}"
echo -e "${BLUE}==========================================${NC}\n"

# Check if in correct directory
if [ ! -f "package.json" ]; then
  echo -e "${RED}Error: Run this script from the root project directory${NC}"
  exit 1
fi

# Step 1: Verify database connection
echo -e "${YELLOW}Step 1: Verifying database connection...${NC}"
if ! psql -U postgres -d pnptv_db -c "SELECT 1" > /dev/null 2>&1; then
  echo -e "${RED}Error: Cannot connect to PostgreSQL database${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Database connection OK${NC}\n"

# Step 2: Run migration
echo -e "${YELLOW}Step 2: Running database migration...${NC}"
if psql -U postgres -d pnptv_db -f database/migrations/071_bluesky_one_click_setup.sql > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Migration successful${NC}"
else
  echo -e "${RED}Error: Migration failed${NC}"
  exit 1
fi

# Verify migration applied
if psql -U postgres -d pnptv_db -c "\d bluesky_profile_syncs" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ New tables verified${NC}\n"
else
  echo -e "${RED}Error: Migration did not create tables${NC}"
  exit 1
fi

# Step 3: Check backend files
echo -e "${YELLOW}Step 3: Verifying backend files...${NC}"
FILES=(
  "apps/backend/bot/services/BlueskyAutoSetupService.js"
  "apps/backend/bot/api/controllers/blueskyController.js"
  "apps/backend/bot/api/routes/blueskyRoutes.js"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✓ $file${NC}"
  else
    echo -e "${RED}✗ Missing: $file${NC}"
    exit 1
  fi
done
echo ""

# Step 4: Check frontend files
echo -e "${YELLOW}Step 4: Verifying frontend files...${NC}"
FRONTEND_FILES=(
  "webapps/prime-hub/src/api/blueskyClient.js"
  "webapps/prime-hub/src/components/BlueskySetupCard.jsx"
  "webapps/prime-hub/src/components/BlueskySuccessModal.jsx"
)

for file in "${FRONTEND_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✓ $file${NC}"
  else
    echo -e "${RED}✗ Missing: $file${NC}"
    exit 1
  fi
done
echo ""

# Step 5: Verify routes are registered
echo -e "${YELLOW}Step 5: Verifying API routes...${NC}"
if grep -q "blueskyRoutes" apps/backend/bot/api/routes.js && \
   grep -q "app.use('/api/bluesky'" apps/backend/bot/api/routes.js; then
  echo -e "${GREEN}✓ Bluesky routes registered in routes.js${NC}\n"
else
  echo -e "${RED}Error: Routes not properly registered${NC}"
  exit 1
fi

# Step 6: Check environment configuration
echo -e "${YELLOW}Step 6: Checking environment configuration...${NC}"
if [ -f ".env.production" ]; then
  if grep -q "BLUESKY_AUTO_SETUP" .env.production || grep -q "BLUESKY_AUTO_SETUP" .env; then
    echo -e "${GREEN}✓ BLUESKY_AUTO_SETUP configured${NC}"
  else
    echo -e "${YELLOW}⚠ BLUESKY_AUTO_SETUP not configured, will default to true${NC}"
  fi
fi

if ! grep -q "BLUESKY_HANDLE_DOMAIN" .env* 2>/dev/null; then
  echo -e "${YELLOW}⚠ BLUESKY_HANDLE_DOMAIN not set, will use default: pnptv.app${NC}"
fi
echo ""

# Step 7: Build backend
echo -e "${YELLOW}Step 7: Building backend...${NC}"
if npm run build:backend > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Backend build successful${NC}\n"
else
  echo -e "${RED}Warning: Backend build may have issues${NC}\n"
fi

# Step 8: Build frontend
echo -e "${YELLOW}Step 8: Building frontend...${NC}"
if npm run build:prime-hub > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Frontend build successful${NC}\n"
else
  echo -e "${RED}Warning: Frontend build may have issues${NC}\n"
fi

# Step 9: Summary
echo -e "${BLUE}==========================================${NC}"
echo -e "${GREEN}✓ One-Click Bluesky Setup Installed!${NC}"
echo -e "${BLUE}==========================================${NC}\n"

echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Restart the application:"
echo -e "   ${GREEN}pm2 restart pnptv-bot${NC}"
echo ""
echo "2. Verify the setup:"
echo -e "   ${GREEN}pm2 logs pnptv-bot | grep Bluesky${NC}"
echo ""
echo "3. Test the feature:"
echo "   - Login to pnptv dashboard"
echo "   - Look for Bluesky card"
echo "   - Click 'Create Bluesky Account'"
echo ""
echo -e "${YELLOW}Documentation:${NC}"
echo "- Member Guide: ./BLUESKY_SIMPLE_SETUP.md"
echo "- Admin Guide: ./BLUESKY_ADMIN_GUIDE.md"
echo ""
echo -e "${GREEN}Happy Blueskyifying! 🦋${NC}"
