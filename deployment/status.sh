#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "📊 PNPtv Bot Status Check"
echo "=========================="
echo ""

# PostgreSQL
echo -e "${BLUE}🗄️  PostgreSQL:${NC}"
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Running${NC}"

    # Check database
    DB_EXISTS=$(psql -U postgres -h localhost -lqt 2>/dev/null | cut -d \| -f 1 | grep -w pnptv_bot | wc -l)
    if [ "$DB_EXISTS" -gt 0 ]; then
        echo -e "   ${GREEN}✅ Database 'pnptv_bot' exists${NC}"

        # Count plans
        PLAN_COUNT=$(psql -U postgres -h localhost -d pnptv_bot -t -c "SELECT COUNT(*) FROM plans;" 2>/dev/null | tr -d ' ')
        echo -e "   ${GREEN}✅ Subscription plans: $PLAN_COUNT${NC}"

        # Count users
        USER_COUNT=$(psql -U postgres -h localhost -d pnptv_bot -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ')
        echo -e "   ${GREEN}✅ Total users: $USER_COUNT${NC}"
    else
        echo -e "   ${RED}❌ Database 'pnptv_bot' not found${NC}"
    fi
else
    echo -e "   ${RED}❌ Not running${NC}"
fi
echo ""

# Redis
echo -e "${BLUE}📦 Redis:${NC}"
if redis-cli ping > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Running${NC}"

    # Get stats
    KEYS=$(redis-cli DBSIZE 2>/dev/null | awk '{print $2}')
    echo -e "   ${GREEN}✅ Cached keys: $KEYS${NC}"
else
    echo -e "   ${RED}❌ Not running${NC}"
fi
echo ""

# Bot Process
echo -e "${BLUE}🤖 Bot Status:${NC}"

# Check PM2
if command -v pm2 >/dev/null 2>&1; then
    PM2_STATUS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="pnptv-bot") | .pm2_env.status' 2>/dev/null || echo "not found")

    if [ "$PM2_STATUS" == "online" ]; then
        echo -e "   ${GREEN}✅ Running (PM2)${NC}"
        pm2 info pnptv-bot 2>/dev/null | grep -E "uptime|restarts|memory"
    elif [ "$PM2_STATUS" == "stopped" ]; then
        echo -e "   ${YELLOW}⚠️  Stopped (PM2)${NC}"
    elif [ "$PM2_STATUS" == "errored" ]; then
        echo -e "   ${RED}❌ Errored (PM2)${NC}"
    fi
fi

# Check systemd
if systemctl is-active --quiet pnptv-bot 2>/dev/null; then
    echo -e "   ${GREEN}✅ Running (systemd)${NC}"
elif systemctl list-units --type=service 2>/dev/null | grep -q pnptv-bot; then
    echo -e "   ${RED}❌ Service exists but not running${NC}"
fi

# Check direct process
BOT_PID=$(pgrep -f "node.*bot.js" 2>/dev/null)
if [ -n "$BOT_PID" ]; then
    echo -e "   ${GREEN}✅ Process running (PID: $BOT_PID)${NC}"
fi

# If no bot process found
if [ -z "$PM2_STATUS" ] && ! systemctl list-units --type=service 2>/dev/null | grep -q pnptv-bot && [ -z "$BOT_PID" ]; then
    echo -e "   ${RED}❌ Bot not running${NC}"
fi
echo ""

# API Health Check
echo -e "${BLUE}🌐 API Health:${NC}"
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ API responding${NC}"
    HEALTH=$(curl -s http://localhost:3000/health 2>/dev/null)
    echo "   $HEALTH"
else
    echo -e "   ${RED}❌ API not responding${NC}"
fi
echo ""

# Disk Space
echo -e "${BLUE}💾 Disk Space:${NC}"
df -h . | tail -1 | awk '{print "   Used: "$3" / "$2" ("$5")"}'
echo ""

# Recent Logs
echo -e "${BLUE}📝 Recent Errors (last 5):${NC}"
if [ -d "logs" ]; then
    tail -5 logs/error-*.log 2>/dev/null | tail -5 || echo "   No recent errors"
else
    echo "   No log directory found"
fi
echo ""

# Summary
echo "================================"
echo -e "${BLUE}📋 Quick Actions:${NC}"
echo ""
echo "Start bot:    npm start"
echo "PM2 status:   pm2 status"
echo "View logs:    pm2 logs pnptv-bot"
echo "Check plans:  psql -U postgres -d pnptv_bot -c 'SELECT * FROM plans;'"
echo ""
