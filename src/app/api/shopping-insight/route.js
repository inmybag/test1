import { NextResponse } from 'next/server';
import { createPool } from '@vercel/postgres';

const pool = createPool({ connectionString: process.env.POSTGRES_URL });

function getPreviousDate(dateStr, daysBefore) {
  const year = parseInt(dateStr.slice(0, 4));
  const month = parseInt(dateStr.slice(4, 6)) - 1;
  const day = parseInt(dateStr.slice(6, 8));
  
  const date = new Date(year, month, day);
  date.setDate(date.getDate() - daysBefore);
  
  return date.toLocaleDateString('en-CA').replace(/-/g, '');
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date');

  if (!dateStr) {
    return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 });
  }

  const prevDateStr = getPreviousDate(dateStr, 7);

  try {
    // 현재 날짜 순위
    const currentRes = await pool.query(
      'SELECT keyword, rank FROM shopping_insight_keywords WHERE date_str = $1 ORDER BY rank ASC',
      [dateStr]
    );

    // 7일 전 순위
    const prevRes = await pool.query(
      'SELECT keyword, rank FROM shopping_insight_keywords WHERE date_str = $1',
      [prevDateStr]
    );

    const prevRankMap = new Map();
    prevRes.rows.forEach(row => {
      prevRankMap.set(row.keyword, row.rank);
    });

    const rankingsWithChange = currentRes.rows.map(row => {
      const prevRank = prevRankMap.get(row.keyword);
      let rankChange = null;

      if (prevRank) {
        // 순위가 낮을수록(숫자가 클수록) 성적이 나쁨. 
        // 10등 -> 5등 = +5 상승 (▲5)
        rankChange = prevRank - row.rank;
      } else {
        rankChange = 'NEW';
      }

      return {
        ...row,
        rankChange
      };
    });

    return NextResponse.json({ 
      date: dateStr, 
      prevDate: prevDateStr,
      rankings: rankingsWithChange 
    });
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
