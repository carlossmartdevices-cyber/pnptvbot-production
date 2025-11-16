-- PostgreSQL Database Initialization Script
-- This script runs automatically when the PostgreSQL container is first created

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create schemas (optional, for future use)
-- CREATE SCHEMA IF NOT EXISTS pnptv;

-- Set default schema
-- SET search_path TO pnptv, public;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE pnptv_bot TO postgres;

-- Logging
\echo 'Database initialized successfully'
\echo 'Extensions enabled: uuid-ossp, pg_trgm'
