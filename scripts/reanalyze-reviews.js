const { createPool } = require('@vercel/postgres');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const pool = createPool({ connectionString: process.env.POSTGRES_URL });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function analyzeWithGemini(reviews) {
  if (!reviews.length) return [];
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const batchSize = 10;
  const result = [];

  for (let i = 0; i < reviews.length; i += batchSize) {
    const batch = reviews.slice(i, i + batchSize);
    const texts = batch.map((r, idx) => `[${idx}] ${r.review_text}`).join('\n');
    console.log(`  [Gemini] ${i + 1}~${Math.min(i + batchSize, reviews.length)} / ${reviews.length} 분석 중...`);

    const prompt = `다음은 화장품 리뷰들입니다. 각 리뷰를 정밀하게 분석하여 JSON 배열로 응답해주세요.

분석 기준:
1. sentiment: "positive"(긍정), "negative"(부정), "neutral"(중립) 중 선택
   - neutral 판단 기준: 
     - 긍정과 부정이 본문에 모두 포함되어 있어 어느 한쪽으로 치우치지 않을 때
     - 제품의 효과나 느낌에 대한 판단 없이 순수하게 사실(배송 완료, 유통기한 등)만 나열할 때
     - "보통이에요", "무난해요" 등 감정적 동요가 없는 표현만 있을 때
2. sentiment_score: 0~1 사이의 실수 (1에 가까울수록 아주 긍정, 0에 가까울수록 아주 부정, 0.5는 중립)
3. attributes: 리뷰에서 언급된 주요 속성을 "커버력", "발림성", "지속력", "색상/밝기", "보습/촉촉함", "자극/민감도", "가성비", "향", "용기/디자인" 등에서 자동 추출하여 리스트로 반환. 
   - [{ "name": "속성명", "sentiment": "positive/negative/neutral", "keyword": "관련 구문" }]
4. source_highlight: 리뷰 원문에서 특정 속성이나 감성이 명확히 드러나는 구문을 추출.
   - [{ "text": "추출된 문구", "attribute": "관련 속성명", "sentiment": "positive/negative/neutral" }]

리뷰들:
${texts}

JSON 배열로만 응답하세요. 마크다운 코드블록이나 설명 없이 순수 JSON만 반환하세요:
[{"index":0,"sentiment":"positive","sentiment_score":0.9,"attributes":[{"name":"지속력","sentiment":"positive","keyword":"오래 가요"}],"source_highlight":[{"text":"하루종일 지워지지 않고 오래 가요","attribute":"지속력","sentiment":"positive"}]}]`;

    try {
      const res = await model.generateContent(prompt);
      const text = res.response.text().trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const analyses = JSON.parse(text);
      for (const a of analyses) {
        const r = batch[a.index];
        if (r) result.push({ ...r, sentiment: a.sentiment, sentiment_score: a.sentiment_score, attributes: a.attributes || [], source_highlight: a.source_highlight || [] });
      }
    } catch (e) {
      console.error('  [Gemini] 오류:', e.message);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return result;
}

async function main() {
  const client = await pool.connect();
  try {
    console.log('[재분석] 최근 리뷰 20건을 가져와 재분석을 시도합니다...');
    const { rows: reviews } = await client.sql`
      SELECT id, review_text 
      FROM product_reviews 
      ORDER BY created_at DESC 
      LIMIT 20
    `;

    if (reviews.length === 0) {
      console.log('[재분석] 데이터가 없습니다.');
      return;
    }

    const analyzed = await analyzeWithGemini(reviews);
    console.log(`[재분석] ${analyzed.length}건 분석 완료. DB 업데이트 중...`);

    for (const r of analyzed) {
      await client.sql`
        UPDATE product_reviews 
        SET sentiment = ${r.sentiment},
            sentiment_score = ${r.sentiment_score},
            attributes = ${JSON.stringify(r.attributes)},
            source_highlight = ${JSON.stringify(r.source_highlight)}
        WHERE id = ${r.id}
      `;
    }
    console.log('[재분석] 완료.');
  } finally {
    client.release();
  }
}

main().catch(console.error);
