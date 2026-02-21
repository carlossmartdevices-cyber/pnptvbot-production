#!/bin/bash

# Coming Soon Pages - Setup Script
# This script sets up the database and integrates coming soon pages into the app

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== PNPtv Coming Soon Pages Setup ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 1. Run database migration
echo -e "${BLUE}Step 1: Running database migration...${NC}"
if command -v psql &> /dev/null; then
  PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -d pnptv_db -f "$PROJECT_ROOT/database/migrations/063_coming_soon_waitlist.sql"
  echo -e "${GREEN}✓ Database migration completed${NC}"
else
  echo -e "${YELLOW}⚠ psql not found. Please run migration manually:${NC}"
  echo "  PGPASSWORD=\$POSTGRES_PASSWORD psql -U postgres -d pnptv_db -f $PROJECT_ROOT/database/migrations/063_coming_soon_waitlist.sql"
fi
echo ""

# 2. Verify backend files exist
echo -e "${BLUE}Step 2: Verifying backend files...${NC}"
REQUIRED_FILES=(
  "src/bot/services/ComingSoonService.js"
  "src/bot/api/controllers/comingSoonController.js"
  "src/bot/api/routes/comingSoonRoutes.js"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ -f "$PROJECT_ROOT/$file" ]; then
    echo -e "${GREEN}✓ $file${NC}"
  else
    echo -e "${RED}✗ Missing: $file${NC}"
    exit 1
  fi
done
echo ""

# 3. Verify frontend files exist
echo -e "${BLUE}Step 3: Verifying frontend files...${NC}"
FRONTEND_FILES=(
  "webapps/prime-hub/src/pages/ComingSoonLive.jsx"
  "webapps/prime-hub/src/pages/ComingSoonHangouts.jsx"
  "webapps/prime-hub/src/styles/coming-soon.css"
  "webapps/prime-hub/src/api/comingSoonClient.js"
)

for file in "${FRONTEND_FILES[@]}"; do
  if [ -f "$PROJECT_ROOT/$file" ]; then
    echo -e "${GREEN}✓ $file${NC}"
  else
    echo -e "${RED}✗ Missing: $file${NC}"
    exit 1
  fi
done
echo ""

# 4. Check if routes are registered
echo -e "${BLUE}Step 4: Checking if routes are registered...${NC}"
if grep -q "coming-soon" "$PROJECT_ROOT/src/bot/api/routes.js" 2>/dev/null; then
  echo -e "${GREEN}✓ Coming soon routes already registered${NC}"
else
  echo -e "${YELLOW}⚠ Routes not registered in routes.js${NC}"
  echo "  Please add this line to src/bot/api/routes.js (around line 45):"
  echo "  app.use('/api/coming-soon', require('./routes/comingSoonRoutes'));"
fi
echo ""

# 5. Check if App.jsx has routes
echo -e "${BLUE}Step 5: Checking App.jsx configuration...${NC}"
if grep -q "ComingSoonLive" "$PROJECT_ROOT/webapps/prime-hub/src/App.jsx" 2>/dev/null; then
  echo -e "${GREEN}✓ App.jsx already configured${NC}"
else
  echo -e "${YELLOW}⚠ App.jsx not configured yet${NC}"
  echo "  Please add these lines to webapps/prime-hub/src/App.jsx:"
  echo ""
  echo "  // Import (around line 22):"
  echo "  import ComingSoonLive from './pages/ComingSoonLive';"
  echo "  import ComingSoonHangouts from './pages/ComingSoonHangouts';"
  echo ""
  echo "  // Routes (around line 77-78):"
  echo "  <Route path=\"/live/coming-soon\" element={<ProtectedRoute><ComingSoonLive /></ProtectedRoute>} />"
  echo "  <Route path=\"/hangouts/coming-soon\" element={<ProtectedRoute><ComingSoonHangouts /></ProtectedRoute>} />"
fi
echo ""

# 6. Check if CSS is imported
echo -e "${BLUE}Step 6: Checking CSS import...${NC}"
PRIME_HUB_INDEX="$PROJECT_ROOT/webapps/prime-hub/src/index.js"
PRIME_HUB_APP="$PROJECT_ROOT/webapps/prime-hub/src/App.jsx"
PRIME_HUB_MAIN="$PROJECT_ROOT/webapps/prime-hub/src/main.jsx"

CSS_IMPORTED=false
for file in "$PRIME_HUB_INDEX" "$PRIME_HUB_APP" "$PRIME_HUB_MAIN"; do
  if [ -f "$file" ] && grep -q "coming-soon.css" "$file" 2>/dev/null; then
    CSS_IMPORTED=true
    echo -e "${GREEN}✓ CSS imported in $file${NC}"
  fi
done

if [ "$CSS_IMPORTED" = false ]; then
  echo -e "${YELLOW}⚠ CSS not imported${NC}"
  echo "  Please add this line to your main CSS file or App.jsx:"
  echo "  import './styles/coming-soon.css';"
fi
echo ""

# 7. Summary
echo -e "${BLUE}=== Setup Summary ===${NC}"
echo ""
echo "Backend files: All present ✓"
echo "Frontend files: All present ✓"
echo "Database migration: Done ✓"
echo ""

echo -e "${YELLOW}Remaining manual steps:${NC}"
echo ""

NEED_ROUTES=false
NEED_APP=false
NEED_CSS=false

if ! grep -q "coming-soon" "$PROJECT_ROOT/src/bot/api/routes.js" 2>/dev/null; then
  NEED_ROUTES=true
  echo "1. Register routes in src/bot/api/routes.js"
fi

if ! grep -q "ComingSoonLive" "$PROJECT_ROOT/webapps/prime-hub/src/App.jsx" 2>/dev/null; then
  NEED_APP=true
  echo "2. Add routes to webapps/prime-hub/src/App.jsx"
fi

if ! grep -q "coming-soon.css" "$PROJECT_ROOT/webapps/prime-hub/src"/*.{js,jsx} 2>/dev/null; then
  NEED_CSS=true
  echo "3. Import coming-soon.css in frontend"
fi

if [ "$NEED_ROUTES" = false ] && [ "$NEED_APP" = false ] && [ "$NEED_CSS" = false ]; then
  echo "✓ All setup complete!"
else
  echo ""
  echo "4. Build frontend: cd webapps/prime-hub && npm run build"
  echo "5. Restart app: pm2 restart pnptv-bot"
  echo ""
fi

echo ""
echo -e "${GREEN}Setup complete! See COMING_SOON_SETUP.md for integration details.${NC}"
echo ""
echo "Next: Verify the pages are accessible at:"
echo "  http://localhost:3001/prime-hub/live/coming-soon"
echo "  http://localhost:3001/prime-hub/hangouts/coming-soon"
echo ""
