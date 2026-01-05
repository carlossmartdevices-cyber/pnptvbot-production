#!/bin/bash

# Database merge script
set -e

DB_USER="pnptvbot"
DB_NAME="pnptvbot"
DB_HOST="localhost"
REMOTE_DUMP="/root/pnptvbot-production/db-backups/remote_pnptvbot.sql"
BACKUP_DIR="/root/pnptvbot-production/db-backups"
TEMP_DB="pnptvbot_remote_temp"

export PGPASSWORD="Apelo801050#"

echo "================================"
echo "Database Merge Script"
echo "================================"

# Step 1: Create backup
echo ""
echo "[1/5] Creating backup of local database..."
BACKUP_FILE="$BACKUP_DIR/pnptvbot_backup_$(date +%Y%m%d_%H%M%S).sql"
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME > "$BACKUP_FILE"
echo "✓ Backup created: $BACKUP_FILE"

# Step 2: Create temporary database
echo ""
echo "[2/5] Creating temporary database for remote dump..."
psql -h $DB_HOST -U $DB_USER -c "DROP DATABASE IF EXISTS $TEMP_DB;" 2>/dev/null || true
psql -h $DB_HOST -U $DB_USER -c "CREATE DATABASE $TEMP_DB;"
echo "✓ Temporary database created"

# Step 3: Restore remote dump
echo ""
echo "[3/5] Restoring remote database dump..."
psql -h $DB_HOST -U $DB_USER -d $TEMP_DB < "$REMOTE_DUMP"
echo "✓ Remote dump restored"

# Step 4: Merge data
echo ""
echo "[4/5] Merging databases..."

psql -h $DB_HOST -U $DB_USER -d $DB_NAME << 'EOSQL'
\echo '-- Merging users table (prefer remote)'
DELETE FROM public.users WHERE id IN (SELECT id FROM pnptvbot_remote_temp.public.users);
INSERT INTO public.users SELECT * FROM pnptvbot_remote_temp.public.users;

\echo '-- Merging payments'
INSERT INTO public.payments SELECT * FROM pnptvbot_remote_temp.public.payments
  ON CONFLICT (id) DO NOTHING;

\echo '-- Merging plans'
INSERT INTO public.plans SELECT * FROM pnptvbot_remote_temp.public.plans
  ON CONFLICT (id) DO NOTHING;

\echo '-- Merging promo codes'
INSERT INTO public.promo_codes SELECT * FROM pnptvbot_remote_temp.public.promo_codes
  ON CONFLICT (code) DO NOTHING;

\echo '-- Merging private calls'
INSERT INTO public.private_calls SELECT * FROM pnptvbot_remote_temp.public.private_calls
  ON CONFLICT (id) DO NOTHING;

\echo '-- Merging broadcasts'
INSERT INTO public.broadcasts SELECT * FROM pnptvbot_remote_temp.public.broadcasts
  ON CONFLICT (id) DO NOTHING;

\echo '-- Merging jitsi rooms'
INSERT INTO public.jitsi_rooms SELECT * FROM pnptvbot_remote_temp.public.jitsi_rooms
  ON CONFLICT (id) DO NOTHING;

\echo '-- Merging radio requests'
INSERT INTO public.radio_requests SELECT * FROM pnptvbot_remote_temp.public.radio_requests
  ON CONFLICT (id) DO NOTHING;

\echo '-- Merging radio history'
INSERT INTO public.radio_history SELECT * FROM pnptvbot_remote_temp.public.radio_history
  ON CONFLICT (id) DO NOTHING;

\echo 'Merge completed!'
EOSQL

echo "✓ Data merge completed"

# Step 5: Verify and cleanup
echo ""
echo "[5/5] Verifying merge and cleaning up..."

echo "Local table row counts:"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME << 'EOSQL'
SELECT 'users' as table_name, COUNT(*) as row_count FROM public.users
UNION ALL SELECT 'payments', COUNT(*) FROM public.payments
UNION ALL SELECT 'plans', COUNT(*) FROM public.plans
UNION ALL SELECT 'private_calls', COUNT(*) FROM public.private_calls
UNION ALL SELECT 'broadcasts', COUNT(*) FROM public.broadcasts
UNION ALL SELECT 'jitsi_rooms', COUNT(*) FROM public.jitsi_rooms
UNION ALL SELECT 'radio_requests', COUNT(*) FROM public.radio_requests
UNION ALL SELECT 'radio_history', COUNT(*) FROM public.radio_history
ORDER BY table_name;
EOSQL

echo ""
echo "Dropping temporary database..."
psql -h $DB_HOST -U $DB_USER -c "DROP DATABASE $TEMP_DB;"
echo "✓ Temporary database dropped"

echo ""
echo "================================"
echo "✓ Database merge completed!"
echo "================================"
echo "Backup location: $BACKUP_FILE"
echo ""
