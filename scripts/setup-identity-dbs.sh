#!/bin/bash
# =====================================================
# setup-identity-dbs.sh
# Creates the databases required by Phase 2 identity
# services inside the existing pnptv-postgres-sovereign
# container.
#
# Run ONCE before starting docker-compose.identity.yml
# =====================================================

set -e

CONTAINER="pnptv-postgres-sovereign"
PG_USER="${POSTGRES_USER:-pnptvbot}"

echo "Creating identity databases in $CONTAINER..."

# Authentik database
docker exec "$CONTAINER" psql -U "$PG_USER" -c \
  "CREATE DATABASE authentik;" 2>/dev/null \
  && echo "  ✓ Created database: authentik" \
  || echo "  - Database already exists: authentik"

# Forgejo database
docker exec "$CONTAINER" psql -U "$PG_USER" -c \
  "CREATE DATABASE forgejo;" 2>/dev/null \
  && echo "  ✓ Created database: forgejo" \
  || echo "  - Database already exists: forgejo"

echo ""
echo "Done. You can now start identity services:"
echo "  docker compose -f docker-compose.identity.yml up -d"
