/**
 * 리뷰 백필 크롤러 - Puppeteer 세션으로 올리브영 API 호출
 * 사용법: node scripts/crawl-reviews-backfill.js
 */
const puppeteer = require('puppeteer');
const axios = require('axios');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const { createPool } = require('@vercel/postgres');
const Anthropic = require('@anthropic-ai/sdk').default;

const pool = createPool({ connectionString: process.env.POSTGRES_URL });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// PostgreSQL JSONB 오류 방지를 위한 유효하지 않은 유니코드 제거 함수
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
            .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

function getDateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

const CUTOFF_DATE = getDateDaysAgo(30);
console.log(`[백필] 수집 기준: ${CUTOFF_DATE} 이후 리뷰`);

function parseOliveDate(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  return null;
}

const SKIN_MAP = {
  'A01': '건성', 'A02': '복합성', 'A03': '지성', 'A04': '중성',
  'B01': '쿨톤', 'B02': '웜톤', 'B03': '중립톤',
  'C01': '주름', 'C02': '탄력', 'C03': '모공', 'C04': '건조', 'C05': '민감', 'C06': '트러블'
};

function decodeSkin(profile) {
  if (!profile) return {};
  const info = {};
  if (profile.skinType) info['피부타입'] = SKIN_MAP[profile.skinType] || profile.skinType;
  if (profile.skinTone) info['피부톤'] = SKIN_MAP[profile.skinTone] || profile.skinTone;
  if (profile.skinTrouble?.length) info['피부고민'] = profile.skinTrouble.map(t => SKIN_MAP[t] || t).join(', ');
  return info;
}

/**
 * 리뷰 배치를 분석하고 DB에 즉시 저장
 */
async function analyzeAndSaveBatch(productId, reviews, platformLabel) {
  if (!reviews.length) return 0;
  
  const texts = reviews.map((r, idx) => `[${idx}] ${sanitizeString(r.review_text)}`).join('\n');

  const prompt = `다음은 화장품 리뷰들입니다. 각 리뷰의 감성을 분석해주세요.

${texts}

각 리뷰에 대해:
1. sentiment: "positive"/"negative"/"neutral"
2. sentiment_score: 0~1 (1=가장긍정)
3. attributes: [{name, sentiment, keyword}] - name은 "커버력","밀착력","지속력","보습력","색상","가성비","발림성","자극","각질","용량","밝기" 등 자동 추출
4. source_highlight: [{text, attribute, sentiment}] - 원문에서 속성이 추출된 구문

JSON 배열로만 응답. 코드블록 없이:
[{"index":0,"sentiment":"positive","sentiment_score":0.9,"attributes":[{"name":"커버력","sentiment":"positive","keyword":"잘 커버"}],"source_highlight":[{"text":"잡티가 잘 커버","attribute":"커버력","sentiment":"positive"}]}]`;

  let analyzed = [];
  let success = false;
  let retries = 3;

  while (!success && retries > 0) {
    try {
      const res = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = res.content[0].text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const analyses = JSON.parse(text);

      for (const a of analyses) {
        const r = reviews[a.index];
        if (r) {
          analyzed.push({
            ...r,
            sentiment: a.sentiment,
            sentiment_score: a.sentiment_score,
            attributes: (a.attributes || []).map(attr => ({ ...attr, name: sanitizeString(attr.name), keyword: sanitizeString(attr.keyword) })),
            source_highlight: (a.source_highlight || []).map(sh => ({ ...sh, text: sanitizeString(sh.text), attribute: sanitizeString(sh.attribute) }))
          });
        }
      }
      success = true;
    } catch (e) {
      if (e.status === 429 || e.message?.includes('rate_limit')) {
        console.log(`    [Claude] 속도 제한. 대기 후 재시도... (남은 횟수: ${retries - 1})`);
        await new Promise(r => setTimeout(r, 15000));
        retries--;
      } else {
        console.error('    [Claude] 오류:', e.message);
        analyzed = reviews.map(r => ({ ...r, sentiment: 'neutral', sentiment_score: 0.5, attributes: [], source_highlight: [] }));
        success = true;
      }
    }
  }

  if (!success) {
    analyzed = reviews.map(r => ({ ...r, sentiment: 'neutral', sentiment_score: 0.5, attributes: [], source_highlight: [] }));
  }

  // DB 저장
  const dbClient = await pool.connect();
  let savedCount = 0;
  try {
    for (const r of analyzed) {
      try {
        await dbClient.sql`
          INSERT INTO product_reviews (product_id, review_date, rating, review_text, reviewer_nickname, extra_info, media_urls, sentiment, sentiment_score, attributes, source_highlight)
          VALUES (${productId}, ${r.review_date}, ${r.rating}, ${r.review_text}, ${r.reviewer_nickname},
            ${JSON.stringify(r.extra_info || {})}, ${JSON.stringify(r.media_urls || [])},
            ${r.sentiment}, ${r.sentiment_score}, ${JSON.stringify(r.attributes || [])}, ${JSON.stringify(r.source_highlight || [])}
          )
          ON CONFLICT (product_id, review_date, (COALESCE(reviewer_nickname, '')), (LEFT(COALESCE(review_text, ''), 100))) 
          DO UPDATE SET 
            media_urls = EXCLUDED.media_urls,
            extra_info = EXCLUDED.extra_info,
            attributes = EXCLUDED.attributes,
            source_highlight = EXCLUDED.source_highlight,
            rating = EXCLUDED.rating`;
        savedCount++;
      } catch (e) {
        console.error(`    [DB] ${platformLabel} 저장 오류: ${e.message}`);
      }
    }
  } finally {
    dbClient.release();
  }
  return savedCount;
}

async function main() {
  if (!process.env.POSTGRES_URL) { console.error('POSTGRES_URL required'); process.exit(1); }

  const targetProductId = process.argv[2];

  const client = await pool.connect();
  let products;
  try {
    if (targetProductId) {
      const { rows } = await client.sql`SELECT id, platform, page_url, brand_name, product_name, thumbnail_url FROM review_products WHERE is_active = TRUE AND id = ${targetProductId}`;
      products = rows;
    } else {
      const { rows } = await client.sql`SELECT id, platform, page_url, brand_name, product_name, thumbnail_url FROM review_products WHERE is_active = TRUE`;
      products = rows;
    }
  } finally { client.release(); }

  if (!products?.length) { console.log('[백필] 등록된 제품 없음.'); process.exit(0); }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const product of products) {
    let allCollectedReviews = [];
    
    // 1. 플랫폼별 리뷰 수집 (메모리 로드)
    if (product.platform === 'cafe24') {
      const urlObj = new URL(product.page_url);
      const host = urlObj.hostname;
      let productNo = '';
      const pathMatch = urlObj.pathname.match(/\/product\/[^\/]+\/(\d+)/);
      if (pathMatch) productNo = pathMatch[1];
      else productNo = urlObj.searchParams.get('product_no');

      if (!productNo) {
        console.log(`[백필] product_no 추출 실패. URL: ${product.page_url}`);
        continue;
      }
      console.log(`\n========================================`);
      console.log(`[백필] (Cafe24) ${product.brand_name} ${product.product_name} (${productNo})`);
      console.log(`========================================`);

      let pageNum = 1;
      while (true) {
        console.log(`  [API] 페이지 ${pageNum} 호출 중...`);
        try {
          const res = await axios.get(`https://review1.cre.ma/api/${host}/reviews?product_code=${productNo}&sort=recent&widget_id=2&page=${pageNum}`);
          const reviews = res.data.reviews || [];
          if (reviews.length === 0) break;

          if (!product.thumbnail_url && reviews[0].product_image_url) {
            const thumb = reviews[0].product_image_url;
            const dc = await pool.connect();
            try { await dc.sql`UPDATE review_products SET thumbnail_url = ${thumb} WHERE id = ${product.id}`; } finally { dc.release(); }
            product.thumbnail_url = thumb;
          }

          let pageEnd = false;
          for (const raw of reviews) {
            let reviewDate = raw.created_at ? raw.created_at.split('T')[0] : null;
            if (!reviewDate || reviewDate < CUTOFF_DATE) { pageEnd = true; continue; }

            let mediaUrls = [];
            if (raw.images?.length) mediaUrls = [...mediaUrls, ...raw.images.map(img => img.url).filter(u => u)];
            if (raw.videos?.length) mediaUrls = [...mediaUrls, ...raw.videos.map(vid => vid.url).filter(u => u)];
            
            const skinInfo = raw.evaluation_properties ? 
              raw.evaluation_properties.reduce((acc, prop) => ({...acc, [prop.name]: prop.value}), {}) : {};

            allCollectedReviews.push({
              review_text: raw.filtered_message || raw.message || '',
              rating: raw.score || 5,
              reviewer_nickname: raw.user_display_name || '익명',
              review_date: reviewDate,
              extra_info: { ...skinInfo, option: raw.options || '' },
              media_urls: mediaUrls
            });
          }
          if (pageEnd) break;
        } catch (e) { break; }
        if (pageNum >= 20) break;
        pageNum++;
        await new Promise(r => setTimeout(r, 800));
      }
    } else if (product.platform === 'naver') {
      console.log(`\n========================================`);
      console.log(`[백필] (Naver) ${product.brand_name} ${product.product_name}`);
      console.log(`========================================`);

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
      let naverPayload = null;
      page.on('request', req => {
        if (req.url().includes('query-pages') && req.method() === 'POST' && !naverPayload) {
          naverPayload = JSON.parse(req.postData());
        }
      });

      await page.goto(product.page_url, { waitUntil: 'networkidle2', timeout: 60000 });
      if (!product.thumbnail_url) {
        const thumb = await page.evaluate(() => document.querySelector('meta[property="og:image"]')?.content);
        if (thumb) {
          const dc = await pool.connect();
          try { await dc.sql`UPDATE review_products SET thumbnail_url = ${thumb} WHERE id = ${product.id}`; } finally { dc.release(); }
          product.thumbnail_url = thumb;
        }
      }

      await page.evaluate(() => window.scrollBy(0, 2000));
      await new Promise(r => setTimeout(r, 2000));
      await page.evaluate(() => {
        const tabs = document.querySelectorAll('a, ul > li > a');
        for(const el of tabs) {
          if(el.textContent && el.textContent.includes('리뷰') && el.textContent.match(/[0-9,]+/)) {
            el.click(); break;
          }
        }
      });
      for (let i = 0; i < 10; i++) { if (naverPayload) break; await new Promise(r => setTimeout(r, 1000)); }
      if (!naverPayload) { await page.close(); continue; }

      let pageNum = 1;
      while (true) {
        console.log(`  [API] 페이지 ${pageNum} 호출 중...`);
        const apiResult = await page.evaluate(async (payload, pageNum) => {
          try {
            payload.page = pageNum;
            payload.pageSize = 20;
            payload.reviewSearchSortType = 'REVIEW_CREATE_DATE_DESC';
            const res = await fetch('/n/v1/contents/reviews/query-pages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            return await res.json();
          } catch(e) { return { error: e.message }; }
        }, naverPayload, pageNum);

        if (apiResult.error || !apiResult.contents?.length) break;
        
        let pageEnd = false;
        for (const raw of apiResult.contents) {
          let reviewDate = raw.createDate ? raw.createDate.split('T')[0] : null;
          if (!reviewDate || reviewDate < CUTOFF_DATE) { pageEnd = true; continue; }
          
          let mediaUrls = raw.reviewAttaches ? raw.reviewAttaches.map(a => a.attachPath) : [];
          if (raw.reviewVideos?.length) {
            mediaUrls = [...mediaUrls, ...raw.reviewVideos.map(v => v.videoUrl || v.apiUrl).filter(u => u)];
          }

          allCollectedReviews.push({
            review_text: raw.reviewContent || '',
            rating: raw.reviewScore || 5,
            reviewer_nickname: raw.writerMemberId || '익명',
            review_date: reviewDate,
            extra_info: { option: raw.productOptionContent || '' },
            media_urls: mediaUrls
          });
        }
        if (pageEnd) break;
        if (pageNum >= 10) break;
        pageNum++;
        await new Promise(r => setTimeout(r, 800));
      }
      await page.close();
    } else if (product.platform === 'oliveyoung') {
      const goodsMatch = product.page_url.match(/goodsNo=([A-Za-z0-9]+)/);
      if (!goodsMatch) continue;
      const goodsNo = goodsMatch[1];
      console.log(`\n========================================`);
      console.log(`[백필] (OliveYoung) ${product.brand_name} ${product.product_name} (${goodsNo})`);
      console.log(`========================================`);

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
      await page.goto(product.page_url, { waitUntil: 'networkidle2', timeout: 60000 });
      if (!product.thumbnail_url) {
        const thumb = await page.evaluate(() => document.querySelector('meta[property="og:image"]')?.content);
        if (thumb) {
          const dc = await pool.connect();
          try { await dc.sql`UPDATE review_products SET thumbnail_url = ${thumb} WHERE id = ${product.id}`; } finally { dc.release(); }
        }
      }

      let pageNum = 0;
      let reachedCutoff = false;
      while (!reachedCutoff) {
        console.log(`  [API] 페이지 ${pageNum + 1} 호출 중...`);
        const apiResult = await page.evaluate(async (goodsNo, pageNum) => {
          try {
            const res = await fetch('https://m.oliveyoung.co.kr/review/api/v2/reviews/cursor', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ goodsNumber: goodsNo, page: pageNum, size: 20, sortType: 'LATEST_DESC', reviewType: 'ALL' })
            });
            return await res.json();
          } catch (e) { return { error: e.message }; }
        }, goodsNo, pageNum);

        if (apiResult.error || apiResult.status !== 'SUCCESS' || !apiResult.data?.goodsReviewList?.length) break;

        for (const raw of apiResult.data.goodsReviewList) {
          let reviewDate = parseOliveDate(raw.createdDateTime);
          if (!reviewDate || reviewDate < CUTOFF_DATE) { reachedCutoff = true; break; }

          const mediaUrls = (raw.photoReviewList || []).map(p => {
            let fullPath = p.imagePath;
            if (!fullPath.startsWith('http')) {
              if (!fullPath.includes('uploads/')) fullPath = `uploads/images/goods/review/${fullPath}`;
              fullPath = `https://image.oliveyoung.co.kr/${fullPath}`;
            }
            return fullPath.includes('?') ? fullPath : `${fullPath}?RS=500x0&q=85&sf=webp`;
          });

          allCollectedReviews.push({
            review_text: raw.content || '',
            rating: raw.reviewScore,
            reviewer_nickname: raw.profileDto?.memberNickname || '',
            review_date: reviewDate,
            extra_info: { ...decodeSkin(raw.profileDto), option: raw.goodsDto?.optionName || '' },
            media_urls: mediaUrls
          });
        }
        if (pageNum >= 15) break;
        pageNum++;
        await new Promise(r => setTimeout(r, 800));
      }
      await page.close();
    } else {
      console.log(`[백필] 미지원 플랫폼: ${product.platform}`);
      continue;
    }

    // 2. 수집된 리뷰 실시간 분석 및 저장 (배치 처리)
    console.log(`\n  [백필] 총 ${allCollectedReviews.length}건 수집 완료. 분석 및 저장 시작...`);
    if (allCollectedReviews.length > 0) {
      const batchSize = 10;
      let totalSaved = 0;
      for (let i = 0; i < allCollectedReviews.length; i += batchSize) {
        const batch = allCollectedReviews.slice(i, i + batchSize);
        console.log(`  [Claude] ${i + 1}~${Math.min(i + batchSize, allCollectedReviews.length)} 분석 중...`);
        const savedCount = await analyzeAndSaveBatch(product.id, batch, product.platform);
        totalSaved += savedCount;
        console.log(`  [DB] ${totalSaved} / ${allCollectedReviews.length} 저장 완료`);
        // Claude 속도 제한 방지를 위한 지연
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  await browser.close();
  console.log(`\n[백필] ===== 전체 완료 =====`);
  process.exit(0);
}

main().catch(e => { console.error('[백필] 치명적 오류:', e); process.exit(1); });
