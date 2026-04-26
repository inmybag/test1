require('dotenv/config');
const { sql } = require('@vercel/postgres');

async function check() {
  try {
    const { rows: products } = await sql`SELECT id, product_name FROM review_products WHERE product_name LIKE '%매그놀리아%' OR product_name LIKE '%세린%'`;
    console.log("Products:", products);
    
    for (const p of products) {
      const { rows: reviews } = await sql`SELECT COUNT(*) FROM product_reviews WHERE product_id = ${p.id}`;
      console.log(`Reviews for ${p.product_name}:`, reviews[0].count);
    }
  } catch(e) {
    console.error(e);
  }
}
check();
