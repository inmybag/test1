
const { sql } = require('@vercel/postgres');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function checkProduct() {
  try {
    const { rows: products } = await sql`
      SELECT id, product_name, brand_name, page_url 
      FROM review_products 
      WHERE product_name LIKE '%벨벳 헤이즈 블러셔%';
    `;
    
    console.log('--- Matching Products ---');
    console.log(JSON.stringify(products, null, 2));

    if (products.length > 0) {
      for (const product of products) {
        const { rows: reviews } = await sql`
          SELECT count(*) as count 
          FROM product_reviews 
          WHERE product_id = ${product.id};
        `;
        console.log(`Product ID: ${product.id}, Name: ${product.product_name}, Review Count: ${reviews[0].count}`);
      }
    } else {
      console.log('No matching product found.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkProduct();
