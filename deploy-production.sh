#!/bin/bash

################################################################################
#                    N8N AUTOMATION - PRODUCTION DEPLOYMENT                   #
#                                                                              #
# This script deploys the updated N8N automation suite to production          #
# It handles: building, stopping, starting, and verifying the deployment      #
################################################################################

set -e

echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║          🚀 N8N PRODUCTION DEPLOYMENT - Starting                        ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKER_IMAGE="pnptv-bot:latest"
CONTAINER_NAME="pnptv-bot"
HEALTHCHECK_RETRIES=30
HEALTHCHECK_DELAY=2

################################################################################
# Step 1: Verify prerequisites
################################################################################

echo -e "${BLUE}📋 STEP 1: Verifying prerequisites...${NC}"
echo ""

# Check git status
echo -n "   Checking git status... "
if [ "$(git status --porcelain | wc -l)" -eq 0 ]; then
  echo -e "${GREEN}✅ Clean${NC}"
else
  echo -e "${YELLOW}⚠️  Uncommitted changes detected${NC}"
  echo "   Stashing changes..."
  git stash
fi

# Check Docker
echo -n "   Checking Docker... "
if command -v docker &> /dev/null; then
  echo -e "${GREEN}✅ Installed${NC}"
else
  echo -e "${RED}❌ Docker not found${NC}"
  exit 1
fi

# Check database
echo -n "   Checking database... "
if PGPASSWORD="${POSTGRES_PASSWORD}" psql -U pnptvbot -d pnptvbot -h localhost -c "SELECT 1" &>/dev/null; then
  echo -e "${GREEN}✅ Connected${NC}"
else
  echo -e "${RED}❌ Cannot connect to database${NC}"
  exit 1
fi

echo ""

################################################################################
# Step 2: Build Docker image
################################################################################

echo -e "${BLUE}🐳 STEP 2: Building Docker image...${NC}"
echo ""

echo "   Building $DOCKER_IMAGE (this may take 1-2 minutes)..."
if docker build --target production -t "$DOCKER_IMAGE" . > /tmp/docker-build.log 2>&1; then
  echo -e "${GREEN}✅ Build successful${NC}"
else
  echo -e "${RED}❌ Build failed${NC}"
  tail -20 /tmp/docker-build.log
  exit 1
fi

echo ""

################################################################################
# Step 3: Stop current service
################################################################################

echo -e "${BLUE}⏹️  STEP 3: Stopping current service...${NC}"
echo ""

echo "   Stopping PM2 service..."
if pm2 stop "$CONTAINER_NAME" 2>/dev/null; then
  echo -e "${GREEN}✅ Service stopped${NC}"
else
  echo -e "${YELLOW}⚠️  Service not running (OK)${NC}"
fi

sleep 2

echo ""

################################################################################
# Step 4: Start updated service
################################################################################

echo -e "${BLUE}🚀 STEP 4: Starting updated service...${NC}"
echo ""

echo "   Starting application with PM2..."
pm2 start ecosystem.config.js --env production

sleep 3

echo -e "${GREEN}✅ Service started${NC}"

echo ""

################################################################################
# Step 5: Wait for health check
################################################################################

echo -e "${BLUE}🏥 STEP 5: Waiting for health check...${NC}"
echo ""

HEALTH_ATTEMPTS=0
until [ $HEALTH_ATTEMPTS -eq $HEALTHCHECK_RETRIES ]
do
  echo -n "   Checking health (attempt $((HEALTH_ATTEMPTS + 1))/$HEALTHCHECK_RETRIES)... "

  if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Healthy${NC}"
    break
  else
    echo -e "${YELLOW}Waiting${NC}"
    sleep $HEALTHCHECK_DELAY
  fi

  ((HEALTH_ATTEMPTS++))
done

if [ $HEALTH_ATTEMPTS -eq $HEALTHCHECK_RETRIES ]; then
  echo -e "${RED}❌ Health check failed after $HEALTHCHECK_RETRIES attempts${NC}"
  echo "   Last 10 PM2 logs:"
  pm2 logs "$CONTAINER_NAME" --lines 10
  exit 1
fi

echo ""

################################################################################
# Step 6: Verify N8N endpoints
################################################################################

echo -e "${BLUE}✅ STEP 6: Verifying N8N endpoints...${NC}"
echo ""

declare -a ENDPOINTS=(
  "/api/n8n/health"
  "/api/n8n/payments/failed"
  "/api/n8n/subscriptions/expiry"
  "/api/n8n/errors/summary"
  "/api/n8n/metrics/dashboard"
)

FAILED=0
for endpoint in "${ENDPOINTS[@]}"
do
  echo -n "   Testing $endpoint... "
  if curl -sf "http://localhost:3001$endpoint" > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC}"
  else
    echo -e "${RED}❌${NC}"
    ((FAILED++))
  fi
done

if [ $FAILED -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}⚠️  $FAILED endpoint(s) failed${NC}"
else
  echo -e "${GREEN}✅ All N8N endpoints operational${NC}"
fi

echo ""

################################################################################
# Step 7: Verify database tables
################################################################################

echo -e "${BLUE}📊 STEP 7: Verifying database tables...${NC}"
echo ""

TABLES=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -U pnptvbot -d pnptvbot -h localhost -t -c "
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_name IN ('payment_recovery_log', 'email_notifications', 'workflow_execution_logs', 'system_health_checks', 'admin_alerts')
" 2>/dev/null)

if [ "$TABLES" = "5" ]; then
  echo -e "   Found ${GREEN}5/5${NC} N8N tables"
else
  echo -e "   Found ${YELLOW}$TABLES/5${NC} N8N tables"
  echo "   Running database migration..."
  PGPASSWORD="$POSTGRES_PASSWORD" psql -U pnptvbot -d pnptvbot -h localhost -f database/migrations/072_n8n_automation_setup.sql
fi

echo ""

################################################################################
# Step 8: Final status
################################################################################

echo -e "${BLUE}📈 STEP 8: Final deployment status...${NC}"
echo ""

echo "   Service Status:"
pm2 status "$CONTAINER_NAME" | tail -1

echo ""
echo "   N8N Health Check:"
curl -s http://localhost:3001/api/n8n/health | jq '.status'

echo ""

################################################################################
# Deployment complete
################################################################################

echo ""
echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║                    ✅ DEPLOYMENT SUCCESSFUL                             ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Your N8N automation suite is now running in production!${NC}"
echo ""
echo "📋 Next Steps:"
echo "   1. Go to: http://148.230.80.210:32776"
echo "   2. Import 3 workflows:"
echo "      • n8n-workflows/1-payment-recovery.json"
echo "      • n8n-workflows/2-email-notifications.json"
echo "      • n8n-workflows/3-health-monitoring.json"
echo "   3. Activate each workflow"
echo "   4. Monitor in n8n UI → Executions tab"
echo ""
echo "📊 Monitor logs:"
echo "   pm2 logs pnptv-bot -f"
echo ""
echo "✅ Check health:"
echo "   curl http://localhost:3001/api/n8n/health"
echo ""
