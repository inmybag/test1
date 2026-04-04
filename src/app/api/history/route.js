import { NextResponse } from 'next/server';
import { getRankingHistory, initDb } from '@/lib/db';

export async function GET(request) {
  await initDb();
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title');
  const dateStr = searchParams.get('date');
  const productId = searchParams.get('productId');
  
  if (!productId || !dateStr) {
    return NextResponse.json({ error: 'ProductId and date are required' }, { status: 400 });
  }
  
  const history = await getRankingHistory(productId, dateStr, 30, title);
  
  return NextResponse.json({
    title,
    history
  });
}
