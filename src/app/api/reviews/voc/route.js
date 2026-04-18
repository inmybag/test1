import { NextResponse } from 'next/server';
import { getAttributeStatsByProduct, getReviewsWithDetails, initDb } from '@/lib/db';

export async function GET(request) {
  try {
    await initDb();
    const { searchParams } = new URL(request.url);
    const productIdsStr = searchParams.get('productIds');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!productIdsStr || !startDate || !endDate) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    const productIds = productIdsStr.split(',').map(Number);

    // 제품별 속성 통계
    const rawStats = await getAttributeStatsByProduct(productIds, startDate, endDate);

    // 제품 × 속성 맵 구성
    const keyMap = {};
    rawStats.forEach(stat => {
      const key = `${stat.productId}__${stat.attributeName}`;
      if (!keyMap[key]) {
        keyMap[key] = {
          productId: stat.productId,
          productName: stat.productName,
          brandName: stat.brandName,
          attributeName: stat.attributeName,
          positive: { count: 0, keywords: [] },
          neutral: { count: 0, keywords: [] },
          negative: { count: 0, keywords: [] },
        };
      }
      const cnt = parseInt(stat.count);
      if (stat.sentiment === 'positive') keyMap[key].positive.count = cnt;
      else if (stat.sentiment === 'neutral') keyMap[key].neutral.count = cnt;
      else if (stat.sentiment === 'negative') keyMap[key].negative.count = cnt;
    });

    // 키워드 추출
    for (const item of Object.values(keyMap)) {
      const [posReviews, neuReviews, negReviews] = await Promise.all([
        getReviewsWithDetails([item.productId], startDate, endDate, 'positive', item.attributeName),
        getReviewsWithDetails([item.productId], startDate, endDate, 'neutral', item.attributeName),
        getReviewsWithDetails([item.productId], startDate, endDate, 'negative', item.attributeName),
      ]);
      item.positive.keywords = extractKeywords(posReviews, item.attributeName, 'positive');
      item.neutral.keywords = extractKeywords(neuReviews, item.attributeName, 'neutral');
      item.negative.keywords = extractKeywords(negReviews, item.attributeName, 'negative');

      const total = item.positive.count + item.neutral.count + item.negative.count;
      item.totalCount = total;
      item.positiveRate = total > 0 ? Math.round((item.positive.count / total) * 100) : 0;
      item.neutralRate = total > 0 ? Math.round((item.neutral.count / total) * 100) : 0;
      item.negativeRate = total > 0 ? Math.round((item.negative.count / total) * 100) : 0;
    }

    const vocData = Object.values(keyMap)
      .filter(item => item.totalCount > 0)
      .sort((a, b) => b.totalCount - a.totalCount);

    return NextResponse.json({ data: vocData });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function extractKeywords(reviews, attrName, sentiment) {
  const kwMap = {};
  reviews.forEach(review => {
    (review.attributes || []).forEach(attr => {
      if (attr.name === attrName && attr.sentiment === sentiment && attr.keyword) {
        kwMap[attr.keyword] = (kwMap[attr.keyword] || 0) + 1;
      }
    });
  });
  return Object.entries(kwMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([keyword, count]) => ({ keyword, count }));
}
