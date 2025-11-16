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
command -v psql >/dev/null 2>&1 || { echo -e "${RED}❌ PostgreSQL client is not installed${NC}"; exit 1; }
command -v redis-cli >/dev/null 2>&1 || { echo -e "${RED}❌ Redis client is not installed${NC}"; exit 1; }

echo -e "${GREEN}✅ All prerequisites met${NC}"
echo ""

# Step 2: Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 3: Check PostgreSQL
echo -e "${BLUE}🗄️  Checking PostgreSQL...${NC}"
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL is running${NC}"
else
    echo -e "${RED}❌ PostgreSQL is not running${NC}"
    echo "   Please start PostgreSQL: sudo systemctl start postgresql"
    exit 1
fi
echo ""

# Step 4: Check Redis
echo -e "${BLUE}📦 Checking Redis...${NC}"
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis is running${NC}"
else
    echo -e "${RED}❌ Redis is not running${NC}"
    echo "   Please start Redis: sudo systemctl start redis"
    exit 1
fi
echo ""

# Step 5: Setup database
echo -e "${BLUE}🗄️  Setting up database...${NC}"

# Check if database exists
DB_EXISTS=$(psql -U postgres -h localhost -lqt | cut -d \| -f 1 | grep -w pnptv_bot | wc -l)

if [ "$DB_EXISTS" -eq 0 ]; then
    echo "Creating database..."
    psql -U postgres -h localhost -c "CREATE DATABASE pnptv_bot;"
    echo -e "${GREEN}✅ Database created${NC}"
else
    echo -e "${GREEN}✅ Database already exists${NC}"
fi

# Run migrations
echo "Running migrations..."
npm run db:migrate
echo -e "${GREEN}✅ Migrations completed${NC}"

# Load plans
echo "Loading subscription plans..."
node scripts/update-plans.js
echo -e "${GREEN}✅ Subscription plans loaded${NC}"
echo ""

# Step 6: Verify configuration
echo -e "${BLUE}🔧 Verifying configuration...${NC}"

if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo "   Please create .env file from .env.example"
    exit 1
fi

if ! grep -q "BOT_TOKEN=" .env; then
    echo -e "${RED}❌ BOT_TOKEN not set in .env${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Configuration verified${NC}"
echo ""

# Step 7: Ask deployment method
echo -e "${BLUE}🚀 Choose deployment method:${NC}"
echo "1) PM2 (Recommended)"
echo "2) Systemd Service"
echo "3) Direct Run (Development)"
read -p "Enter choice [1-3]: " choice

case $choice in
    1)
        echo ""
        echo -e "${BLUE}📦 Installing PM2...${NC}"
        npm install -g pm2 2>/dev/null || sudo npm install -g pm2

        echo -e "${BLUE}🚀 Starting bot with PM2...${NC}"
        pm2 start ecosystem.config.js
        pm2 save

        echo ""
        echo -e "${GREEN}✅ Bot deployed with PM2!${NC}"
        echo ""
        echo "📊 Useful PM2 commands:"
        echo "   pm2 status          - Check bot status"
        echo "   pm2 logs pnptv-bot  - View logs"
        echo "   pm2 restart pnptv-bot - Restart bot"
        echo "   pm2 stop pnptv-bot    - Stop bot"
        echo ""
        pm2 status
        ;;
    2)
        echo ""
        echo -e "${BLUE}🔧 Setting up systemd service...${NC}"

        # Copy service file
        sudo cp deployment/pnptv-bot.service /etc/systemd/system/

        # Update paths in service file
        sudo sed -i "s|/home/pnptv|$HOME|g" /etc/systemd/system/pnptv-bot.service
        sudo sed -i "s|User=pnptv|User=$USER|g" /etc/systemd/system/pnptv-bot.service

        # Create log directory
        sudo mkdir -p /var/log/pnptv-bot
        sudo chown $USER:$USER /var/log/pnptv-bot

        # Reload systemd
        sudo systemctl daemon-reload
        sudo systemctl enable pnptv-bot
        sudo systemctl start pnptv-bot

        echo -e "${GREEN}✅ Bot deployed as systemd service!${NC}"
        echo ""
        echo "📊 Useful systemd commands:"
        echo "   sudo systemctl status pnptv-bot  - Check status"
        echo "   sudo journalctl -u pnptv-bot -f  - View logs"
        echo "   sudo systemctl restart pnptv-bot - Restart"
        echo "   sudo systemctl stop pnptv-bot    - Stop"
        echo ""
        sudo systemctl status pnptv-bot
        ;;
    3)
        echo ""
        echo -e "${BLUE}🚀 Starting bot...${NC}"
        npm start
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo ""
echo "📋 Next steps:"
echo "1. Test the bot by sending /start to @PNPtvBot"
echo "2. Monitor logs for any errors"
echo "3. Check health endpoint: curl http://localhost:3000/health"
echo ""
