require('dotenv').config({ allowEmptyValues: true });
const db = require('../src/utils/db');

const threadId = Number(process.argv[2]);
if (!Number.isFinite(threadId)) {
  console.error('Usage: node scripts/delete-support-topic-by-thread.js <threadId>');
  process.exit(1);
}

(async () => {
  try {
    const result = await db.query('DELETE FROM support_topics WHERE thread_id = $1', [threadId]);
    console.log(`Deleted rows: ${result.rowCount}`);
    process.exit(0);
  } catch (error) {
    console.error('Delete failed:', error.message || error);
    process.exit(1);
  }
})();
