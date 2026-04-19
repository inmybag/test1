import { NextResponse } from 'next/server';
import { getReviewDashboard, getAttributeStatsByProduct, getReviewsWithDetails, getMarketingReport, saveMarketingReport, initDb } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function GET(request) {
  try {
    await initDb();
    const { searchParams } = new URL(request.url);
    const productIdsStr = searchParams.get('productIds');

    if (!productIdsStr) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    const productIds = productIdsStr.split(',').map(Number);
    const force = searchParams.get('force') === 'true';
    // force=true 시 특정 pid만 재생성 (나머지는 캐시 유지)
    const forcePid = searchParams.get('forcePid') ? Number(searchParams.get('forcePid')) : null;

    // 항상 전체 누적 데이터 기준 (날짜 필터 무시)
    const allStart = '2020-01-01';
    const allEnd = new Date().toISOString().slice(0, 10);

    // 각 제품별 캐시 확인 (캐시 키 = String(productId))
    const cachedByPid = {};
    const toGenerateIds = [];

    for (const pid of productIds) {
      const shouldForce = force && (!forcePid || forcePid === pid);
      if (!shouldForce) {
        const cached = await getMarketingReport(String(pid));
        if (cached) {
          const data = typeof cached.report_data === 'object' ? cached.report_data : {};
          cachedByPid[pid] = { ...data, productId: pid, updatedAt: cached.updated_at, cached: true };
          continue;
        }
      }
      toGenerateIds.push(pid);
    }

    // 생성이 필요한 제품이 없으면 캐시 결과만 반환
    if (toGenerateIds.length === 0) {
      const products = productIds.map(pid => cachedByPid[pid] || { productId: pid });
      return NextResponse.json({ data: { products } });
    }

    // 생성 필요한 제품만 데이터 수집
    const dashboard = await getReviewDashboard(toGenerateIds, allStart, allEnd);
    const attrStats = await getAttributeStatsByProduct(toGenerateIds, allStart, allEnd);

    // 제품별 속성 맵
    const attrByProduct = {};
    attrStats.forEach(stat => {
      const pid = String(stat.productId);
      if (!attrByProduct[pid]) attrByProduct[pid] = {};
      const attr = stat.attributeName;
      if (!attrByProduct[pid][attr]) attrByProduct[pid][attr] = { positive: 0, negative: 0, neutral: 0 };
      attrByProduct[pid][attr][stat.sentiment] = parseInt(stat.count);
    });

    // 제품별 리뷰 샘플 (최대 5건)
    const negSampleByProduct = {};
    const posSampleByProduct = {};
    for (const pid of toGenerateIds) {
      const negRevs = await getReviewsWithDetails([pid], allStart, allEnd, 'negative', null, 1);
      const posRevs = await getReviewsWithDetails([pid], allStart, allEnd, 'positive', null, 1);
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

    let generatedData;
    try {
      generatedData = JSON.parse(text);
    } catch (e) {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { generatedData = JSON.parse(match[0]); }
        catch { generatedData = { products: [] }; }
      } else {
        generatedData = { products: [] };
      }
    }

    // productId 보강 및 제품별 독립 캐시 저장
    const now = new Date().toISOString();
    const generatedByPid = {};
    if (generatedData?.products?.length > 0) {
      for (const p of generatedData.products) {
        const d = dashboard.find(d => d.productName?.trim() === p.productName?.trim() && d.brandName?.trim() === p.brandName?.trim())
          || dashboard.find(d => d.productName?.trim() === p.productName?.trim())
          || dashboard.find(d => d.brandName?.trim() === p.brandName?.trim());
        const pid = d?.productId ?? null;
        if (pid) {
          const enriched = { ...p, productId: pid };
          generatedByPid[pid] = { ...enriched, updatedAt: now, cached: false };
          await saveMarketingReport(String(pid), String(pid), allStart, allEnd, enriched);
        }
      }
    }

    // 캐시 + 생성 결과 합쳐서 반환
    const products = productIds.map(pid => cachedByPid[pid] || generatedByPid[pid] || { productId: pid, updatedAt: now, cached: false });
    return NextResponse.json({ data: { products } });
  } catch (error) {
    console.error('Marketing analysis error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
