require('dotenv').config({ allowEmptyValues: true });
const db = require('../src/utils/db');

const ids = ['1984620292','619458626','1160084529','8186221292','8133002738','2052693083','272444158'];

db.query('SELECT id, subscription_status, plan_id, plan_expiry FROM users WHERE id = ANY($1::text[])', [ids])
  .then(r => { console.log(r.rows); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
