const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const { createPool } = require('@vercel/postgres');

const pool = createPool({
  connectionString: process.env.POSTGRES_URL
});

const TARGET_KEYWORDS = [
  // Beauty
  { en: "Korean skincare routine", ko: "스킨케어 루틴", type: "Beauty" },
  { en: "Daily makeup tutorial", ko: "데일리 메이크업", type: "Beauty" },
  { en: "Olive Young recommended", ko: "올리브영 추천템", type: "Beauty" },
  { en: "K-beauty trending", ko: "K뷰티 트렌드", type: "Beauty" },
  // Household - Body/Hair
  { en: "Body wash recommendation", ko: "바디워시 추천", type: "Household" },
  { en: "Hair care routine", ko: "헤어케어 루틴", type: "Household" },
  { en: "Shampoo for hair loss", ko: "탈모 샴푸", type: "Household" },
  // Household - Living
  { en: "Laundry detergent hack", ko: "세탁세제 꿀팁", type: "Household" },
  { en: "Fabric softener scent", ko: "섬유유연제 향수", type: "Household" },
  { en: "Whitening toothpaste", ko: "미백 치약 추천", type: "Household" },
  { en: "Bathroom cleaning hack", ko: "화장실 청소 꿀팁", type: "Household" },
  { en: "Kitchen grease removal", ko: "주방 기름때 제거", type: "Household" },
];

const COUNTS = {
  tiktok: 15,     // 키워드별 후보 수집량 (12개 키워드 x 15 = 180개 후보 중 Top 10 선정)
  instagram: 12   // 인스타그램 후보 수집량
};

// 지표 텍스트(1.2M, 10K 등)를 숫자로 변환하는 헬퍼
function parseMetric(text) {
  if (!text) return 0;
  const clean = text.replace(/[^0-9.KMBm]/g, '').toUpperCase();
  if (clean.includes('M')) return parseFloat(clean) * 1000000;
  if (clean.includes('K')) return parseFloat(clean) * 1000;
  if (clean.includes('B')) return parseFloat(clean) * 1000000000;
  return parseFloat(clean) || 0;
}

// 인게이지먼트 점수 산출: (좋아요x10) + (댓글x50) + (조회수x0.05)
function calculateEngagementScore(v) {
  return (v.like_count * 10) + (v.comment_count * 50) + (v.view_count * 0.05);
}

async function saveToDb(dateStr, videos) {
  if (!videos || videos.length === 0) return;
  const client = await pool.connect();
  try {
    let saved = 0;
    for (const v of videos) {
      if (!v.video_id || !v.url) continue;
      const defaultAnalysis = {
        score: 0,
        hook: "분석 전",
        summary: "AI 분석이 예약되었습니다.",
        takeaways: [],
        tags: []
      };
      await client.sql`
        INSERT INTO video_analyses
        (platform, video_id, url, title, thumbnail, category, date_str,
         analysis_json, view_count, like_count, comment_count, description, comments)
        VALUES (${v.platform}, ${v.video_id}, ${v.url}, ${v.title}, ${v.thumbnail}, 
                ${v.category}, ${dateStr}, ${JSON.stringify(defaultAnalysis)}, 
                ${v.view_count || 0}, ${v.like_count || 0}, ${v.comment_count || 0}, 
                ${v.description || ''}, '[]'::jsonb)
        ON CONFLICT (video_id)
        DO UPDATE SET
          platform = EXCLUDED.platform,
          category = EXCLUDED.category,
          url = EXCLUDED.url,
          thumbnail = EXCLUDED.thumbnail,
          view_count = EXCLUDED.view_count,
          like_count = EXCLUDED.like_count,
          comment_count = EXCLUDED.comment_count,
          description = EXCLUDED.description;
      `;
      saved++;
    }
    console.log(`  💾 DB 저장 완료: ${saved}건`);
  } catch (error) {
    console.error(`  ❌ DB 저장 오류: ${error.message}`);
  } finally {
    client.release();
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchTikTok(browser, keyword_en, keyword_ko, category, count) {
  const page = await browser.newPage();
  try {
    console.log(`  🔍 TikTok 검색 중: ${keyword_ko} (${keyword_en})`);
    // 'tiktok viral' 대신 '2024 2025 viral' 등을 섞어 최신성 유도
    const q = encodeURIComponent(`${keyword_en} viral 2025`);
    const url = `https://www.tiktok.com/search/video?q=${q}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    
    const videos = await page.evaluate((category, count, parseMetricFnStr) => {
      const parseMetric = new Function("return " + parseMetricFnStr)();
      const items = [];
      const videoCards = document.querySelectorAll('div[data-e2e="search_video-item"], div[class*="DivVideoItem"]');
      
      videoCards.forEach((el, index) => {
        if (items.length >= count) return;
        const aTag = el.querySelector('a[href*="/video/"]');
        if (!aTag) return;
        
        const url = aTag.href;
        let video_id = url.split('/video/')[1]?.split('?')[0];
        if (!video_id || items.some(i => i.video_id === video_id)) return;
        
        const titleEl = el.querySelector('div[data-e2e="search-card-video-caption"], .video-desc, .desc');
        const title = titleEl ? titleEl.innerText : "TikTok 벤치마킹 영상";
        
        const thumbEl = el.querySelector('img');
        const thumbnail = thumbEl ? thumbEl.src : '';
        
        const viewEl = el.querySelector('strong[data-e2e="video-views"], .video-count, .views');
        const viewCount = viewEl ? parseMetric(viewEl.innerText) : 0;
        
        const rankScore = (count - index) * 1000;
        
        items.push({
          platform: 'tiktok',
          video_id: video_id,
          url: url,
          title: title,
          thumbnail: thumbnail,
          category: category,
          view_count: viewCount || rankScore,
          like_count: 0,
          comment_count: 0,
          description: `[TikTok Trending] ${category} 카테고리 최신 영상`
        });
      });
      return items;
    }, category, count, parseMetric.toString());
    
    console.log(`  ✅ TikTok [${keyword_ko}]: ${videos.length}개 후보군 확보`);
    return videos;
  } catch (error) {
    console.log(`  ❌ TikTok 수집 실패 (${keyword_ko}): ${error.message}`);
    return [];
  } finally {
    await page.close();
  }
}

async function fetchInstagram(browser, keyword_en, keyword_ko, category, count) {
  const page = await browser.newPage();
  try {
    console.log(`  🔍 Instagram 태그 검색 중: ${keyword_ko}`);
    const q = encodeURIComponent(keyword_ko);
    const url = `https://www.instagram.com/explore/tags/${q}/`;
    
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
    });
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(5000);
    
    const currentUrl = page.url();
    if (currentUrl.includes('/login/')) {
        throw new Error("비로그인 접속 차단 (로그인 페이지로 강제 리다이렉트됨).");
    }

    const videos = await page.evaluate((category, count, parseMetricFnStr) => {
      const parseMetric = new Function("return " + parseMetricFnStr)();
      const items = [];
      const links = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
      
      links.forEach((a, index) => {
        if (items.length >= count) return;
        const url = a.href;
        let type = url.includes('/reel/') ? '/reel/' : '/p/';
        let video_id = url.split(type)[1]?.split('/')[0];
        
        if (!video_id || items.some(i => i.video_id === video_id)) return;
        
        const img = a.querySelector('img');
        const thumbnail = img ? img.src : '';
        const desc = img ? img.alt : '';
        
        const rankScore = (count - index) * 5000;
        
        items.push({
          platform: 'instagram',
          video_id: video_id,
          url: url,
          title: `Instagram Post - ${video_id}`,
          thumbnail: thumbnail,
          category: category,
          view_count: rankScore, 
          like_count: 0,
          comment_count: 0,
          description: `[Instagram Trending] ${category} 인기 태그 영상`
        });
      });
      return items;
    }, category, count, parseMetric.toString());

    console.log(`  ✅ Instagram [${keyword_ko}]: ${videos.length}개 후보군 확보`);
    return videos;
  } catch (error) {
    console.log(`  ❌ Instagram 수집 실패 (${keyword_ko}): ${error.message}`);
    return [];
  } finally {
    await page.close();
  }
}

async function main() {
  if (!process.env.POSTGRES_URL) {
    console.error('Error: POSTGRES_URL environment variable is not set.');
    process.exit(1);
  }

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).replace(/-/g, '');
  console.log("=".repeat(60));
  console.log(`🎬 숏폼 크롤링 시작 (Puppeteer Stealth) | 날짜: ${todayStr}`);
  console.log(`   플랫폼: TikTok / Instagram Reels`);
  console.log("=".repeat(60));

  console.log('Launching browser (stealth mode)...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let all_tt_candidates = [];
  let all_ig_candidates = [];

  for (const item of TARGET_KEYWORDS) {
    const { en, ko, type } = item;
    console.log(`\n📌 [${type}] ${ko} 후보군 수집 중...`);
    
    // TikTok 후보 수집
    const tt_videos = await fetchTikTok(browser, en, ko, type, COUNTS.tiktok);
    all_tt_candidates.push(...tt_videos);

    // Instagram 후보 수집
    const ig_videos = await fetchInstagram(browser, en, ko, type, COUNTS.instagram);
    all_ig_candidates.push(...ig_videos);
    
    await delay(2000);
  }

  // 1. TikTok TOP 10 선별 및 저장
  console.log(`\n📊 TikTok TOP 10 선별 중 (총 ${all_tt_candidates.length}개 후보)...`);
  all_tt_candidates.sort((a, b) => calculateEngagementScore(b) - calculateEngagementScore(a));
  const top10_tt = all_tt_candidates.slice(0, 10);
  top10_tt.forEach(v => v.date_str = todayStr);
  await saveToDb(todayStr, top10_tt);

  // 2. Instagram TOP 10 선별 및 저장
  console.log(`\n📊 Instagram TOP 10 선별 중 (총 ${all_ig_candidates.length}개 후보)...`);
  all_ig_candidates.sort((a, b) => calculateEngagementScore(b) - calculateEngagementScore(a));
  const top10_ig = all_ig_candidates.slice(0, 10);
  top10_ig.forEach(v => v.date_str = todayStr);
  await saveToDb(todayStr, top10_ig);

  await browser.close();
  console.log("\n" + "=".repeat(60));
  console.log(`✅ 성과 기반 크롤링 완료: 플랫폼별 최신 상위 10개씩 저장되었습니다.`);
  console.log("=".repeat(60));
  
  process.exit(0);
}

main();
