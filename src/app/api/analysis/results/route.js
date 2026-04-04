import { NextResponse } from 'next/server';
import { getVideoAnalyses, initDb } from '@/lib/db';

export async function GET(request) {
  await initDb();
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date') || new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const category = searchParams.get('category');
  
  const results = await getVideoAnalyses(dateStr, category);
  
  return NextResponse.json({
    date: dateStr,
    results
  });
}
