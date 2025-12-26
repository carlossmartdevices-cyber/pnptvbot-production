-- Create confirmation_tokens table for one-time payment confirmation tokens
CREATE TABLE IF NOT EXISTS confirmation_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR(64) UNIQUE NOT NULL,
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id VARCHAR(100) REFERENCES plans(id),
    provider VARCHAR(50) NOT NULL, -- 'paypal', 'daimo', 'epayco'
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,

    CONSTRAINT check_provider CHECK (provider IN ('paypal', 'daimo', 'epayco'))
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_confirmation_tokens_token ON confirmation_tokens(token);
CREATE INDEX IF NOT EXISTS idx_confirmation_tokens_payment_id ON confirmation_tokens(payment_id);
CREATE INDEX IF NOT EXISTS idx_confirmation_tokens_user_id ON confirmation_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_confirmation_tokens_expires_at ON confirmation_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_confirmation_tokens_used ON confirmation_tokens(used);

-- Auto-update updated_at for confirmation_tokens
CREATE TRIGGER update_confirmation_tokens_updated_at
BEFORE UPDATE ON confirmation_tokens
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
