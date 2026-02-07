#!/bin/bash
# Deployment script for PNPTV Bot
# This script ensures clean deployment by stopping old processes and starting fresh Docker containers

set -e

echo "=========================================="
echo "  PNPTV Bot Deployment Script"
echo "=========================================="
echo ""

# Step 1: Stop old Node.js processes on port 3000
echo "Step 1/4: Stopping old Node.js processes..."
PID=$(lsof -ti :3000 2>/dev/null || true)

if [ -z "$PID" ]; then
    echo "  ✓ No conflicting processes found"
else
    echo "  Found process(es) on port 3000: $PID"
    for pid in $PID; do
        echo "  Stopping process $pid..."
        kill $pid 2>/dev/null || kill -9 $pid 2>/dev/null || true
    done
    echo "  ✓ Process(es) stopped"
    sleep 2
fi

# Step 2: Clean up Docker
echo ""
echo "Step 2/4: Cleaning up Docker containers..."
docker compose down --remove-orphans 2>/dev/null || true
echo "  ✓ Cleanup complete"

# Step 3: Build and start services
echo ""
echo "Step 3/4: Building and starting Docker services..."
docker compose build
docker compose up -d

# Step 4: Verify deployment
echo ""
echo "Step 4/4: Verifying deployment..."
sleep 5
docker compose ps

echo ""
echo "=========================================="
echo "  Deployment Status"
echo "=========================================="
docker compose ps

echo ""
echo "=========================================="
echo "  Recent Logs"
echo "=========================================="
docker compose logs --tail=30 bot

echo ""
echo "=========================================="
echo "  ✓ Deployment Complete!"
echo "=========================================="
echo ""
echo "Access your bot at: http://localhost:3000"
echo ""
echo "Useful commands:"
echo "  - View logs: docker compose logs -f bot"
echo "  - Check status: docker compose ps"
echo "  - Restart: docker compose restart bot"
echo "  - Stop: docker compose down"
echo ""
