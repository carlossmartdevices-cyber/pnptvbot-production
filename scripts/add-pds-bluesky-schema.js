#!/usr/bin/env node

require('dotenv').config({ path: '.env.production' });

const { Pool } = require('pg');
const logger = require('../apps/backend/utils/logger');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    logger.info('Starting PDS & Bluesky schema migration...');

    // 1. Add PDS columns to users table
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS pds_did VARCHAR(255) UNIQUE,
      ADD COLUMN IF NOT EXISTS pds_instance_url VARCHAR(255),
      ADD COLUMN IF NOT EXISTS pds_handle VARCHAR(255),
      ADD COLUMN IF NOT EXISTS pds_created_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS pds_sync_status VARCHAR(50) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS pds_error TEXT;
    `);
    logger.info('✓ Added PDS columns to users table');

    // 2. Add Bluesky columns to users table
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS bluesky_did VARCHAR(255) UNIQUE,
      ADD COLUMN IF NOT EXISTS bluesky_handle VARCHAR(255) UNIQUE,
      ADD COLUMN IF NOT EXISTS bluesky_created_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS bluesky_synced_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS bluesky_sync_status VARCHAR(50) DEFAULT 'pending';
    `);
    logger.info('✓ Added Bluesky columns to users table');

    // 3. Create user_pds_mapping table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_pds_mapping (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id VARCHAR(255) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        pds_did VARCHAR(255) NOT NULL UNIQUE,
        pds_handle VARCHAR(255) NOT NULL,
        pds_instance_url VARCHAR(255) NOT NULL,
        encrypted_credentials JSONB NOT NULL,
        encryption_version VARCHAR(10) DEFAULT 'aes-256-gcm',
        credential_backup_id UUID,
        health_status VARCHAR(50) DEFAULT 'healthy',
        last_health_check TIMESTAMP,
        last_sync TIMESTAMP,
        sync_error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    logger.info('✓ Created user_pds_mapping table');

    // 4. Create pds_provisioning_log table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pds_provisioning_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        pds_instance_url VARCHAR(255),
        pds_did VARCHAR(255),
        error_message TEXT,
        error_code VARCHAR(50),
        request_data JSONB,
        response_data JSONB,
        duration_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    logger.info('✓ Created pds_provisioning_log table');

    // 5. Create pds_health_checks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pds_health_checks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pds_did VARCHAR(255),
        status VARCHAR(50) NOT NULL,
        response_time_ms INTEGER,
        last_error TEXT,
        consecutive_failures INTEGER DEFAULT 0,
        last_checked TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    logger.info('✓ Created pds_health_checks table');

    // 6. Create pds_credential_backups table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pds_credential_backups (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        backup_type VARCHAR(50) NOT NULL,
        encrypted_backup JSONB NOT NULL,
        encryption_key_id VARCHAR(100),
        recovery_email VARCHAR(255),
        backup_timestamp TIMESTAMP,
        restore_count INTEGER DEFAULT 0,
        last_restored TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      );
    `);
    logger.info('✓ Created pds_credential_backups table');

    // 7. Create pds_provisioning_queue table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pds_provisioning_queue (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id VARCHAR(255) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        queue_type VARCHAR(50) DEFAULT 'auto_provisioning',
        priority INTEGER DEFAULT 5,
        attempt_count INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        status VARCHAR(50) DEFAULT 'pending',
        metadata JSONB,
        scheduled_at TIMESTAMP,
        processing_started_at TIMESTAMP,
        last_error TEXT,
        error_code VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    logger.info('✓ Created pds_provisioning_queue table');

    // 8. Create indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_pds_mapping_user_id ON user_pds_mapping(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_pds_mapping_pds_did ON user_pds_mapping(pds_did);
      CREATE INDEX IF NOT EXISTS idx_pds_provisioning_log_user_id ON pds_provisioning_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_pds_provisioning_log_event_type ON pds_provisioning_log(event_type);
      CREATE INDEX IF NOT EXISTS idx_pds_health_checks_user_id ON pds_health_checks(user_id);
      CREATE INDEX IF NOT EXISTS idx_pds_health_checks_status ON pds_health_checks(status);
      CREATE INDEX IF NOT EXISTS idx_pds_credential_backups_user_id ON pds_credential_backups(user_id);
      CREATE INDEX IF NOT EXISTS idx_pds_provisioning_queue_status ON pds_provisioning_queue(status);
      CREATE INDEX IF NOT EXISTS idx_users_pds_did ON users(pds_did);
      CREATE INDEX IF NOT EXISTS idx_users_bluesky_did ON users(bluesky_did);
      CREATE INDEX IF NOT EXISTS idx_users_bluesky_handle ON users(bluesky_handle);
    `);
    logger.info('✓ Created indexes for PDS tables');

    // 9. Add federated access audit tables (for PDS privacy tracking)
    await client.query(`
      CREATE TABLE IF NOT EXISTS federated_access_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        access_type VARCHAR(50) NOT NULL,
        external_domain VARCHAR(255),
        external_service VARCHAR(100),
        request_method VARCHAR(10),
        request_path TEXT,
        response_status INTEGER,
        decision VARCHAR(50),
        reason TEXT,
        user_agent TEXT,
        ip_address VARCHAR(45),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    logger.info('✓ Created federated_access_log table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS outbound_federation_blocks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blocked_domain VARCHAR(255) NOT NULL,
        block_reason TEXT,
        blocked_operations VARCHAR(50)[] DEFAULT ARRAY['POST', 'PUT', 'PATCH', 'DELETE'],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, blocked_domain)
      );
    `);
    logger.info('✓ Created outbound_federation_blocks table');

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_federated_access_log_user_id ON federated_access_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_federated_access_log_timestamp ON federated_access_log(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_outbound_federation_blocks_user_id ON outbound_federation_blocks(user_id);
    `);
    logger.info('✓ Created federation audit indexes');

    logger.info('✅ PDS & Bluesky schema migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.release();
    await pool.end();
  }
}

runMigration();
