const { sql } = require('@vercel/postgres');
require('dotenv').config({ path: '.env.local' });
async function check() {
  const { rows } = await sql`
    SELECT 
      CURRENT_TIMESTAMP as u_ct,
      (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date as kst_today,
      created_at,
      (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::date as kst_created,
      created_at::date as utc_created
    FROM product_reviews
    ORDER BY created_at DESC LIMIT 1
  `;
  console.log(rows);
  process.exit(0);
}
check();
