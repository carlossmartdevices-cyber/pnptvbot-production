-- Fixes production issues:
-- 1) ON CONFLICT (user_id) on performers requires a unique constraint/index on user_id.
-- 2) user_roles table was created by postgres and app role pnptvbot lacks permissions.

-- Remove duplicated performers by user_id, keeping the most recently updated row.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM performers
  WHERE user_id IS NOT NULL
)
DELETE FROM performers p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;

-- Ensure upsert target exists for ON CONFLICT (user_id).
CREATE UNIQUE INDEX IF NOT EXISTS uq_performers_user_id ON performers(user_id);

-- Ensure app role can read/write user_roles.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pnptvbot')
     AND EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = 'user_roles'
     ) THEN
    ALTER TABLE user_roles OWNER TO pnptvbot;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_roles TO pnptvbot;
  END IF;
END $$;
