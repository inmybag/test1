require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');
async function test() {
  try {
    const { rows } = await sql`SELECT * FROM review_products ORDER BY id DESC LIMIT 5`;
    console.log(rows);
  } catch(e) { console.error(e) }
  process.exit(0);
}
test();
