require('dotenv').config({ allowEmptyValues: true });
const db = require('../src/utils/db');

(async () => {
  try {
    const res = await db.query('SELECT account_id, handle, created_by, is_active, created_at FROM x_accounts ORDER BY created_at DESC LIMIT 10');
    console.log(res.rows);
    process.exit(0);
  } catch (error) {
    console.error('Check failed:', error.message || error);
    process.exit(1);
  }
})();
