import { NextResponse } from 'next/server';
import { getReviewDashboard, getTopAttributes, getReviewsWithDetails, initDb } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

    const dashboard = await getReviewDashboard(productIds, startDate, endDate);
    const negativeReviews = await getReviewsWithDetails(productIds, startDate, endDate, 'negative');
    const positiveReviews = await getReviewsWithDetails(productIds, startDate, endDate, 'positive');

    const topAttributes = {};
    for (const pid of productIds) {
      topAttributes[pid] = await getTopAttributes([pid], startDate, endDate);
    }

    const productSummaries = dashboard.map(d => {
      const attrs = topAttributes[d.productId] || { positive: [], negative: [] };
      return `
제품: ${d.brandName} ${d.productName}
총 리뷰: ${d.totalReviews}건 | 긍정: ${d.positiveCount}건 | 부정: ${d.negativeCount}건
평균 별점: ${d.avgRating}
TOP 긍정 속성: ${attrs.positive.map(a => a.name).join(', ') || '없음'}
TOP 부정 속성: ${attrs.negative.map(a => a.name).join(', ') || '없음'}
대표 부정 리뷰: ${negativeReviews.filter(r => r.productId === d.productId).slice(0, 3).map(r => r.reviewText).join(' | ') || '없음'}
대표 긍정 리뷰: ${positiveReviews.filter(r => r.productId === d.productId).slice(0, 3).map(r => r.reviewText).join(' | ') || '없음'}
`;
    }).join('\n---\n');

    const prompt = `당신은 화장품/뷰티 브랜드의 마케팅 전략 전문가입니다.
아래 제품들의 리뷰 분석 결과를 바탕으로 마케팅 분석 리포트를 작성해주세요.

${productSummaries}

아래 항목들에 대해 JSON 포맷으로 응답해주세요:
{
  "products": [
    {
      "productName": "제품명",
      "vocItems": [
        {"issue": "VoC 핵심내용 (부정 속성/불만 키워드)", "action": "구체적 대응 액션플랜"}
      ],
      "marketingPoints": {
        "catchphrase": ["추천 캐치프라이즈/키 메시지 1", "추천 캐치프라이즈 2"],
        "usp": ["제품 차별화 포인트(USP) 1", "USP 2"],
        "contentIdeas": ["영상/콘텐츠 제작 아이디어 1", "아이디어 2", "아이디어 3"]
      }
    }
  ]
}

JSON만 출력해주세요. 마크다운 코드블록 없이 순수 JSON만 반환해주세요.`;

    const result = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = result.content[0].text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let marketingData;
    try {
      marketingData = JSON.parse(text);
    } catch (e) {
      marketingData = { products: [], rawText: text };
    }

    return NextResponse.json({ data: marketingData });
  } catch (error) {
    console.error('Marketing analysis error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
