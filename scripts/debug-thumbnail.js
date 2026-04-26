const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function debug(url, platform) {
  const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
  const page = await browser.newPage();
  try {
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
    
    // List all images
    const images = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src,
        className: img.className,
        alt: img.alt,
        width: img.width,
        height: img.height
      }));
    });
    
    console.log(`Found ${images.length} images.`);
    images.forEach((img, idx) => {
      if (img.src.includes('tiktokcdn') || img.src.includes('cdninstagram') || img.width > 100) {
        console.log(`[${idx}] src: ${img.src.substring(0, 50)}... class: ${img.className} size: ${img.width}x${img.height}`);
      }
    });

    const html = await page.content();
    require('fs').writeFileSync('debug_platform.html', html);
    console.log('Saved debug_platform.html');

  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
  }
}

const url = process.argv[2] || 'https://www.tiktok.com/@tymarz/video/7325208460964941061';
const platform = url.includes('tiktok') ? 'tiktok' : 'instagram';
debug(url, platform);
