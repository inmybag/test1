const { sql } = require('@vercel/postgres');
require('dotenv').config({ path: '.env.local' });
async function run() {
  const { rows } = await sql`
      SELECT
        rp.product_name as "productName",
        COUNT(pr.id) as "totalReviews",
        (SELECT COUNT(*) FROM product_reviews WHERE product_id = rp.id) as "allTimeCount"
      FROM review_products rp
      LEFT JOIN product_reviews pr ON rp.id = pr.product_id
        AND pr.review_date >= '2026-01-29' AND pr.review_date <= '2026-04-29'
      GROUP BY rp.id, rp.product_name
  `;
  console.log(rows);
}
run();
