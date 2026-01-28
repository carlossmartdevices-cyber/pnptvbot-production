-- Migration 049: Nearby Places System
-- Creates tables for Community Businesses and Places of Interest with submission/approval workflow

-- =====================================================
-- 1. PLACE CATEGORIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS nearby_place_categories (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(50) UNIQUE NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    name_es VARCHAR(100) NOT NULL,
    description_en TEXT,
    description_es TEXT,
    emoji VARCHAR(10),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    requires_age_verification BOOLEAN DEFAULT FALSE,
    parent_category_id INTEGER REFERENCES nearby_place_categories(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 2. NEARBY PLACES TABLE (Core table for all places)
-- =====================================================
CREATE TABLE IF NOT EXISTS nearby_places (
    id SERIAL PRIMARY KEY,
    -- Basic Info
    name VARCHAR(200) NOT NULL,
    description TEXT,
    address VARCHAR(500),
    city VARCHAR(100),
    country VARCHAR(100),
    -- Location (for Haversine distance calculation)
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    location_geohash VARCHAR(12),
    -- Categorization
    category_id INTEGER REFERENCES nearby_place_categories(id),
    place_type VARCHAR(50) NOT NULL CHECK (place_type IN ('business', 'place_of_interest')),
    -- Contact Info
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(500),
    telegram_username VARCHAR(100),
    instagram VARCHAR(100),
    -- Business-specific fields
    is_community_owned BOOLEAN DEFAULT FALSE,
    owner_user_id VARCHAR(50),
    recommender_user_id VARCHAR(50),
    -- Media
    photo_url VARCHAR(500),
    photo_file_id VARCHAR(255),
    -- Operating Info
    hours_of_operation JSONB DEFAULT '{}',
    price_range VARCHAR(10) CHECK (price_range IN ('$', '$$', '$$$', '$$$$') OR price_range IS NULL),
    -- Status & Moderation
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    rejection_reason TEXT,
    moderated_by VARCHAR(50),
    moderated_at TIMESTAMP,
    -- Statistics
    view_count INTEGER DEFAULT 0,
    favorite_count INTEGER DEFAULT 0,
    report_count INTEGER DEFAULT 0,
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 3. PLACE SUBMISSIONS TABLE (User proposals)
-- =====================================================
CREATE TABLE IF NOT EXISTS nearby_place_submissions (
    id SERIAL PRIMARY KEY,
    -- Submitter Info
    submitted_by_user_id VARCHAR(50) NOT NULL,
    submitted_at TIMESTAMP DEFAULT NOW(),
    -- Place Data (mirrors nearby_places structure)
    name VARCHAR(200) NOT NULL,
    description TEXT,
    address VARCHAR(500),
    city VARCHAR(100),
    country VARCHAR(100),
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    category_id INTEGER REFERENCES nearby_place_categories(id),
    place_type VARCHAR(50) NOT NULL CHECK (place_type IN ('business', 'place_of_interest')),
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(500),
    telegram_username VARCHAR(100),
    instagram VARCHAR(100),
    is_community_owned BOOLEAN DEFAULT FALSE,
    photo_file_id VARCHAR(255),
    hours_of_operation JSONB DEFAULT '{}',
    price_range VARCHAR(10) CHECK (price_range IN ('$', '$$', '$$$', '$$$$') OR price_range IS NULL),
    -- Moderation
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    moderated_by VARCHAR(50),
    moderated_at TIMESTAMP,
    rejection_reason TEXT,
    admin_notes TEXT,
    -- If approved, link to created place
    created_place_id INTEGER REFERENCES nearby_places(id),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 4. PLACE FAVORITES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS nearby_place_favorites (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    place_id INTEGER REFERENCES nearby_places(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, place_id)
);

-- =====================================================
-- 5. PLACE REVIEWS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS nearby_place_reviews (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    place_id INTEGER REFERENCES nearby_places(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    status VARCHAR(20) DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 6. PLACE REPORTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS nearby_place_reports (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    place_id INTEGER REFERENCES nearby_places(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('closed', 'incorrect_info', 'inappropriate', 'spam', 'other')),
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
    resolved_by VARCHAR(50),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 7. INDEXES FOR PERFORMANCE
-- =====================================================
-- Location-based search optimization (for Haversine queries)
CREATE INDEX IF NOT EXISTS idx_nearby_places_location
ON nearby_places(location_lat, location_lng);

CREATE INDEX IF NOT EXISTS idx_nearby_places_geohash
ON nearby_places(location_geohash);

CREATE INDEX IF NOT EXISTS idx_nearby_places_category
ON nearby_places(category_id);

CREATE INDEX IF NOT EXISTS idx_nearby_places_status
ON nearby_places(status);

CREATE INDEX IF NOT EXISTS idx_nearby_places_type
ON nearby_places(place_type);

CREATE INDEX IF NOT EXISTS idx_nearby_places_city
ON nearby_places(city);

-- Approved places only (most common query)
CREATE INDEX IF NOT EXISTS idx_nearby_places_approved_location
ON nearby_places(location_lat, location_lng) WHERE status = 'approved';

-- Submissions
CREATE INDEX IF NOT EXISTS idx_place_submissions_status
ON nearby_place_submissions(status);

CREATE INDEX IF NOT EXISTS idx_place_submissions_user
ON nearby_place_submissions(submitted_by_user_id);

-- Favorites & Reviews
CREATE INDEX IF NOT EXISTS idx_place_favorites_user
ON nearby_place_favorites(user_id);

CREATE INDEX IF NOT EXISTS idx_place_favorites_place
ON nearby_place_favorites(place_id);

CREATE INDEX IF NOT EXISTS idx_place_reviews_place
ON nearby_place_reviews(place_id);

CREATE INDEX IF NOT EXISTS idx_place_reports_status
ON nearby_place_reports(status);

-- =====================================================
-- 8. SEED DEFAULT CATEGORIES
-- =====================================================
INSERT INTO nearby_place_categories (slug, name_en, name_es, description_en, description_es, emoji, sort_order, requires_age_verification) VALUES
    ('wellness', 'Wellness', 'Bienestar', 'Spas, massage parlors, gyms, and wellness centers', 'Spas, centros de masajes, gimnasios y centros de bienestar', '🧘', 1, false),
    ('cruising', 'Cruising Spots', 'Zonas de Cruising', 'Popular cruising locations', 'Lugares populares de cruising', '🌙', 2, true),
    ('adult_entertainment', '+18 Businesses', 'Negocios +18', 'Adult entertainment venues', 'Lugares de entretenimiento para adultos', '🔞', 3, true),
    ('pnp_friendly', 'PNP Friendly', 'PNP Amigable', 'PNP-friendly businesses and spaces', 'Negocios y espacios PNP-amigables', '💨', 4, true),
    ('help_centers', 'Help Centers', 'Centros de Ayuda', 'LGBTQ+ support, youth refuges, health centers', 'Apoyo LGBTQ+, refugios juveniles, centros de salud', '🏥', 5, false),
    ('saunas', 'Saunas & Bath Houses', 'Saunas y Baños', 'Saunas, steam rooms, and bath houses', 'Saunas, baños de vapor y casas de baños', '🧖', 6, true),
    ('bars_clubs', 'Bars & Clubs', 'Bares y Discotecas', 'LGBTQ+ bars, clubs, and nightlife venues', 'Bares, discotecas y lugares nocturnos LGBTQ+', '🍸', 7, false),
    ('community_business', 'Community Businesses', 'Negocios Comunitarios', 'Businesses owned by or recommended by community members', 'Negocios propiedad de o recomendados por miembros de la comunidad', '🏪', 8, false)
ON CONFLICT (slug) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_es = EXCLUDED.name_es,
    description_en = EXCLUDED.description_en,
    description_es = EXCLUDED.description_es,
    emoji = EXCLUDED.emoji,
    sort_order = EXCLUDED.sort_order,
    requires_age_verification = EXCLUDED.requires_age_verification;

-- =====================================================
-- 9. UPDATE TIMESTAMP TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION update_nearby_places_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_nearby_places_timestamp ON nearby_places;
CREATE TRIGGER trigger_update_nearby_places_timestamp
BEFORE UPDATE ON nearby_places
FOR EACH ROW
EXECUTE FUNCTION update_nearby_places_timestamp();

DROP TRIGGER IF EXISTS trigger_update_place_submissions_timestamp ON nearby_place_submissions;
CREATE TRIGGER trigger_update_place_submissions_timestamp
BEFORE UPDATE ON nearby_place_submissions
FOR EACH ROW
EXECUTE FUNCTION update_nearby_places_timestamp();

DROP TRIGGER IF EXISTS trigger_update_place_categories_timestamp ON nearby_place_categories;
CREATE TRIGGER trigger_update_place_categories_timestamp
BEFORE UPDATE ON nearby_place_categories
FOR EACH ROW
EXECUTE FUNCTION update_nearby_places_timestamp();

-- =====================================================
-- 10. HELPER FUNCTION: Calculate average rating
-- =====================================================
CREATE OR REPLACE FUNCTION get_place_average_rating(p_place_id INTEGER)
RETURNS DECIMAL(3,2) AS $$
DECLARE
    avg_rating DECIMAL(3,2);
BEGIN
    SELECT COALESCE(AVG(rating)::DECIMAL(3,2), 0)
    INTO avg_rating
    FROM nearby_place_reviews
    WHERE place_id = p_place_id AND status = 'approved';

    RETURN avg_rating;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 11. ANALYZE TABLES
-- =====================================================
ANALYZE nearby_place_categories;
ANALYZE nearby_places;
ANALYZE nearby_place_submissions;
ANALYZE nearby_place_favorites;
ANALYZE nearby_place_reviews;
ANALYZE nearby_place_reports;

-- =====================================================
-- 12. COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE nearby_place_categories IS 'Categories for nearby places (wellness, cruising, bars, etc.)';
COMMENT ON TABLE nearby_places IS 'Main table storing all approved and pending places/businesses';
COMMENT ON TABLE nearby_place_submissions IS 'User-submitted proposals for new places awaiting admin approval';
COMMENT ON TABLE nearby_place_favorites IS 'User favorites for quick access to saved places';
COMMENT ON TABLE nearby_place_reviews IS 'User reviews and ratings for places';
COMMENT ON TABLE nearby_place_reports IS 'User reports for moderation of incorrect/inappropriate places';

COMMENT ON COLUMN nearby_places.place_type IS 'Type: business (community-owned/recommended) or place_of_interest (general POI)';
COMMENT ON COLUMN nearby_places.status IS 'Moderation status: pending, approved, rejected, or suspended';
COMMENT ON COLUMN nearby_places.location_geohash IS 'Geohash for efficient spatial queries';
