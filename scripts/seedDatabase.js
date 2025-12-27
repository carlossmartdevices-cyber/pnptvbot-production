require('dotenv').config();
const { getFirestore, Collections, initializeFirebase } = require('../src/bot/config/firebase');
const logger = require('../src/utils/logger');

/**
 * Seed the database with initial data
 */
async function seedDatabase() {
  try {
    logger.info('🌱 Seeding database...');

    // Initialize Firebase
    initializeFirebase();
    const db = getFirestore();

    // Seed subscription plans
    const plans = [
      {
        id: 'basic',
        name: 'Basic',
        price: 9.99,
        currency: 'USD',
        durationDays: 30,
        features: {
          liveStreams: 1,
          zoomRooms: 1,
          support: 'basic',
        },
        active: true,
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 19.99,
        currency: 'USD',
        durationDays: 30,
        features: {
          liveStreams: 3,
          zoomRooms: 3,
          support: 'priority',
          analytics: true,
        },
        active: true,
      },
      {
        id: 'gold',
        name: 'Gold',
        price: 49.99,
        currency: 'USD',
        durationDays: 30,
        features: {
          liveStreams: 10,
          zoomRooms: 10,
          support: '24/7-premium',
          analytics: true,
          customBranding: true,
        },
        active: true,
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 0,
        currency: 'USD',
        durationDays: 30,
        features: {
          liveStreams: -1, // unlimited
          zoomRooms: -1, // unlimited
          support: 'dedicated',
          analytics: true,
          customBranding: true,
          customIntegrations: true,
        },
        active: true,
      },
    ];

    // Add plans to Firestore
    for (const plan of plans) {
      await db.collection(Collections.PLANS).doc(plan.id).set(plan);
      logger.info(`✅ Plan added: ${plan.name}`);
    }

    // Seed sample live streams (optional)
    const sampleStreams = [
      {
        id: 'stream1',
        title: 'PNPtv Live - Welcome Stream',
        url: 'https://youtube.com/watch?v=example1',
        active: true,
        createdAt: new Date(),
      },
    ];

    for (const stream of sampleStreams) {
      await db.collection(Collections.LIVE_STREAMS).doc(stream.id).set(stream);
      logger.info(`✅ Live stream added: ${stream.title}`);
    }

    // Seed sample Zoom rooms (optional)
    const sampleRooms = [
      {
        id: 'room1',
        name: 'PNPtv Haus',
        joinUrl: 'https://zoom.us/j/123456789',
        active: true,
        createdAt: new Date(),
      },
    ];

    for (const room of sampleRooms) {
      await db.collection(Collections.ZOOM_ROOMS).doc(room.id).set(room);
      logger.info(`✅ Zoom room added: ${room.name}`);
    }

    logger.info('✅ Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run seed
seedDatabase();
