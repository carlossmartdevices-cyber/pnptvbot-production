require('dotenv').config({ allowEmptyValues: true });
const db = require('../src/utils/db');

const userId = '5417627815';

(async () => {
  try {
    const user = await db.query('SELECT id, username, email, subscription_status, plan_id, plan_expiry, onboarding_complete FROM users WHERE id = $1', [userId]);
    console.log('User:', user.rows[0] || null);
    const dup = await db.query('SELECT id, username, email FROM users WHERE username = $1', ['owl_who_who']);
    console.log('Users with username owl_who_who:', dup.rows);
    process.exit(0);
  } catch (error) {
    console.error('Check failed:', error.message || error);
    process.exit(1);
  }
})();
