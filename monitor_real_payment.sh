#!/bin/bash

# Real Payment Test Monitor
# Watches for payment events and captures 3DS data in real-time

OUTPUT_FILE="/root/pnptvbot-production/REAL_PAYMENT_MONITOR_$(date +%Y%m%d_%H%M%S).log"
CAPTURE_FILE="/root/pnptvbot-production/REAL_PAYMENT_CAPTURE_$(date +%Y%m%d_%H%M%S).json"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

clear

{
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║     Real Payment Test Monitor - ePayco 3DS Integration         ║"
  echo "║     Watching for payment events in real-time...                ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo ""
  echo "📋 Instructions:"
  echo "1. Send /subscribe to Telegram bot"
  echo "2. Click checkout link"
  echo "3. Fill payment form with test card:"
  echo "   - Card: 4111111111111111"
  echo "   - Exp: 12/2025"
  echo "   - CVC: 123"
  echo "4. Click PAY"
  echo "5. Watch this monitor for 3DS data"
  echo ""
  echo "🔍 Monitoring logs for payment events..."
  echo "═══════════════════════════════════════════════════════════════════"
  echo ""
} | tee "$OUTPUT_FILE"

# Track found events
found_token=0
found_charge=0
found_3ds=0

# Function to extract and display important data
check_payment_events() {
  local log_output="$1"

  # Check for token creation
  if echo "$log_output" | grep -q "ePayco token created\|tokenId"; then
    if [ $found_token -eq 0 ]; then
      echo -e "${GREEN}✅ TOKEN CREATED${NC}" | tee -a "$OUTPUT_FILE"
      echo "$log_output" | grep -i "token" | head -3 | tee -a "$OUTPUT_FILE"
      found_token=1
      echo "" | tee -a "$OUTPUT_FILE"
    fi
  fi

  # Check for charge attempt
  if echo "$log_output" | grep -q "Creating ePayco tokenized charge\|ePayco charge result"; then
    if [ $found_charge -eq 0 ]; then
      echo -e "${BLUE}📝 CHARGE PROCESSING${NC}" | tee -a "$OUTPUT_FILE"
      echo "$log_output" | grep -i "charge" | head -5 | tee -a "$OUTPUT_FILE"
      found_charge=1
      echo "" | tee -a "$OUTPUT_FILE"
    fi
  fi

  # Check for 3DS response (THE KEY TEST)
  if echo "$log_output" | grep -q "3DS bank redirect URL\|Cardinal Commerce\|deviceDataCollectionUrl\|urlbanco"; then
    if [ $found_3ds -eq 0 ]; then
      echo -e "${GREEN}🎉 3DS RESPONSE RECEIVED!${NC}" | tee -a "$OUTPUT_FILE"
      echo "$log_output" | tee -a "$OUTPUT_FILE"
      found_3ds=1
      echo "" | tee -a "$OUTPUT_FILE"

      # Check which type of 3DS
      if echo "$log_output" | grep -q "3DS 1.0\|urlbanco\|bank redirect"; then
        echo -e "${GREEN}✅ 3DS 1.0 (Bank Redirect) Detected!${NC}" | tee -a "$OUTPUT_FILE"
      elif echo "$log_output" | grep -q "3DS 2.0\|Cardinal\|deviceDataCollectionUrl"; then
        echo -e "${GREEN}✅ 3DS 2.0 (Cardinal Commerce) Detected!${NC}" | tee -a "$OUTPUT_FILE"
      fi
      echo "" | tee -a "$OUTPUT_FILE"
    fi
  fi

  # Check for errors
  if echo "$log_output" | grep -q -i "error\|fail\|rejected\|null.*urlbanco"; then
    echo -e "${RED}❌ ERROR DETECTED:${NC}" | tee -a "$OUTPUT_FILE"
    echo "$log_output" | tee -a "$OUTPUT_FILE"
    echo "" | tee -a "$OUTPUT_FILE"
  fi
}

# Monitor logs in real-time
pm2 logs pnptv-bot --lines 0 2>&1 | while IFS= read -r line; do
  # Only process lines that might contain payment info
  if echo "$line" | grep -qi "token\|charge\|3ds\|urlbanco\|cardinal\|payment\|error"; then
    echo "$line" | tee -a "$OUTPUT_FILE"
    check_payment_events "$line"
  fi
done &

MONITOR_PID=$!

# User can press Ctrl+C to stop
echo -e "${YELLOW}Press Ctrl+C to stop monitoring${NC}" | tee -a "$OUTPUT_FILE"
echo ""

# Wait for monitoring process
wait $MONITOR_PID 2>/dev/null || true

# Summary when monitoring stops
{
  echo ""
  echo "═══════════════════════════════════════════════════════════════════"
  echo "Monitoring stopped."
  echo "Results saved to: $OUTPUT_FILE"
  echo ""
  echo "Check results above to verify:"
  echo "✅ Token creation (with holder_name)"
  echo "✅ 3DS 1.0 bank URL OR 3DS 2.0 Cardinal data returned"
  echo "✅ No errors in payment processing"
  echo ""
} | tee -a "$OUTPUT_FILE"
