const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { performance } = require('perf_hooks');
require('dotenv').config();
const { query } = require('../src/config/postgres');
const logger = require('../src/utils/logger'); // Assuming a logger utility exists

const CSV_FILE_PATH = path.join(__dirname, '../Customes_legacy.csv');
const USERS_TABLE = 'users';

// Helper function to generate a unique BIGINT ID for new legacy users
// This uses a simple hashing strategy on the Stripe Customer ID and checks for collisions.
// In a real-world scenario, for BIGINT PKs, a dedicated sequence or UUID might be preferred
// but for simplicity and to fit BIGINT, this approach will generate a consistent ID.
async function generateUniqueLegacyUserId(stripeCustomerId, attempts = 0) {
  // Simple hash: Sum of char codes modulo BIGINT max, combined with current timestamp for uniqueness
  let hash = 0;
  for (let i = 0; i < stripeCustomerId.length; i++) {
    hash = ((hash << 5) - hash) + stripeCustomerId.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  // Make it a large positive BIGINT by shifting and adding current time, then add attempt to ensure uniqueness on collision
  let generatedId = (Math.abs(hash) * 100000000000 + Date.now() + attempts) % 9223372036854775807; // Max BIGINT
  generatedId = BigInt(generatedId);

  // Check for collision in the database
  const result = await query(`SELECT id FROM ${USERS_TABLE} WHERE id = $1`, [generatedId.toString()]);
  if (result.rows.length > 0) {
    logger.warn(`Collision detected for generated ID ${generatedId}. Retrying with attempt ${attempts + 1}`);
    return generateUniqueLegacyUserId(stripeCustomerId, attempts + 1); // Recurse with incremented attempt
  }
  return generatedId;
}


async function importLegacyCustomers() {
  logger.info('Starting legacy customer import to PostgreSQL...');
  const startTime = performance.now();

  const importResults = {
    total: 0,
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  const customersToImport = [];

  // Read and parse the CSV file
  try {
    await new Promise((resolve, reject) => {
      fs.createReadStream(CSV_FILE_PATH)
        .pipe(csv())
        .on('data', (row) => {
          customersToImport.push(row);
        })
        .on('end', () => {
          logger.info(`Finished parsing CSV. Found ${customersToImport.length} records.`);
          resolve();
        })
        .on('error', (error) => {
          logger.error('Error parsing CSV:', error);
          reject(error);
        });
    });
  } catch (error) {
    logger.error('Failed to read or parse CSV:', error);
    importResults.errors++;
    return importResults;
  }

  importResults.total = customersToImport.length;

  for (const customerRow of customersToImport) {
    try {
      const {
        id: stripeCustomerId, // Rename 'id' from CSV to stripeCustomerId
        Email: rawEmail,
        Name: rawName,
        'Created (UTC)': CreatedUTC,
        Plan: stripePriceId // Rename 'Plan' from CSV to stripePriceId
      } = customerRow;

      const email = rawEmail ? rawEmail.toLowerCase().trim() : null;
      if (!stripeCustomerId || !email) {
        logger.warn(`Skipping record due to missing Stripe Customer ID or Email: ${JSON.stringify(customerRow)}`);
        importResults.skipped++;
        continue;
      }

      // Split name into first_name and last_name
      let firstName = null;
      let lastName = null;
      if (rawName) {
        const nameParts = rawName.trim().split(' ');
        firstName = nameParts[0] || null;
        lastName = nameParts.slice(1).join(' ') || null;
      }

      // Convert CreatedUTC to a PostgreSQL-compatible TIMESTAMP
      const createdAt = new Date(CreatedUTC);
      const createdAtDb = isNaN(createdAt.getTime()) ? new Date() : createdAt; // Default to now if invalid date

      // Try to find an existing user by email
      const existingUserResult = await query(
        `SELECT id, created_at FROM ${USERS_TABLE} WHERE email = $1`,
        [email]
      );

      if (existingUserResult.rows.length > 0) {
        // User exists, update their Stripe-related fields
        const existingUser = existingUserResult.rows[0];
        const userId = existingUser.id;

        const updateQuery = `
          UPDATE ${USERS_TABLE}
          SET
            stripe_customer_id = $1,
            stripe_price_id = $2,
            updated_at = $3,
            created_at = CASE WHEN created_at > $4 THEN $4 ELSE created_at END,
            subscription_status = COALESCE(subscription_status, $5),
            plan_id = COALESCE(plan_id, $6),
            role = COALESCE(role, 'customer')
          WHERE id = $7
        `;
        const updateParams = [
          stripeCustomerId,
          stripePriceId && stripePriceId.startsWith('price_') ? stripePriceId : null,
          new Date(),
          createdAtDb,
          stripePriceId ? 'active' : 'inactive', // Default status based on plan
          stripePriceId && stripePriceId.startsWith('price_') ? stripePriceId : null,
          userId
        ];
        await query(updateQuery, updateParams);
        logger.info(`Updated existing user ${userId} (email: ${email}) with Stripe data.`);
        importResults.updated++;
      } else {
        // No existing user found by email, insert a new user
        const newUserId = await generateUniqueLegacyUserId(stripeCustomerId);

        const insertQuery = `
          INSERT INTO ${USERS_TABLE} (
            id,
            first_name,
            last_name,
            email,
            created_at,
            updated_at,
            stripe_customer_id,
            stripe_price_id,
            subscription_status,
            plan_id,
            role,
            -- Default values for other non-nullable or commonly used fields
            is_bot,
            is_banned,
            profile_views,
            favorites,
            badges,
            privacy_accepted,
            is_active,
            onboarding_complete
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
            FALSE, FALSE, 0, '{}', '{}', FALSE, TRUE, TRUE
          )
          ON CONFLICT (email) DO UPDATE SET
            stripe_customer_id = EXCLUDED.stripe_customer_id,
            stripe_price_id = EXCLUDED.stripe_price_id,
            updated_at = EXCLUDED.updated_at,
            created_at = CASE WHEN users.created_at > EXCLUDED.created_at THEN EXCLUDED.created_at ELSE users.created_at END,
            subscription_status = COALESCE(users.subscription_status, EXCLUDED.subscription_status),
            plan_id = COALESCE(users.plan_id, EXCLUDED.plan_id),
            role = COALESCE(users.role, EXCLUDED.role)
            WHERE users.id = (SELECT id FROM ${USERS_TABLE} WHERE email = EXCLUDED.email)
        `; // Added ON CONFLICT (email) for robustness if email uniqueness constraint is added/enabled
        const insertParams = [
          newUserId.toString(), // Ensure BigInt is converted to string for PostgreSQL client
          firstName,
          lastName,
          email,
          createdAtDb,
          new Date(),
          stripeCustomerId,
          stripePriceId && stripePriceId.startsWith('price_') ? stripePriceId : null,
          stripePriceId ? 'active' : 'inactive', // Default status based on plan
          stripePriceId && stripePriceId.startsWith('price_') ? stripePriceId : null,
          'customer' // Default role for imported customers
        ];
        await query(insertQuery, insertParams);
        logger.info(`Inserted new user ${newUserId} (email: ${email}) with Stripe data.`);
        importResults.imported++;
      }
    } catch (error) {
      logger.error(`Error processing customer ${customerRow.id || customerRow.Email}:`, error);
      importResults.errors++;
    }
  }

  const endTime = performance.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  logger.info(`Legacy customer import to PostgreSQL completed in ${duration} seconds!`, importResults);
  return importResults;
}

if (require.main === module) {
  importLegacyCustomers()
    .then((result) => {
      console.log('\n✅ Legacy customer import to PostgreSQL completed successfully!');
      console.log('\nSummary:');
      console.log(`Total records in CSV: ${result.total}`);
      console.log(`Successfully imported (new users): ${result.imported}`);
      console.log(`Successfully updated (existing users): ${result.updated}`);
      console.log(`Skipped (missing data): ${result.skipped}`);
      console.log(`Errors during import: ${result.errors}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Legacy customer import to PostgreSQL failed:', error);
      process.exit(1);
    });
}

module.exports = { importLegacyCustomers };