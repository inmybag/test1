/**
 * 기존 수집된 리뷰를 Gemini 2.0 Flash Lite로 재분석
 * 사용법:
 *   node scripts/re-analyze-reviews.js           # 미분석 리뷰만 (attributes = [])
 *   node scripts/re-analyze-reviews.js --force   # 전체 재분석
 *   node scripts/re-analyze-reviews.js --product 3  # 특정 제품만
 */
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { createPool } = require('@vercel/postgres');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const pool = createPool({ connectionString: process.env.POSTGRES_URL });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const FORCE = process.argv.includes('--force');
const PRODUCT_IDX = process.argv.indexOf('--product');
const TARGET_PRODUCT_ID = PRODUCT_IDX >= 0 ? process.argv[PRODUCT_IDX + 1] : null;

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
            .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

async function analyzeAndUpdateBatch(reviews) {
  if (!reviews.length) return 0;

  const texts = reviews.map((r, idx) => `[${idx}] ${sanitizeString(r.review_text)}`).join('\n');

  const prompt = `다음은 화장품 리뷰들입니다. 각 리뷰의 감성을 분석해주세요.

${texts}

각 리뷰에 대해:
1. sentiment: "positive"/"negative"/"neutral"
2. sentiment_score: 0~1 (1=가장긍정)
3. attributes: [{name, sentiment, keyword}] - name은 "커버력","밀착력","지속력","보습력","색상","가성비","발림성","자극","각질","용량","밝기","사용감","향","흡수력","텍스처","보습","탄력" 등 자동 추출
4. source_highlight: [{text, attribute, sentiment}] - 원문에서 속성이 추출된 구문

JSON 배열로만 응답. 코드블록 없이:
[{"index":0,"sentiment":"positive","sentiment_score":0.9,"attributes":[{"name":"커버력","sentiment":"positive","keyword":"잘 커버"}],"source_highlight":[{"text":"잡티가 잘 커버","attribute":"커버력","sentiment":"positive"}]}]`;

  let retries = 3;
  while (retries > 0) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const analyses = JSON.parse(text);

      const dbClient = await pool.connect();
      let savedCount = 0;
      try {
        for (const a of analyses) {
          const r = reviews[a.index];
          if (!r) continue;
          const attributes = (a.attributes || []).map(attr => ({
            ...attr,
            name: sanitizeString(attr.name),
            keyword: sanitizeString(attr.keyword),
          }));
          const sourceHighlight = (a.source_highlight || []).map(sh => ({
            ...sh,
            text: sanitizeString(sh.text),
            attribute: sanitizeString(sh.attribute),
          }));
          try {
            await dbClient.query(
              `UPDATE product_reviews SET sentiment=$1, sentiment_score=$2, attributes=$3, source_highlight=$4 WHERE id=$5`,
              [a.sentiment, a.sentiment_score, JSON.stringify(attributes), JSON.stringify(sourceHighlight), r.id]
            );
            savedCount++;
          } catch (e) {
            console.error(`  [DB] 업데이트 오류 id=${r.id}: ${e.message}`);
          }
        }
      } finally {
        dbClient.release();
      }
      return savedCount;
    } catch (e) {
      if (e.status === 429 || e.message?.includes('quota') || e.message?.includes('rate') || e.message?.includes('Resource') || e.message?.includes('RESOURCE')) {
        console.log(`  [Gemini] 속도 제한 (${e.message?.slice(0, 80)}). 60초 대기 후 재시도... (남은: ${retries - 1})`);
        await new Promise(r => setTimeout(r, 60000));
        retries--;
      } else {
        console.error('  [Gemini] 오류:', e.message);
        console.error('  [Gemini] 오류 상세:', JSON.stringify(e, null, 2));
        return 0;
      }
    }
  }
  return 0;
}

async function main() {
  if (!process.env.POSTGRES_URL) { console.error('POSTGRES_URL 필요'); process.exit(1); }
  if (!process.env.GEMINI_API_KEY) { console.error('GEMINI_API_KEY 필요'); process.exit(1); }

  const client = await pool.connect();
  let reviews;
  try {
    let query = `SELECT id, product_id, review_text FROM product_reviews WHERE review_text IS NOT NULL AND review_text != ''`;
    const params = [];

    if (TARGET_PRODUCT_ID) {
      params.push(TARGET_PRODUCT_ID);
      query += ` AND product_id = $${params.length}`;
    }
    if (!FORCE) {
      query += ` AND (attributes IS NULL OR attributes = '[]'::jsonb)`;
    }
    query += ` ORDER BY id ASC`;

    const { rows } = await client.query(query, params);
    reviews = rows;
  } finally {
    client.release();
  }

  console.log(`\n[재분석] 대상 리뷰: ${reviews.length}건 (${FORCE ? '전체 강제 재분석' : '미분석만'}) | 모델: gemini-2.5-flash-lite`);
  if (!reviews.length) { console.log('[재분석] 분석할 리뷰 없음.'); process.exit(0); }

  const batchSize = 15;
  let total = 0;
  for (let i = 0; i < reviews.length; i += batchSize) {
    const batch = reviews.slice(i, i + batchSize);
    console.log(`  [Gemini] ${i + 1}~${Math.min(i + batchSize, reviews.length)} / ${reviews.length} 분석 중...`);
    const count = await analyzeAndUpdateBatch(batch);
    total += count;
    console.log(`  [DB] ${total} / ${reviews.length} 완료`);
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log(`\n[재분석] 완료: ${total}건 업데이트`);
  process.exit(0);
}

main().catch(e => { console.error('[재분석] 오류:', e); process.exit(1); });
