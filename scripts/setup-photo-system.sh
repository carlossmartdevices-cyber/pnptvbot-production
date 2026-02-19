#!/bin/bash

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "  Photo System Setup Script"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Error: This script must be run as root${NC}"
   exit 1
fi

cd /root/pnptvbot-production

echo -e "${YELLOW}1. Creating photo directories...${NC}"
mkdir -p public/photos/{admin/{originals,thumbnails},user-posts/{originals,thumbnails}}
chmod -R 755 public/photos/
echo -e "${GREEN}✓ Directories created${NC}"

echo ""
echo -e "${YELLOW}2. Checking npm dependencies...${NC}"
if npm ls sharp >/dev/null 2>&1; then
  echo -e "${GREEN}✓ sharp is installed${NC}"
else
  echo -e "${YELLOW}Installing sharp...${NC}"
  npm install sharp
fi

if npm ls uuid >/dev/null 2>&1; then
  echo -e "${GREEN}✓ uuid is installed${NC}"
else
  echo -e "${YELLOW}Installing uuid...${NC}"
  npm install uuid
fi

if npm ls fs-extra >/dev/null 2>&1; then
  echo -e "${GREEN}✓ fs-extra is installed${NC}"
else
  echo -e "${YELLOW}Installing fs-extra...${NC}"
  npm install fs-extra
fi

echo ""
echo -e "${YELLOW}3. Running database migration...${NC}"

# Get PostgreSQL credentials from .env.production
if [ -f .env.production ]; then
  export $(grep -v '^#' .env.production | xargs)

  # Extract PostgreSQL credentials
  PGUSER=${POSTGRES_USER:-postgres}
  PGPASSWORD=${POSTGRES_PASSWORD:-}
  PGHOST=${POSTGRES_HOST:-localhost}
  PGPORT=${POSTGRES_PORT:-5432}
  PGDATABASE=${POSTGRES_DB:-pnptv_db}

  # Run migration
  echo "Connecting to PostgreSQL as $PGUSER@$PGHOST:$PGPORT/$PGDATABASE"

  if PGPASSWORD="$PGPASSWORD" psql -U "$PGUSER" -h "$PGHOST" -p "$PGPORT" -d "$PGDATABASE" -f database/migrations/060_photo_system.sql; then
    echo -e "${GREEN}✓ Database migration completed${NC}"
  else
    echo -e "${RED}✗ Database migration failed${NC}"
    echo "Please run manually:"
    echo "psql -U $PGUSER -d $PGDATABASE -f database/migrations/060_photo_system.sql"
    exit 1
  fi
else
  echo -e "${YELLOW}Warning: .env.production not found${NC}"
  echo "Please run database migration manually:"
  echo "psql -U postgres -d pnptv_db -f database/migrations/060_photo_system.sql"
fi

echo ""
echo -e "${YELLOW}4. Verifying database tables...${NC}"

if [ -f .env.production ]; then
  export $(grep -v '^#' .env.production | xargs)
  PGPASSWORD="$PGPASSWORD" psql -U "$PGUSER" -h "$PGHOST" -p "$PGPORT" -d "$PGDATABASE" -c "
    SELECT 'photos' as table_name, COUNT(*) as rows FROM photos
    UNION ALL
    SELECT 'photo_categories', COUNT(*) FROM photo_categories
    UNION ALL
    SELECT 'photo_activity_log', COUNT(*) FROM photo_activity_log
    UNION ALL
    SELECT 'user_photo_stats', COUNT(*) FROM user_photo_stats
    UNION ALL
    SELECT 'photo_storage_limits', COUNT(*) FROM photo_storage_limits;
  " || echo -e "${YELLOW}Could not verify tables${NC}"
fi

echo ""
echo -e "${YELLOW}5. Checking file permissions...${NC}"
chmod -R 755 public/photos/
ls -lh public/photos/
echo -e "${GREEN}✓ Permissions verified${NC}"

echo ""
echo -e "${YELLOW}6. Checking disk space...${NC}"
df -h public/
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo -e "${GREEN}✓ Photo System Setup Complete!${NC}"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Start the server: npm start (or pm2 start ecosystem.config.js)"
echo "2. Access admin photos at: http://localhost:3001/prime-hub/admin/photos"
echo "3. Test with CURL: bash scripts/test-photo-system.sh"
echo ""
echo "Documentation:"
echo "- Setup guide: cat PHOTO_SYSTEM_SETUP.md"
echo "- API examples: cat PHOTO_SYSTEM_CURL_EXAMPLES.md"
echo ""
