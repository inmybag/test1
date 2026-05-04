import { sql } from '@vercel/postgres';

async function check() {
  const { rows } = await sql`SELECT MIN(date_str) as min_date, MAX(date_str) as max_date, COUNT(*) FROM rankings;`;
  console.log('Total rankings:', rows[0]);
  
  const { rows: dates } = await sql`SELECT date_str, COUNT(*) FROM rankings GROUP BY date_str ORDER BY date_str DESC LIMIT 30;`;
  console.log('Recent dates:', dates);
  
  process.exit(0);
}
check().catch(console.error);
