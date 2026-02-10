-- Migration 048: Add user_id to pnp_models table
-- Adds user_id column to link models with users for self-service functionality

-- =====================================================
-- 1. Add user_id column to pnp_models
-- =====================================================
ALTER TABLE pnp_models
ADD COLUMN IF NOT EXISTS user_id VARCHAR(50);

-- =====================================================
-- 2. Create index for user_id
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pnp_models_user_id
ON pnp_models(user_id);

-- =====================================================
-- 3. Add constraint for user_id uniqueness
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'pnp_models_user_id_unique'
        AND table_name = 'pnp_models'
    ) THEN
        ALTER TABLE pnp_models ADD CONSTRAINT pnp_models_user_id_unique UNIQUE (user_id);
    END IF;
END
$$;

-- =====================================================
-- 4. Analyze table
-- =====================================================
ANALYZE pnp_models;

-- =====================================================
-- 5. Comments for documentation
-- =====================================================
COMMENT ON COLUMN pnp_models.user_id IS 'Telegram user ID that owns this model profile';

-- =====================================================
-- 6. Add missing column if check fails
-- =====================================================
DO $$
BEGIN
    -- Add column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pnp_models' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE pnp_models ADD COLUMN user_id VARCHAR(50);
        CREATE INDEX CONCURRENTLY idx_pnp_models_user_id ON pnp_models(user_id);
        ALTER TABLE pnp_models ADD CONSTRAINT pnp_models_user_id_unique UNIQUE (user_id);
    END IF;
END $$;