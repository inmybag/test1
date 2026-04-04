import { NextResponse } from 'next/server';
import { getPagedVideoAnalyses, initDb } from '@/lib/db';

export async function GET(request) {
  await initDb();
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const page = parseInt(searchParams.get('page')) || 1;
  const limit = parseInt(searchParams.get('limit')) || 12;
  
  const { rows, totalCount } = await getPagedVideoAnalyses(category, page, limit);
  const totalPages = Math.ceil(totalCount / limit);
  
  return NextResponse.json({
    results: rows,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages
    }
  });
}
