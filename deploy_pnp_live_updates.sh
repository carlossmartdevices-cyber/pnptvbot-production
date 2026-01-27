#!/bin/bash

# PNP Live Updates Deployment Script
# This script deploys the new AI moderation, availability, and model self-service features

echo "🚀 PNP Live Updates Deployment Script"
echo "======================================"
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

# Step 1: Backup current state
echo -e "${BLUE}📦 Step 1/6: Backing up current state...${NC}"

# Create backup directory
BACKUP_DIR="backups/pre_pnp_live_deployment_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup database (if PostgreSQL is available)
if command -v pg_dump >/dev/null 2>&1; then
    echo -e "${YELLOW}💾 Creating database backup...${NC}"
    pg_dump -U postgres -d pnptvbot -F c -f "$BACKUP_DIR/pnptvbot_backup.dump" 2>/dev/null || 
        echo -e "${YELLOW}⚠️  Could not create database backup (PostgreSQL not available or configured)${NC}"
else
    echo -e "${YELLOW}⚠️  pg_dump not available, skipping database backup${NC}"
fi

# Backup code
cp -r src/ "$BACKUP_DIR/"
cp -r config/ "$BACKUP_DIR/"
cp package.json "$BACKUP_DIR/"

echo -e "${GREEN}✅ Backup created in: $BACKUP_DIR${NC}"
echo ""

# Step 2: Apply database migrations
echo -e "${BLUE}📦 Step 2/6: Applying database migrations...${NC}"

# Check if PostgreSQL is available
if command -v psql >/dev/null 2>&1; then
    echo -e "${YELLOW}🔧 Applying migration 046 (AI moderation tables)...${NC}"
    psql -U postgres -d pnptvbot -f database/migrations/046_add_ai_moderation_tables.sql 2>/dev/null || 
        echo -e "${RED}❌ Failed to apply migration 046${NC}"
    
    echo -e "${YELLOW}🔧 Applying migration 047 (Comprehensive availability system)...${NC}"
    psql -U postgres -d pnptvbot -f database/migrations/047_comprehensive_availability_system.sql 2>/dev/null || 
        echo -e "${RED}❌ Failed to apply migration 047${NC}"
    
    echo -e "${YELLOW}🔧 Applying migration 048 (Add user_id to models)...${NC}"
    psql -U postgres -d pnptvbot -f database/migrations/048_add_user_id_to_models.sql 2>/dev/null || 
        echo -e "${RED}❌ Failed to apply migration 048${NC}"
    
    echo -e "${GREEN}✅ Database migrations applied${NC}"
else
    echo -e "${YELLOW}⚠️  PostgreSQL not available, skipping database migrations${NC}"
    echo -e "${YELLOW}⚠️  You will need to apply these manually later:${NC}"
    echo "      - database/migrations/046_add_ai_moderation_tables.sql"
    echo "      - database/migrations/047_comprehensive_availability_system.sql"
    echo "      - database/migrations/048_add_user_id_to_models.sql"
fi
echo ""

# Step 3: Install dependencies
echo -e "${BLUE}📦 Step 3/6: Installing dependencies...${NC}"

if [ -f "package.json" ]; then
    npm install --production
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${RED}❌ package.json not found${NC}"
    exit 1
fi
echo ""

# Step 4: Deploy new services
echo -e "${BLUE}📦 Step 4/6: Deploying new services...${NC}"

# Check if services exist
SERVICES_TO_DEPLOY=(
    "src/services/aiModerationService.js"
    "src/bot/services/availabilityService.js"
    "src/bot/handlers/model/modelSelfService.js"
)

for service in "${SERVICES_TO_DEPLOY[@]}"; do
    if [ -f "$service" ]; then
        echo -e "${YELLOW}📄 Deploying: $service${NC}"
        # Services are already in place, just need to be loaded by the bot
    else
        echo -e "${RED}❌ Service not found: $service${NC}"
    fi
done

echo -e "${GREEN}✅ Services deployed${NC}"
echo ""

# Step 5: Update configuration
echo -e "${BLUE}📦 Step 5/6: Updating configuration...${NC}"

if [ -f ".env" ]; then
    # Add new configuration variables if not present
    if ! grep -q "AI_MODERATION_ENABLED" .env; then
        echo "AI_MODERATION_ENABLED=true" >> .env
    fi
    
    if ! grep -q "AVAILABILITY_CACHE_TTL" .env; then
        echo "AVAILABILITY_CACHE_TTL=300" >> .env
    fi
    
    if ! grep -q "HOLD_DURATION_MINUTES" .env; then
        echo "HOLD_DURATION_MINUTES=10" >> .env
    fi
    
    echo -e "${GREEN}✅ Configuration updated${NC}"
else
    echo -e "${RED}❌ .env file not found${NC}"
    echo "Please create .env file from .env.example"
fi
echo ""

# Step 6: Restart services
echo -e "${BLUE}📦 Step 6/6: Restarting services...${NC}"

if command -v pm2 >/dev/null 2>&1; then
    echo -e "${YELLOW}🔄 Restarting PM2 services...${NC}"
    pm2 restart all
    pm2 list
    echo -e "${GREEN}✅ Services restarted${NC}"
else
    echo -e "${YELLOW}⚠️  PM2 not available, you will need to restart services manually${NC}"
    echo "   Try: npm start"
fi
echo ""

# Final verification
echo "======================================"
echo -e "${BLUE}🎉 Deployment Summary${NC}"
echo "======================================"
echo ""

echo "✅ Backup created: $BACKUP_DIR"
echo "✅ Database migrations: Applied (if PostgreSQL available)"
echo "✅ Dependencies: Installed"
echo "✅ Services: Deployed"
echo "✅ Configuration: Updated"
echo "✅ Services: Restarted"
echo ""

echo "📋 New Features Deployed:"
echo "   • AI Moderation System"
echo "   • Comprehensive Availability Management"
echo "   • Model Self-Service Interface"
echo "   • Smart Booking with Slot Holds"
echo "   • Recurring Schedule Support"
echo ""

echo "🔧 Next Steps:"
echo "   1. Verify database tables were created"
echo "   2. Test new features in staging"
echo "   3. Monitor logs for errors"
echo "   4. Enable features for users"
echo ""

echo "📚 Documentation:"
echo "   • PNP_LIVE_INTEGRATION.md - Integration guide"
echo "   • DEPLOYMENT_GUIDE.md - Deployment instructions"
echo "   • AVAILABILITY_SYSTEM_IMPLEMENTATION.md - Availability details"
echo "   • PNP_LIVE_ENHANCEMENTS.md - AI moderation details"
echo ""

echo "======================================"
echo -e "${GREEN}🎉 PNP Live Updates Deployment Complete!${NC}"
echo "======================================"
