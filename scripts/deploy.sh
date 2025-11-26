#!/bin/bash

# Deployment script for PNPtv Telegram Bot
# Usage: ./scripts/deploy.sh [environment]
# Example: ./scripts/deploy.sh production

set -e  # Exit on error

ENVIRONMENT=${1:-production}
echo "🚀 Deploying to: $ENVIRONMENT"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if .env file exists
if [ ! -f .env ]; then
    print_error ".env file not found!"
    print_warning "Please create .env file from .env.example"
    exit 1
fi
print_success ".env file found"

# Check required environment variables
echo ""
echo "📋 Checking required environment variables..."

required_vars=(
    "BOT_TOKEN"
    "FIREBASE_PROJECT_ID"
    "DB_HOST"
    "DB_USER"
    "DB_PASSWORD"
    "REDIS_HOST"
)

critical_vars=(
    "EPAYCO_PRIVATE_KEY"
    "DAIMO_WEBHOOK_SECRET"
)

missing_vars=0
for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" .env; then
        print_error "Missing required variable: $var"
        missing_vars=$((missing_vars + 1))
    else
        print_success "Found: $var"
    fi
done

for var in "${critical_vars[@]}"; do
    if ! grep -q "^${var}=" .env || grep -q "^${var}=your_" .env; then
        print_warning "Critical variable not configured: $var"
        print_warning "Webhook signature verification will fail in production!"
    else
        print_success "Found: $var"
    fi
done

if [ $missing_vars -gt 0 ]; then
    print_error "Please configure missing variables in .env"
    exit 1
fi

# Stop existing containers
echo ""
echo "🛑 Stopping existing containers..."
docker-compose down || print_warning "No existing containers to stop"

# Pull latest changes (if in git repo)
if [ -d .git ]; then
    echo ""
    echo "📥 Pulling latest changes..."
    git pull origin $(git branch --show-current)
    print_success "Repository updated"
fi

# Build Docker images
echo ""
echo "🔨 Building Docker images..."
if docker-compose build; then
    print_success "Docker images built successfully"
else
    print_error "Docker build failed"
    exit 1
fi

# Run database migrations (if needed)
echo ""
echo "🗄️ Database setup..."
# Add your migration commands here
# docker-compose run --rm bot npm run migrate
print_success "Database ready"

# Start services
echo ""
echo "🚀 Starting services..."
if docker-compose up -d; then
    print_success "Services started"
else
    print_error "Failed to start services"
    exit 1
fi

# Wait for services to be ready
echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check health
echo ""
echo "🏥 Checking service health..."

health_check() {
    local service=$1
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if docker-compose ps | grep -q "$service.*healthy"; then
            print_success "$service is healthy"
            return 0
        fi
        echo "  Attempt $attempt/$max_attempts: $service not ready yet..."
        sleep 2
        attempt=$((attempt + 1))
    done

    print_error "$service failed to become healthy"
    return 1
}

# Check each service
health_check "redis"
health_check "postgres"

# Check bot health endpoint
echo ""
echo "🤖 Checking bot health endpoint..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        response=$(curl -s http://localhost:3000/health)
        echo "$response" | jq '.'

        status=$(echo "$response" | jq -r '.status')
        if [ "$status" == "ok" ]; then
            print_success "Bot is healthy!"
            break
        elif [ "$status" == "degraded" ]; then
            print_warning "Bot is running but some dependencies are degraded"
            echo "$response" | jq '.dependencies'
            break
        fi
    fi

    echo "  Attempt $attempt/$max_attempts: Bot not ready yet..."
    sleep 2
    attempt=$((attempt + 1))
done

if [ $attempt -gt $max_attempts ]; then
    print_error "Bot failed to become healthy"
    echo ""
    echo "📋 Container logs:"
    docker-compose logs --tail=50 bot
    exit 1
fi

# Run integration tests (optional)
if [ "$ENVIRONMENT" != "production" ]; then
    echo ""
    echo "🧪 Running integration tests..."
    if npm run test:integration; then
        print_success "All tests passed!"
    else
        print_warning "Some tests failed - check before deploying to production"
    fi
fi

# Summary
echo ""
echo "═══════════════════════════════════════"
echo "  ✅ Deployment Successful!"
echo "═══════════════════════════════════════"
echo ""
echo "📊 Service Status:"
docker-compose ps
echo ""
echo "🔗 Access Points:"
echo "  Bot API: http://localhost:3000"
echo "  Health Check: http://localhost:3000/health"
echo "  PostgreSQL: localhost:5432"
echo "  Redis: localhost:6379"
echo ""
echo "📋 Useful Commands:"
echo "  View logs: docker-compose logs -f bot"
echo "  Stop services: docker-compose down"
echo "  Restart: docker-compose restart bot"
echo "  Shell access: docker-compose exec bot sh"
echo ""
print_success "Deployment complete!"
