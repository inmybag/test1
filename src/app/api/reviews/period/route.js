import { NextResponse } from 'next/server';
import { getReviewsByPeriod, getReviewsWithDetails, initDb } from '@/lib/db';

export async function GET(request) {
  try {
    await initDb();
    const { searchParams } = new URL(request.url);
    const productIdsStr = searchParams.get('productIds');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sentiment = searchParams.get('sentiment') || null;
    const attribute = searchParams.get('attribute') || null;
    const page = parseInt(searchParams.get('page')) || 1;

    if (!productIdsStr || !startDate || !endDate) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    const productIds = productIdsStr.split(',').map(Number);

    // 기간별 집계 데이터 (페이지 1일 때만 조회하여 부하 감소)
    let periodData = [];
    if (page === 1) {
      periodData = await getReviewsByPeriod(productIds, startDate, endDate);
    }
    
    // 리뷰 상세 목록 (필터링, 페이징 포함 10건)
    const reviews = await getReviewsWithDetails(productIds, startDate, endDate, sentiment, attribute, page);

    return NextResponse.json({ 
      periodData,
      reviews 
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
