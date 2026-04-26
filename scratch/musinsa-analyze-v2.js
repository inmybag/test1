const puppeteer = require('puppeteer');

async function analyze() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 2000 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  page.on('request', request => {
    const url = request.url();
    // Log any request that seems related to data fetching
    if (url.includes('musinsa.com') && (url.includes('api') || url.includes('review') || url.includes('estimate') || url.includes('v1') || url.includes('5923474'))) {
      console.log('Request:', url);
    }
  });

  page.on('response', async response => {
    const url = response.url();
    if (url.includes('musinsa.com') && (url.includes('review') || url.includes('estimate'))) {
      console.log('--- FOUND POTENTIAL REVIEW API ---');
      console.log('URL:', url);
      try {
        const text = await response.text();
        console.log('Sample:', text.substring(0, 500));
      } catch (e) {}
    }
  });

  console.log('Navigating to Musinsa...');
  await page.goto('https://www.musinsa.com/products/5923474', { waitUntil: 'networkidle2' });
  
  // Click "후기" tab if it exists
  console.log('Looking for review tab...');
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('a, button, li'));
    const reviewTab = tabs.find(t => t.innerText && t.innerText.includes('후기') && t.innerText.match(/\d/));
    if (reviewTab) {
      reviewTab.click();
      console.log('Clicked review tab');
    }
  });
  await new Promise(r => setTimeout(r, 3000));

  console.log('Scrolling...');
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 2000));
    await new Promise(r => setTimeout(r, 2000));
  }

  // Look for iframes
  const iframes = await page.frames();
  console.log('Total frames:', iframes.length);
  for (const frame of iframes) {
    console.log('Frame URL:', frame.url());
  }

  await browser.close();
}

analyze();
