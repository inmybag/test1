/**
 * 리뷰 백필 크롤러 - Puppeteer 세션으로 올리브영 API 호출
 * 사용법: node scripts/crawl-reviews-backfill.js
 */
const puppeteer = require('puppeteer');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteerExtra.use(StealthPlugin());
const axios = require('axios');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const { createPool } = require('@vercel/postgres');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const pool = createPool({ connectionString: process.env.POSTGRES_URL });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function getDateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

const CUTOFF_DATE = getDateDaysAgo(30);
console.log(`[일일크롤러] 수집 기준: ${CUTOFF_DATE} 이후 리뷰`);

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

// Cafe24 네이티브 리뷰 HTML 스크래핑 (Crema 미사용 쇼핑몰용)
async function fetchNativeCafe24Reviews(baseUrl, productNo, cutoffDate) {
  const reviews = [];

  // 첫 페이지에서 board_no 및 썸네일 파악
  let boardNo = 4;
  let thumbnailUrl = null;
  try {
    const firstPage = await axios.get(`${baseUrl}/product/detail.html?product_no=${productNo}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' },
      timeout: 15000
    });
    const boardMatch = firstPage.data.match(/CAFE24\.BOARD\s*=\s*\{"config_(\d+)"/);
    if (boardMatch) boardNo = parseInt(boardMatch[1]);
    const ogMatch = firstPage.data.match(/property="og:image"\s+content="([^"]+)"/) ||
                    firstPage.data.match(/content="([^"]+)"\s+property="og:image"/);
    if (ogMatch) thumbnailUrl = ogMatch[1];
  } catch (e) {
    console.log(`  [네이티브] 첫 페이지 로드 실패: ${e.message}`);
    return { reviews, thumbnailUrl: null };
  }

  console.log(`  [네이티브] board_no=${boardNo} 감지, 썸네일: ${thumbnailUrl ? '확인' : '없음'}`);

  let page = 1;
  let stop = false;

  while (!stop) {
    console.log(`  [네이티브] 목록 페이지 ${page} 호출 중...`);
    let html;
    try {
      const res = await axios.get(`${baseUrl}/product/detail.html?product_no=${productNo}&page_${boardNo}=${page}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' },
        timeout: 15000
      });
      html = res.data;
    } catch (e) {
      console.log(`  [네이티브] 목록 페이지 오류: ${e.message}`);
      break;
    }

    // 리뷰 목록 항목 파싱
    const itemRegex = /href="\/product\/provider\/review_read\.xml\?no=(\d+)&board_no=(\d+)[^"]*"[\s\S]*?class="summary">([\s\S]*?)<\/strong>[\s\S]*?class="id"[^>]*>([\s\S]*?)<\/span>[\s\S]*?class="date[^"]*"[^>]*>([\s\S]*?)<\/span>(?:[\s\S]*?class="point[^"]*"[\s\S]*?alt="(\d+)점")?/g;

    let match;
    const pageItems = [];
    while ((match = itemRegex.exec(html)) !== null) {
      const no = match[1];
      const dateRaw = match[5]?.trim() || '';
      const dateStr = dateRaw.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || null;
      if (!dateStr) continue;

      const rating = match[6] ? parseInt(match[6]) : 5;
      const title = match[3].replace(/<[^>]+>/g, '').trim();
      const author = match[4].replace(/<[^>]+>/g, '').trim();

      pageItems.push({ no, dateStr, rating, title, author });
    }

    if (pageItems.length === 0) {
      console.log(`  [네이티브] 더 이상 리뷰 없음`);
      break;
    }

    console.log(`  [네이티브] ${pageItems.length}건 발견`);

    // 각 리뷰 상세 페이지에서 본문 수집
    for (const item of pageItems) {
      if (item.dateStr < '2025-01-01') { stop = true; continue; }

      let body = item.title; // fallback
      try {
        const detailRes = await axios.get(`${baseUrl}/board/product/read.html?no=${item.no}&board_no=${boardNo}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' },
          timeout: 10000
        });
        const detailHtml = detailRes.data;
        const contentMatch = detailHtml.match(/class="content"[\s\S]*?<strong[^>]*>내용<\/strong>\s*([\s\S]*?)<\/div>/);
        if (contentMatch) {
          body = contentMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
            .replace(/\([^)]*에 등록된[^)]*구매평\)/g, '').trim();
        }
        // 첨부 이미지
      } catch (e) {
        console.log(`  [네이티브] 상세 ${item.no} 오류: ${e.message}`);
      }

      reviews.push({
        review_text: body || item.title,
        rating: item.rating,
        reviewer_nickname: item.author || '익명',
        review_date: item.dateStr,
        extra_info: {},
        media_urls: []
      });

      await new Promise(r => setTimeout(r, 400));
    }

    // 페이지네이션 종료 감지
    const hasNextPage = new RegExp(`page_${boardNo}=${page + 1}`).test(html);
    if (!hasNextPage || stop) break;
    page++;
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`  [네이티브] 총 ${reviews.length}건 수집 완료`);
  return { reviews, thumbnailUrl };
}

// Gemini AI 감성분석
async function analyzeWithGemini(reviews) {
  if (!reviews.length) return reviews;
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  const batchSize = 15;
  const result = [];

  for (let i = 0; i < reviews.length; i += batchSize) {
    const batch = reviews.slice(i, i + batchSize);
    const texts = batch.map((r, idx) => `[${idx}] ${r.review_text}`).join('\n');
    console.log(`  [Gemini] ${i+1}~${Math.min(i+batchSize, reviews.length)} / ${reviews.length}`);

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
      batch.forEach(r => result.push({ ...r, sentiment: 'neutral', sentiment_score: 0.5, attributes: [], source_highlight: [] }));
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  return result;
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

  if (!products?.length) { console.log('[일일크롤러] 등록된 제품 없음.'); process.exit(0); }

  // Puppeteer 실행
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const product of products) {
    // Cafe24 처리
    if (product.platform === 'cafe24') {
      const urlObj = new URL(product.page_url);
      const host = urlObj.hostname;
      
      // product_no 추출 (/product/이름/번호/ 또는 ?product_no=번호)
      let productNo = '';
      const pathMatch = urlObj.pathname.match(/\/product\/[^\/]+\/(\d+)/);
      if (pathMatch) productNo = pathMatch[1];
      else productNo = urlObj.searchParams.get('product_no');

      if (!productNo) {
        console.log(`[일일크롤러] product_no 추출 실패. URL: ${product.page_url}`);
        continue;
      }
      console.log(`[일일크롤러] 상품번호: ${productNo}`);

      // 리뷰 수집: Crema API 먼저 시도, 실패 시 네이티브 HTML 스크래핑
      const allReviews = [];
      let pageNum = 1;
      let cremaWorked = false;

      while (true) {
        console.log(`  [Crema] 페이지 ${pageNum} 호출 중...`);
        try {
          const res = await axios.get(`https://review1.cre.ma/api/${host}/reviews?product_code=${productNo}&sort=recent&widget_id=2&page=${pageNum}`);
          const reviews = res.data.reviews || [];

          if (pageNum === 1 && reviews.length > 0) cremaWorked = true;

          if (reviews.length === 0) {
            console.log(`  [Crema] 리뷰 없음 또는 마지막 페이지`);
            break;
          }

          // 썸네일(첫 번째 리뷰에서 추출)
          if (!product.thumbnail_url && reviews[0].product_image_url) {
            const thumb = reviews[0].product_image_url;
            const dc = await pool.connect();
            try { await dc.sql`UPDATE review_products SET thumbnail_url = ${thumb} WHERE id = ${product.id}`; } finally { dc.release(); }
            console.log(`[일일크롤러] 썸네일 저장: ${thumb.substring(0, 60)}...`);
            product.thumbnail_url = thumb;
          }

          console.log(`  [Crema] ${reviews.length}건 수취`);

          for (const raw of reviews) {
            let reviewDate = raw.created_at ? raw.created_at.split('T')[0] : null;
            if (!reviewDate) continue;
            if (reviewDate < '2025-01-01') continue;

            let mediaUrls = [];
            if (raw.images && raw.images.length > 0) {
              mediaUrls = [...mediaUrls, ...raw.images.map(img => img.url).filter(u => u)];
            }
            if (raw.videos && raw.videos.length > 0) {
              mediaUrls = [...mediaUrls, ...raw.videos.map(vid => vid.url).filter(u => u)];
            }

            const skinInfo = raw.evaluation_properties ?
              raw.evaluation_properties.reduce((acc, prop) => ({...acc, [prop.name]: prop.value}), {}) : {};

            allReviews.push({
              review_text: raw.filtered_message || raw.message || '',
              rating: raw.score || 5,
              reviewer_nickname: raw.user_display_name || '익명',
              review_date: reviewDate,
              extra_info: { ...skinInfo, option: raw.options || '' },
              media_urls: mediaUrls
            });
          }
        } catch (e) {
          console.log(`  [Crema] 오류: ${e.message}`);
          break;
        }

        if (pageNum >= 10) break;
        pageNum++;
        await new Promise(r => setTimeout(r, 800));
      }

      // Crema에서 리뷰를 못 받은 경우 → 네이티브 Cafe24 HTML 스크래핑
      if (!cremaWorked) {
        console.log(`  [네이티브] Crema 미사용 쇼핑몰 감지. HTML 스크래핑으로 전환...`);
        const { reviews: nativeReviews, thumbnailUrl: nativeThumb } = await fetchNativeCafe24Reviews(`https://${host}`, productNo, CUTOFF_DATE);
        allReviews.push(...nativeReviews);
        if (!product.thumbnail_url && nativeThumb) {
          const dc = await pool.connect();
          try { await dc.sql`UPDATE review_products SET thumbnail_url = ${nativeThumb} WHERE id = ${product.id}`; } finally { dc.release(); }
          product.thumbnail_url = nativeThumb;
          console.log(`  [네이티브] 썸네일 저장: ${nativeThumb.substring(0, 60)}...`);
        }
      }

      console.log(`\n[일일크롤러] 총 ${allReviews.length}건 수집`);
      if (!allReviews.length) { console.log('[일일크롤러] 수집 리뷰 없음.'); continue; }

      // Gemini AI 감성분석
      console.log(`\n[일일크롤러] Gemini AI 감성분석 시작...`);
      const analyzed = await analyzeWithGemini(allReviews);
      console.log(`[일일크롤러] 분석 완료: ${analyzed.length}건`);

      // DB 저장
      const dbClient = await pool.connect();
      let saved = 0;
      try {
        for (const r of analyzed) {
          try {
            await dbClient.sql`
              INSERT INTO product_reviews (product_id, review_date, rating, review_text, reviewer_nickname, extra_info, media_urls, sentiment, sentiment_score, attributes, source_highlight)
              VALUES (${product.id}, ${r.review_date}, ${r.rating}, ${r.review_text}, ${r.reviewer_nickname},
                ${JSON.stringify(r.extra_info || {})}, ${JSON.stringify(r.media_urls || [])},
                ${r.sentiment}, ${r.sentiment_score}, ${JSON.stringify(r.attributes || [])}, ${JSON.stringify(r.source_highlight || [])}
              )
              ON CONFLICT (product_id, review_date, COALESCE(reviewer_nickname, ''), LEFT(COALESCE(review_text, ''), 100))
              DO UPDATE SET 
                media_urls = EXCLUDED.media_urls,
                extra_info = EXCLUDED.extra_info,
                attributes = EXCLUDED.attributes,
                source_highlight = EXCLUDED.source_highlight,
                rating = EXCLUDED.rating`;
            saved++;
          } catch(e) {}
        }
        console.log(`[일일크롤러] DB 저장: ${saved}건`);
      } finally { dbClient.release(); }
      continue;
    }

    // Musinsa(무신사) 처리
    if (product.platform === 'musinsa') {
      console.log(`\n========================================`);
      console.log(`[일일크롤러] ${product.brand_name} ${product.product_name}`);
      console.log(`========================================`);

      const goodsMatch = product.page_url.match(/products\/(\d+)/);
      if (!goodsMatch) {
        console.log('[일일크롤러] 무신사 상품 번호(goodsNo) 추출 실패');
        continue;
      }
      const goodsNo = goodsMatch[1];

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

      console.log('[일일크롤러] 무신사 페이지 방문 중...');
      await page.goto(product.page_url, { waitUntil: 'networkidle2', timeout: 60000 });

      // 썸네일
      if (!product.thumbnail_url) {
        console.log('[일일크롤러] 무신사 썸네일 추출 중...');
        const thumb = await page.evaluate(() => document.querySelector('meta[property="og:image"]')?.content);
        if (thumb) {
          const dc = await pool.connect();
          try { await dc.sql`UPDATE review_products SET thumbnail_url = ${thumb} WHERE id = ${product.id}`; } finally { dc.release(); }
          product.thumbnail_url = thumb;
          console.log(`[일일크롤러] 무신사 썸네일 저장: ${thumb.substring(0, 60)}...`);
        }
      }

      const allReviews = [];
      let pageNum = 0; // 무신사는 0페이지부터 시작

      while (true) {
        console.log(`  [API] 페이지 ${pageNum + 1} 호출 중...`);
        
        const apiResult = await page.evaluate(async (goodsNo, pageNum) => {
          try {
            const res = await fetch(`https://goods.musinsa.com/api2/review/v1/view/list?page=${pageNum}&pageSize=20&goodsNo=${goodsNo}&sort=newest_desc`, {
              method: 'GET',
              headers: { 
                'Accept': 'application/json',
                'Referer': `https://www.musinsa.com/products/${goodsNo}`
              }
            });
            return await res.json();
          } catch(e) { return { error: e.message }; }
        }, goodsNo, pageNum);

        if (apiResult.error || !apiResult.data || !apiResult.data.list || apiResult.data.list.length === 0) {
          console.log(`  [API] 더 이상 리뷰 없음 또는 오류.`);
          break;
        }

        const reviews = apiResult.data.list;
        console.log(`  [API] ${reviews.length}건 수취`);

        for (const raw of reviews) {
          let reviewDate = raw.createDate ? raw.createDate.split('T')[0] : null;
          if (!reviewDate) continue;

          // 2025년 이후 데이터만 수집 (공통 기준)
          if (reviewDate < '2025-01-01') continue;

          let mediaUrls = raw.images ? raw.images.map(img => {
            const url = img.imageUrl || '';
            return url.startsWith('http') ? url : 'https://image.msscdn.net' + url;
          }) : [];
          
          allReviews.push({
            review_text: raw.content || '',
            rating: parseInt(raw.grade) || 5,
            reviewer_nickname: raw.userProfileInfo?.userNickName || '익명',
            review_date: reviewDate,
            extra_info: { 
              option: raw.goodsOption || '',
              skinType: raw.userProfileInfo?.skinType || '',
              skinTone: raw.userProfileInfo?.skinTone || ''
            },
            media_urls: mediaUrls
          });
        }

        if (pageNum >= 9) break; // 최대 10페이지 (200건)
        pageNum++;
        await new Promise(r => setTimeout(r, 800));
      }

      await page.close();
      
      console.log(`\n[일일크롤러] 총 ${allReviews.length}건 수집`);
      if (!allReviews.length) { console.log('[일일크롤러] 수집 리뷰 없음.'); continue; }

      console.log(`\n[일일크롤러] Gemini AI 감성분석 시작...`);
      const analyzed = await analyzeWithGemini(allReviews);
      console.log(`[일일크롤러] 분석 완료: ${analyzed.length}건`);

      const dbClient = await pool.connect();
      let saved = 0;
      try {
        for (const r of analyzed) {
          try {
            await dbClient.sql`
              INSERT INTO product_reviews (product_id, review_date, rating, review_text, reviewer_nickname, extra_info, media_urls, sentiment, sentiment_score, attributes, source_highlight)
              VALUES (${product.id}, ${r.review_date}, ${r.rating}, ${r.review_text}, ${r.reviewer_nickname},
                ${JSON.stringify(r.extra_info || {})}, ${JSON.stringify(r.media_urls || [])},
                ${r.sentiment}, ${r.sentiment_score}, ${JSON.stringify(r.attributes || [])}, ${JSON.stringify(r.source_highlight || [])}
              )
              ON CONFLICT (product_id, review_date, COALESCE(reviewer_nickname, ''), LEFT(COALESCE(review_text, ''), 100))
              DO UPDATE SET 
                media_urls = EXCLUDED.media_urls,
                extra_info = EXCLUDED.extra_info,
                attributes = EXCLUDED.attributes,
                source_highlight = EXCLUDED.source_highlight,
                rating = EXCLUDED.rating`;
            saved++;
          } catch(e) {}
        }
        console.log(`[일일크롤러] DB 저장: ${saved}건`);
      } finally { dbClient.release(); }
      continue;
    }

    // Naver 스마트스토어 처리
    if (product.platform === 'naver') {
      console.log(`\n========================================`);
      console.log(`[일일크롤러] ${product.brand_name} ${product.product_name}`);
      console.log(`========================================`);

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

      let naverPayload = null;
      page.on('request', req => {
        if (req.url().includes('query-pages') && req.method() === 'POST' && !naverPayload) {
          naverPayload = JSON.parse(req.postData());
        }
      });

      console.log('[일일크롤러] 네이버 페이지 방문 중...');
      await page.goto(product.page_url, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // 썸네일
      if (!product.thumbnail_url) {
        const thumb = await page.evaluate(() => document.querySelector('meta[property="og:image"]')?.content);
        if (thumb) {
          const dc = await pool.connect();
          try { await dc.sql`UPDATE review_products SET thumbnail_url = ${thumb} WHERE id = ${product.id}`; } finally { dc.release(); }
          product.thumbnail_url = thumb;
          console.log(`[일일크롤러] 네이버 썸네일 저장: ${thumb.substring(0, 60)}...`);
        }
      }

      // 스크롤 및 탭 클릭으로 리뷰 API 호출 유도
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

      // Payload 잡힐 때까지 최대 10초 대기
      for (let i = 0; i < 10; i++) {
        if (naverPayload) break;
        await new Promise(r => setTimeout(r, 1000));
      }

      if (!naverPayload) {
        console.log('[일일크롤러] 네이버 리뷰 API 파라미터 캡처 실패');
        await page.close();
        continue;
      }
      
      console.log(`[일일크롤러] 네이버 파라미터 획득: merchant=${naverPayload.checkoutMerchantNo}, origin=${naverPayload.originProductNo}`);

      // API 호출 반복 (evaluate 내부)
      const allReviews = [];
      let pageNum = 1;

      while (true) {
        console.log(`  [API] 페이지 ${pageNum} 호출 중...`);
        
        const apiResult = await page.evaluate(async (payload, pageNum) => {
          try {
            payload.page = pageNum;
            payload.pageSize = 20;
            payload.reviewSearchSortType = 'REVIEW_CREATE_DATE_DESC'; // 최신순
            
            const res = await fetch('/n/v1/contents/reviews/query-pages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            return await res.json();
          } catch(e) { return { error: e.message }; }
        }, naverPayload, pageNum);

        if (apiResult.error || !apiResult.contents || apiResult.contents.length === 0) {
          console.log(`  [API] 더 이상 리뷰 없음 또는 오류. ${apiResult.error || ''}`);
          break;
        }

        const reviews = apiResult.contents;
        console.log(`  [API] ${reviews.length}건 수취, 데이터 샘플: ${JSON.stringify(reviews[0], null, 2)}`);

        for (const raw of reviews) {
          let reviewDate = raw.createDate ? raw.createDate.split('T')[0] : null;
          if (!reviewDate) continue;

          if (reviewDate < '2025-01-01') continue;

          // 날짜 랜덤 로직 제거
            // if (reviewDate < CUTOFF_DATE) {
            //   const randomDays = Math.floor(Math.random() * 30);
            //   reviewDate = getDateDaysAgo(randomDays);
            // }

          let mediaUrls = raw.reviewAttaches ? raw.reviewAttaches.map(a => a.attachPath) : [];
          
          // 네이버 비디오 추가 수집
          if (raw.reviewVideos && raw.reviewVideos.length > 0) {
            const videoUrls = raw.reviewVideos.map(v => v.videoUrl || v.apiUrl).filter(u => u);
            mediaUrls = [...mediaUrls, ...videoUrls];
          }

          allReviews.push({
            review_text: raw.reviewContent || '',
            rating: raw.reviewScore || 5,
            reviewer_nickname: raw.writerMemberId || '익명',
            review_date: reviewDate,
            extra_info: { option: raw.productOptionContent || '' },
            media_urls: mediaUrls
          });
        }

        if (pageNum >= 5) break; // 최대 5페이지 (100건)
        pageNum++;
        await new Promise(r => setTimeout(r, 800));
      }

      await page.close();
      
      console.log(`\n[일일크롤러] 총 ${allReviews.length}건 수집`);
      if (!allReviews.length) { console.log('[일일크롤러] 수집 리뷰 없음.'); continue; }

      console.log(`\n[일일크롤러] Gemini AI 감성분석 시작...`);
      const analyzed = await analyzeWithGemini(allReviews);
      console.log(`[일일크롤러] 분석 완료: ${analyzed.length}건`);

      const dbClient = await pool.connect();
      let saved = 0;
      try {
        for (const r of analyzed) {
          try {
            await dbClient.sql`
              INSERT INTO product_reviews (product_id, review_date, rating, review_text, reviewer_nickname, extra_info, media_urls, sentiment, sentiment_score, attributes, source_highlight)
              VALUES (${product.id}, ${r.review_date}, ${r.rating}, ${r.review_text}, ${r.reviewer_nickname},
                ${JSON.stringify(r.extra_info || {})}, ${JSON.stringify(r.media_urls || [])},
                ${r.sentiment}, ${r.sentiment_score}, ${JSON.stringify(r.attributes || [])}, ${JSON.stringify(r.source_highlight || [])}
              )
              ON CONFLICT (product_id, review_date, COALESCE(reviewer_nickname, ''), LEFT(COALESCE(review_text, ''), 100))
              DO UPDATE SET 
                media_urls = EXCLUDED.media_urls,
                extra_info = EXCLUDED.extra_info,
                attributes = EXCLUDED.attributes,
                source_highlight = EXCLUDED.source_highlight,
                rating = EXCLUDED.rating`;
            saved++;
          } catch(e) {}
        }
        console.log(`[일일크롤러] DB 저장: ${saved}건`);
      } finally { dbClient.release(); }
      continue;
    }

    if (product.platform === 'amazon') {
      const asinMatch = product.page_url.match(/\/dp\/([A-Z0-9]{10})/) ||
                        product.page_url.match(/\/gp\/product\/([A-Z0-9]{10})/) ||
                        product.page_url.match(/\/product-reviews\/([A-Z0-9]{10})/);
      if (!asinMatch) { console.log(`[일일크롤러] Amazon ASIN 추출 실패: ${product.page_url}`); continue; }
      const asin = asinMatch[1];

      console.log(`\n========================================`);
      console.log(`[일일크롤러] (Amazon) ${product.brand_name} ${product.product_name} (${asin})`);
      console.log(`========================================`);

      const stealthBrowser = await puppeteerExtra.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=en-US']
      });
      const page = await stealthBrowser.newPage();
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

      // Amazon 로그인 (환경변수에 계정 정보가 있는 경우)
      const amazonEmail = process.env.AMAZON_EMAIL;
      const amazonPassword = process.env.AMAZON_PASSWORD;
      if (amazonEmail && amazonPassword) {
        console.log(`  [Amazon] 로그인 시도 중...`);
        try {
          await page.goto('https://www.amazon.com/ap/signin?openid.return_to=https%3A%2F%2Fwww.amazon.com&openid.mode=checkid_setup&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0', { waitUntil: 'networkidle2', timeout: 30000 });
          await page.type('#ap_email', amazonEmail, { delay: 50 });
          await Promise.all([page.click('#continue'), page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})]);
          await new Promise(r => setTimeout(r, 1000));
          await page.type('#ap_password', amazonPassword, { delay: 50 });
          await Promise.all([page.click('#signInSubmit'), page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})]);
          await new Promise(r => setTimeout(r, 1500));
          const currentUrl = page.url();
          if (currentUrl.includes('/ap/signin') || currentUrl.includes('/ap/mfa')) {
            console.log(`  [Amazon] 로그인 실패 또는 2FA 필요. URL: ${currentUrl}`);
          } else {
            console.log(`  [Amazon] 로그인 성공`);
          }
        } catch(e) { console.log(`  [Amazon] 로그인 오류: ${e.message}`); }
      } else {
        console.log(`  [Amazon] AMAZON_EMAIL/AMAZON_PASSWORD 환경변수 없음 — 비로그인으로 시도`);
      }

      if (!product.thumbnail_url) {
        try {
          await page.goto(`https://www.amazon.com/dp/${asin}`, { waitUntil: 'networkidle2', timeout: 60000 });
          const thumb = await page.evaluate(() =>
            document.querySelector('#landingImage')?.src ||
            document.querySelector('meta[property="og:image"]')?.content
          );
          if (thumb) {
            const dc = await pool.connect();
            try { await dc.sql`UPDATE review_products SET thumbnail_url = ${thumb} WHERE id = ${product.id}`; } finally { dc.release(); }
            product.thumbnail_url = thumb;
          }
        } catch(e) {}
      }

      const allReviews = [];
      let pageNum = 1;
      while (pageNum <= 10) {
        console.log(`  [Amazon] 리뷰 페이지 ${pageNum} 호출 중...`);
        try {
          await page.goto(
            `https://www.amazon.com/product-reviews/${asin}/?sortBy=recent&pageNumber=${pageNum}`,
            { waitUntil: 'networkidle2', timeout: 60000 }
          );
          await new Promise(r => setTimeout(r, 1000));

          const reviews = await page.evaluate(() => {
            const items = [...document.querySelectorAll('[data-hook="review"]')];
            return items.map(el => {
              const ratingEl = el.querySelector('[data-hook="review-star-rating"] .a-icon-alt') ||
                               el.querySelector('i[data-hook*="star"] .a-icon-alt');
              const rating = ratingEl ? parseFloat(ratingEl.textContent) : 5;
              const dateText = el.querySelector('[data-hook="review-date"]')?.textContent?.trim() || '';
              const body = el.querySelector('[data-hook="review-body"] span')?.textContent?.trim() || '';
              const titleEls = [...el.querySelectorAll('[data-hook="review-title"] span')];
              const title = titleEls.map(s => s.textContent.trim()).filter(t => !t.match(/^\d+(\.\d+)? out of/)).join(' ').trim();
              const author = el.querySelector('.a-profile-name')?.textContent?.trim() || '익명';
              const images = [...el.querySelectorAll('[data-hook="review-image-tile"] img')].map(img => img.src).filter(Boolean);
              const verified = !!el.querySelector('[data-hook="avp-badge"]');
              return { rating, dateText, body, title, author, images, verified };
            });
          });

          if (!reviews.length) break;

          let pageEnd = false;
          for (const raw of reviews) {
            const dateMatch = raw.dateText.match(/on (\w+ \d+, \d{4})/);
            let reviewDate = null;
            if (dateMatch) {
              const d = new Date(dateMatch[1]);
              if (!isNaN(d.getTime())) reviewDate = d.toISOString().split('T')[0];
            }
            if (!reviewDate || reviewDate < CUTOFF_DATE) { pageEnd = true; continue; }

            allReviews.push({
              review_text: [raw.title, raw.body].filter(Boolean).join('. '),
              rating: Math.round(raw.rating),
              reviewer_nickname: raw.author,
              review_date: reviewDate,
              extra_info: { verified: raw.verified },
              media_urls: raw.images
            });
          }
          if (pageEnd) break;
        } catch(e) {
          console.log(`  [Amazon] 페이지 ${pageNum} 오류: ${e.message}`);
          break;
        }
        pageNum++;
        await new Promise(r => setTimeout(r, 1500));
      }
      await stealthBrowser.close();

      console.log(`\n[일일크롤러] 총 ${allReviews.length}건 수집`);
      if (!allReviews.length) { console.log('[일일크롤러] 수집 리뷰 없음.'); continue; }

      const analyzed = await analyzeWithGemini(allReviews);
      const dbClient = await pool.connect();
      let saved = 0;
      try {
        for (const r of analyzed) {
          try {
            await dbClient.sql`
              INSERT INTO product_reviews (product_id, review_date, rating, review_text, reviewer_nickname, extra_info, media_urls, sentiment, sentiment_score, attributes, source_highlight)
              VALUES (${product.id}, ${r.review_date}, ${r.rating}, ${r.review_text}, ${r.reviewer_nickname},
                ${JSON.stringify(r.extra_info || {})}, ${JSON.stringify(r.media_urls || [])},
                ${r.sentiment}, ${r.sentiment_score}, ${JSON.stringify(r.attributes || [])}, ${JSON.stringify(r.source_highlight || [])})
              ON CONFLICT (product_id, review_date, COALESCE(reviewer_nickname, ''), LEFT(COALESCE(review_text, ''), 100))
              DO UPDATE SET
                media_urls = EXCLUDED.media_urls,
                extra_info = EXCLUDED.extra_info,
                attributes = EXCLUDED.attributes,
                source_highlight = EXCLUDED.source_highlight,
                rating = EXCLUDED.rating`;
            saved++;
          } catch(e) {}
        }
        console.log(`[일일크롤러] DB 저장: ${saved}건`);
      } finally { dbClient.release(); }
      continue;
    }

    if (product.platform !== 'oliveyoung') { console.log(`[일일크롤러] ${product.brand_name}: 미지원 플랫폼 (${product.platform})`); continue; }

    const goodsMatch = product.page_url.match(/goodsNo=([A-Za-z0-9]+)/);
    if (!goodsMatch) { console.log('[일일크롤러] goodsNo 추출 실패'); continue; }
    const goodsNo = goodsMatch[1];

    console.log(`\n========================================`);
    console.log(`[일일크롤러] ${product.brand_name} ${product.product_name} (${goodsNo})`);
    console.log(`========================================`);

    // 페이지 방문하여 세션/쿠키 획득
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    console.log('[일일크롤러] 페이지 방문하여 세션 획득 중...');
    await page.goto(product.page_url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    // 썸네일 추출
    if (!product.thumbnail_url) {
      const thumb = await page.evaluate(() => {
        const meta = document.querySelector('meta[property="og:image"]');
        return meta ? meta.content : null;
      });
      if (thumb) {
        const dc = await pool.connect();
        try { await dc.sql`UPDATE review_products SET thumbnail_url = ${thumb} WHERE id = ${product.id}`; } finally { dc.release(); }
        console.log(`[일일크롤러] 썸네일 저장: ${thumb.substring(0, 60)}...`);
      }
    }

    // 브라우저 내에서 API 호출 (세션쿠키 자동 포함)
    const allReviews = [];
    let pageNum = 0;
    let reachedCutoff = false;
    const PAGE_SIZE = 30;

    while (!reachedCutoff) {
      console.log(`  [API] 페이지 ${pageNum + 1} 호출 중...`);
      
      const apiResult = await page.evaluate(async (goodsNo, pageNum, pageSize) => {
        try {
          const res = await fetch('https://m.oliveyoung.co.kr/review/api/v2/reviews/cursor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
              goodsNumber: goodsNo,
              page: pageNum,
              size: Math.min(pageSize, 10), // API accepts max size of 10 usually
              sortType: 'USEFUL_SCORE_DESC',
              reviewType: 'ALL'
            })
          });
          const data = await res.json();
          return data;
        } catch (e) {
          return { error: e.message };
        }
      }, goodsNo, pageNum, PAGE_SIZE);

      // ...
      if (apiResult.error || apiResult.status !== 'SUCCESS' || !apiResult.data?.goodsReviewList?.length) {
        if (apiResult.error) {
          console.log(`  [API] 코드 내 예외 오류: ${apiResult.error}`);
        } else {
          console.log(`  [API] 응답 실패 또는 리뷰 없음. ${JSON.stringify(apiResult)}`);
        }
        break;
      }


      const reviewList = apiResult.data.goodsReviewList;
      console.log(`  [API] ${reviewList.length}건 수취`);

      for (const raw of reviewList) {
        let reviewDate = parseOliveDate(raw.createdDateTime);
        if (!reviewDate) continue;

        // 컷오프 로직 우회: USEFUL_SCORE_DESC는 날짜순이 아니므로
        // 너무 오래된 (예: 1년 전) 데이터만 아니면 수집
        if (reviewDate < '2025-01-01') {
          continue; // 너무 오래된 리뷰 패스
        }

        // 데모 목적으로 날짜를 최근 30일 이내로 조정했었으나 (정합성을 위해 제거)
        // if (reviewDate < CUTOFF_DATE) {
        //    const randomDays = Math.floor(Math.random() * 30);
        //    reviewDate = getDateDaysAgo(randomDays);
        // }
        const mediaUrls = (raw.photoReviewList || []).map(p => {
          let fullPath = p.imagePath;
          if (!fullPath.startsWith('http')) {
            // uploads/ 가 이미 포함되어 있으면 도메인만, 없으면 기본 goods/review 경로 추가
            if (!fullPath.includes('uploads/')) {
              fullPath = `uploads/images/goods/review/${fullPath}`;
            }
            fullPath = `https://image.oliveyoung.co.kr/${fullPath}`;
          }
          return fullPath.includes('?') ? fullPath : `${fullPath}?RS=500x0&q=85&sf=webp`;
        });

        allReviews.push({
          review_text: raw.content || '',
          rating: raw.reviewScore,
          reviewer_nickname: raw.profileDto?.memberNickname || '',
          review_date: reviewDate,
          extra_info: {
            ...decodeSkin(raw.profileDto),
            option: raw.goodsDto?.optionName || '',
            reviewType: raw.reviewType || ''
          },
          media_urls: mediaUrls
        });
      }

      if (pageNum >= 9) break; // 최대 10페이지 (100건)
      pageNum++;
      await new Promise(r => setTimeout(r, 800));
    }

    await page.close();

    console.log(`\n[일일크롤러] 총 ${allReviews.length}건 수집`);
    if (!allReviews.length) { console.log('[일일크롤러] 수집 리뷰 없음.'); continue; }

    // Gemini AI 감성분석
    console.log(`\n[일일크롤러] Gemini AI 감성분석 시작...`);
    const analyzed = await analyzeWithGemini(allReviews);
    console.log(`[일일크롤러] 분석 완료: ${analyzed.length}건`);

    // DB 저장
    const dbClient = await pool.connect();
    let saved = 0;
    try {
      for (const r of analyzed) {
        try {
          await dbClient.sql`
            INSERT INTO product_reviews (product_id, review_date, rating, review_text, reviewer_nickname, extra_info, media_urls, sentiment, sentiment_score, attributes, source_highlight)
            VALUES (${product.id}, ${r.review_date}, ${r.rating}, ${r.review_text}, ${r.reviewer_nickname},
              ${JSON.stringify(r.extra_info || {})}, ${JSON.stringify(r.media_urls || [])},
              ${r.sentiment}, ${r.sentiment_score}, ${JSON.stringify(r.attributes || [])}, ${JSON.stringify(r.source_highlight || [])})
            ON CONFLICT DO NOTHING`;
          saved++;
        } catch(e) {}
      }
      console.log(`[일일크롤러] DB 저장: ${saved}건`);
    } finally { dbClient.release(); }
  }

  await browser.close();
  console.log(`\n[일일크롤러] ===== 전체 완료 =====`);
  process.exit(0);
}

main().catch(e => { console.error('[일일크롤러] 치명적 오류:', e); process.exit(1); });
