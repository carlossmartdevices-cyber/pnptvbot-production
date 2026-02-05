require('dotenv').config({ allowEmptyValues: true });
const db = require('../src/utils/db');

const userId = process.argv[2];
if (!userId) {
  console.error('Usage: node scripts/delete-user-by-id.js <userId>');
  process.exit(1);
}

(async () => {
  try {
    const result = await db.query('DELETE FROM users WHERE id = $1', [userId]);
    console.log(`Deleted rows: ${result.rowCount}`);
    process.exit(0);
  } catch (error) {
    console.error('Delete failed:', error.message || error);
    process.exit(1);
  }
})();
