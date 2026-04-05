require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function migrate() {
  try {
    console.log('Adding notion_url column to video_analyses table...');
    await sql`ALTER TABLE video_analyses ADD COLUMN IF NOT EXISTS notion_url TEXT;`;
    console.log('Successfully updated database schema.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

migrate();
