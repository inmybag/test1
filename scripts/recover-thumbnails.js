const { createPool } = require('@vercel/postgres');
const puppeteer = require('puppeteer');
require('dotenv').config({ path: '.env.local' });

const pool = createPool({ connectionString: process.env.POSTGRES_URL });

async function recoverYouTube(videoId) {
  // Standard YouTube high quality thumbnail
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

async function captureElementAsBase64(page, selector) {
  try {
    const element = await page.$(selector);
    if (!element) return null;
    
    // Ensure element is visible
    await element.scrollIntoViewIfNeeded();
    await new Promise(r => setTimeout(r, 500));
    
    const base64 = await element.screenshot({ encoding: 'base64' });
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error(`      ⚠️ Screenshot failed: ${error.message}`);
    return null;
  }
}

async function fetchFreshThumbnail(browser, url, platform) {
  const page = await browser.newPage();
  try {
    // Set a larger viewport to ensure image is not clipped
    await page.setViewport({ width: 1280, height: 1200 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log(`    🔍 Visiting: ${url}`);
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
    
    if (!response || response.status() >= 400) {
      console.error(`    ⚠️ Received status ${response ? response.status() : 'null'}`);
      return null;
    }

    await new Promise(r => setTimeout(r, 6000));
    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise(r => setTimeout(r, 2000));

    const bestSelector = await page.evaluate((plat) => {
      const imgs = Array.from(document.querySelectorAll('img'));
      const platformCdn = plat === 'tiktok' ? 'tiktokcdn' : 'cdninstagram';
      
      const valid = imgs.map((img, idx) => {
        const src = img.src || '';
        const isCdn = src.includes(platformCdn);
        const isLarge = img.width > 120 && img.height > 120;
        return { idx, isCdn, isLarge, score: (isCdn ? 10 : 0) + (isLarge ? 5 : 0) };
      }).filter(v => v.score > 0);

      if (valid.length > 0) {
        valid.sort((a, b) => b.score - a.score);
        const best = imgs[valid[0].idx];
        // Give it a temporary ID to find it from node
        best.id = 'target-thumb-' + Date.now();
        return '#' + best.id;
      }
      return null;
    }, platform);

    if (bestSelector) {
      console.log(`    📸 Capturing element screenshot...`);
      return await captureElementAsBase64(page, bestSelector);
    }

    return thumbUrl;
  } catch (error) {
    console.error(`    ❌ Failed to fetch for ${url}: ${error.message}`);
    return null;
  } finally {
    await page.close();
  }
}

async function recover() {
  const isForce = process.argv.includes('--force');
  console.log(`🚀 Starting Thumbnail Recovery Process (Force Mode: ${isForce})...`);
  
  const query = isForce 
    ? `SELECT id, platform, video_id as "videoId", url, thumbnail FROM video_analyses WHERE platform IN ('tiktok', 'instagram')`
    : `SELECT id, platform, video_id as "videoId", url, thumbnail 
       FROM video_analyses 
       WHERE thumbnail LIKE 'data:image%' 
          OR thumbnail IS NULL 
          OR thumbnail = ''
          OR (platform = 'youtube' AND thumbnail NOT LIKE '%hqdefault%')`;

  const { rows } = await pool.query(query);

  if (rows.length === 0) {
    console.log('✨ No broken thumbnails found in database.');
    process.exit(0);
  }

  console.log(`🔍 Found ${rows.length} videos requiring recovery.`);
  
  let browser;
  let recoveredCount = 0;

  for (const row of rows) {
    console.log(`\n--- [${row.platform}] Recovering: ${row.videoId} ---`);
    let newThumbnail = null;

    if (row.platform === 'youtube') {
      newThumbnail = await recoverYouTube(row.videoId);
    } else {
      if (!browser) {
        browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
      }
      newThumbnail = await fetchFreshThumbnail(browser, row.url, row.platform);
    }

    if (newThumbnail && !newThumbnail.startsWith('data:image')) {
      await pool.query('UPDATE video_analyses SET thumbnail = $1 WHERE id = $2', [newThumbnail, row.id]);
      console.log(`  ✅ Recovered: ${newThumbnail.substring(0, 60)}...`);
      recoveredCount++;
    } else {
      console.log('  ⚠️ Could not recover valid thumbnail.');
    }

    // Delay to avoid being blocked
    await new Promise(r => setTimeout(r, 1000));
  }

  if (browser) await browser.close();
  console.log(`\n🎉 Recovery process complete. Recovered ${recoveredCount} thumbnails.`);
  process.exit(0);
}

recover();
