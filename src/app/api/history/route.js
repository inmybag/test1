import { NextResponse } from 'next/server';
import { getRankingHistory, initDb } from '@/lib/db';

export async function GET(request) {
  await initDb();
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title');
  const dateStr = searchParams.get('date');
  
  if (!title || !dateStr) {
    return NextResponse.json({ error: 'Title and date are required' }, { status: 400 });
  }
  
  const history = await getRankingHistory(title, dateStr);
  
  return NextResponse.json({
    title,
    history
  });
}
