#!/bin/bash

# Monetization System Setup Script
# Installs and configures the complete auth, payment, and monetization system

set -e

echo "=================================================="
echo "PNPtv Monetization System Setup"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running from correct directory
if [ ! -f "package.json" ]; then
  echo -e "${RED}Error: package.json not found. Run from project root.${NC}"
  exit 1
fi

echo -e "${YELLOW}Step 1: Checking dependencies...${NC}"
npm list bcryptjs uuid > /dev/null 2>&1 || npm install bcryptjs uuid
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

echo -e "${YELLOW}Step 2: Verifying database connection...${NC}"
if [ -z "$DATABASE_URL" ] && [ ! -f ".env.production" ]; then
  echo -e "${RED}Error: DATABASE_URL not set and .env.production not found${NC}"
  echo "Please configure database connection in .env.production"
  exit 1
fi
echo -e "${GREEN}✓ Database configuration found${NC}"
echo ""

echo -e "${YELLOW}Step 3: Running database migration...${NC}"
if command -v psql &> /dev/null; then
  echo "Applying migration: 058_auth_payments_monetization.sql"
  psql -U postgres -d pnptv_db -f database/migrations/058_auth_payments_monetization.sql
  echo -e "${GREEN}✓ Migration applied${NC}"
else
  echo -e "${YELLOW}Warning: psql not found. Run migration manually:${NC}"
  echo "psql -U postgres -d pnptv_db -f database/migrations/058_auth_payments_monetization.sql"
fi
echo ""

echo -e "${YELLOW}Step 4: Verifying tables created...${NC}"
TABLES=(subscription_plans user_subscriptions paid_content content_purchases live_streams stream_views model_earnings withdrawals withdrawal_audit_log session_tokens)
for table in "${TABLES[@]}"; do
  if psql -U postgres -d pnptv_db -c "SELECT 1 FROM $table LIMIT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Table: $table"
  else
    echo -e "${RED}✗${NC} Table missing: $table"
  fi
done
echo ""

echo -e "${YELLOW}Step 5: Checking file structure...${NC}"
FILES=(
  "src/models/subscriptionModel.js"
  "src/models/paidContentModel.js"
  "src/models/modelEarningsModel.js"
  "src/models/withdrawalModel.js"
  "src/bot/services/subscriptionService.js"
  "src/bot/services/modelMonetizationService.js"
  "src/bot/services/withdrawalService.js"
  "src/bot/api/middleware/authGuard.js"
  "src/bot/api/middleware/roleGuard.js"
  "src/bot/api/controllers/authController.js"
  "src/bot/api/controllers/subscriptionPaymentController.js"
  "src/bot/api/controllers/modelController.js"
  "src/bot/api/routes/authRoutes.js"
  "src/bot/api/routes/subscriptionRoutes.js"
  "src/bot/api/routes/modelRoutes.js"
)

MISSING=0
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✓${NC} $file"
  else
    echo -e "${RED}✗${NC} Missing: $file"
    MISSING=$((MISSING + 1))
  fi
done

if [ $MISSING -gt 0 ]; then
  echo -e "${RED}Error: $MISSING files missing!${NC}"
  exit 1
fi
echo ""

echo -e "${YELLOW}Step 6: Creating subscription plans...${NC}"
cat > scripts/temp-init-plans.js << 'SCRIPTEOF'
const SubscriptionService = require('./src/bot/services/subscriptionService');
const { getPool } = require('./src/config/postgres');
const logger = require('./src/utils/logger');

(async () => {
  try {
    console.log('Initializing subscription plans...');
    const plans = await SubscriptionService.initializeDefaultPlans();
    console.log('Plans created:');
    plans.forEach(p => {
      console.log(`  - ${p.name} ($${p.priceUsd}/month, ${p.role})`);
    });
    console.log('\n✓ Initialization complete');
    process.exit(0);
  } catch (error) {
    if (error.message.includes('already initialized')) {
      console.log('✓ Plans already initialized');
      process.exit(0);
    }
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
SCRIPTEOF

if command -v node &> /dev/null; then
  node scripts/temp-init-plans.js
  rm -f scripts/temp-init-plans.js
else
  echo -e "${YELLOW}Warning: Node not found in PATH. Run manually:${NC}"
  echo "node scripts/temp-init-plans.js"
fi
echo ""

echo -e "${YELLOW}Step 7: Environment variables checklist...${NC}"
REQUIRED_VARS=(SESSION_SECRET DATABASE_URL EPAYCO_PUBLIC_KEY EPAYCO_PRIVATE_KEY)
for var in "${REQUIRED_VARS[@]}"; do
  if grep -q "$var=" ".env.production" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} $var configured"
  else
    echo -e "${YELLOW}⚠${NC}  $var not found in .env.production"
  fi
done
echo ""

echo "=================================================="
echo -e "${GREEN}✓ Monetization System Setup Complete!${NC}"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Restart the application:"
echo "   pm2 restart pnptv-bot"
echo ""
echo "2. Test the endpoints:"
echo "   curl http://localhost:3001/api/subscriptions/plans?role=user"
echo ""
echo "3. Review documentation:"
echo "   cat MONETIZATION_IMPLEMENTATION.md"
echo ""
echo "4. Configure admin users:"
echo "   UPDATE users SET role='admin' WHERE email='admin@example.com';"
echo ""
echo "5. Set up model users (same as admin role, but for models)"
echo ""
