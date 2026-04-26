const { sql } = require('@vercel/postgres');
require('dotenv').config({ path: '.env.local' });
async function check() {
  const { rows } = await sql`
    SELECT review_date, COUNT(*) as count
    FROM product_reviews 
    WHERE review_date IN ('2026-04-18', '2026-04-19', '2026-04-20')
    GROUP BY review_date
  `;
  console.log('Recent review dates counts:', rows);
  
  const { rows: latestCrawled } = await sql`
    SELECT review_date, product_id, created_at
    FROM product_reviews 
    ORDER BY created_at DESC 
    LIMIT 20
  `;
  console.log('\nLatest collected items (review_date):', latestCrawled.map(r => r.review_date));
  process.exit(0);
}
check();
