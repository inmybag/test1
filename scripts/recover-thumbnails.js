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
    console.log(`      📸 Attempting screenshot for selector: ${selector}`);
    const element = await page.$(selector);
    if (!element) {
      console.error(`      ❌ Element not found for selector: ${selector}`);
      return null;
    }
    
    // Ensure element is visible and has size
    const box = await element.boundingBox();
    if (!box || box.width === 0 || box.height === 0) {
      console.error(`      ❌ Element has no size: ${JSON.stringify(box)}`);
      return null;
    }

    await element.scrollIntoViewIfNeeded();
    await new Promise(r => setTimeout(r, 1000));
    
    const base64 = await element.screenshot({ encoding: 'base64' });
    console.log(`      ✅ Screenshot success! (Base64 length: ${base64.length})`);
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error(`      ❌ Screenshot fatal error: ${error.message}`);
    return null;
  }
}

async function fetchFreshThumbnail(browser, url, platform) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1280, height: 1200 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log(`    🔍 Visiting: ${url}`);
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    
    if (!response || response.status() >= 400) {
      console.error(`    ⚠️ Status error: ${response ? response.status() : 'null'}`);
      return null;
    }

    // Wait a bit more for dynamic content
    await new Promise(r => setTimeout(r, 8000));
    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise(r => setTimeout(r, 2000));

    const debugInfo = await page.evaluate((plat) => {
      const imgs = Array.from(document.querySelectorAll('img'));
      const platformCdn = plat === 'tiktok' ? 'tiktokcdn' : 'cdninstagram';
      
      const stats = imgs.map((img, idx) => {
        const src = img.src || '';
        const isCdn = src.includes(platformCdn);
        const isLarge = img.width > 50 && img.height > 50;
        const score = (isCdn ? 10 : 0) + (isLarge ? 5 : 0);
        if (score > 0) {
          img.id = `debug-thumb-${idx}-${Date.now()}`;
        }
        return { 
          idx, 
          src: src.substring(0, 40) + '...', 
          w: img.width, 
          h: img.height, 
          isCdn, 
          score,
          selector: img.id ? `#${img.id}` : null
        };
      }).filter(s => s.score > 0);

      stats.sort((a, b) => b.score - a.score);
      return { total: imgs.length, filtered: stats.length, best: stats[0] || null };
    }, platform);

    console.log(`    📊 Page Summary: ${debugInfo.total} images total, ${debugInfo.filtered} candidates found.`);
    
    if (debugInfo.best && debugInfo.best.selector) {
      console.log(`    📸 Capturing element screenshot...`);
      return await captureElementAsBase64(page, debugInfo.best.selector);
    } else {
      console.warn(`    ⚠️ No thumbnail candidates found on page.`);
      // Take a full page screenshot for debug if everything fails
      const debugName = `debug_fail_${Date.now()}.png`;
      await page.screenshot({ path: debugName });
      console.log(`    🖼️ Saved failure screenshot: ${debugName}`);
      return null;
    }
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

    // Allow data:image if it's long (actual screenshot) vs short (placeholder)
    const isValidBase64 = newThumbnail && newThumbnail.startsWith('data:image') && newThumbnail.length > 1000;
    const isValidUrl = newThumbnail && !newThumbnail.startsWith('data:image');

    if (isValidBase64 || isValidUrl) {
      await pool.query('UPDATE video_analyses SET thumbnail = $1 WHERE id = $2', [newThumbnail, row.id]);
      console.log(`  ✅ Recovered: ${newThumbnail.substring(0, 50)}... (${newThumbnail.length} chars)`);
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
