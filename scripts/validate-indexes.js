#!/usr/bin/env node

/**
 * Database Indexes Validation Script
 * Validates that required Firestore indexes are configured
 */

const { getFirestore } = require('../src/config/firebase');
const logger = require('../src/utils/logger');

// Required indexes for optimal query performance
const REQUIRED_INDEXES = [
  {
    collection: 'users',
    fields: [
      { fieldPath: 'subscriptionStatus', order: 'ASCENDING' },
      { fieldPath: 'planExpiry', order: 'ASCENDING' },
    ],
    queryScope: 'COLLECTION',
    description: 'Query users by subscription status and expiry',
  },
  {
    collection: 'users',
    fields: [
      { fieldPath: 'location.lat', order: 'ASCENDING' },
      { fieldPath: 'location.lng', order: 'ASCENDING' },
    ],
    queryScope: 'COLLECTION',
    description: 'Geolocation queries for nearby users',
  },
  {
    collection: 'payments',
    fields: [
      { fieldPath: 'userId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
    queryScope: 'COLLECTION',
    description: 'Query payments by user and date',
  },
  {
    collection: 'payments',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
    queryScope: 'COLLECTION',
    description: 'Query payments by status and date',
  },
  {
    collection: 'payments',
    fields: [
      { fieldPath: 'transactionId', order: 'ASCENDING' },
      { fieldPath: 'provider', order: 'ASCENDING' },
    ],
    queryScope: 'COLLECTION',
    description: 'Webhook payment reconciliation',
  },
];

// Recommended single-field indexes
const RECOMMENDED_INDEXES = {
  users: ['userId', 'subscriptionStatus', 'planId', 'createdAt'],
  payments: ['userId', 'status', 'provider', 'transactionId', 'planId', 'createdAt'],
  plans: ['planId', 'active'],
};

/**
 * Validate that commonly queried fields have indexes
 */
async function validateSingleFieldIndexes() {
  const db = getFirestore();
  const results = [];

  console.log('\n=== Single-Field Index Recommendations ===\n');

  for (const [collection, fields] of Object.entries(RECOMMENDED_INDEXES)) {
    console.log(`Collection: ${collection}`);

    for (const field of fields) {
      try {
        // Try a query to see if it works efficiently
        // Note: Firestore automatically creates single-field indexes
        const testQuery = await db.collection(collection)
          .where(field, '==', 'test')
          .limit(1)
          .get();

        console.log(`  ✓ ${field} - Single-field index (automatic)`);
        results.push({ collection, field, status: 'OK', type: 'single' });
      } catch (error) {
        console.log(`  ✗ ${field} - Error: ${error.message}`);
        results.push({
          collection, field, status: 'ERROR', type: 'single', error: error.message,
        });
      }
    }
    console.log('');
  }

  return results;
}

/**
 * Check if composite indexes are required
 */
async function validateCompositeIndexes() {
  console.log('=== Composite Index Requirements ===\n');

  REQUIRED_INDEXES.forEach((index, i) => {
    console.log(`${i + 1}. Collection: ${index.collection}`);
    console.log(`   Description: ${index.description}`);
    console.log(`   Fields:`);
    index.fields.forEach((field) => {
      console.log(`     - ${field.fieldPath} (${field.order})`);
    });
    console.log('');
  });

  return REQUIRED_INDEXES;
}

/**
 * Generate Firestore index creation links
 */
function generateIndexLinks() {
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!projectId) {
    console.log('⚠️  FIREBASE_PROJECT_ID not set. Cannot generate index links.\n');
    return;
  }

  console.log('=== Firestore Index Creation Links ===\n');
  console.log(`Project ID: ${projectId}\n`);

  console.log('To create composite indexes, visit:');
  console.log(`https://console.firebase.google.com/project/${projectId}/firestore/indexes\n`);

  console.log('Or use the Firebase CLI:');
  console.log('  firebase deploy --only firestore:indexes\n');
}

/**
 * Generate firestore.indexes.json content
 */
function generateIndexesJson() {
  console.log('=== firestore.indexes.json Configuration ===\n');

  const indexesConfig = {
    indexes: REQUIRED_INDEXES.map((index) => ({
      collectionGroup: index.collection,
      queryScope: index.queryScope,
      fields: index.fields,
    })),
    fieldOverrides: [],
  };

  console.log(JSON.stringify(indexesConfig, null, 2));
  console.log('\n');
}

/**
 * Test critical queries to ensure indexes work
 */
async function testCriticalQueries() {
  const db = getFirestore();
  console.log('=== Testing Critical Queries ===\n');

  const tests = [
    {
      name: 'User payment history',
      test: async () => {
        const query = await db.collection('payments')
          .where('userId', '==', 'test')
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();
        return query.empty ? 'No data (OK)' : `Found ${query.size} records`;
      },
    },
    {
      name: 'Active subscriptions',
      test: async () => {
        const query = await db.collection('users')
          .where('subscriptionStatus', '==', 'active')
          .limit(1)
          .get();
        return query.empty ? 'No data (OK)' : `Found ${query.size} records`;
      },
    },
    {
      name: 'Payment by transaction ID',
      test: async () => {
        const query = await db.collection('payments')
          .where('transactionId', '==', 'test')
          .where('provider', '==', 'epayco')
          .limit(1)
          .get();
        return query.empty ? 'No data (OK)' : `Found ${query.size} records`;
      },
    },
  ];

  for (const test of tests) {
    try {
      const result = await test.test();
      console.log(`✓ ${test.name}: ${result}`);
    } catch (error) {
      if (error.code === 9) {
        console.log(`✗ ${test.name}: MISSING INDEX - ${error.message}`);
      } else {
        console.log(`✗ ${test.name}: Error - ${error.message}`);
      }
    }
  }

  console.log('');
}

/**
 * Main validation function
 */
async function main() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   Firestore Index Validation Script       ║');
  console.log('╚════════════════════════════════════════════╝\n');

  try {
    // Validate single-field indexes
    await validateSingleFieldIndexes();

    // Show composite index requirements
    await validateCompositeIndexes();

    // Generate helpful links
    generateIndexLinks();

    // Generate indexes JSON
    generateIndexesJson();

    // Test critical queries
    await testCriticalQueries();

    console.log('✅ Validation complete!\n');
    console.log('Next steps:');
    console.log('1. Review the index recommendations above');
    console.log('2. Create missing composite indexes in Firebase Console');
    console.log('3. Or deploy indexes using: firebase deploy --only firestore:indexes');
    console.log('4. Re-run this script to verify\n');
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    logger.error('Index validation error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  validateSingleFieldIndexes,
  validateCompositeIndexes,
  REQUIRED_INDEXES,
  RECOMMENDED_INDEXES,
};
