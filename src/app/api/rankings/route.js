import { NextResponse } from 'next/server';
import { fetchOliveYoungRankings } from '@/lib/crawler';
import { getRankings, saveRankings, initDb } from '@/lib/db';

export async function GET(request) {
  await initDb();
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date');
  
  if (!dateStr) {
    return NextResponse.json({ error: 'Date is required' }, { status: 400 });
  }
  
  // Try to get from DB
  let rankings = await getRankings(dateStr);
  
  // If not found, crawl (only for today)
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  
  if (rankings.length === 0 && dateStr === todayStr) {
    console.log(`Crawl needed for ${dateStr}...`);
    rankings = await fetchOliveYoungRankings();
    if (rankings.length > 0) {
      await saveRankings(dateStr, rankings);
    }
  }
  
  return NextResponse.json({
    date: dateStr,
    count: rankings.length,
    data: rankings
  });
}
