import { NextResponse } from 'next/server';
import { createPool } from '@vercel/postgres';

const pool = createPool({ connectionString: process.env.POSTGRES_URL });

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');

  if (!keyword) {
    return NextResponse.json({ error: 'Keyword parameter is required' }, { status: 400 });
  }

  try {
    const { rows } = await pool.query(
      'SELECT rank, date_str as date FROM shopping_insight_keywords WHERE keyword = $1 ORDER BY date_str ASC LIMIT 90',
      [keyword]
    );

    return NextResponse.json({ keyword, history: rows });
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
