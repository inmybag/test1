import { NextResponse } from 'next/server';
import { getVideoAnalyses, initDb } from '@/lib/db';

export async function GET(request) {
  await initDb();
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date') || new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const category = searchParams.get('category');
  
  let results = await getVideoAnalyses(dateStr, category);
  
  // 만약 해당 날짜의 데이터가 없으면, DB에 있는 가장 최신 날짜의 데이터를 가져온다.
  if (!results || results.length === 0) {
    const { sql } = require('@vercel/postgres');
    try {
      const { rows } = await sql`SELECT MAX(date_str) as latest FROM video_analyses`;
      if (rows.length > 0 && rows[0].latest) {
        const latestDate = rows[0].latest;
        results = await getVideoAnalyses(latestDate, category);
        return NextResponse.json({
          date: latestDate,
          results,
          isFallback: true
        });
      }
    } catch (e) {
      console.error("최신 날짜 폴백 실패:", e);
    }
  }
  
  return NextResponse.json({
    date: dateStr,
    results
  });
}
