-- Migration: 030_add_retry_count_to_tables.sql
-- Description: Add retry_count column to x_post_jobs and broadcast_recipients tables for retry logic

-- Add retry_count to x_post_jobs table
ALTER TABLE x_post_jobs
ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;

-- Add retry_count to broadcast_recipients table
ALTER TABLE broadcast_recipients
ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
