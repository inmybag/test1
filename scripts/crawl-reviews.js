/**
 * 리뷰 백필 크롤러 - Puppeteer 세션으로 올리브영 API 호출
 * 사용법: node scripts/crawl-reviews-backfill.js
 */
const puppeteer = require('puppeteer');
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

      // 리뷰 수집 (Crema API)
      const allReviews = [];
      let pageNum = 1;

      while (true) {
        console.log(`  [API] 페이지 ${pageNum} 호출 중...`);
        try {
          const res = await axios.get(`https://review1.cre.ma/api/${host}/reviews?product_code=${productNo}&sort=recent&widget_id=2&page=${pageNum}`);
          const reviews = res.data.reviews || [];
          
          if (reviews.length === 0) {
            console.log(`  [API] 리뷰 없음 또는 마지막 페이지`);
            break;
          }

          // 썸네일(첫 번째 리뷰에서 추출)
          if (!product.thumbnail_url && reviews[0].product_image_url) {
            const thumb = reviews[0].product_image_url;
            const dc = await pool.connect();
            try { await dc.sql`UPDATE review_products SET thumbnail_url = ${thumb} WHERE id = ${product.id}`; } finally { dc.release(); }
            console.log(`[일일크롤러] 썸네일 저장: ${thumb.substring(0, 60)}...`);
            product.thumbnail_url = thumb; // 메모리 갱신
          }

          console.log(`  [API] ${reviews.length}건 수취, 데이터 샘플: ${JSON.stringify(reviews[0], null, 2)}`);

          for (const raw of reviews) {
            let reviewDate = raw.created_at ? raw.created_at.split('T')[0] : null;
            if (!reviewDate) continue;

            // 너무 오래된 리뷰 통과
            if (reviewDate < '2025-01-01') continue;

            // 날짜 랜덤 로직 제거 (실제 데이터 정합성 유지)
            // if (reviewDate < CUTOFF_DATE) {
            //   const randomDays = Math.floor(Math.random() * 30);
            //   reviewDate = getDateDaysAgo(randomDays);
            // }

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
          console.log(`  [API] 오류: ${e.message}`);
          break;
        }

        if (pageNum >= 10) break; // 최대 10페이지 (100건)
        pageNum++;
        await new Promise(r => setTimeout(r, 800));
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
              ON CONFLICT ON CONSTRAINT idx_review_unique 
              DO UPDATE SET 
                media_urls = EXCLUDED.media_urls,
                extra_info = EXCLUDED.extra_info,
                attributes = EXCLUDED.attributes,
                source_highlight = EXCLUDED.source_highlight,
                rating = EXCLUDED.rating`;
            saved++;
          } catch(e) {}
        }
        console.log(`[일일크롤러] DB 저장: \${saved}건`);
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
              ON CONFLICT ON CONSTRAINT idx_review_unique 
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
