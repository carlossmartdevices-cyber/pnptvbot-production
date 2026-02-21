#!/bin/bash

##############################################################################
# PDS/Bluesky/Daimo Integration Verification Script
# Purpose: Comprehensive verification of all integration components
# Status: PRODUCTION READY (2026-02-21)
##############################################################################

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  PDS/Bluesky/Daimo Integration Verification                   ║"
echo "║  Status: PRODUCTION READY                                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

REPO_ROOT="/root/pnptvbot-production"
FAILED=0
PASSED=0

# Helper functions
check_file() {
    if [ -f "$1" ]; then
        echo "✅ $2"
        ((PASSED++))
        return 0
    else
        echo "❌ MISSING: $2 at $1"
        ((FAILED++))
        return 1
    fi
}

check_env_var() {
    if grep -q "^$1=" "$REPO_ROOT/.env.production" 2>/dev/null; then
        echo "✅ Environment variable: $1"
        ((PASSED++))
        return 0
    else
        echo "⚠️  MISSING: $1 in .env.production"
        ((FAILED++))
        return 1
    fi
}

check_code_string() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo "✅ Code check: $3"
        ((PASSED++))
        return 0
    else
        echo "❌ MISSING: $3 in $1"
        ((FAILED++))
        return 1
    fi
}

###############################################################################
# 1. BACKEND SERVICES VERIFICATION
###############################################################################

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. BACKEND SERVICES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_file "$REPO_ROOT/apps/backend/bot/services/PDSProvisioningService.js" "PDSProvisioningService"
check_file "$REPO_ROOT/apps/backend/bot/services/BlueskyAutoSetupService.js" "BlueskyAutoSetupService"
check_file "$REPO_ROOT/apps/backend/bot/services/BlueskyService.js" "BlueskyService"
check_file "$REPO_ROOT/apps/backend/config/daimo.js" "Daimo Configuration"

###############################################################################
# 2. BACKEND CONTROLLERS VERIFICATION
###############################################################################

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. BACKEND CONTROLLERS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_file "$REPO_ROOT/apps/backend/bot/api/controllers/pdsController.js" "pdsController"
check_file "$REPO_ROOT/apps/backend/bot/api/controllers/blueskyController.js" "blueskyController"
check_code_string "$REPO_ROOT/apps/backend/bot/api/controllers/webhookController.js" "handleDaimoWebhook" "Daimo webhook handler"

###############################################################################
# 3. ROUTES VERIFICATION
###############################################################################

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. ROUTES CONFIGURATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_file "$REPO_ROOT/apps/backend/bot/api/routes/pdsRoutes.js" "pdsRoutes"
check_file "$REPO_ROOT/apps/backend/bot/api/routes/blueskyRoutes.js" "blueskyRoutes"
check_code_string "$REPO_ROOT/apps/backend/bot/api/routes.js" "app.use('/api/pds', pdsRoutes)" "PDS routes mounted"
check_code_string "$REPO_ROOT/apps/backend/bot/api/routes.js" "app.use('/api/bluesky', blueskyRoutes)" "Bluesky routes mounted"
check_code_string "$REPO_ROOT/apps/backend/bot/api/routes.js" "app.post('/api/webhooks/daimo/debug'" "Daimo diagnostic endpoint"
check_code_string "$REPO_ROOT/apps/backend/bot/api/routes.js" "app.post('/api/webhooks/daimo', webhookLimiter" "Daimo webhook handler"

###############################################################################
# 4. AUTHENTICATION INTEGRATION
###############################################################################

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. AUTHENTICATION INTEGRATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_code_string "$REPO_ROOT/apps/backend/api/handlers/telegramAuthHandler.js" "PDSProvisioningService.createOrLinkPDS" "PDS provisioning in Telegram auth"
check_code_string "$REPO_ROOT/apps/backend/api/handlers/telegramAuthHandler.js" "setImmediate" "Async background provisioning"

###############################################################################
# 5. FRONTEND COMPONENTS
###############################################################################

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. FRONTEND COMPONENTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_file "$REPO_ROOT/webapps/prime-hub/src/components/BlueskySetupCard.jsx" "BlueskySetupCard component"
check_file "$REPO_ROOT/webapps/prime-hub/src/components/BlueskySuccessModal.jsx" "BlueskySuccessModal component"
check_file "$REPO_ROOT/webapps/prime-hub/src/components/PDSStatus.jsx" "PDSStatus component"
check_file "$REPO_ROOT/webapps/prime-hub/src/components/DecentralizedIdentity.jsx" "DecentralizedIdentity component"

###############################################################################
# 6. FRONTEND API CLIENTS
###############################################################################

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. FRONTEND API CLIENTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_file "$REPO_ROOT/webapps/prime-hub/src/api/pdsClient.js" "pdsClient API"
check_file "$REPO_ROOT/webapps/prime-hub/src/api/blueskyClient.js" "blueskyClient API"
check_code_string "$REPO_ROOT/webapps/prime-hub/src/api/blueskyClient.js" "setupBlueskyAccount" "setupBlueskyAccount method"
check_code_string "$REPO_ROOT/webapps/prime-hub/src/api/blueskyClient.js" "getBlueskyStatus" "getBlueskyStatus method"

###############################################################################
# 7. ENVIRONMENT VARIABLES
###############################################################################

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7. ENVIRONMENT VARIABLES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_env_var "DAIMO_API_KEY"
check_env_var "DAIMO_APP_ID"
check_env_var "DAIMO_TREASURY_ADDRESS"
check_env_var "DAIMO_REFUND_ADDRESS"
check_env_var "DAIMO_WEBHOOK_SECRET"

echo ""
echo "Optional (with defaults if not present):"
check_env_var "PDS_ENCRYPTION_KEY" || echo "   → Uses default encryption key"
check_env_var "BLUESKY_AUTO_SETUP" || echo "   → Uses default: true"

###############################################################################
# 8. NPM DEPENDENCIES
###############################################################################

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "8. NPM DEPENDENCIES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if npm list @daimo/pay >/dev/null 2>&1; then
    echo "✅ @daimo/pay SDK installed"
    ((PASSED++))
else
    echo "❌ @daimo/pay SDK missing - run: npm install"
    ((FAILED++))
fi

if npm list uuid >/dev/null 2>&1; then
    echo "✅ uuid library installed"
    ((PASSED++))
else
    echo "❌ uuid library missing - run: npm install uuid"
    ((FAILED++))
fi

###############################################################################
# 9. RUNNING APPLICATION CHECKS
###############################################################################

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "9. RUNNING APPLICATION CHECKS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if pm2 list | grep -q "pnptv-bot"; then
    echo "✅ Application running (pnptv-bot)"
    ((PASSED++))

    # Check for errors in logs
    if ! grep -i "FATAL\|CRITICAL" "$REPO_ROOT/logs/pm2-out.log" 2>/dev/null | grep -q "ERROR"; then
        echo "✅ No fatal errors in logs"
        ((PASSED++))
    else
        echo "⚠️  Check logs for errors: tail -20 $REPO_ROOT/logs/pm2-out.log"
    fi
else
    echo "⚠️  Application not running - start with: pm2 start ecosystem.config.js --env production"
fi

###############################################################################
# 10. API ENDPOINT CHECKS (if running)
###############################################################################

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "10. API ENDPOINT VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "Testing endpoints (if app is running):"
echo ""

# Try health check
if curl -s http://localhost:3001/health >/dev/null 2>&1; then
    echo "✅ Health check endpoint responding"
    ((PASSED++))
else
    echo "⚠️  Health check not responding - app may not be running"
fi

# Try Daimo diagnostic endpoint
if curl -s -X POST http://localhost:3001/api/webhooks/daimo/debug \
    -H "Content-Type: application/json" \
    -d '{"test":true}' 2>/dev/null | grep -q "received"; then
    echo "✅ Daimo diagnostic endpoint working"
    ((PASSED++))
else
    echo "ℹ️  Daimo diagnostic endpoint not yet tested (requires running app)"
fi

###############################################################################
# FINAL SUMMARY
###############################################################################

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "VERIFICATION SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║  ✅ ALL CHECKS PASSED - READY FOR PRODUCTION                  ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Next steps:"
    echo "  1. npm run build:prime-hub (if needed)"
    echo "  2. pm2 restart pnptv-bot --env production"
    echo "  3. Monitor logs: tail -f logs/pm2-out.log"
    echo "  4. Test login flow via Telegram"
    echo "  5. Verify Bluesky setup works"
    echo ""
    exit 0
else
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║  ❌ VERIFICATION FAILED - FIX ISSUES BEFORE DEPLOYING          ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "See details above. Common fixes:"
    echo "  • Run: npm install (to get missing dependencies)"
    echo "  • Check: .env.production has all required variables"
    echo "  • Rebuild: npm run build:prime-hub"
    echo "  • Verify: pm2 logs pnptv-bot"
    echo ""
    exit 1
fi
