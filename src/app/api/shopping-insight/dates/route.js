import { NextResponse } from 'next/server';
import { createPool } from '@vercel/postgres';

const pool = createPool({ connectionString: process.env.POSTGRES_URL });

export async function GET() {
  try {
    const { rows } = await pool.query(
      'SELECT DISTINCT date_str FROM shopping_insight_keywords ORDER BY date_str DESC LIMIT 30'
    );
    return NextResponse.json({ dates: rows.map(r => r.date_str) });
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
