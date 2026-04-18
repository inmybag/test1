import { NextResponse } from 'next/server';
import { getReviewDashboard, getAttributeStatsByProduct, getReviewsWithDetails, getMarketingReport, saveMarketingReport, initDb } from '@/lib/db';
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
    const force = searchParams.get('force') === 'true';

    // 캐시 키: 정렬된 productIds + 기간
    const reportKey = [...productIds].sort().join(',') + `|${startDate}|${endDate}`;

    // 캐시 조회 (force=true 이면 스킵)
    if (!force) {
      const cached = await getMarketingReport(reportKey);
      if (cached) {
        return NextResponse.json({ data: cached.report_data, cached: true, updatedAt: cached.updated_at });
      }
    }

    // 제품별 대시보드 요약
    const dashboard = await getReviewDashboard(productIds, startDate, endDate);

    // 제품 × 속성 VoC 데이터 (긍/부정 키워드 포함)
    const attrStats = await getAttributeStatsByProduct(productIds, startDate, endDate);

    // 제품별 속성 맵 구성
    const attrByProduct = {};
    attrStats.forEach(stat => {
      const pid = String(stat.productId);
      if (!attrByProduct[pid]) attrByProduct[pid] = {};
      const attr = stat.attributeName;
      if (!attrByProduct[pid][attr]) {
        attrByProduct[pid][attr] = { positive: 0, negative: 0, neutral: 0 };
      }
      attrByProduct[pid][attr][stat.sentiment] = parseInt(stat.count);
    });

    // 제품별 부정 리뷰 샘플 (최대 5건)
    const negSampleByProduct = {};
    const posSampleByProduct = {};
    for (const pid of productIds) {
      const negRevs = await getReviewsWithDetails([pid], startDate, endDate, 'negative', null, 1);
      const posRevs = await getReviewsWithDetails([pid], startDate, endDate, 'positive', null, 1);
      negSampleByProduct[pid] = negRevs.slice(0, 5).map(r => r.reviewText?.slice(0, 150)).filter(Boolean);
      posSampleByProduct[pid] = posRevs.slice(0, 5).map(r => r.reviewText?.slice(0, 150)).filter(Boolean);
    }

    // 프롬프트 컨텍스트 구성
    const productSummaries = dashboard.map(d => {
      const pid = String(d.productId);
      const attrs = attrByProduct[pid] || {};
      const total = parseInt(d.totalReviews) || 0;
      const pos = parseInt(d.positiveCount) || 0;
      const neg = parseInt(d.negativeCount) || 0;

      // 속성별 긍/부정 정리
      const attrLines = Object.entries(attrs)
        .map(([name, counts]) => {
          const t = counts.positive + counts.negative + counts.neutral;
          const posRate = t > 0 ? Math.round((counts.positive / t) * 100) : 0;
          const negRate = t > 0 ? Math.round((counts.negative / t) * 100) : 0;
          return `  - ${name}: 긍정 ${posRate}% / 부정 ${negRate}% (총 ${t}건)`;
        })
        .sort((a, b) => {
          const ta = Object.values(attrs[a.match(/- (.+?):/)?.[1]] || {}).reduce((s, v) => s + v, 0);
          const tb = Object.values(attrs[b.match(/- (.+?):/)?.[1]] || {}).reduce((s, v) => s + v, 0);
          return tb - ta;
        })
        .slice(0, 12)
        .join('\n');

      return `
=== ${d.brandName} ${d.productName} ===
총 리뷰: ${total}건 | 긍정: ${pos}건(${total > 0 ? Math.round(pos/total*100) : 0}%) | 부정: ${neg}건(${total > 0 ? Math.round(neg/total*100) : 0}%) | 평균 별점: ${d.avgRating}

[속성별 VoC 분포]
${attrLines || '  (속성 데이터 없음)'}

[긍정 리뷰 샘플]
${(posSampleByProduct[d.productId] || []).map((t, i) => `  ${i+1}. "${t}"`).join('\n') || '  없음'}

[부정 리뷰 샘플]
${(negSampleByProduct[d.productId] || []).map((t, i) => `  ${i+1}. "${t}"`).join('\n') || '  없음'}`;
    }).join('\n\n');

    const prompt = `당신은 K-뷰티 브랜드 전문 마케팅 전략 컨설턴트입니다.
아래 실제 소비자 리뷰 VoC 데이터를 분석하여 제품별 AI 전략 리포트를 작성해주세요.

${productSummaries}

각 제품에 대해 다음 항목을 포함한 JSON을 반환하세요:

{
  "products": [
    {
      "productName": "제품명",
      "brandName": "브랜드명",
      "summary": "VoC 기반 핵심 한줄 진단 (소비자가 실제로 느끼는 이 제품의 본질)",
      "vocImprovements": [
        {
          "issue": "부정 VoC에서 도출한 핵심 불만 이슈 (구체적으로)",
          "suggestion": "제품 개선 또는 운영 개선 제안 (실행 가능하게)",
          "priority": "high | mid | low"
        }
      ],
      "uspPoints": [
        "긍정 VoC에서 도출한 핵심 소구포인트 (마케팅에 바로 쓸 수 있게 구체적으로)"
      ],
      "catchphrases": [
        "USP 기반 광고 카피라이트 (타겟 감성에 맞게, 3초 후킹 가능한 문장)"
      ],
      "contentIdeas": [
        {
          "format": "영상 | 화보 | 체험단 | SNS",
          "concept": "콘텐츠 컨셉 설명",
          "hook": "초반 3초 후킹 텍스트 또는 썸네일 카피",
          "storyboard": "30초~60초 콘티: 씬1(도입/후킹) → 씬2(문제제시/공감) → 씬3(제품등장/솔루션) → 씬4(결과/CTA) 각 씬을 1~2문장으로 설명"
        }
      ]
    }
  ]
}

요구사항:
- vocImprovements: 3~5개, 실제 리뷰 내용 기반, 우선순위 구분
- uspPoints: 3~4개, 경쟁 차별화 관점
- catchphrases: 3개, 한국어 감성 카피
- contentIdeas: 3개, 실행 가능한 컨셉 + 30~60초 콘티(씬별 구체적 설명)
- 설명 없이 순수 JSON만 출력`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const result = await model.generateContent(prompt);
    let text = result.response.text().trim()
      .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let marketingData;
    try {
      marketingData = JSON.parse(text);
    } catch (e) {
      // JSON 블록만 추출 시도
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { marketingData = JSON.parse(match[0]); }
        catch { marketingData = { products: [] }; }
      } else {
        marketingData = { products: [] };
      }
    }

    // productId 보강 (dashboard 데이터에서 매핑)
    if (marketingData?.products?.length > 0) {
      marketingData.products = marketingData.products.map(p => {
        const d = dashboard.find(d => d.productName === p.productName);
        return { ...p, productId: d?.productId ?? null };
      });
      await saveMarketingReport(reportKey, productIdsStr, startDate, endDate, marketingData);
    }

    const now = new Date().toISOString();
    return NextResponse.json({ data: marketingData, cached: false, updatedAt: now });
  } catch (error) {
    console.error('Marketing analysis error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
