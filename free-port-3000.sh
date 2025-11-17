#!/bin/bash
# Script to free port 3000 and start the bot

set -e

echo "=== Finding and stopping process on port 3000 ==="
echo ""

# Try to find the PID using port 3000
PID=$(lsof -ti :3000 2>/dev/null || true)

if [ -z "$PID" ]; then
    PID=$(fuser 3000/tcp 2>/dev/null | awk '{print $1}' || true)
fi

if [ -z "$PID" ]; then
    echo "No process found using port 3000"
else
    echo "Found process(es) using port 3000: $PID"
    echo ""
    echo "Process details:"
    ps aux | grep -E "^\S+\s+($PID)" | grep -v grep || true
    echo ""

    read -p "Do you want to kill this process? (y/n) " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        for pid in $PID; do
            echo "Killing process $pid..."
            kill -9 $pid 2>/dev/null || true
        done
        echo "Process(es) killed."
        sleep 2
    else
        echo "Aborted. Not killing the process."
        exit 1
    fi
fi

echo ""
echo "=== Starting Docker services ==="
docker-compose up -d

echo ""
echo "=== Service status ==="
docker-compose ps
