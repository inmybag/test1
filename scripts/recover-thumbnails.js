const { createPool } = require('@vercel/postgres');
const puppeteer = require('puppeteer');
require('dotenv').config({ path: '.env.local' });

const pool = createPool({ connectionString: process.env.POSTGRES_URL });

async function recoverYouTube(videoId) {
  // Standard YouTube high quality thumbnail
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

async function fetchFreshThumbnail(browser, url, platform) {
  const page = await browser.newPage();
  try {
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Scroll a bit to trigger lazy loading
    await page.evaluate(() => window.scrollBy(0, 300));
    await new Promise(r => setTimeout(r, 2000));

    const thumbnail = await page.evaluate((plat) => {
      if (plat === 'tiktok') {
        const img = document.querySelector('img[src*="tiktokcdn"]');
        return img ? img.src : null;
      }
      if (plat === 'instagram') {
        const img = document.querySelector('img[src*="cdninstagram"]');
        return img ? img.src : null;
      }
      return null;
    }, platform);

    return thumbnail;
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
