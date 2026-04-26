const { sql } = require('@vercel/postgres');
require('dotenv').config({ path: '.env.local' });
async function check() {
  const { rows } = await sql`
    SELECT review_date, product_id, created_at, reviewer_nickname 
    FROM product_reviews 
    WHERE created_at > '2026-04-19 00:00:00'
    ORDER BY created_at DESC 
    LIMIT 10
  `;
  console.log(rows);
  process.exit(0);
}
check();
