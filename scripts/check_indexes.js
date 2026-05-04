const { sql } = require('@vercel/postgres');
require('dotenv').config({ path: '.env.local' });
async function run() {
  const { rows } = await sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'product_reviews';
  `;
  console.log(rows);
}
run();
