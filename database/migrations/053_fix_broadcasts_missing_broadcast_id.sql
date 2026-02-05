-- Fix missing broadcasts.broadcast_id column used by schedulers

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS broadcast_id UUID;

UPDATE broadcasts
SET broadcast_id = uuid_generate_v4()
WHERE broadcast_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'broadcasts_broadcast_id_key'
  ) THEN
    ALTER TABLE broadcasts
      ADD CONSTRAINT broadcasts_broadcast_id_key UNIQUE (broadcast_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'broadcasts'
      AND column_name = 'broadcast_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE broadcasts
      ALTER COLUMN broadcast_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_broadcasts_broadcast_id ON broadcasts(broadcast_id);
