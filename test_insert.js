require('dotenv').config({ path: '.env.local' });
const { createPool } = require('@vercel/postgres');
const pool = createPool({ connectionString: process.env.POSTGRES_URL });

async function test() {
  const client = await pool.connect();
  try {
    await client.sql`
      INSERT INTO product_reviews (product_id, review_date, rating, review_text, reviewer_nickname, extra_info, media_urls, sentiment, sentiment_score, attributes, source_highlight)
      VALUES (9, '2026-04-10', 5, '테스트입니다', '익명', '{}'::jsonb, '[]'::jsonb, 'positive', 1.0, '[]'::jsonb, '[]'::jsonb)
      ON CONFLICT DO NOTHING
    `;
    console.log("Success ON CONFLICT DO NOTHING");
  } catch (e) {
    console.error("Error:", e);
  } finally {
    client.release();
    process.exit(0);
  }
}
test();
