require('dotenv').config({ allowEmptyValues: true });
const db = require('../src/utils/db');

const planIds = ['week-pass','monthly-pass','6-month-pass'];

db.query('SELECT id, duration_days, duration, is_lifetime FROM plans WHERE id = ANY($1::text[])', [planIds])
  .then(r => { console.log(r.rows); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
