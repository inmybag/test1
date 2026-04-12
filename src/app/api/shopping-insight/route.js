import { NextResponse } from 'next/server';
import { createPool } from '@vercel/postgres';

const pool = createPool({ connectionString: process.env.POSTGRES_URL });

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date');

  if (!dateStr) {
    return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 });
  }

  try {
    const { rows } = await pool.query(
      'SELECT keyword, rank FROM shopping_insight_keywords WHERE date_str = $1 ORDER BY rank ASC',
      [dateStr]
    );

    return NextResponse.json({ date: dateStr, rankings: rows });
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
