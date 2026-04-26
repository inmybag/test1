const puppeteer = require('puppeteer');

async function analyze() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 2000 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  page.on('response', async response => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';
    if (contentType.includes('application/json')) {
      console.log('JSON Request:', url);
      if (url.includes('review') || url.includes('estimate') || url.includes('list')) {
        console.log('--- REVIEW DATA CANDIDATE ---');
        try {
          const text = await response.text();
          console.log('Sample:', text.substring(0, 300));
        } catch (e) {}
      }
    }
  });

  console.log('Navigating...');
  await page.goto('https://www.musinsa.com/products/5923474', { waitUntil: 'networkidle2' });
  
  console.log('Scrolling to find reviews...');
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollBy(0, 1500));
    await new Promise(r => setTimeout(r, 1500));
  }

  await browser.close();
}

analyze();
