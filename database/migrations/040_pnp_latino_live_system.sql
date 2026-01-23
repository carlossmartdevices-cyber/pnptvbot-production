-- Migration for PNP Latino Live System
-- Replaces Meet & Greet with enhanced private shows system

-- Create PNP models table (replaces models)
CREATE TABLE IF NOT EXISTS pnp_models (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE,
    bio TEXT,
    profile_image_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    is_online BOOLEAN DEFAULT FALSE,
    last_online TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create PNP availability table (replaces model_availability)
CREATE TABLE IF NOT EXISTS pnp_availability (
    id SERIAL PRIMARY KEY,
    model_id INTEGER REFERENCES pnp_models(id) ON DELETE CASCADE,
    available_from TIMESTAMP NOT NULL,
    available_to TIMESTAMP NOT NULL,
    is_booked BOOLEAN DEFAULT FALSE,
    booking_id INTEGER REFERENCES pnp_bookings(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT valid_availability CHECK (available_from < available_to)
);

-- Create PNP bookings table (replaces meet_greet_bookings)
CREATE TABLE IF NOT EXISTS pnp_bookings (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    model_id INTEGER REFERENCES pnp_models(id),
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (30, 60, 90)),
    price_usd DECIMAL(10,2) NOT NULL,
    booking_time TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'refunded')),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    payment_method VARCHAR(50),
    video_room_name VARCHAR(100),
    video_room_url VARCHAR(255),
    video_room_token TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create PNP payments table (replaces meet_greet_payments)
CREATE TABLE IF NOT EXISTS pnp_payments (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES pnp_bookings(id) ON DELETE CASCADE,
    amount_usd DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    transaction_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    payment_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create PNP feedback table (new for PNP Latino Live)
CREATE TABLE IF NOT EXISTS pnp_feedback (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES pnp_bookings(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    comments TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create PNP refunds table (new for PNP Latino Live)
CREATE TABLE IF NOT EXISTS pnp_refunds (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES pnp_bookings(id) ON DELETE CASCADE,
    amount_usd DECIMAL(10,2) NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    processed_by VARCHAR(50),
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pnp_availability_model ON pnp_availability(model_id);
CREATE INDEX IF NOT EXISTS idx_pnp_availability_time ON pnp_availability(available_from, available_to);
CREATE INDEX IF NOT EXISTS idx_pnp_bookings_user ON pnp_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_pnp_bookings_model ON pnp_bookings(model_id);
CREATE INDEX IF NOT EXISTS idx_pnp_bookings_status ON pnp_bookings(status);
CREATE INDEX IF NOT EXISTS idx_pnp_payments_booking ON pnp_payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_pnp_payments_status ON pnp_payments(status);
CREATE INDEX IF NOT EXISTS idx_pnp_feedback_booking ON pnp_feedback(booking_id);
CREATE INDEX IF NOT EXISTS idx_pnp_refunds_booking ON pnp_refunds(booking_id);

-- Create trigger for updating model online status
CREATE OR REPLACE FUNCTION update_model_online_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_online = TRUE THEN
        NEW.last_online = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_model_online
BEFORE UPDATE ON pnp_models
FOR EACH ROW
EXECUTE FUNCTION update_model_online_status();

-- Create trigger for updating booking timestamps
CREATE OR REPLACE FUNCTION update_booking_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_booking_timestamp
BEFORE UPDATE ON pnp_bookings
FOR EACH ROW
EXECUTE FUNCTION update_booking_timestamp();