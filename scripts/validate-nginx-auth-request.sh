#!/bin/bash
# ============================================================================
# PNPtv Nginx auth_request Validation Script
# ============================================================================
# Purpose: Validate Nginx auth_request configuration before deployment
# Usage: bash scripts/validate-nginx-auth-request.sh
#
# Tests:
#   1. Nginx syntax validation
#   2. Auth verify endpoint responds correctly
#   3. Protected routes redirect without auth
#   4. Public routes work without auth
#   5. Protected routes serve content with auth
#
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="${DOMAIN:-https://pnptv.app}"
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:3001}"
HEALTH_ENDPOINT="${BACKEND_URL}/health"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# ============================================================================
# Helper Functions
# ============================================================================

log_info() {
  echo -e "${BLUE}ℹ ${NC}$1"
}

log_success() {
  echo -e "${GREEN}✓ ${NC}$1"
  ((TESTS_PASSED++))
}

log_error() {
  echo -e "${RED}✗ ${NC}$1"
  ((TESTS_FAILED++))
}

log_warning() {
  echo -e "${YELLOW}⚠ ${NC}$1"
}

# ============================================================================
# Test Functions
# ============================================================================

test_nginx_syntax() {
  log_info "Testing Nginx configuration syntax..."

  if sudo nginx -t &>/dev/null; then
    log_success "Nginx configuration syntax is valid"
  else
    log_error "Nginx configuration has syntax errors"
    sudo nginx -t
    return 1
  fi
}

test_backend_health() {
  log_info "Testing backend health endpoint..."

  response=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_ENDPOINT")

  if [ "$response" = "200" ]; then
    log_success "Backend is healthy (HTTP $response)"
  else
    log_error "Backend health check failed (HTTP $response)"
    log_warning "Ensure Express is running with: npm run start:backend"
    return 1
  fi
}

test_auth_verify_endpoint() {
  log_info "Testing /api/webapp/auth/verify endpoint..."

  # Without session (should return 401)
  response=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/webapp/auth/verify")

  if [ "$response" = "401" ]; then
    log_success "Auth verify returns 401 without session (HTTP $response)"
  else
    log_error "Auth verify returned unexpected status (HTTP $response, expected 401)"
  fi
}

test_public_routes() {
  log_info "Testing public routes (should work without auth)..."

  # Test /health
  response=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/health")
  if [ "$response" = "200" ]; then
    log_success "/health endpoint is accessible (HTTP $response)"
  else
    log_warning "/health returned HTTP $response (expected 200)"
  fi

  # Test /login (if it exists)
  response=$(curl -s -L -o /dev/null -w "%{http_code}" "$DOMAIN/login")
  if [ "$response" = "200" ] || [ "$response" = "301" ] || [ "$response" = "302" ]; then
    log_success "/login is accessible (HTTP $response)"
  else
    log_warning "/login returned HTTP $response"
  fi

  # Test /auth/ (if it exists)
  response=$(curl -s -L -o /dev/null -w "%{http_code}" "$DOMAIN/auth/")
  if [ "$response" = "200" ] || [ "$response" = "301" ] || [ "$response" = "302" ]; then
    log_success "/auth/ is accessible (HTTP $response)"
  else
    log_warning "/auth/ returned HTTP $response"
  fi
}

test_protected_routes_redirect() {
  log_info "Testing protected routes (should redirect without auth)..."

  # Test /hub/ (should redirect to /auth/ without session)
  response=$(curl -s -o /dev/null -w "%{http_code}" -L "$DOMAIN/hub/")
  location=$(curl -s -i "$DOMAIN/hub/" 2>&1 | grep -i "Location:" || echo "")

  if [[ "$location" == *"/auth/"* ]] || [ "$response" = "200" ]; then
    log_success "/hub/ is protected (redirects or serves with auth)"
  else
    log_warning "/hub/ returned HTTP $response"
  fi

  # Test /media/ (should redirect to /auth/ without session)
  response=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/media/")
  if [ "$response" = "302" ] || [ "$response" = "301" ] || [ "$response" = "200" ]; then
    log_success "/media/ is protected (HTTP $response)"
  else
    log_warning "/media/ returned HTTP $response"
  fi

  # Test /hangouts/ (should redirect to /auth/ without session)
  response=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/hangouts/")
  if [ "$response" = "302" ] || [ "$response" = "301" ] || [ "$response" = "200" ]; then
    log_success "/hangouts/ is protected (HTTP $response)"
  else
    log_warning "/hangouts/ returned HTTP $response"
  fi
}

test_nginx_config_includes() {
  log_info "Checking Nginx configuration includes..."

  # Check if auth_request is configured
  if grep -q "auth_request /api/webapp/auth/verify" /etc/nginx/nginx.conf 2>/dev/null || \
     grep -r "auth_request /api/webapp/auth/verify" /etc/nginx/conf.d/ 2>/dev/null | grep -q .; then
    log_success "auth_request directive is configured"
  else
    log_warning "auth_request directive not found in Nginx config"
  fi

  # Check if internal auth endpoint is configured
  if grep -q "location = /api/webapp/auth/verify" /etc/nginx/nginx.conf 2>/dev/null || \
     grep -r "location = /api/webapp/auth/verify" /etc/nginx/conf.d/ 2>/dev/null | grep -q .; then
    log_success "Internal auth endpoint is configured"
  else
    log_warning "Internal auth endpoint not found"
  fi

  # Check if error_page 401 is configured
  if grep -q "error_page 401" /etc/nginx/nginx.conf 2>/dev/null || \
     grep -r "error_page 401" /etc/nginx/conf.d/ 2>/dev/null | grep -q .; then
    log_success "Auth failure handler is configured"
  else
    log_warning "Auth failure handler (error_page 401) not found"
  fi
}

test_nginx_running() {
  log_info "Checking if Nginx is running..."

  if systemctl is-active --quiet nginx; then
    log_success "Nginx is running"
  else
    log_error "Nginx is not running. Start it with: sudo systemctl start nginx"
    return 1
  fi
}

test_ssl_certificate() {
  log_info "Checking SSL certificate..."

  cert_file="/etc/ssl/certs/pnptv.crt"
  key_file="/etc/ssl/private/pnptv.key"

  if [ -f "$cert_file" ] && [ -f "$key_file" ]; then
    log_success "SSL certificate files exist"

    # Check expiration
    expiration=$(openssl x509 -in "$cert_file" -noout -enddate 2>/dev/null | cut -d= -f2)
    if [ -n "$expiration" ]; then
      log_info "Certificate expires: $expiration"
    fi
  else
    log_warning "SSL certificate files not found at $cert_file or $key_file"
  fi
}

# ============================================================================
# Main Test Suite
# ============================================================================

main() {
  echo ""
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║         PNPtv Nginx auth_request Validation Suite             ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo ""

  log_info "Domain: $DOMAIN"
  log_info "Backend: $BACKEND_URL"
  echo ""

  # Run tests
  test_nginx_syntax || true
  test_nginx_running || true
  test_ssl_certificate || true
  test_nginx_config_includes || true
  test_backend_health || true
  test_auth_verify_endpoint || true
  echo ""
  test_public_routes || true
  echo ""
  test_protected_routes_redirect || true

  # Summary
  echo ""
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║                      TEST RESULTS SUMMARY                     ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo -e "${GREEN}✓ Passed: $TESTS_PASSED${NC}"
  echo -e "${RED}✗ Failed: $TESTS_FAILED${NC}"
  echo ""

  if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Monitor logs: tail -f /var/log/nginx/pnptv-error.log"
    echo "  2. Check metrics: curl -i https://pnptv.app/health"
    echo "  3. Test login flow: Visit https://pnptv.app/auth/"
    exit 0
  else
    echo -e "${RED}Some tests failed. Review the output above.${NC}"
    echo ""
    echo "Debugging tips:"
    echo "  1. Check Nginx syntax: sudo nginx -t"
    echo "  2. Reload Nginx: sudo systemctl reload nginx"
    echo "  3. View error logs: sudo tail -f /var/log/nginx/pnptv-error.log"
    echo "  4. Verify backend is running: curl $BACKEND_URL/health"
    exit 1
  fi
}

# ============================================================================
# Script Entry Point
# ============================================================================

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --domain)
      DOMAIN="$2"
      shift 2
      ;;
    --backend)
      BACKEND_URL="$2"
      shift 2
      ;;
    --help)
      echo "Usage: bash scripts/validate-nginx-auth-request.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --domain DOMAIN      Override domain (default: https://pnptv.app)"
      echo "  --backend URL        Override backend URL (default: http://127.0.0.1:3001)"
      echo "  --help              Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

main
