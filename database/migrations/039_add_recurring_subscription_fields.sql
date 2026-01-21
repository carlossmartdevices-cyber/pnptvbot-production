-- Migration: Add recurring subscription fields for ePayco/Visa Cybersource tokenization
-- Date: 2026-01-21
-- Description: Adds fields to support recurring subscriptions via ePayco tokenization with Visa Cybersource network

-- Add recurring subscription fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS card_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS card_token_mask VARCHAR(20),
ADD COLUMN IF NOT EXISTS card_franchise VARCHAR(50),
ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS subscription_type VARCHAR(50) DEFAULT 'one_time',
ADD COLUMN IF NOT EXISTS recurring_plan_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS billing_failures INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_billing_attempt TIMESTAMP;

-- Add indexes for recurring subscription lookups
CREATE INDEX IF NOT EXISTS idx_users_auto_renew ON users(auto_renew) WHERE auto_renew = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_next_billing_date ON users(next_billing_date) WHERE next_billing_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_subscription_type ON users(subscription_type) WHERE subscription_type = 'recurring';

-- Add recurring fields to plans table
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS billing_interval VARCHAR(20) DEFAULT 'month',
ADD COLUMN IF NOT EXISTS billing_interval_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS recurring_price NUMERIC(10,2);

-- Create recurring_subscriptions table for detailed tracking
CREATE TABLE IF NOT EXISTS recurring_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id VARCHAR(100) REFERENCES plans(id),

    -- Card tokenization details (ePayco)
    card_token VARCHAR(255) NOT NULL,
    card_token_mask VARCHAR(20),
    card_franchise VARCHAR(50),
    customer_id VARCHAR(255),

    -- Subscription status
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    -- active, paused, cancelled, past_due, expired

    -- Billing details
    amount NUMERIC(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    billing_interval VARCHAR(20) DEFAULT 'month',
    billing_interval_count INTEGER DEFAULT 1,

    -- Dates
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    next_billing_date TIMESTAMP,
    trial_end TIMESTAMP,

    -- Cancellation
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMP,
    cancellation_reason TEXT,
    ended_at TIMESTAMP,

    -- Billing history
    billing_failures INTEGER DEFAULT 0,
    last_billing_attempt TIMESTAMP,
    last_successful_payment TIMESTAMP,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for recurring_subscriptions
CREATE INDEX IF NOT EXISTS idx_recurring_subscriptions_user_id ON recurring_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_subscriptions_status ON recurring_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_recurring_subscriptions_next_billing ON recurring_subscriptions(next_billing_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_recurring_subscriptions_card_token ON recurring_subscriptions(card_token);

-- Create recurring_payments table for payment history
CREATE TABLE IF NOT EXISTS recurring_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES recurring_subscriptions(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Payment details
    amount NUMERIC(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    status VARCHAR(50) NOT NULL,
    -- pending, processing, completed, failed, refunded

    -- Provider details
    provider VARCHAR(50) DEFAULT 'epayco_cybersource',
    transaction_id VARCHAR(255),
    authorization_code VARCHAR(100),
    response_code VARCHAR(50),
    response_message TEXT,

    -- Period this payment covers
    period_start TIMESTAMP,
    period_end TIMESTAMP,

    -- Retry info
    attempt_number INTEGER DEFAULT 1,
    next_retry_at TIMESTAMP,

    -- Timestamps
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for recurring_payments
CREATE INDEX IF NOT EXISTS idx_recurring_payments_subscription_id ON recurring_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_recurring_payments_user_id ON recurring_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_payments_status ON recurring_payments(status);
CREATE INDEX IF NOT EXISTS idx_recurring_payments_transaction_id ON recurring_payments(transaction_id);

-- Create card_tokens table to store tokenized cards securely
CREATE TABLE IF NOT EXISTS card_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Token details (from ePayco tokenization)
    token VARCHAR(255) NOT NULL,
    customer_id VARCHAR(255),

    -- Card info (masked/safe data only)
    card_mask VARCHAR(20),
    franchise VARCHAR(50),
    expiry_month VARCHAR(2),
    expiry_year VARCHAR(4),
    card_holder_name VARCHAR(255),

    -- Status
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_used_at TIMESTAMP,

    UNIQUE(user_id, token)
);

-- Create indexes for card_tokens
CREATE INDEX IF NOT EXISTS idx_card_tokens_user_id ON card_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_card_tokens_token ON card_tokens(token);
CREATE INDEX IF NOT EXISTS idx_card_tokens_default ON card_tokens(user_id, is_default) WHERE is_default = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN users.card_token IS 'Default card token for recurring billing (ePayco)';
COMMENT ON COLUMN users.card_token_mask IS 'Masked card number (e.g., ****4242)';
COMMENT ON COLUMN users.card_franchise IS 'Card brand (visa, mastercard, etc.)';
COMMENT ON COLUMN users.auto_renew IS 'Whether user has enabled auto-renewal';
COMMENT ON COLUMN users.subscription_type IS 'Type of subscription: one_time or recurring';
COMMENT ON COLUMN users.recurring_plan_id IS 'Plan ID for recurring subscription';
COMMENT ON COLUMN users.next_billing_date IS 'Next scheduled billing date';
COMMENT ON COLUMN users.billing_failures IS 'Number of consecutive billing failures';

COMMENT ON TABLE recurring_subscriptions IS 'Stores recurring subscription details for ePayco/Visa Cybersource';
COMMENT ON TABLE recurring_payments IS 'Stores payment history for recurring subscriptions';
COMMENT ON TABLE card_tokens IS 'Stores tokenized card information from ePayco';

-- Update the monthly plan to support recurring billing
UPDATE plans
SET is_recurring = TRUE,
    billing_interval = 'month',
    billing_interval_count = 1,
    recurring_price = price
WHERE id = 'monthly_pass' OR id LIKE '%monthly%';
