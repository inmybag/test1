const { sql } = require('@vercel/postgres');
require('dotenv').config({ path: '.env.local' });
async function run() {
  const { rows } = await sql`SELECT rp.platform, count(pr.id) FROM review_products rp JOIN product_reviews pr ON rp.id = pr.product_id GROUP BY rp.platform`;
  console.log('platform counts:', rows);
}
run();
