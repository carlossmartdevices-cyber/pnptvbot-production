-- ============================================
-- MIGRACIÓN: Sistema de Pagos Completo
-- ============================================

-- Tabla de pagos
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  plan_id VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  provider VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  payment_url TEXT,
  destination_address VARCHAR(255),
  transaction_ref VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_provider ON payments(provider);
CREATE INDEX idx_payments_transaction_ref ON payments(transaction_ref);

-- Tabla de suscripciones
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  plan_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  expires_at TIMESTAMP NOT NULL,
  payment_id INTEGER REFERENCES payments(id),
  auto_renew BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_expires_at ON subscriptions(expires_at);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para verificar suscripciones activas
CREATE OR REPLACE FUNCTION is_subscription_active(p_user_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  subscription_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM subscriptions 
    WHERE user_id = p_user_id 
    AND status = 'active' 
    AND expires_at > NOW()
  ) INTO subscription_exists;
  
  RETURN subscription_exists;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE payments IS 'Registro de todos los pagos del sistema';
COMMENT ON TABLE subscriptions IS 'Gestión de suscripciones de usuarios';
COMMENT ON FUNCTION is_subscription_active IS 'Verifica si un usuario tiene suscripción activa';
