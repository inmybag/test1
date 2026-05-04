import { sql } from '@vercel/postgres';

async function test() {
  const { rows } = await sql`SELECT product_id, title FROM rankings WHERE product_id IS NOT NULL LIMIT 1;`;
  console.log('Not null product_ids:', rows);
  
  const { rows: allRows } = await sql`SELECT COUNT(*) FROM rankings WHERE product_id IS NULL;`;
  console.log('Null product_ids count:', allRows[0].count);
  process.exit(0);
}
test().catch(console.error);
