import { NextResponse } from 'next/server';
import { getAttributeStats, getReviewsWithDetails, initDb } from '@/lib/db';

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

    // 속성별 통계
    const attributeStats = await getAttributeStats(productIds, startDate, endDate);
    
    // VoC 속성별 그룹핑
    const vocMap = {};
    attributeStats.forEach(stat => {
      if (!vocMap[stat.attributeName]) {
        vocMap[stat.attributeName] = {
          name: stat.attributeName,
          positive: { count: 0, keywords: [] },
          negative: { count: 0, keywords: [] }
        };
      }
      if (stat.sentiment === 'positive') {
        vocMap[stat.attributeName].positive.count = parseInt(stat.count);
      } else if (stat.sentiment === 'negative') {
        vocMap[stat.attributeName].negative.count = parseInt(stat.count);
      }
    });

    // 각 속성별 대표 키워드 추출 (리뷰 텍스트에서)
    for (const attrName of Object.keys(vocMap)) {
      const posReviews = await getReviewsWithDetails(productIds, startDate, endDate, 'positive', attrName);
      const negReviews = await getReviewsWithDetails(productIds, startDate, endDate, 'negative', attrName);
      
      // 속성 내 키워드 추출
      const posKeywords = extractKeywordsFromReviews(posReviews, attrName, 'positive');
      const negKeywords = extractKeywordsFromReviews(negReviews, attrName, 'negative');
      
      vocMap[attrName].positive.keywords = posKeywords;
      vocMap[attrName].negative.keywords = negKeywords;
      vocMap[attrName].totalCount = vocMap[attrName].positive.count + vocMap[attrName].negative.count;
    }

    const vocData = Object.values(vocMap).sort((a, b) => b.totalCount - a.totalCount);

    return NextResponse.json({ data: vocData });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function extractKeywordsFromReviews(reviews, attrName, sentiment) {
  const keywordMap = {};
  reviews.forEach(review => {
    const attrs = review.attributes || [];
    attrs.forEach(attr => {
      if (attr.name === attrName && attr.sentiment === sentiment && attr.keyword) {
        keywordMap[attr.keyword] = (keywordMap[attr.keyword] || 0) + 1;
      }
    });
  });
  return Object.entries(keywordMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([keyword, count]) => ({ keyword, count }));
}
