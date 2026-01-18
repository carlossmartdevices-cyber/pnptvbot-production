-- Models Management System
-- Complete system for 1:1 private calls with models

-- Models table
CREATE TABLE IF NOT EXISTS models (
  id SERIAL PRIMARY KEY,
  model_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  bio TEXT,
  photo_url VARCHAR(512),
  price_per_minute DECIMAL(10, 2) NOT NULL,
  min_duration_minutes INT DEFAULT 15,
  max_duration_minutes INT DEFAULT 120,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Model availability schedule (recurring weekly schedule)
CREATE TABLE IF NOT EXISTS model_availability (
  id SERIAL PRIMARY KEY,
  model_id BIGINT NOT NULL REFERENCES models(model_id) ON DELETE CASCADE,
  day_of_week INT NOT NULL, -- 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(model_id, day_of_week)
);

-- Model status (real-time online/offline/busy)
CREATE TABLE IF NOT EXISTS model_status (
  id SERIAL PRIMARY KEY,
  model_id BIGINT NOT NULL UNIQUE REFERENCES models(model_id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'offline', -- 'online', 'offline', 'busy'
  current_booking_id INT REFERENCES model_bookings(id) ON DELETE SET NULL,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Model bookings/reservations
CREATE TABLE IF NOT EXISTS model_bookings (
  id SERIAL PRIMARY KEY,
  model_id BIGINT NOT NULL REFERENCES models(model_id),
  user_id BIGINT NOT NULL,
  telegram_user_id BIGINT NOT NULL,
  username VARCHAR(255),
  scheduled_date DATE NOT NULL,
  start_time TIME NOT NULL,
  duration_minutes INT NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'active', 'completed', 'cancelled'
  payment_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'refunded'
  payment_method VARCHAR(50), -- 'stripe', 'epayco', 'daimo', etc
  transaction_id VARCHAR(255),
  total_price DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  call_room_url VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Model photos gallery
CREATE TABLE IF NOT EXISTS model_photos (
  id SERIAL PRIMARY KEY,
  model_id BIGINT NOT NULL REFERENCES models(model_id) ON DELETE CASCADE,
  photo_url VARCHAR(512) NOT NULL,
  caption TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Model reviews/ratings
CREATE TABLE IF NOT EXISTS model_reviews (
  id SERIAL PRIMARY KEY,
  model_id BIGINT NOT NULL REFERENCES models(model_id),
  user_id BIGINT NOT NULL,
  booking_id INT REFERENCES model_bookings(id),
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Model earnings tracking
CREATE TABLE IF NOT EXISTS model_earnings (
  id SERIAL PRIMARY KEY,
  model_id BIGINT NOT NULL REFERENCES models(model_id),
  booking_id INT REFERENCES model_bookings(id),
  amount DECIMAL(10, 2) NOT NULL,
  commission_percentage DECIMAL(5, 2) DEFAULT 30, -- Platform takes 30% commission
  model_earnings DECIMAL(10, 2) NOT NULL,
  payment_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid'
  payout_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_models_active ON models(is_active);
CREATE INDEX idx_model_availability_day ON model_availability(day_of_week);
CREATE INDEX idx_model_bookings_model ON model_bookings(model_id);
CREATE INDEX idx_model_bookings_user ON model_bookings(user_id);
CREATE INDEX idx_model_bookings_date ON model_bookings(scheduled_date);
CREATE INDEX idx_model_bookings_status ON model_bookings(status);
CREATE INDEX idx_model_status_model ON model_status(model_id);
CREATE INDEX idx_model_photos_model ON model_photos(model_id);
