const { sql } = require('@vercel/postgres');
require('dotenv').config({ path: '.env.local' });
async function check() {
  const { rows } = await sql`
    SELECT platform, MAX(review_date) as max_date, COUNT(*) as count 
    FROM product_reviews pr
    JOIN review_products rp ON pr.product_id = rp.id
    GROUP BY platform
  `;
  console.log(rows);
  process.exit(0);
}
check();
