import { NextResponse } from 'next/server';
import { getReviewDashboard, getTopAttributes, getReviewsWithDetails, initDb } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
표본 부정 리뷰: ${negativeReviews.filter(r => r.productId === d.productId).slice(0, 3).map(r => r.reviewText).join(' | ') || '없음'}
표본 긍정 리뷰: ${positiveReviews.filter(r => r.productId === d.productId).slice(0, 3).map(r => r.reviewText).join(' | ') || '없음'}
`;
    }).join('\n---\n');

    const prompt = `당신은 뷰티/화장품 산업 전문 마케팅 전략 컨설턴트입니다. 
제공된 리뷰 분석 데이터를 기반으로 브랜드 성장을 위한 심층 마케팅 분석 리포트를 생성해주세요.

데이터:
${productSummaries}

다음 구조의 JSON으로만 응답해주세요:
{
  "products": [
    {
      "productName": "제품명",
      "brandName": "브랜드명",
      "summary": "핵심 요약 한줄",
      "persona": {
        "target": "주요 타겟 고객층 설명",
        "painPoint": "그들이 해결하고자 하는 핵심 고민"
      },
      "strengths": ["강점 1", "강점 2"],
      "weaknesses": ["약점 1", "약점 2"],
      "actionPlan": [
        {"area": "제품 개선/운영", "task": "구체적 과제"},
        {"area": "마케팅/광고", "task": "구체적 과제"}
      ],
      "marketingHooks": {
        "catchphrases": ["카피라이트 1", "카피라이트 2"],
        "contentConcepts": ["영상/화보 컨셉 1", "체험단 가이드 포인트"]
      }
    }
  ]
}

설명 없이 순수 JSON 배열만 출력하세요.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();
    
    // JSON 추출 (마크다운 가드 제거)
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    let marketingData;
    try {
      marketingData = JSON.parse(text);
    } catch (e) {
      console.error('JSON Parse Error:', text);
      marketingData = { products: [], error: '데이터 구조 생성 중 오류가 발생했습니다.' };
    }

    return NextResponse.json({ data: marketingData });
  } catch (error) {
    console.error('Marketing analysis error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
