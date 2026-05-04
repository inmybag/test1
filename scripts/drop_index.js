const { sql } = require('@vercel/postgres');
require('dotenv').config({ path: '.env.local' });
async function run() {
  try {
    await sql`DROP INDEX IF EXISTS idx_reviews_unique;`;
    console.log("Dropped idx_reviews_unique");
  } catch (e) {
    console.log("Error:", e.message);
  }
}
run();
