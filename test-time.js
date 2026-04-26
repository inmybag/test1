const { sql } = require('@vercel/postgres');
require('dotenv').config({ path: '.env.local' });
async function check() {
  const { rows } = await sql`SELECT CURRENT_TIMESTAMP, CURRENT_DATE`;
  console.log('DB Time:', rows);
  const { rows: r } = await sql`SELECT review_date, created_at FROM product_reviews ORDER BY created_at DESC LIMIT 5`;
  console.log('Latest reviews:', r);
  process.exit(0);
}
check();
