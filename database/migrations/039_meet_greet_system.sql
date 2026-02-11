BEGIN;

-- Migration for Meet & Greet System
-- Adds tables for models, availability, bookings, and payments

-- Create models table
CREATE TABLE IF NOT EXISTS models (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE,
    bio TEXT,
    profile_image_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Drop the table first to ensure a clean slate, as it might exist in a broken state
DROP TABLE IF EXISTS model_availability CASCADE;

-- Create model availability table
CREATE TABLE IF NOT EXISTS model_availability (
    id SERIAL PRIMARY KEY,
    model_id INTEGER REFERENCES models(id) ON DELETE CASCADE,
    available_from TIMESTAMP NOT NULL,
    available_to TIMESTAMP NOT NULL,
    is_booked BOOLEAN DEFAULT FALSE,
    booking_id INTEGER REFERENCES meet_greet_bookings(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT valid_availability CHECK (available_from < available_to)
);

-- Create meet greet bookings table
CREATE TABLE IF NOT EXISTS meet_greet_bookings (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    model_id INTEGER REFERENCES models(id),
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (30, 60, 90)),
    price_usd DECIMAL(10,2) NOT NULL,
    booking_time TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'refunded')),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    payment_method VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create meet greet payments table
CREATE TABLE IF NOT EXISTS meet_greet_payments (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES meet_greet_bookings(id) ON DELETE CASCADE,
    amount_usd DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    transaction_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    payment_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_model_availability_model ON model_availability(model_id);
CREATE INDEX IF NOT EXISTS idx_model_availability_time ON model_availability(available_from, available_to);
CREATE INDEX IF NOT EXISTS idx_meet_greet_bookings_user ON meet_greet_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_meet_greet_bookings_model ON meet_greet_bookings(model_id);
CREATE INDEX IF NOT EXISTS idx_meet_greet_bookings_status ON meet_greet_bookings(status);
CREATE INDEX IF NOT EXISTS idx_meet_greet_payments_booking ON meet_greet_payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_meet_greet_payments_status ON meet_greet_payments(status);

COMMIT;