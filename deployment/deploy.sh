#!/bin/bash
set -e

echo "🚀 PNPtv Bot Deployment Script"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then
   echo -e "${RED}❌ Please do not run as root${NC}"
   exit 1
fi

# Step 1: Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

command -v node >/dev/null 2>&1 || { echo -e "${RED}❌ Node.js is not installed${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}❌ npm is not installed${NC}"; exit 1; }
command -v redis-cli >/dev/null 2>&1 || { echo -e "${RED}❌ Redis client is not installed${NC}"; exit 1; }

echo -e "${GREEN}✅ All prerequisites met${NC}"
echo ""

# Step 2: Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 3: Check Redis
echo -e "${BLUE}📦 Checking Redis...${NC}"
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis is running${NC}"
else
    echo -e "${RED}❌ Redis is not running${NC}"
    echo "   Please start Redis: sudo systemctl start redis"
    exit 1
fi
echo ""

# Step 4: Verify configuration
echo -e "${BLUE}🔧 Verifying configuration...${NC}"

if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo "   Please create .env file from .env.example"
    exit 1
fi

required_vars=(
    "BOT_TOKEN"
    "FIREBASE_PROJECT_ID"
    "FIREBASE_PRIVATE_KEY"
    "FIREBASE_CLIENT_EMAIL"
)

for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" .env; then
        echo -e "${RED}❌ $var not set in .env${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ Configuration verified${NC}"
echo ""

# Step 5: Verify Firestore connectivity
echo -e "${BLUE}🔥 Testing Firebase/Firestore connectivity...${NC}"
if npm run validate:env >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Firebase credentials verified${NC}"
else
    echo -e "${RED}❌ Firebase credential verification failed${NC}"
    echo "   Please check your Firebase credentials in .env"
    exit 1
fi
echo ""

# Step 6: Final checks
echo -e "${BLUE}✅ Pre-deployment checks completed${NC}"
echo ""

echo "================================"
echo -e "${GREEN}✅ Deployment ready!${NC}"
echo "================================"
echo ""

echo "To start the bot, run:"
echo "  npm start       (or use PM2: pm2 start src/bot/core/bot.js --name pnptv-bot)"
echo ""

echo "Database: Firebase Firestore (Cloud-based, no local setup needed)"
echo "Cache: Redis (local or cloud instance)"
echo ""

echo "Useful commands:"
echo "  npm run dev           - Start in development mode with auto-reload"
echo "  npm run validate:env  - Check environment variables"
echo "  npm run lint          - Check code quality"
echo ""
