const { sql } = require('@vercel/postgres');
require('dotenv').config({ path: '.env.local' });
async function check() {
  const { rows } = await sql`
    SELECT review_date, product_id, created_at
    FROM product_reviews 
    ORDER BY review_date DESC 
    LIMIT 10
  `;
  console.log(rows);
  const { rows: pRows } = await sql`
    SELECT id, product_name FROM review_products
  `;
  console.log('Products:', pRows);
  process.exit(0);
}
check();
