require('dotenv').config({ path: '.env.local' });
const { createPool } = require('@vercel/postgres');

const pool = createPool({
  connectionString: process.env.POSTGRES_URL
});

async function checkData() {
  const client = await pool.connect();
  try {
    const { rows } = await client.sql`
      SELECT rank, title, image_url, product_id 
      FROM rankings 
      WHERE date_str = '20260320' 
      ORDER BY rank ASC 
      LIMIT 15;
    `;
    console.log('Sample Data (Rank 1-15):');
    rows.forEach(row => {
      console.log(`Rank ${row.rank}: ${row.title}`);
      console.log(`  Img: ${row.image_url}`);
      console.log(`  PID: ${row.product_id}`);
    });
  } catch (err) {
    console.error('Error checking data:', err);
  } finally {
    client.release();
  }
}

checkData();
