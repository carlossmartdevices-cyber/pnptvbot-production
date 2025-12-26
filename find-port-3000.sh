#!/bin/bash
# Script to find what's using port 3000

echo "=== Checking what's using port 3000 ==="
echo ""

echo "1. Using lsof:"
lsof -i :3000 2>/dev/null || echo "   lsof: No results or command not available"
echo ""

echo "2. Using netstat:"
netstat -tulpn 2>/dev/null | grep :3000 || echo "   netstat: No results or command not available"
echo ""

echo "3. Using ss:"
ss -tulpn 2>/dev/null | grep :3000 || echo "   ss: No results or command not available"
echo ""

echo "4. Using fuser:"
fuser 3000/tcp 2>/dev/null && echo "   ^ PID(s) found above" || echo "   fuser: No results or command not available"
echo ""

echo "5. Checking all listening ports:"
netstat -tulpn 2>/dev/null | grep LISTEN | grep -E '(3000|3001)' || echo "   No processes listening on 3000 or 3001"
