#!/usr/bin/env node

/**
 * Script to analyze database structure and identify unused fields
 * Usage: node scripts/analyze-database.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Initialize Firebase Admin
const serviceAccount = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const db = admin.firestore();

/**
 * Analyze a collection and get all unique fields
 */
async function analyzeCollection(collectionName) {
  console.log(`\n📊 Analyzing collection: ${collectionName}`);

  try {
    const snapshot = await db.collection(collectionName).limit(100).get();

    if (snapshot.empty) {
      console.log(`   ⚠️  Collection is empty`);
      return { count: 0, fields: {} };
    }

    const fields = {};
    let totalDocs = 0;

    snapshot.forEach(doc => {
      totalDocs++;
      const data = doc.data();

      // Analyze fields
      Object.keys(data).forEach(key => {
        if (!fields[key]) {
          fields[key] = {
            count: 0,
            types: new Set(),
            samples: []
          };
        }

        fields[key].count++;
        const value = data[key];
        const type = Array.isArray(value) ? 'array' : typeof value;
        fields[key].types.add(type);

        // Store sample values
        if (fields[key].samples.length < 3) {
          if (type === 'object' && !Array.isArray(value)) {
            fields[key].samples.push(JSON.stringify(value, null, 2).substring(0, 100));
          } else if (type === 'array') {
            fields[key].samples.push(`[${value.length} items]`);
          } else {
            fields[key].samples.push(String(value).substring(0, 50));
          }
        }
      });
    });

    console.log(`   ✓ Documents sampled: ${totalDocs}`);
    console.log(`   ✓ Unique fields found: ${Object.keys(fields).length}`);

    // Show field usage
    console.log(`\n   Field Usage:`);
    Object.entries(fields)
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([field, info]) => {
        const percentage = ((info.count / totalDocs) * 100).toFixed(1);
        const types = Array.from(info.types).join(', ');
        console.log(`      ${field}: ${info.count}/${totalDocs} (${percentage}%) [${types}]`);
      });

    return { count: totalDocs, fields };
  } catch (error) {
    console.error(`   ❌ Error analyzing collection:`, error.message);
    return { count: 0, fields: {} };
  }
}

/**
 * Main execution
 */
(async () => {
  try {
    console.log('\n🔍 DATABASE STRUCTURE ANALYSIS\n');
    console.log('=' .repeat(60));

    // List of collections to analyze
    const collections = [
      'users',
      'payments',
      'plans',
      'calls',
      'callPackages',
      'liveStreams',
      'radioStations',
      'promoCodes',
      'gamification',
      'moderation'
    ];

    const analysis = {};

    for (const collection of collections) {
      analysis[collection] = await analyzeCollection(collection);
    }

    console.log('\n\n' + '='.repeat(60));
    console.log('📋 SUMMARY');
    console.log('='.repeat(60));

    Object.entries(analysis).forEach(([collection, data]) => {
      console.log(`${collection}: ${data.count} docs, ${Object.keys(data.fields).length} fields`);
    });

    console.log('\n✅ Analysis complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  }
})();
