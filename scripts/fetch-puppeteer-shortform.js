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
  { en: "Hera makeup", ko: "헤라", type: "Beauty" },
  { en: "Sulwhasoo skincare", ko: "설화수", type: "Beauty" },
  { en: "Romand lip", ko: "롬앤", type: "Beauty" },
  { en: "Laneige lips", ko: "라네즈", type: "Beauty" },
  { en: "Clio makeup", ko: "클리오", type: "Beauty" },
  { en: "Beauty of Joseon", ko: "조선미녀", type: "Beauty" },
  { en: "Skin1004 centella", ko: "스킨1004", type: "Beauty" },
  { en: "Medicube pore", ko: "메디큐브", type: "Beauty" },
  { en: "Korean base makeup", ko: "파운데이션 꿀팁", type: "Beauty" },
  { en: "Olive Young haul", ko: "올리브영 추천템", type: "Beauty" },
  // Household
  { en: "Downy fabric softener", ko: "다우니", type: "Household" },
  { en: "Pigeon laundry", ko: "피죤", type: "Household" },
  { en: "Aura detergent", ko: "아우라 세제", type: "Household" },
  { en: "Yuhanrox disinfect", ko: "유한락스", type: "Household" },
  { en: "laundry hack smell", ko: "빨래 쉰내 제거", type: "Household" },
  { en: "bathroom cleaning tip", ko: "화장실 청소 팁", type: "Household" },
  { en: "kitchen grease hack", ko: "주방 기름때 제거", type: "Household" },
];

const COUNTS = {
  tiktok: 3,
  instagram: 2
};

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
        takeaways: []
      };
      await client.sql`
        INSERT INTO video_analyses
        (platform, video_id, url, title, thumbnail, category, date_str,
         analysis_json, view_count, like_count, comment_count, description, comments)
        VALUES (${v.platform}, ${v.video_id}, ${v.url}, ${v.title}, ${v.thumbnail}, 
                ${v.category}, ${dateStr}, ${JSON.stringify(defaultAnalysis)}, 
                ${v.view_count || 0}, ${v.like_count || 0}, ${v.comment_count || 0}, 
                ${v.description || ''}, '[]'::jsonb)
        ON CONFLICT (video_id, date_str)
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
    const q = encodeURIComponent(`${keyword_en} tiktok viral`);
    const url = `https://www.tiktok.com/search/video?q=${q}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    
    const videos = await page.evaluate((category, count) => {
      const items = [];
      const videoCards = document.querySelectorAll('div[data-e2e="search_video-item"], a[href*="/video/"]');
      let found = 0;
      
      for (const el of videoCards) {
        if (found >= count) break;
        let aTag = el.tagName === 'A' ? el : el.querySelector('a[href*="/video/"]');
        if (!aTag) continue;
        
        const url = aTag.href;
        if (!url.includes('/video/')) continue;
        
        let video_id = url.split('/video/')[1];
        if (video_id && video_id.includes('?')) {
          video_id = video_id.split('?')[0];
        }
        
        if (items.some(i => i.video_id === video_id)) continue;
        
        // TikTok specific selectors for search page
        const titleEl = el.closest('div').querySelector('.tiktok-j2a19r-SpanText, .video-desc, .desc, div[data-e2e="search-card-video-caption"]');
        const title = titleEl ? titleEl.innerText : `TikTok 벤치마킹 - ${video_id}`;
        
        const thumbEl = el.closest('div').querySelector('img');
        const thumbnail = thumbEl ? thumbEl.src : '';
        
        items.push({
          platform: 'tiktok',
          video_id: video_id,
          url: url,
          title: title,
          thumbnail: thumbnail,
          category: category,
          view_count: 0,
          like_count: 0,
          comment_count: 0,
          description: `[TikTok 벤치마킹] 직접 크롤링 수집`
        });
        found++;
      }
      return items;
    }, category, count);
    
    console.log(`  ✅ TikTok [${keyword_ko}]: ${videos.length}개 수집 (목표: ${count}개)`);
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
    
    // Instagram tends to reject completely if loading without typical headers.
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
    });
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(5000);
    
    const currentUrl = page.url();
    if (currentUrl.includes('/login/')) {
        throw new Error("비로그인 접속 차단 (로그인 페이지로 강제 리다이렉트됨).");
    }

    const videos = await page.evaluate((category, count) => {
      const items = [];
      const links = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
      let found = 0;
      for (const a of links) {
        if (found >= count) break;
        const url = a.href;
        let type = url.includes('/reel/') ? '/reel/' : '/p/';
        let video_id = url.split(type)[1];
        if (video_id && video_id.includes('/')) {
            video_id = video_id.split('/')[0];
        }
        if (!video_id || items.some(i => i.video_id === video_id)) continue;
        
        const img = a.querySelector('img');
        const thumbnail = img ? img.src : '';
        const desc = img ? img.alt : '';
        
        items.push({
          platform: 'instagram',
          video_id: video_id,
          url: url,
          title: `Instagram Post - ${video_id}`,
          thumbnail: thumbnail,
          category: category,
          view_count: 0,
          like_count: 0,
          comment_count: 0,
          description: `[Instagram 벤치마킹] ${desc || '릴스/게시물'}`
        });
        found++;
      }
      return items;
    }, category, count);

    console.log(`  ✅ Instagram [${keyword_ko}]: ${videos.length}개 수집 (목표: ${count}개)`);
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

  let total = 0;

  for (const item of TARGET_KEYWORDS) {
    const { en, ko, type } = item;
    console.log(`\n📌 [${type}] ${ko} (${en})`);
    
    // TikTok
    const tt_videos = await fetchTikTok(browser, en, ko, type, COUNTS.tiktok);
    tt_videos.forEach(v => v.date_str = todayStr);
    await saveToDb(todayStr, tt_videos);
    total += tt_videos.length;

    // Instagram
    const ig_videos = await fetchInstagram(browser, en, ko, type, COUNTS.instagram);
    ig_videos.forEach(v => v.date_str = todayStr);
    await saveToDb(todayStr, ig_videos);
    total += ig_videos.length;
    
    await delay(3000); // delay between keywords to avoid immediate ban
  }

  await browser.close();
  console.log("\n" + "=".repeat(60));
  console.log(`✅ 브라우저 직접 크롤링 완료: 총 ${total}개 영상 수집`);
  console.log("=".repeat(60));
  
  process.exit(0);
}

main();
