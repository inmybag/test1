const { createPool } = require('@vercel/postgres');
require('dotenv').config({ path: '.env.local' });

const pool = createPool({
  connectionString: process.env.POSTGRES_URL
});

async function run() {
  const client = await pool.connect();
  console.log('Creating video_analyses table...');
  try {
    await client.sql`
      CREATE TABLE IF NOT EXISTS video_analyses (
        id SERIAL PRIMARY KEY,
        platform TEXT NOT NULL,
        video_id TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        thumbnail TEXT,
        category TEXT NOT NULL,
        date_str TEXT NOT NULL,
        analysis_json JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(video_id, date_str)
      );
    `;
    console.log('Table created successfully.');
  } catch (err) {
    console.error('Error creating table:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
