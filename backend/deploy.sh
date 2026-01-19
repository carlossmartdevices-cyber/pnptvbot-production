#!/bin/bash
# path: backend/deploy.sh

# Exit on error
set -e

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Install dependencies
echo "Installing dependencies..."
npm ci --production

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Build the application
echo "Building application..."
npm run build

# Restart the service
echo "Restarting service..."
if command -v pm2 &> /dev/null; then
    pm2 restart pnptv-backend || pm2 start dist/index.js --name pnptv-backend
elif command -v systemctl &> /dev/null; then
    sudo systemctl restart pnptv-backend
else
    echo "Neither pm2 nor systemctl found. Please start the service manually."
    echo "You can run: node dist/index.js"
fi

echo "Deployment completed successfully!"

# Health check
sleep 5
echo "Checking service health..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:${PORT:-3001}/health || {
    echo "Health check failed. Service may not be running properly."
    exit 1
}

echo "Service is healthy and running!"
