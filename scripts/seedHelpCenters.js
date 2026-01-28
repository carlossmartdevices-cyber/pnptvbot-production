require('dotenv').config();
const { Pool } = require('pg');
const logger = require('../src/utils/logger');

/**
 * Seed Help Centers and NGOs into nearby_places
 *
 * Usage: node scripts/seedHelpCenters.js
 */

// ==============================================
// ADD YOUR ORGANIZATIONS HERE
// ==============================================
const helpCenters = [
  {
    name: "Lambda Legal",
    description: "Legal advocacy, litigation and protection of civil rights for LGBTQ+ people and people living with HIV.",
    address: "120 Wall St 19th Floor",
    city: "New York",
    country: "USA",
    location_lat: 40.7064,
    location_lng: -74.0094,
    phone: "+12128098585",
    email: null,
    website: "https://lambdalegal.org",
    telegram_username: null,
    instagram: null
  },
  {
    name: "Los Angeles LGBT Center",
    description: "Comprehensive LGBTQ+ services including health care, mental health, housing, legal support and advocacy.",
    address: "1125 N McCadden Pl",
    city: "Los Angeles",
    country: "USA",
    location_lat: 34.0928,
    location_lng: -118.3336,
    phone: "+13239932900",
    email: null,
    website: "https://lalgbtcenter.org",
    telegram_username: null,
    instagram: null
  },
  {
    name: "Yaaj México",
    description: "Human rights advocacy and legal support for LGBTQ+ people, with strong focus on trans and non-binary communities.",
    address: "Col. Roma Norte",
    city: "Ciudad de México",
    country: "México",
    location_lat: 19.4194,
    location_lng: -99.1620,
    phone: null,
    email: "yaajmexico@gmail.com",
    website: "https://www.yaajmexico.org",
    telegram_username: null,
    instagram: null
  },
  {
    name: "Colombia Diversa",
    description: "Strategic litigation, research and advocacy for LGBTIQ+ rights in Colombia.",
    address: "Chapinero",
    city: "Bogotá",
    country: "Colombia",
    location_lat: 4.6486,
    location_lng: -74.0636,
    phone: null,
    email: null,
    website: "https://colombiadiversa.org",
    telegram_username: null,
    instagram: null
  },
  {
    name: "Casa 1",
    description: "Community center and temporary shelter providing support, culture and protection for LGBTQIA+ people.",
    address: "Bela Vista",
    city: "São Paulo",
    country: "Brasil",
    location_lat: -23.5587,
    location_lng: -46.6350,
    phone: null,
    email: "contato@casaum.org",
    website: "https://www.instagram.com/casa1/",
    telegram_username: null,
    instagram: null
  },
  {
    name: "Stonewall",
    description: "UK-based organization working for equality and human rights of LGBTQ+ people through policy and advocacy.",
    address: "Tower Hill",
    city: "London",
    country: "United Kingdom",
    location_lat: 51.5095,
    location_lng: -0.0760,
    phone: null,
    email: null,
    website: "https://www.stonewall.org.uk",
    telegram_username: null,
    instagram: null
  },
  {
    name: "Schwulenberatung Berlin",
    description: "Counseling and support services for LGBTQ+ people including mental health, addiction and housing assistance.",
    address: "Niebuhrstraße 59/60",
    city: "Berlin",
    country: "Germany",
    location_lat: 52.5105,
    location_lng: 13.3053,
    phone: "+4930446688111",
    email: null,
    website: "https://schwulenberatungberlin.de",
    telegram_username: null,
    instagram: null
  },
  {
    name: "FELGTBI+",
    description: "Spanish national federation advocating for LGTBI+ rights, equality policies and social inclusion.",
    address: "Calle Infantas",
    city: "Madrid",
    country: "Spain",
    location_lat: 40.4210,
    location_lng: -3.6984,
    phone: "+34913604605",
    email: null,
    website: "https://felgtbi.org",
    telegram_username: null,
    instagram: null
  },
  {
    name: "Rainbow Sky Association of Thailand (RSAT)",
    description: "Community-based LGBTQ+ organization offering health education, advocacy and social support.",
    address: "Phaya Thai District",
    city: "Bangkok",
    country: "Thailand",
    location_lat: 13.7563,
    location_lng: 100.5018,
    phone: "+6627316532",
    email: null,
    website: "https://rsat.info",
    telegram_username: null,
    instagram: null
  },
  {
    name: "Equality Australia",
    description: "National organization advancing legal and social equality for LGBTIQ+ people in Australia.",
    address: "Surry Hills",
    city: "Sydney",
    country: "Australia",
    location_lat: -33.8865,
    location_lng: 151.2127,
    phone: "+61272087922",
    email: null,
    website: "https://equalityaustralia.org.au",
    telegram_username: null,
    instagram: null
  },
];

async function seedHelpCenters() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    logger.info('🏥 Seeding Help Centers and NGOs...');

    // Get the help_centers category ID
    const categoryResult = await pool.query(
      "SELECT id FROM nearby_place_categories WHERE slug = 'help_centers'"
    );

    if (categoryResult.rows.length === 0) {
      throw new Error("help_centers category not found. Run migration 049 first.");
    }

    const categoryId = categoryResult.rows[0].id;
    logger.info(`📁 Using category_id: ${categoryId} (help_centers)`);

    let added = 0;
    let skipped = 0;

    for (const org of helpCenters) {
      // Check if already exists
      const existing = await pool.query(
        "SELECT id FROM nearby_places WHERE name = $1 AND city = $2",
        [org.name, org.city]
      );

      if (existing.rows.length > 0) {
        logger.info(`⏭️  Skipping (exists): ${org.name}`);
        skipped++;
        continue;
      }

      // Insert new organization
      await pool.query(`
        INSERT INTO nearby_places (
          name, description, address, city, country,
          location_lat, location_lng,
          category_id, place_type,
          phone, email, website, telegram_username, instagram,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        org.name,
        org.description,
        org.address,
        org.city,
        org.country,
        org.location_lat,
        org.location_lng,
        categoryId,
        'place_of_interest',
        org.phone,
        org.email,
        org.website,
        org.telegram_username,
        org.instagram,
        'approved'  // Auto-approve help centers
      ]);

      logger.info(`✅ Added: ${org.name} (${org.city})`);
      added++;
    }

    logger.info('');
    logger.info('='.repeat(50));
    logger.info(`🎉 Seeding complete! Added: ${added}, Skipped: ${skipped}`);
    logger.info('='.repeat(50));

    await pool.end();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error seeding help centers:', error);
    await pool.end();
    process.exit(1);
  }
}

seedHelpCenters();
