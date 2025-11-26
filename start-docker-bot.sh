#!/bin/bash
# Script to stop the old Node.js process and start Docker services

set -e

echo "=== Stopping old Node.js process on port 3000 ==="
echo ""

# Find Node.js processes using port 3000
PID=$(lsof -ti :3000 2>/dev/null || true)

if [ -z "$PID" ]; then
    echo "✓ No process found using port 3000"
else
    echo "Found Node.js process(es) on port 3000:"
    echo ""
    ps aux | grep -E "^\S+\s+($PID)" | grep -v grep || true
    echo ""

    for pid in $PID; do
        echo "Stopping process $pid..."
        kill $pid 2>/dev/null || kill -9 $pid 2>/dev/null || true
    done

    echo "✓ Process(es) stopped"
    sleep 2
fi

echo ""
echo "=== Cleaning up any orphaned Docker containers ==="
docker-compose down --remove-orphans 2>/dev/null || true

echo ""
echo "=== Starting Docker services ==="
docker-compose up -d

echo ""
echo "=== Service status ==="
docker-compose ps

echo ""
echo "=== Logs (last 20 lines) ==="
docker-compose logs --tail=20 bot
