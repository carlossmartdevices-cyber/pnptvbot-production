/**
 * Setup script for Lifetime Pass Landing Page
 * This script creates the necessary Firestore collections and sample data
 *
 * Usage: node scripts/setup-lifetime-pass.js
 */

require('dotenv').config();
const logger = require('../src/utils/logger');
const crypto = require('crypto');

/**
 * Generate a unique activation code
 * @returns {string} Activation code
 */
function generateActivationCode() {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
}

/**
 * Create Firestore collections for lifetime pass
 */
async function setupCollections() {
  try {
    logger.info('Starting Lifetime Pass setup...');

    // Initialize Firebase
    initializeFirebase();
    const db = getFirestore();

    logger.info('✓ Firebase initialized');

    // 1. Create sample payment links
    logger.info('Creating sample payment links...');

    const samplePaymentLinks = [
      {
        url: 'https://pay.getmeru.com/CtJb_x',
        used: false,
        product: 'lifetime-pass',
        price: 80,
        currency: 'USD',
        createdAt: new Date(),
      },
      {
        url: 'https://pay.getmeru.com/Dt8c_y',
        used: false,
        product: 'lifetime-pass',
        price: 80,
        currency: 'USD',
        createdAt: new Date(),
      },
      {
        url: 'https://pay.getmeru.com/Et9d_z',
        used: false,
        product: 'lifetime-pass',
        price: 80,
        currency: 'USD',
        createdAt: new Date(),
      },
      {
        url: 'https://pay.getmeru.com/Ft0e_a',
        used: false,
        product: 'lifetime-pass',
        price: 80,
        currency: 'USD',
        createdAt: new Date(),
      },
      {
        url: 'https://pay.getmeru.com/Gt1f_b',
        used: false,
        product: 'lifetime-pass',
        price: 80,
        currency: 'USD',
        createdAt: new Date(),
      },
    ];

    const paymentLinksCollection = db.collection('paymentLinks');

    for (const link of samplePaymentLinks) {
      await paymentLinksCollection.add(link);
      logger.info(`  ✓ Added payment link: ${link.url}`);
    }

    logger.info(`✓ Created ${samplePaymentLinks.length} payment links`);

    // 2. Create sample activation codes
    logger.info('Creating sample activation codes...');

    const sampleActivationCodes = [
      {
        code: generateActivationCode(),
        product: 'lifetime-pass',
        used: false,
        email: 'customer1@example.com',
        createdAt: new Date(),
        // expiresAt: null, // No expiration for lifetime pass
      },
      {
        code: generateActivationCode(),
        product: 'lifetime-pass',
        used: false,
        email: 'customer2@example.com',
        createdAt: new Date(),
      },
      {
        code: generateActivationCode(),
        product: 'lifetime-pass',
        used: false,
        email: 'customer3@example.com',
        createdAt: new Date(),
      },
    ];

    const activationCodesCollection = db.collection('activationCodes');

    for (const codeData of sampleActivationCodes) {
      await activationCodesCollection.doc(codeData.code).set(codeData);
      logger.info(`  ✓ Created activation code: ${codeData.code} (${codeData.email})`);
    }

    logger.info(`✓ Created ${sampleActivationCodes.length} activation codes`);

    // 3. Create activation logs collection (empty, for tracking)
    logger.info('Setting up activation logs collection...');

    // Just ensure the collection exists by adding a placeholder document
    await db.collection('activationLogs').doc('_placeholder').set({
      note: 'This collection stores activation logs',
      createdAt: new Date(),
    });

    logger.info('✓ Activation logs collection ready');

    // 4. Display summary
    logger.info('\n========================================');
    logger.info('Lifetime Pass Setup Complete!');
    logger.info('========================================\n');

    logger.info('Sample Activation Codes:');
    sampleActivationCodes.forEach((code, index) => {
      logger.info(`  ${index + 1}. ${code.code} - ${code.email}`);
    });

    logger.info('\nPayment Links Created: ' + samplePaymentLinks.length);

    logger.info('\nNext Steps:');
    logger.info('1. Update public/firebase-config.js with your Firebase credentials');
    logger.info('2. Replace sample payment links with real ones in Firestore');
    logger.info('3. Generate activation codes for each successful payment');
    logger.info('4. Deploy landing page to your server');
    logger.info('5. Test activation with: /activate CODE\n');

    logger.info('Collections created:');
    logger.info('  - paymentLinks');
    logger.info('  - activationCodes');
    logger.info('  - activationLogs\n');

    process.exit(0);

  } catch (error) {
    logger.error('Error setting up collections:', error);
    process.exit(1);
  }
}

/**
 * Add payment links from command line
 * Usage: node scripts/setup-lifetime-pass.js add-links <url1> <url2> ...
 */
async function addPaymentLinks(urls) {
  try {
    initializeFirebase();
    const db = getFirestore();

    logger.info(`Adding ${urls.length} payment links...`);

    for (const url of urls) {
      const linkData = {
        url: url.trim(),
        used: false,
        product: 'lifetime-pass',
        price: 80,
        currency: 'USD',
        createdAt: new Date(),
      };

      await db.collection('paymentLinks').add(linkData);
      logger.info(`  ✓ Added: ${url}`);
    }

    logger.info('✓ All payment links added successfully');
    process.exit(0);

  } catch (error) {
    logger.error('Error adding payment links:', error);
    process.exit(1);
  }
}

/**
 * Generate activation codes
 * Usage: node scripts/setup-lifetime-pass.js generate-codes <email1> <email2> ...
 */
async function generateCodes(emails) {
  try {
    initializeFirebase();
    const db = getFirestore();

    logger.info(`Generating ${emails.length} activation codes...`);

    const codes = [];

    for (const email of emails) {
      const code = generateActivationCode();
      const codeData = {
        code,
        product: 'lifetime-pass',
        used: false,
        email: email.trim(),
        createdAt: new Date(),
      };

      await db.collection('activationCodes').doc(code).set(codeData);
      codes.push({ code, email: email.trim() });
      logger.info(`  ✓ ${code} - ${email}`);
    }

    logger.info('\n✓ All activation codes generated successfully\n');
    logger.info('Send these codes to customers via email:\n');

    codes.forEach(({ code, email }) => {
      logger.info(`${email}: ${code}`);
    });

    process.exit(0);

  } catch (error) {
    logger.error('Error generating activation codes:', error);
    process.exit(1);
  }
}

// Main execution
const args = process.argv.slice(2);
const command = args[0];

if (command === 'add-links') {
  const urls = args.slice(1);
  if (urls.length === 0) {
    logger.error('Please provide at least one payment URL');
    logger.info('Usage: node scripts/setup-lifetime-pass.js add-links <url1> <url2> ...');
    process.exit(1);
  }
  addPaymentLinks(urls);
} else if (command === 'generate-codes') {
  const emails = args.slice(1);
  if (emails.length === 0) {
    logger.error('Please provide at least one email address');
    logger.info('Usage: node scripts/setup-lifetime-pass.js generate-codes <email1> <email2> ...');
    process.exit(1);
  }
  generateCodes(emails);
} else {
  // Default: run full setup
  setupCollections();
}
