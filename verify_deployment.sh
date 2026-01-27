#!/bin/bash

# PNP Live Deployment Verification Script
# This script verifies that all new features are properly deployed

echo "🔍 PNP Live Deployment Verification"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then
   echo -e "${RED}❌ Please do not run as root${NC}"
   exit 1
fi

# Check current directory
if [ ! -d "database/migrations" ]; then
   echo -e "${RED}❌ Please run this script from the project root directory${NC}"
   exit 1
fi

# Verification functions
verify_service() {
    local service_path=$1
    local service_name=$2
    
    if [ -f "$service_path" ]; then
        echo -e "${GREEN}✅ $service_name service found${NC}"
        return 0
    else
        echo -e "${RED}❌ $service_name service NOT found${NC}"
        return 1
    fi
}

verify_migration() {
    local migration_path=$1
    local migration_name=$2
    
    if [ -f "$migration_path" ]; then
        echo -e "${GREEN}✅ $migration_name migration found${NC}"
        return 0
    else
        echo -e "${RED}❌ $migration_name migration NOT found${NC}"
        return 1
    fi
}

verify_database_table() {
    local table_name=$1
    
    if command -v psql >/dev/null 2>&1; then
        if psql -U postgres -d pnptvbot -c "\dt" | grep -q "$table_name"; then
            echo -e "${GREEN}✅ Database table $table_name exists${NC}"
            return 0
        else
            echo -e "${RED}❌ Database table $table_name NOT found${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  Cannot verify database tables (PostgreSQL not available)${NC}"
        return 2
    fi
}

# Start verification
echo -e "${BLUE}📋 Verifying Services...${NC}"
echo ""

verify_service "src/services/aiModerationService.js" "AI Moderation"
verify_service "src/bot/services/availabilityService.js" "Availability Management"
verify_service "src/bot/handlers/model/modelSelfService.js" "Model Self-Service"

echo ""
echo -e "${BLUE}📋 Verifying Migrations...${NC}"
echo ""

verify_migration "database/migrations/046_add_ai_moderation_tables.sql" "AI Moderation Tables"
verify_migration "database/migrations/047_comprehensive_availability_system.sql" "Comprehensive Availability"
verify_migration "database/migrations/048_add_user_id_to_models.sql" "User ID to Models"

echo ""
echo -e "${BLUE}📋 Verifying Database Tables...${NC}"
echo ""

verify_database_table "pnp_models"
verify_database_table "pnp_availability"
verify_table_exists="$?"

if [ "$verify_table_exists" -eq 0 ]; then
    verify_database_table "pnp_model_schedules"
    verify_database_table "pnp_model_blocked_dates"
    verify_database_table "user_notifications"
    verify_database_table "availability_change_log"
    verify_database_table "booking_holds"
fi

echo ""
echo -e "${BLUE}📋 Verifying Configuration...${NC}"
echo ""

if [ -f ".env" ]; then
    if grep -q "AI_MODERATION_ENABLED" .env; then
        echo -e "${GREEN}✅ AI Moderation configuration found${NC}"
    else
        echo -e "${RED}❌ AI Moderation configuration NOT found${NC}"
    fi
    
    if grep -q "AVAILABILITY_CACHE_TTL" .env; then
        echo -e "${GREEN}✅ Availability cache configuration found${NC}"
    else
        echo -e "${RED}❌ Availability cache configuration NOT found${NC}"
    fi
    
    if grep -q "HOLD_DURATION_MINUTES" .env; then
        echo -e "${GREEN}✅ Hold duration configuration found${NC}"
    else
        echo -e "${RED}❌ Hold duration configuration NOT found${NC}"
    fi
else
    echo -e "${RED}❌ .env file not found${NC}"
fi

echo ""
echo -e "${BLUE}📋 Verifying Dependencies...${NC}"
echo ""

if [ -f "package.json" ]; then
    echo -e "${GREEN}✅ package.json found${NC}"
    
    # Check if required dependencies are installed
    if [ -d "node_modules" ]; then
        echo -e "${GREEN}✅ node_modules directory exists${NC}"
    else
        echo -e "${RED}❌ node_modules directory NOT found${NC}"
        echo "   Run: npm install"
    fi
else
    echo -e "${RED}❌ package.json not found${NC}"
fi

echo ""
echo -e "${BLUE}📋 Verifying Service Status...${NC}"
echo ""

if command -v pm2 >/dev/null 2>&1; then
    if pm2 list | grep -q "online"; then
        echo -e "${GREEN}✅ PM2 services are running${NC}"
        pm2 list
    else
        echo -e "${RED}❌ PM2 services are NOT running${NC}"
        echo "   Try: pm2 restart all"
    fi
else
    echo -e "${YELLOW}⚠️  PM2 not available, cannot verify service status${NC}"
fi

echo ""
echo "===================================="
echo -e "${BLUE}🎯 Deployment Verification Summary${NC}"
echo "===================================="
echo ""

echo "📋 Services Verified:"
echo "   • AI Moderation Service"
echo "   • Availability Management Service"
echo "   • Model Self-Service Handler"
echo ""

echo "📋 Migrations Verified:"
echo "   • AI Moderation Tables (046)"
echo "   • Comprehensive Availability (047)"
echo "   • User ID to Models (048)"
echo ""

echo "📋 Database Tables Verified:"
echo "   • Core tables and new feature tables"
echo ""

echo "📋 Configuration Verified:"
echo "   • Environment variables"
echo "   • Service settings"
echo ""

echo "🔧 Next Steps:"
echo "   1. Test AI moderation functionality"
echo "   2. Test availability management"
echo "   3. Test model self-service interface"
echo "   4. Monitor system performance"
echo "   5. Address any issues found"
echo ""

echo "📚 Documentation:"
echo "   • PNP_LIVE_INTEGRATION.md - Integration guide"
echo "   • DEPLOYMENT_GUIDE.md - Deployment instructions"
echo "   • AVAILABILITY_SYSTEM_IMPLEMENTATION.md - Availability details"
echo "   • PNP_LIVE_ENHANCEMENTS.md - AI moderation details"
echo ""

echo "===================================="
echo -e "${GREEN}🎉 Verification Complete!${NC}"
echo "===================================="
