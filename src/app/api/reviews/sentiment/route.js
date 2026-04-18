import { NextResponse } from 'next/server';
import { getAttributeStats, getReviewsWithDetails, initDb } from '@/lib/db';

export async function GET(request) {
  try {
    await initDb();
    const { searchParams } = new URL(request.url);
    const productIdsStr = searchParams.get('productIds');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const attribute = searchParams.get('attribute') || null;

    if (!productIdsStr || !startDate || !endDate) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    const productIds = productIdsStr.split(',').map(Number);

    // 속성별 긍/부정 통계
    const attributeStats = await getAttributeStats(productIds, startDate, endDate);
    
    // 속성별 긍/부정 비율 데이터 가공
    const attributeMap = {};
    attributeStats.forEach(stat => {
      if (!attributeMap[stat.attributeName]) {
        attributeMap[stat.attributeName] = { name: stat.attributeName, positive: 0, negative: 0, neutral: 0 };
      }
      attributeMap[stat.attributeName][stat.sentiment] = parseInt(stat.count);
    });

    const processedStats = Object.values(attributeMap).map(attr => {
      const total = attr.positive + attr.negative + attr.neutral;
      return {
        ...attr,
        total,
        positiveRate: total > 0 ? Math.round((attr.positive / total) * 100) : 0,
        negativeRate: total > 0 ? Math.round((attr.negative / total) * 100) : 0,
      };
    }).sort((a, b) => b.total - a.total);

    // 특정 속성의 리뷰 원문 (하이라이트 포함)
    let attributeReviews = [];
    if (attribute) {
      attributeReviews = await getReviewsWithDetails(productIds, startDate, endDate, null, attribute);
    }

    return NextResponse.json({ 
      attributeStats: processedStats,
      attributeReviews 
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
