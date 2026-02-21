#!/bin/bash

##############################################################################
# setup-pds-bluesky-integration.sh
# Deploy PDS Bluesky and Element integration for pnptv-bot
#
# Usage: bash scripts/setup-pds-bluesky-integration.sh [environment]
# environment: development, staging, production (default: development)
##############################################################################

set -e

ENVIRONMENT=${1:-development}
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

##############################################################################
# 1. Validate environment
##############################################################################

log_info "Validating environment..."

if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
  log_error "Invalid environment: $ENVIRONMENT (must be development, staging, or production)"
  exit 1
fi

# Check required files
if [[ ! -f "$PROJECT_ROOT/.env.$ENVIRONMENT" ]]; then
  log_warn ".env.$ENVIRONMENT not found, using .env"
  ENV_FILE="$PROJECT_ROOT/.env"
else
  ENV_FILE="$PROJECT_ROOT/.env.$ENVIRONMENT"
fi

if [[ ! -f "$PROJECT_ROOT/database/migrations/070_pds_bluesky_element_integration.sql" ]]; then
  log_error "Migration file not found: database/migrations/070_pds_bluesky_element_integration.sql"
  exit 1
fi

log_info "Environment: $ENVIRONMENT"
log_info "ENV file: $ENV_FILE"

##############################################################################
# 2. Generate encryption key if needed
##############################################################################

log_info "Checking federation encryption key..."

if ! grep -q "FEDERATION_ENCRYPTION_KEY" "$ENV_FILE"; then
  log_warn "FEDERATION_ENCRYPTION_KEY not found in $ENV_FILE"

  # Generate 256-bit (32 bytes) hex key for AES-256-GCM
  ENCRYPTION_KEY=$(openssl rand -hex 32)

  log_info "Generated FEDERATION_ENCRYPTION_KEY: $ENCRYPTION_KEY"
  log_warn "Add this to your $ENV_FILE:"
  echo ""
  echo "FEDERATION_ENCRYPTION_KEY=$ENCRYPTION_KEY"
  echo ""

  if [[ "$ENVIRONMENT" == "production" ]]; then
    log_error "In production, you MUST add FEDERATION_ENCRYPTION_KEY to .env.production"
    exit 1
  else
    # Add to non-production env
    echo "FEDERATION_ENCRYPTION_KEY=$ENCRYPTION_KEY" >> "$ENV_FILE"
    log_info "Added to $ENV_FILE"
  fi
else
  log_info "FEDERATION_ENCRYPTION_KEY already configured"
fi

##############################################################################
# 3. Run database migration
##############################################################################

log_info "Running database migration..."

# Load database credentials from env
source "$ENV_FILE" 2>/dev/null || true

if [[ -z "$POSTGRES_USER" || -z "$POSTGRES_PASSWORD" ]]; then
  log_error "PostgreSQL credentials not found in $ENV_FILE"
  exit 1
fi

if [[ -z "$POSTGRES_DB" ]]; then
  POSTGRES_DB="pnptv_db"
fi

PGPASSWORD="$POSTGRES_PASSWORD" psql \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -h "${POSTGRES_HOST:-localhost}" \
  -p "${POSTGRES_PORT:-5432}" \
  -f "$PROJECT_ROOT/database/migrations/070_pds_bluesky_element_integration.sql" \
  2>&1 | tee /tmp/migration.log

if [[ ${PIPESTATUS[0]} -eq 0 ]]; then
  log_info "Database migration completed successfully"
else
  log_error "Database migration failed. See /tmp/migration.log"
  exit 1
fi

##############################################################################
# 4. Verify database tables
##############################################################################

log_info "Verifying database tables..."

TABLES=(
  "external_profiles"
  "external_profile_verification"
  "pds_posts"
  "pds_feed_preferences"
  "element_rooms"
  "element_room_membership"
  "federated_access_log"
  "outbound_federation_blocks"
  "federation_encryption_keys"
)

for table in "${TABLES[@]}"; do
  result=$(PGPASSWORD="$POSTGRES_PASSWORD" psql \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -h "${POSTGRES_HOST:-localhost}" \
    -p "${POSTGRES_PORT:-5432}" \
    -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '$table');" 2>/dev/null || echo "f")

  if [[ "$result" == "t" ]]; then
    log_info "✓ Table $table exists"
  else
    log_error "✗ Table $table not found"
    exit 1
  fi
done

##############################################################################
# 5. Create necessary directories
##############################################################################

log_info "Creating directories..."

mkdir -p "$PROJECT_ROOT/logs/federation"
mkdir -p "$PROJECT_ROOT/logs/audit"

log_info "✓ Directories created"

##############################################################################
# 6. Initialize federation encryption keys
##############################################################################

log_info "Initializing federation encryption keys..."

PGPASSWORD="$POSTGRES_PASSWORD" psql \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -h "${POSTGRES_HOST:-localhost}" \
  -p "${POSTGRES_PORT:-5432}" \
  -c "
INSERT INTO federation_encryption_keys (key_id, key_version, algorithm, is_active)
VALUES ('primary', 1, 'AES-256-GCM', TRUE)
ON CONFLICT (key_id) DO UPDATE SET is_active = TRUE;
" 2>/dev/null || log_warn "Encryption key initialization may have failed (might already exist)"

log_info "✓ Encryption keys initialized"

##############################################################################
# 7. Configure privacy middleware
##############################################################################

log_info "Checking privacy middleware configuration..."

ROUTES_FILE="$PROJECT_ROOT/apps/backend/bot/api/routes.js"

if grep -q "FederationPrivacyMiddleware" "$ROUTES_FILE"; then
  log_info "✓ Privacy middleware already registered"
else
  log_warn "Privacy middleware not registered in routes.js"
  log_info "Add to routes.js (before other middleware):"
  echo ""
  echo "const FederationPrivacyMiddleware = require('./middleware/federationPrivacyMiddleware');"
  echo "app.use(new FederationPrivacyMiddleware(pool).middleware());"
  echo ""
fi

##############################################################################
# 8. Register API routes
##############################################################################

log_info "Checking API routes registration..."

if grep -q "externalProfileRoutes" "$ROUTES_FILE"; then
  log_info "✓ External profile routes already registered"
else
  log_warn "External profile routes not registered in routes.js"
  log_info "Add to routes.js (in route registration section):"
  echo ""
  echo "const externalProfileRoutes = require('./routes/externalProfileRoutes');"
  echo "router.use('/api/webapp/profile', externalProfileRoutes(pool));"
  echo "router.use('/api/webapp/feed', externalProfileRoutes(pool));"
  echo ""
fi

##############################################################################
# 9. Environment configuration summary
##############################################################################

log_info "Configuration summary for $ENVIRONMENT:"
echo ""
echo "Required Environment Variables:"
echo "  FEDERATION_ENCRYPTION_KEY=<64-char hex string>"
echo "  FEDERATION_PRIVACY_ENABLED=true"
echo "  BLUESKY_PDS_URL=https://bsky.social"
echo "  BLUESKY_ATPROTO_URL=https://api.bsky.app/xrpc"
echo ""
echo "Optional Variables:"
echo "  BLUESKY_API_KEY=<if required>"
echo "  ELEMENT_HOMESERVER_URL=https://element.io"
echo "  ELEMENT_API_KEY=<if required>"
echo ""

##############################################################################
# 10. Build frontend
##############################################################################

log_info "Building frontend components..."

if [[ -f "$PROJECT_ROOT/package.json" ]]; then
  cd "$PROJECT_ROOT"

  if npm run build:prime-hub 2>&1 | tee /tmp/build.log | tail -20; then
    log_info "✓ Frontend built successfully"
  else
    log_warn "Frontend build may have failed. Check /tmp/build.log"
  fi
fi

##############################################################################
# 11. Cleanup and summary
##############################################################################

log_info "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Verify all environment variables are set in $ENV_FILE"
echo "2. Update routes.js with privacy middleware and route registration"
echo "3. Restart the application: pm2 restart pnptv-bot"
echo "4. Verify health check: curl http://localhost:3001/health"
echo ""
echo "To test the integration:"
echo "  curl -X GET http://localhost:3001/api/webapp/profile/external \\"
echo "    -H 'Authorization: Bearer <your-token>'"
echo ""

log_info "Integration setup complete for $ENVIRONMENT environment"
