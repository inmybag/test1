const { sql } = require('@vercel/postgres');
require('dotenv').config({ path: '.env.local' });
async function run() {
  try {
    await sql`
      INSERT INTO product_reviews (product_id, review_date, reviewer_nickname, review_text)
      VALUES (1, '2026-04-29', 'test', 'test review')
      ON CONFLICT (product_id, COALESCE(reviewer_nickname, ''), review_date)
      DO NOTHING;
    `;
    console.log("Success");
  } catch (e) {
    console.log("Error:", e.message);
  }
}
run();
