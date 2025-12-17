#!/bin/bash

#############################################
# PNPtv Bot - Server Deployment Script
# For Ubuntu/Debian servers
#############################################

set -e  # Exit on any error

echo "=========================================="
echo "PNPtv Bot - Server Deployment"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use: sudo bash deploy-server.sh)"
    exit 1
fi

print_info "Starting deployment process..."
echo ""

#############################################
# 1. System Update
#############################################
print_info "Step 1: Updating system packages..."
apt-get update -y
apt-get upgrade -y
print_success "System packages updated"
echo ""

#############################################
# 2. Install Node.js
#############################################
print_info "Step 2: Installing Node.js 18.x..."

# Check if Node.js is already installed
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_info "Node.js is already installed: $NODE_VERSION"

    # Check if version is 18 or higher
    MAJOR_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        print_error "Node.js version is too old. Installing Node.js 18.x..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    fi
else
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

print_success "Node.js installed: $(node -v)"
print_success "npm installed: $(npm -v)"
echo ""

#############################################
# 3. Install PostgreSQL
#############################################
print_info "Step 3: Installing PostgreSQL..."

if command -v psql &> /dev/null; then
    print_info "PostgreSQL is already installed"
else
    apt-get install -y postgresql postgresql-contrib
    print_success "PostgreSQL installed"
fi

# Start PostgreSQL service
systemctl start postgresql
systemctl enable postgresql
print_success "PostgreSQL service started and enabled"
echo ""

#############################################
# 4. Install Redis
#############################################
print_info "Step 4: Installing Redis..."

if command -v redis-server &> /dev/null; then
    print_info "Redis is already installed"
else
    apt-get install -y redis-server
    print_success "Redis installed"
fi

# Start Redis service
systemctl start redis-server
systemctl enable redis-server
print_success "Redis service started and enabled"
echo ""

#############################################
# 5. Setup PostgreSQL Database
#############################################
print_info "Step 5: Setting up PostgreSQL database..."

# Generate random password if not set
if [ -z "$DB_PASSWORD" ]; then
    DB_PASSWORD="PnpTv_$(openssl rand -base64 12)"
fi

DB_NAME="pnptv_bot"
DB_USER="pnptv_user"

# Create database user and database
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || print_info "User already exists"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || print_info "Database already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null

print_success "Database created: $DB_NAME"
print_success "Database user created: $DB_USER"
print_info "Database password: $DB_PASSWORD"
echo ""

#############################################
# 6. Install Git and Clone Repository
#############################################
print_info "Step 6: Installing Git and cloning repository..."

apt-get install -y git curl wget

# Deployment directory
DEPLOY_DIR="/opt/pnptvbot-production"

if [ -d "$DEPLOY_DIR" ]; then
    print_info "Repository directory already exists. Pulling latest changes..."
    cd "$DEPLOY_DIR"
    git pull
else
    print_info "Cloning repository..."
    cd /opt
    git clone https://github.com/carlossmartdevices-cyber/pnptvbot-production.git
    cd "$DEPLOY_DIR"
fi

print_success "Repository ready at $DEPLOY_DIR"
echo ""

#############################################
# 7. Install Dependencies
#############################################
print_info "Step 7: Installing npm dependencies..."
cd "$DEPLOY_DIR"
npm install --production
print_success "Dependencies installed"
echo ""

#############################################
# 8. Configure Environment Variables
#############################################
print_info "Step 8: Configuring environment variables..."

if [ ! -f "$DEPLOY_DIR/.env" ]; then
    cp "$DEPLOY_DIR/.env.example" "$DEPLOY_DIR/.env"

    # Generate secure keys
    JWT_SECRET=$(openssl rand -base64 32)
    ENCRYPTION_KEY=$(openssl rand -base64 32)

    # Update .env file with database credentials
    sed -i "s|DB_HOST=.*|DB_HOST=localhost|g" "$DEPLOY_DIR/.env"
    sed -i "s|DB_PORT=.*|DB_PORT=5432|g" "$DEPLOY_DIR/.env"
    sed -i "s|DB_NAME=.*|DB_NAME=$DB_NAME|g" "$DEPLOY_DIR/.env"
    sed -i "s|DB_USER=.*|DB_USER=$DB_USER|g" "$DEPLOY_DIR/.env"
    sed -i "s|DB_PASSWORD=.*|DB_PASSWORD=$DB_PASSWORD|g" "$DEPLOY_DIR/.env"
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|g" "$DEPLOY_DIR/.env"
    sed -i "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENCRYPTION_KEY|g" "$DEPLOY_DIR/.env"

    print_success ".env file created and configured"
    print_error "⚠️  IMPORTANT: You must edit /opt/pnptvbot-production/.env and add your BOT_TOKEN"
else
    print_info ".env file already exists. Skipping..."
fi
echo ""

#############################################
# 9. Setup PM2 Process Manager
#############################################
print_info "Step 9: Installing PM2 process manager..."

npm install -g pm2

print_success "PM2 installed"
echo ""

#############################################
# 10. Start the Bot
#############################################
print_info "Step 10: Starting the bot with PM2..."

cd "$DEPLOY_DIR"

# Stop existing instance if running
pm2 stop pnptvbot 2>/dev/null || true
pm2 delete pnptvbot 2>/dev/null || true

# Start the bot
pm2 start src/bot/core/bot.js --name pnptvbot --time

# Save PM2 process list
pm2 save

# Setup PM2 startup script
pm2 startup systemd -u root --hp /root

print_success "Bot started with PM2"
echo ""

#############################################
# 11. Configure Firewall (Optional)
#############################################
print_info "Step 11: Configuring firewall (optional)..."

if command -v ufw &> /dev/null; then
    print_info "UFW firewall detected. Configuring..."
    ufw allow 22/tcp      # SSH
    ufw allow 3000/tcp    # Bot API
    # ufw enable  # Uncomment to enable firewall
    print_success "Firewall rules added (not enabled by default)"
else
    print_info "UFW not installed. Skipping firewall configuration..."
fi
echo ""

#############################################
# Summary
#############################################
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
print_success "Services Status:"
echo "  ✓ PostgreSQL: Running"
echo "  ✓ Redis: Running"
echo "  ✓ Bot: Running with PM2"
echo ""
print_info "Database Credentials:"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Password: $DB_PASSWORD"
echo ""
print_error "⚠️  IMPORTANT NEXT STEPS:"
echo ""
echo "1. Edit your .env file with your Telegram bot token:"
echo "   nano /opt/pnptvbot-production/.env"
echo ""
echo "2. Add your BOT_TOKEN from @BotFather"
echo ""
echo "3. Configure other optional services (Firebase, Payments, etc.)"
echo ""
echo "4. Restart the bot after editing .env:"
echo "   pm2 restart pnptvbot"
echo ""
echo "5. View bot logs:"
echo "   pm2 logs pnptvbot"
echo ""
echo "6. Check bot status:"
echo "   pm2 status"
echo ""
echo "=========================================="
echo "Useful PM2 Commands:"
echo "=========================================="
echo "  pm2 status          - View all processes"
echo "  pm2 logs pnptvbot   - View logs"
echo "  pm2 restart pnptvbot - Restart bot"
echo "  pm2 stop pnptvbot   - Stop bot"
echo "  pm2 monit           - Monitor resources"
echo "=========================================="
echo ""
print_success "Deployment script completed successfully!"
